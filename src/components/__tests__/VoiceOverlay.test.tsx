import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceOverlay } from "../VoiceOverlay";

const mocks = vi.hoisted(() => ({
  app: { voiceOpen: true, closeVoice: vi.fn(), showToast: vi.fn(), sendVoiceMessage: vi.fn(), appendChatMessages: vi.fn() },
  eleven: {
    status: "connected", isSpeaking: false, isMuted: false,
    startSession: vi.fn(), setMuted: vi.fn(), sendUserMessage: vi.fn(),
    getInputVolume: vi.fn(() => 0.2), getOutputVolume: vi.fn(() => 0.4),
  },
  speech: { supported: true, state: "listening", muted: false, transcript: "",
    startListening: vi.fn(), cancelSpeech: vi.fn(), teardown: vi.fn(), toggleMute: vi.fn() },
  session: vi.fn(),
}));

vi.mock("../../context/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => (s: string) => s, useI18n: () => ({ t: (s: string) => s, lang: "es" }) }));
vi.mock("../../hooks/useSpeechAssistant", () => ({ useSpeechAssistant: () => mocks.speech }));
vi.mock("../../utils/voiceApi", () => ({ requestVoiceSession: mocks.session }));
vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: React.ReactNode }) => children,
  useConversation: () => mocks.eleven,
}));
vi.mock("../VoiceOrb", () => ({ VoiceOrb: () => null }));
vi.mock("@ionic/react", async () => {
  const React = await import("react");
  return {
    IonModal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => isOpen ? children : null,
    IonIcon: () => null,
    IonButton: ({ children, onClick, "aria-label": label }: { children: React.ReactNode; onClick: () => void; "aria-label": string }) => React.createElement("button", { onClick, "aria-label": label }, children),
    IonInput: () => null,
  };
});

describe("VoiceOverlay: regresión de controles y degradación", () => {
  beforeEach(() => {
    mocks.app.voiceOpen = true;
    mocks.eleven.isMuted = false;
    mocks.eleven.isSpeaking = false;
    mocks.eleven.status = "connected";
    mocks.speech.supported = true;
    mocks.session.mockResolvedValue({ signedUrl: "wss://example.invalid" });
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

  it("degrada a Web Speech sin cambiar los controles", async () => {
    mocks.session.mockResolvedValue(null);
    render(<VoiceOverlay />);
    await waitFor(() => expect(mocks.speech.startListening).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Silenciar micrófono"));
    expect(mocks.speech.toggleMute).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Colgar"));
    expect(mocks.speech.cancelSpeech).toHaveBeenCalled();
    expect(mocks.speech.teardown).toHaveBeenCalled();
  });

  it("overlay cerrado no deja canvas montado", async () => {
    const { container, rerender } = render(<VoiceOverlay />);
    await act(async () => { await Promise.resolve(); });
    mocks.app.voiceOpen = false;
    rerender(<VoiceOverlay />);
    expect(container.querySelector("canvas")).toBeNull();
  });
});
