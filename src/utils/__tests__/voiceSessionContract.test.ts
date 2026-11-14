import { afterEach, describe, expect, it, vi } from "vitest";
import { linkedVoiceSessionId, requestVoiceSession, revokeVoiceSession, voiceSessionStartOptions } from "../voiceApi";
vi.mock("../legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined) }));

describe("contrato de sesión Vita", () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
  const session = { runtimeMode: "vita" as const, signedUrl: "wss://synthetic.invalid", agentId: "agent", conversationId: "conversation", threadId: "thread", sessionId: "session", sessionToken: "opaque-synthetic", expiresAt: new Date(Date.now() + 60_000).toISOString() };
  it("solo entrega el token reducido como variable secreta en modo vita", () => {
    expect(voiceSessionStartOptions(session, "thread")).toEqual({ signedUrl: session.signedUrl, dynamicVariables: { secret__vita_session_token: "opaque-synthetic" } });
    expect(voiceSessionStartOptions({ ...session, runtimeMode: "legacy" }, "thread")).toEqual({ signedUrl: session.signedUrl });
    expect(voiceSessionStartOptions({ signedUrl: session.signedUrl, agentId: "legacy" }, "thread")).toEqual({ signedUrl: session.signedUrl });
  });
  it.each(["threadId", "sessionId", "sessionToken", "expiresAt", "conversationId"])("falla cerrado si falta %s", key => {
    expect(() => voiceSessionStartOptions({ ...session, [key]: undefined }, "thread")).toThrow();
  });
  it("rechaza expiración y cambio del hilo firmado", () => {
    expect(() => voiceSessionStartOptions({ ...session, expiresAt: new Date(0).toISOString() }, "thread")).toThrow();
    expect(() => voiceSessionStartOptions(session, "another-thread")).toThrow();
  });
  it("anuncia supportsVitaVoice sin enviar identidad ni transcript", async () => {
    localStorage.setItem("copp_access_token", `header.${btoa(JSON.stringify({ sub: "owner-a" }))}.signature`);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(session), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await requestVoiceSession("es", "thread")).toMatchObject({ runtimeMode: "vita" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ supportsVitaVoice: true, language: "es", threadId: "thread" });
  });
  it.each([undefined, "legacy"] as const)("admite legacy vinculado con modo %s sin transmitir token al SDK", runtimeMode => {
    const linked = { signedUrl: session.signedUrl, agentId: "legacy", runtimeMode, sessionId: "linked-id", threadId: "thread" };
    expect(linkedVoiceSessionId(linked, "thread")).toBe("linked-id");
    expect(voiceSessionStartOptions(linked, "thread")).toEqual({ signedUrl: session.signedUrl });
  });
  it("legacy sin metadatos o con solo hilo informativo continúa RAM", () => {
    const old = { signedUrl: session.signedUrl, agentId: "legacy" };
    expect(linkedVoiceSessionId(old, "thread")).toBeUndefined();
    expect(linkedVoiceSessionId({ ...old, threadId: "thread" }, "thread")).toBeUndefined();
    expect(voiceSessionStartOptions(old, "thread")).toEqual({ signedUrl: session.signedUrl });
  });
  it.each([{ sessionId: "id" }, { sessionId: "id", threadId: "another" }, { sessionId: "", threadId: "thread" }])("rechaza vínculo legacy incompleto o contradictorio: %j", binding => {
    expect(() => voiceSessionStartOptions({ signedUrl: session.signedUrl, agentId: "legacy", runtimeMode: "legacy", ...binding }, "thread")).toThrow();
  });
  it("DELETE conserva JWT original tras cambiar cuenta y no refresca con la cuenta nueva", async () => {
    localStorage.setItem("copp_access_token", "new-account-token");
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    expect(await revokeVoiceSession("session-id", "original-owner-token")).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toContain("/api/v1/chat/voice/session/session-id");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "DELETE", headers: { Authorization: "Bearer original-owner-token" } });
    expect(await revokeVoiceSession("session-id", null)).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
