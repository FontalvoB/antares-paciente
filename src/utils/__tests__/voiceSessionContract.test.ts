import { afterEach, describe, expect, it, vi } from "vitest";
import { revokeVoiceSession, voiceSessionStartOptions } from "../voiceApi";

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
