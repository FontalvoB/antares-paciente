import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceOverlay } from "../VoiceOverlay";
import { consentFailure, requireLegalConsent, verifyLegalConsent, withdrawLegalConsent } from "../../utils/legalConsents";

const GATEWAY_SOCKET = window.location.origin.replace(/^http/, "ws") + "/synthetic-voice";
const mocks = vi.hoisted(() => ({
  lang: "es" as "es" | "en",
  stop: null as (() => Promise<void>) | null,
  sdkCallbacks: {} as { onDisconnect?: () => void },
  app: { voiceOpen: true, voiceMinimized: false, threadId: "thread-a", minimizeVoice: vi.fn(), openVoice: vi.fn(), closeVoice: vi.fn(), showToast: vi.fn(), sendVoiceMessage: vi.fn(), upsertVoiceMessage: vi.fn(), appendChatMessages: vi.fn(), registerVoiceSession: vi.fn(), markVoiceSessionClosed: vi.fn(), refreshChatHistory: vi.fn() },
  callbacks: {} as Record<string, (...args: any[]) => void>,
  modalDismiss: undefined as undefined | (() => void),
  eleven: {
    status: "connected", isSpeaking: false, isMuted: false,
    startSession: vi.fn(), endSession: vi.fn(), setMuted: vi.fn(), sendUserMessage: vi.fn(),
    getInputVolume: vi.fn(() => 0.2), getOutputVolume: vi.fn(() => 0.4),
  },
  speech: { supported: true, state: "listening", muted: false, transcript: "",
    startListening: vi.fn(), cancelSpeech: vi.fn(), teardown: vi.fn(), toggleMute: vi.fn() },
  session: vi.fn(),
  revoke: vi.fn().mockResolvedValue(true),
  tool: vi.fn(),
  clientTools: null as Record<string, (params: Record<string, unknown>) => Promise<string>> | null,
}));
vi.mock("../../utils/legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined), verifyLegalConsent: vi.fn().mockResolvedValue({ accepted: true }) }));
vi.mock("../../utils/apiClient", async original => ({ ...await original<object>(), apiFetch: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../context/AppContext", () => ({ useApp: () => ({ ...mocks.app, registerVoiceStop: (stop: () => Promise<void>) => { mocks.stop = stop; return () => { mocks.stop = null; }; } }) }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => (s: string) => s, useI18n: () => ({ t: (s: string) => s, lang: mocks.lang }) }));
vi.mock("../../hooks/useSpeechAssistant", () => ({ useSpeechAssistant: () => mocks.speech }));
vi.mock("../../utils/voiceApi", async original => ({
  ...await original<object>(), revokeVoiceSession: mocks.revoke,
  requestVoiceSession: mocks.session, toolCancelAppointment: mocks.tool, toolGetAvailabilitySlots: mocks.tool,
  toolGetMyRequests: mocks.tool, toolGetUpcomingAppointments: mocks.tool, toolListProfessionals: mocks.tool,
  toolListSpecialties: mocks.tool, toolRequestAppointment: mocks.tool, toolRescheduleAppointment: mocks.tool,
}));
vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children, clientTools, ...callbacks }: { children: React.ReactNode; clientTools: typeof mocks.clientTools; [key: string]: any }) => { mocks.clientTools = clientTools; mocks.callbacks = callbacks; return children; },
  useConversation: (callbacks: typeof mocks.sdkCallbacks) => { mocks.sdkCallbacks = callbacks; return mocks.eleven; },
}));
vi.mock("../VoiceOrb", () => ({ VoiceOrb: () => null }));
vi.mock("@ionic/react", async () => {
  const React = await import("react");
  return {
    IonModal: ({ children, isOpen, onDidDismiss }: { children: React.ReactNode; isOpen: boolean; onDidDismiss?: () => void }) => { mocks.modalDismiss = onDidDismiss; return isOpen ? children : null; },
    IonIcon: () => null,
    IonSpinner: () => null,
    IonButton: ({ children, onClick, disabled, "aria-label": label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; "aria-label": string }) => React.createElement("button", { onClick, disabled, "aria-label": label }, children),
    IonInput: ({ value, onIonInput, "aria-label": label }: { value: string; onIonInput: (event: { detail: { value: string } }) => void; "aria-label": string }) => React.createElement("input", {
      value, "aria-label": label, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onIonInput({ detail: { value: event.target.value } }),
    }),
  };
});

