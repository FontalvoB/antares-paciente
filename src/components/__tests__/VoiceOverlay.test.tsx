import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceOverlay } from "../VoiceOverlay";
import { consentFailure, requireLegalConsent, verifyLegalConsent, withdrawLegalConsent } from "../../utils/legalConsents";

const mocks = vi.hoisted(() => ({
  app: { voiceOpen: true, closeVoice: vi.fn(), showToast: vi.fn(), sendVoiceMessage: vi.fn(), appendChatMessages: vi.fn() },
  eleven: {
    status: "connected", isSpeaking: false, isMuted: false,
    startSession: vi.fn(), endSession: vi.fn(), setMuted: vi.fn(), sendUserMessage: vi.fn(),
    getInputVolume: vi.fn(() => 0.2), getOutputVolume: vi.fn(() => 0.4),
  },
  speech: { supported: true, state: "listening", muted: false, transcript: "",
    startListening: vi.fn(), cancelSpeech: vi.fn(), teardown: vi.fn(), toggleMute: vi.fn() },
  session: vi.fn(),
  tool: vi.fn(),
  clientTools: null as Record<string, (params: Record<string, unknown>) => Promise<string>> | null,
}));
vi.mock("../../utils/legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined), verifyLegalConsent: vi.fn().mockResolvedValue({ accepted: true }) }));
vi.mock("../../utils/apiClient", async original => ({ ...await original<object>(), apiFetch: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../context/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => (s: string) => s, useI18n: () => ({ t: (s: string) => s, lang: "es" }) }));
vi.mock("../../hooks/useSpeechAssistant", () => ({ useSpeechAssistant: () => mocks.speech }));
vi.mock("../../utils/voiceApi", () => ({
  requestVoiceSession: mocks.session, toolCancelAppointment: mocks.tool, toolGetAvailabilitySlots: mocks.tool,
  toolGetMyRequests: mocks.tool, toolGetUpcomingAppointments: mocks.tool, toolListProfessionals: mocks.tool,
  toolListSpecialties: mocks.tool, toolRequestAppointment: mocks.tool, toolRescheduleAppointment: mocks.tool,
}));
vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children, clientTools }: { children: React.ReactNode; clientTools: typeof mocks.clientTools }) => { mocks.clientTools = clientTools; return children; },
  useConversation: () => mocks.eleven,
}));
vi.mock("../VoiceOrb", () => ({ VoiceOrb: () => null }));
vi.mock("@ionic/react", async () => {
  const React = await import("react");
  return {
    IonModal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => isOpen ? children : null,
    IonIcon: () => null,
    IonSpinner: () => null,
    IonButton: ({ children, onClick, "aria-label": label }: { children: React.ReactNode; onClick: () => void; "aria-label": string }) => React.createElement("button", { onClick, "aria-label": label }, children),
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
    mocks.eleven.isMuted = false;
    mocks.eleven.isSpeaking = false;
    mocks.eleven.status = "connected";
    mocks.speech.supported = true;
    mocks.session.mockResolvedValue({ signedUrl: "wss://example.invalid" });
    vi.mocked(requireLegalConsent).mockResolvedValue(undefined);
    vi.mocked(verifyLegalConsent).mockResolvedValue({ accepted: true } as Awaited<ReturnType<typeof verifyLegalConsent>>);
    mocks.tool.mockResolvedValue("synthetic tool result");
    mocks.clientTools = null;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
});
