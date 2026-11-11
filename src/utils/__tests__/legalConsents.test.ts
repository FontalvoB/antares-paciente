import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetch: vi.fn(), token: vi.fn(), currentToken: "test-token" }));
vi.mock("../apiClient", async original => ({ ...await original<object>(), apiFetch: api.fetch }));
vi.mock("../authApi", async original => ({ ...await original<object>(), ensureFreshAccessToken: api.token, getAccessToken: () => api.currentToken }));
import {
  acceptLegalConsent, onLegalConsentChange, registerLegalConsentPrompt, requireLegalConsent,
  verifyLegalConsent, withdrawLegalConsent, type LegalConsentRequirement, type LegalConsentStatus,
} from "../legalConsents";
import { analyzeFoodImage } from "../foodAiApi";
import { requestVoiceSession } from "../voiceApi";
import { sendChatMessage, streamChatMessage, uploadLabExam } from "../threadApi";
import { generateProfileGuidance } from "../../services/assessments/profile-analysis-service";

const requirement = (patch: Partial<LegalConsentRequirement> = {}): LegalConsentRequirement => ({
  scope: "food", available: true, accepted: true, disclosureId: "a".repeat(64),
  providers: ["Synthetic processor"], receiptId: "receipt", acceptedAt: "2026-01-01T00:00:00Z",
  documents: [{ code: "synthetic", versionId: "version-1", version: "1", title: "Test document", content: "Synthetic test text", locale: "es", publishedAt: "2026-01-01T00:00:00Z" }],
  ...patch,
});
const status = (scope = requirement()): LegalConsentStatus => ({ locale: "es", scopes: [scope] });
const json = (value: unknown, code = 200) => new Response(JSON.stringify(value), { status: code, headers: { "Content-Type": "application/json" } });
let unregister: (() => void) | undefined;