describe("VoiceOverlay: regresión de controles y degradación", () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("copp_access_token", `header.${btoa(JSON.stringify({ sub: "voice-owner-a" }))}.signature`);
    mocks.app.voiceOpen = true;
    mocks.lang = "es";
    mocks.app.voiceMinimized = false;
    mocks.eleven.isMuted = false;
    mocks.eleven.isSpeaking = false;
    mocks.eleven.status = "connected";
    mocks.eleven.endSession.mockImplementation(() => { mocks.sdkCallbacks.onDisconnect?.(); });
    mocks.speech.supported = true;
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET });
    mocks.revoke.mockReset().mockResolvedValue(true);
    vi.mocked(requireLegalConsent).mockResolvedValue(undefined);
    vi.mocked(verifyLegalConsent).mockResolvedValue({ accepted: true } as Awaited<ReturnType<typeof verifyLegalConsent>>);
    mocks.tool.mockResolvedValue("synthetic tool result");
    mocks.clientTools = null;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each([
    ["vita", "en"], ["vita", "es"], ["legacy", "en"], ["legacy", "es"],
  ] as const)("inicia %s con idioma app %s y solo permite override de language en Vita", async (runtimeMode, language) => {
    mocks.lang = language;
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET, runtimeMode, conversationId: "conversation", sessionId: "server-session", threadId: "thread-a", sessionToken: "synthetic-context", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalledWith({
      signedUrl: GATEWAY_SOCKET,
      ...(runtimeMode === "vita" ? {
        dynamicVariables: { secret__vita_session_token: "synthetic-context" },
        overrides: { agent: { language } },
      } : {}),
    }));
    expect(mocks.session).toHaveBeenCalledWith(language, "thread-a", expect.any(AbortSignal));
  });

  it("conserva el idioma enviado al backend si cambia mientras llega la credencial Vita", async () => {
    mocks.lang = "en";
    let finish!: (value: unknown) => void;
    mocks.session.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.session).toHaveBeenCalledWith("en", "thread-a", expect.any(AbortSignal)));
    mocks.lang = "es"; rerender(<VoiceOverlay />);
    await act(async () => finish({ signedUrl: GATEWAY_SOCKET, runtimeMode: "vita", conversationId: "conversation", sessionId: "server-session", threadId: "thread-a", sessionToken: "synthetic-context", expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    expect(mocks.eleven.startSession).toHaveBeenCalledExactlyOnceWith({
      signedUrl: GATEWAY_SOCKET,
      dynamicVariables: { secret__vita_session_token: "synthetic-context" },
      overrides: { agent: { language: "en" } },
    });
  });

  it("la limpieza espera el SDK y la revocación, y descarta eventos anteriores", async () => {
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET, runtimeMode: "legacy", sessionId: "server-session", threadId: "thread-a", conversationId: "linked-legacy" });
    let finishRevoke!: (value: boolean) => void;
    mocks.revoke.mockReturnValueOnce(new Promise(resolve => { finishRevoke = resolve; }));
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    const oldMessage = mocks.callbacks.onMessage;
    let stopped = false;
    let pending!: Promise<void>;
    act(() => { pending = mocks.stop!().then(() => { stopped = true; }); });
    await waitFor(() => expect(mocks.eleven.endSession).toHaveBeenCalled());
    expect(stopped).toBe(false);
    act(() => oldMessage({ role: "agent", source: "ai", message: "Late event", event_id: 10 }));
    expect(mocks.app.upsertVoiceMessage).not.toHaveBeenCalled();
    await act(async () => { finishRevoke(true); await pending; });
    expect(stopped).toBe(true); expect(mocks.speech.teardown).toHaveBeenCalled();
    expect(mocks.app.closeVoice).toHaveBeenCalled();
  });

  it("una revocación no confirmada rechaza la limpieza y puede reintentarse", async () => {
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET, runtimeMode: "legacy", sessionId: "server-session", threadId: "thread-a", conversationId: "linked-legacy" });
    mocks.revoke.mockResolvedValue(false);
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    await act(async () => { await expect(mocks.stop!()).rejects.toThrow("Voice revocation was not confirmed"); });
    mocks.revoke.mockResolvedValue(true);
    await act(async () => { await expect(mocks.stop!()).resolves.toBeUndefined(); });
  });

  it("sin evento de desconexión rechaza el cierre tras cinco segundos", async () => {
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    mocks.eleven.endSession.mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      let pending!: Promise<void>;
      act(() => { pending = mocks.stop!(); });
      const rejected = expect(pending).rejects.toThrow("Voice disconnect was not confirmed");
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); await rejected; });
    } finally { vi.useRealTimers(); }
  });

  it("drena una sesión emitida tarde antes de confirmar el cierre", async () => {
    let finish!: (value: unknown) => void;
    mocks.session.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.session).toHaveBeenCalled());
    let pending!: Promise<void>;
    act(() => { pending = mocks.stop!(); });
    expect(mocks.eleven.startSession).not.toHaveBeenCalled();
    await act(async () => {
      finish({ signedUrl: GATEWAY_SOCKET, sessionId: "late-server", threadId: "thread-a", runtimeMode: "legacy" });
      await pending;
    });
    expect(mocks.revoke).toHaveBeenCalledWith("late-server", expect.any(String));
    expect(mocks.eleven.startSession).not.toHaveBeenCalled();
  });

  it("conserva el shell CSS si WebGL falla y mantiene mute y colgar", async () => {
    const { container, rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    expect(container.querySelector(".vc-orb.is-listening")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
    fireEvent.click(screen.getByLabelText("Silenciar micrófono"));
    expect(mocks.eleven.setMuted).toHaveBeenCalledWith(true);
    mocks.eleven.isMuted = true;
    rerender(<VoiceOverlay />);
    expect(container.querySelector(".vc-orb.is-muted")).not.toBeNull();
    fireEvent.click(screen.getByLabelText("Colgar"));
    expect(mocks.app.closeVoice).toHaveBeenCalled();
    expect(mocks.app.showToast).toHaveBeenCalledWith("Llamada de voz finalizada", "ok");
  });

  it("ofrece Web Speech solo tras una elección explícita y autorización separada de voz y chat", async () => {
    mocks.session.mockResolvedValue(null);
    render(<VoiceOverlay />);
    await screen.findByText("Revisar y usar voz del dispositivo");
    expect(mocks.speech.startListening).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Revisar y usar voz del dispositivo"));
    await waitFor(() => expect(mocks.speech.startListening).toHaveBeenCalled());
    expect(requireLegalConsent).toHaveBeenCalledWith("voice", "es", expect.any(AbortSignal));
    expect(requireLegalConsent).toHaveBeenCalledWith("chat", "es", expect.any(AbortSignal));
    fireEvent.click(screen.getByLabelText("Silenciar micrófono"));
    expect(mocks.speech.toggleMute).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Colgar"));
    expect(mocks.speech.cancelSpeech).toHaveBeenCalled();
    expect(mocks.speech.teardown).toHaveBeenCalled();
  });

  it("cancelar la autorización no pide micrófono ni inicia el SDK o Web Speech", async () => {
    vi.mocked(requireLegalConsent).mockRejectedValueOnce(consentFailure("CONSENT_CANCELLED"));
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.app.closeVoice).toHaveBeenCalled());
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.eleven.startSession).not.toHaveBeenCalled();
    expect(mocks.speech.startListening).not.toHaveBeenCalled();
  });

  it("un rechazo de consentimiento al emitir signed URL no abre el fallback", async () => {
    mocks.session.mockRejectedValueOnce(consentFailure("CONSENT_DOCUMENT_UNAVAILABLE", 503));
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.app.closeVoice).toHaveBeenCalled());
    expect(mocks.speech.startListening).not.toHaveBeenCalled();
    expect(screen.queryByText("Revisar y usar voz del dispositivo")).toBeNull();
  });

  it("retirar una autorización cierra la conexión y el micrófono activos", async () => {
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    await act(async () => { await withdrawLegalConsent("own-receipt", "voice"); });
    expect(mocks.app.closeVoice).toHaveBeenCalled();
    expect(mocks.eleven.endSession).toHaveBeenCalled();
    expect(mocks.speech.teardown).toHaveBeenCalled();
  });

  it("cerrar mientras se decide no permite que una aceptación tardía abra el micrófono", async () => {
    let finish!: () => void;
    vi.mocked(requireLegalConsent).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const { rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(requireLegalConsent).toHaveBeenCalled());
    mocks.app.voiceOpen = false; rerender(<VoiceOverlay />);
    await act(async () => { finish(); await Promise.resolve(); });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.speech.startListening).not.toHaveBeenCalled();
  });

  it.each(["close", "withdraw", "account"])("una comprobación tardía tras %s no ejecuta herramientas de citas", async change => {
    const { rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    let finish!: (value: Awaited<ReturnType<typeof verifyLegalConsent>>) => void;
    vi.mocked(verifyLegalConsent).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const oldTools = mocks.clientTools!;
    const response = oldTools.request_appointment({ specialty_id: "synthetic-specialty", reason: "synthetic" });
    const refused = expect(response).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    if (change === "close") { mocks.app.voiceOpen = false; rerender(<VoiceOverlay />); }
    if (change === "withdraw") await act(async () => { await withdrawLegalConsent("own-receipt", "voice"); });
    if (change === "account") localStorage.setItem("copp_access_token", `header.${btoa(JSON.stringify({ sub: "voice-owner-b" }))}.signature`);
    await act(async () => { finish({ accepted: true } as Awaited<ReturnType<typeof verifyLegalConsent>>); });
    await refused;
    expect(mocks.tool).not.toHaveBeenCalled();
  });

  it("no devuelve datos de una herramienta al SDK si la sesión cerró mientras llegaban", async () => {
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    let finish!: (value: string) => void;
    mocks.tool.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
    const response = mocks.clientTools!.get_my_upcoming_appointments({});
    const refused = expect(response).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    await waitFor(() => expect(mocks.tool).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByLabelText("Colgar"));
    await act(async () => { finish("private result from the previous session"); });
    await refused;
    expect(verifyLegalConsent).toHaveBeenCalledTimes(1);
  });

  it("un callback del SDK anterior no puede usar una sesión de voz nueva", async () => {
    const { rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalledTimes(1));
    const oldTools = mocks.clientTools!;
    mocks.app.voiceOpen = false; rerender(<VoiceOverlay />);
    mocks.app.voiceOpen = true; rerender(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalledTimes(2));
    await expect(oldTools.request_appointment({})).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    expect(mocks.tool).not.toHaveBeenCalled();
  });

  it.each(["close", "account"])("una verificación tardía tras %s no envía texto al SDK anterior", async change => {
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    let finish!: (value: Awaited<ReturnType<typeof verifyLegalConsent>>) => void;
    vi.mocked(verifyLegalConsent).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const input = screen.getByLabelText("Escribe un mensaje…");
    fireEvent.change(input, { target: { value: "private synthetic message" } });
    fireEvent.submit(input.closest("form")!);
    if (change === "close") fireEvent.click(screen.getByLabelText("Colgar"));
    else localStorage.setItem("copp_access_token", `header.${btoa(JSON.stringify({ sub: "voice-owner-b" }))}.signature`);
    await act(async () => { finish({ accepted: true } as Awaited<ReturnType<typeof verifyLegalConsent>>); });
    expect(mocks.eleven.sendUserMessage).not.toHaveBeenCalled();
  });

  it("overlay cerrado no deja canvas montado", async () => {
    const { container, rerender } = render(<VoiceOverlay />);
    await act(async () => { await Promise.resolve(); });
    mocks.app.voiceOpen = false;
    rerender(<VoiceOverlay />);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("muestra cada frase SDK sin esperar bot, conserva IDs y no genera otro turno", async () => {
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    const payload = { message: "Hola", role: "user", source: "user", event_id: 10 };
    act(() => mocks.callbacks.onMessage(payload));
    const first = mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0];
    expect(first).toMatchObject({ role: "user", text: "Hola", channel: "voice", threadId: "thread-a" });
    act(() => mocks.callbacks.onMessage({ ...payload, message: "Hola de nuevo" }));
    expect(mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0].id).toBe(first.id);
    act(() => mocks.callbacks.onMessage({ ...payload, event_id: 11 }));
    expect(mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0].id).not.toBe(first.id);
    expect(mocks.app.sendVoiceMessage).not.toHaveBeenCalled();
  });

  it("corrige e interrumpe la misma respuesta por response_id", async () => {
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    act(() => mocks.callbacks.onMessage({ message: "Texto completo", role: "agent", source: "ai", event_id: 2, response_id: "r1" }));
    const first = mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0];
    act(() => mocks.callbacks.onAgentResponseCorrection({ original_agent_response: "Texto completo", corrected_agent_response: "Texto", event_id: 3, response_id: "r1" }));
    expect(mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0]).toMatchObject({ id: first.id, text: "Texto", delivery: "interrupted" });
    act(() => mocks.callbacks.onMessage({ message: "Texto completo", role: "agent", source: "ai", event_id: 2, response_id: "r1" }));
    expect(mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0].text).toBe("Texto");
    act(() => mocks.callbacks.onInterruption({ event_id: 4 }));
    expect(mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0].id).toBe(first.id);
  });

  it("minimizar/restaurar conserva SDK; no abre una segunda captura y colgar libera la sesión", async () => {
    const { rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalledTimes(1));
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Minimizar asistente de voz"));
    expect(mocks.app.minimizeVoice).toHaveBeenCalled();
    mocks.app.voiceMinimized = true; rerender(<VoiceOverlay />);
    expect(mocks.eleven.endSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Silenciar micrófono"));
    expect(mocks.eleven.setMuted).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByLabelText("Restaurar llamada"));
    expect(mocks.app.openVoice).not.toHaveBeenCalled();
    act(() => mocks.modalDismiss?.());
    fireEvent.click(screen.getByLabelText("Restaurar llamada"));
    expect(mocks.app.openVoice).toHaveBeenCalled();
    mocks.app.voiceMinimized = false; rerender(<VoiceOverlay />);
    expect(mocks.eleven.startSession).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("Colgar"));
    expect(mocks.eleven.endSession).toHaveBeenCalled();
  });

  it.each(["account", "session"])("rechaza mensajes/correcciones tardíos tras cambiar %s", async change => {
    const { rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalledTimes(1));
    const old = mocks.callbacks;
    if (change === "account") localStorage.setItem("copp_access_token", `header.${btoa(JSON.stringify({ sub: "other-owner" }))}.signature`);
    else {
      mocks.app.voiceOpen = false; rerender(<VoiceOverlay />);
      mocks.app.voiceOpen = true; rerender(<VoiceOverlay />);
      await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalledTimes(2));
    }
    act(() => {
      old.onMessage({ message: "private", role: "user", source: "user", event_id: 1 });
      old.onAgentResponseCorrection({ corrected_agent_response: "private", original_agent_response: "private", event_id: 1 });
    });
    expect(mocks.app.upsertVoiceMessage).not.toHaveBeenCalled();
  });

  it.each(["vita", "legacy"] as const)("abre %s vinculado y revoca con JWT original sin refrescar la cuenta nueva", async runtimeMode => {
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET, runtimeMode, conversationId: "conversation", sessionId: "server-session", threadId: "thread-a", ...(runtimeMode === "vita" ? { sessionToken: "synthetic-context", expiresAt: new Date(Date.now() + 60_000).toISOString() } : {}) });
    const originalToken = localStorage.getItem("copp_access_token");
    const { unmount } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalledWith({ signedUrl: GATEWAY_SOCKET, ...(runtimeMode === "vita" ? { dynamicVariables: { secret__vita_session_token: "synthetic-context" }, overrides: { agent: { language: "es" } } } : {}) }));
    expect(mocks.app.registerVoiceSession).toHaveBeenCalledWith("server-session", "thread-a");
    act(() => mocks.callbacks.onMessage({ message: "Mensaje sintético", role: "user", source: "user", event_id: 2 }));
    expect(mocks.app.upsertVoiceMessage.mock.calls.at(-1)![0]).toMatchObject({ voiceSessionId: "server-session", voiceRuntime: runtimeMode });
    localStorage.setItem("copp_access_token", "other-account");
    unmount();
    await act(async () => { await Promise.resolve(); });
    expect(mocks.revoke).toHaveBeenCalledWith("server-session", originalToken);
    expect(mocks.eleven.endSession).toHaveBeenCalled();
    expect(mocks.app.refreshChatHistory).not.toHaveBeenCalled();
  });

  it("legacy vinculado recarga el historial solo después del DELETE, sin reinvocar al agente", async () => {
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET, runtimeMode: "legacy", sessionId: "linked-legacy", threadId: "thread-a" });
    let finish!: (value: boolean) => void;
    mocks.revoke.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Colgar"));
    mocks.app.voiceOpen = false; rerender(<VoiceOverlay />);
    expect(mocks.app.markVoiceSessionClosed).toHaveBeenCalledWith("linked-legacy", "thread-a");
    expect(mocks.app.refreshChatHistory).not.toHaveBeenCalled();
    await act(async () => finish(true));
    expect(mocks.app.refreshChatHistory).toHaveBeenCalledWith("thread-a");
    expect(mocks.app.sendVoiceMessage).not.toHaveBeenCalled();
    expect(mocks.eleven.sendUserMessage).not.toHaveBeenCalled();
  });

  it("legacy antiguo sin vínculo no registra sesión ni intenta importar al cerrar", async () => {
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.eleven.startSession).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Colgar"));
    expect(mocks.app.registerVoiceSession).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.app.refreshChatHistory).not.toHaveBeenCalled();
  });

  it("legacy con sessionId sin hilo falla cerrado antes de conectar", async () => {
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET, runtimeMode: "legacy", sessionId: "incomplete" });
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.app.closeVoice).toHaveBeenCalled());
    expect(mocks.eleven.startSession).not.toHaveBeenCalled();
    expect(mocks.app.registerVoiceSession).not.toHaveBeenCalled();
  });

  it("modo Vita incompleto no abre SDK ni fallback y revoca la sesión recibida", async () => {
    mocks.session.mockResolvedValue({ signedUrl: GATEWAY_SOCKET, runtimeMode: "vita", sessionId: "server-session" });
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.app.closeVoice).toHaveBeenCalled());
    expect(mocks.eleven.startSession).not.toHaveBeenCalled();
    expect(mocks.speech.startListening).not.toHaveBeenCalled();
    expect(mocks.revoke).toHaveBeenCalledWith("server-session", expect.any(String));
  });
});