beforeEach(() => { api.currentToken = "test-token"; api.fetch.mockReset(); api.token.mockResolvedValue("fresh-token"); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { unregister?.(); unregister = undefined; vi.unstubAllGlobals(); });

describe("approved-document consent boundary", () => {
  it("restores feature access without prompting or recording acceptance when review enforcement is off", async () => {
    vi.stubEnv("VITE_ENFORCE_LEGAL_CONSENTS", "false");
    const decide = vi.fn();
    unregister = registerLegalConsentPrompt(decide);
    try {
      await requireLegalConsent("food", "es");
      await requireLegalConsent("voice", "en");
      await requireLegalConsent("program", "es");
      expect(await verifyLegalConsent("voice", "en")).toBeNull();
      expect(decide).not.toHaveBeenCalled();
      expect(api.fetch).not.toHaveBeenCalled();
      const cancelled = new AbortController(); cancelled.abort();
      await expect(requireLegalConsent("food", "es", cancelled.signal)).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    } finally { vi.unstubAllEnvs(); }
  });

  it("unavailable documents fail closed before an upload", async () => {
    api.fetch.mockResolvedValue(status(requirement({ available: false, accepted: false, documents: [] })));
    await expect(analyzeFoodImage(new Blob(["private image"]), "meal.jpg")).rejects.toMatchObject({ code: "CONSENT_DOCUMENT_UNAVAILABLE", status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("consent-check network failure stays typed and cannot initiate a provider retry", async () => {
    api.fetch.mockRejectedValue(new TypeError("network unavailable"));
    await expect(streamChatMessage("synthetic", "thread")).rejects.toMatchObject({ code: "CONSENT_CHECK_FAILED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancel never uploads a photo or lab file, starts voice, or posts chat", async () => {
    const decide = vi.fn().mockResolvedValue(false);
    unregister = registerLegalConsentPrompt(decide);
    const file = new File(["private"], "lab.pdf", { type: "application/pdf" });
    const actions = [analyzeFoodImage(file, "meal.jpg"), uploadLabExam(file), requestVoiceSession("es"), streamChatMessage("private message", "thread")];
    for (const action of actions) await expect(action).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    expect(decide.mock.calls.map(call => call[0]).sort()).toEqual(["chat", "food", "lab", "voice"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("authenticates FoodAI with the refreshed token only after authorization", async () => {
    api.fetch.mockResolvedValue(status());
    vi.mocked(fetch).mockResolvedValue(json({ foods: [], analysisId: "synthetic" }));
    await analyzeFoodImage(new Blob(["synthetic image"]), "meal.jpg");
    expect(api.token).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/foodai/analyze"), expect.objectContaining({ headers: { Authorization: "Bearer fresh-token" }, body: expect.any(FormData) }));
  });

  it("chat consent does not authorize assessment or plan AI", async () => {
    api.fetch.mockResolvedValue(status(requirement({ scope: "chat" })));
    await expect(generateProfileGuidance("es")).rejects.toMatchObject({ code: "CONSENT_DOCUMENT_UNAVAILABLE" });
    expect(api.fetch).toHaveBeenCalledTimes(1);
    expect(api.fetch.mock.calls[0][0]).toContain("/legal-consents?locale=es");
  });

  it("does not substitute Spanish legal text for missing approved English text", async () => {
    api.fetch.mockResolvedValue(status());
    await expect(requireLegalConsent("food", "en")).rejects.toMatchObject({ code: "CONSENT_DOCUMENT_UNAVAILABLE" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["CONSENT_REQUIRED", "CONSENT_DOCUMENT_UNAVAILABLE"])("keeps typed %s on voice failures instead of returning a fallback", async code => {
    api.fetch.mockResolvedValue(status(requirement({ scope: "voice" })));
    vi.mocked(fetch).mockResolvedValue(json({ code, scope: "voice" }, code === "CONSENT_REQUIRED" ? 403 : 503));
    await expect(requestVoiceSession("es")).rejects.toMatchObject({ code });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves a backend stream refusal for the caller to stop fallback", async () => {
    api.fetch.mockResolvedValue(status(requirement({ scope: "chat" })));
    vi.mocked(fetch).mockResolvedValue(json({ code: "CONSENT_REQUIRED", scope: "chat" }, 403));
    await expect(streamChatMessage("synthetic", "thread")).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["withdrawn", "document", "providers"])("requires a fresh matching GET after POST when %s changed", async changed => {
    const original = requirement({ accepted: false, receiptId: null });
    const current = requirement(changed === "withdrawn" ? { accepted: false, receiptId: null }
      : changed === "providers" ? { disclosureId: "b".repeat(64) }
      : { documents: [{ ...original.documents[0], versionId: "version-2" }] });
    api.fetch.mockResolvedValueOnce({ id: "historical" }).mockResolvedValueOnce(status(current));
    await expect(acceptLegalConsent(original, "es", "request-key")).rejects.toMatchObject({ code: "DOCUMENT_VERSION_CHANGED" });
    expect(api.fetch.mock.calls[1][0]).toBe("/api/v1/me/legal-consents?locale=es");
  });

  it("accepts only the exact displayed version/disclosure and reuses the deliberate request key", async () => {
    const displayed = requirement({ accepted: false });
    api.fetch.mockResolvedValueOnce({ id: "receipt" }).mockResolvedValueOnce(status());
    await expect(acceptLegalConsent(displayed, "es", "same-request-key")).resolves.toMatchObject({ scopes: [{ accepted: true }] });
    expect(api.fetch.mock.calls[0]).toEqual(["/api/v1/me/legal-consents/acceptances", expect.objectContaining({ method: "POST", expectedUserId: null, body: {
      scope: "food", versionId: "version-1", locale: "es", disclosureId: "a".repeat(64), idempotencyKey: "same-request-key",
    } })]);
  });

  it("withdraws the own receipt, stops scope listeners, and cannot reuse the old authorization", async () => {
    const changed = vi.fn(); const stop = onLegalConsentChange(changed);
    api.fetch.mockResolvedValueOnce(undefined).mockResolvedValueOnce(status(requirement({ accepted: false, receiptId: null })));
    await withdrawLegalConsent("own-receipt", "food");
    expect(api.fetch).toHaveBeenCalledWith("/api/v1/me/legal-consents/acceptances/own-receipt", expect.objectContaining({ method: "DELETE", expectedUserId: null }));
    expect(changed).toHaveBeenCalledWith("food");
    await expect(requireLegalConsent("food", "es")).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    stop();
  });

  it("an acceptance cannot confirm or continue as a different account after POST", async () => {
    api.currentToken = `header.${btoa(JSON.stringify({ sub: "owner-a" }))}.signature`;
    api.fetch.mockImplementationOnce(async () => {
      api.currentToken = `header.${btoa(JSON.stringify({ sub: "owner-b" }))}.signature`;
      return { id: "old-owner-receipt" };
    });
    await expect(acceptLegalConsent(requirement(), "es", "request-key")).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    expect(api.fetch).toHaveBeenCalledTimes(1);
    expect(api.fetch.mock.calls[0][1].expectedUserId).toBe("owner-a");
  });

  it("raw chat, lab and voice stop if ownership changes during authorization", async () => {
    const ownerA = `header.${btoa(JSON.stringify({ sub: "owner-a" }))}.signature`;
    const ownerB = `header.${btoa(JSON.stringify({ sub: "owner-b" }))}.signature`;
    unregister = registerLegalConsentPrompt(async () => { api.currentToken = ownerB; return true; });
    const actions = [() => sendChatMessage("synthetic", "thread"), () => streamChatMessage("synthetic", "thread"),
      () => uploadLabExam(new File(["private"], "lab.pdf")), () => requestVoiceSession("es")];
    for (const action of actions) {
      api.currentToken = ownerA;
      await expect(action()).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
