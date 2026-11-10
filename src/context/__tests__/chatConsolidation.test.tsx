import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import { AppProvider, useApp } from "../AppContext";
import { I18nProvider } from "../../i18n/I18nContext";
import { sendChatMessage, streamChatMessage } from "../../utils/threadApi";
import { consentFailure, requireLegalConsent } from "../../utils/legalConsents";
import type { ChatMessage } from "../../types";

/**
 * REQ-AG-01 (change agente-asistente-citas): el streaming emite pasadas
 * duplicadas alrededor de tool-calls; el turno final DEBE pintar la
 * respuesta canónica del evento `done` (`answer`) y jamás la concatenación
 * de pasadas. REQ-AG-02: la sugerencia `cta_text` viaja como CTA del
 * mensaje. D4 (voz): `sendVoiceMessage` retorna el mensaje consolidado.
 */

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  sendChatMessage: vi.fn(),
  streamChatMessage: vi.fn(),
}));
vi.mock("../../utils/legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../utils/authApi", () => ({
  restoreSession: vi
    .fn()
    .mockResolvedValue({ accessToken: "demo-access-token" }),
  getMe: vi.fn().mockResolvedValue({
    id: "10247381",
    email: "maria.gonzalez@email.com",
    firstName: "María",
    lastName: "González",
  }),
  getAccessToken: vi.fn(() => "demo-access-token"),
  isAccessTokenExpired: vi.fn(() => false),
  logoutUser: vi.fn(),
  onSessionInvalid: vi.fn(() => () => {}),
}));

vi.mock("../../utils/appointmentsApi", () => ({
  hasRealSession: () => true,
  fetchMyAppointments: vi.fn().mockResolvedValue([]),
  fetchMyRequests: vi.fn().mockResolvedValue([]),
  fetchMyContext: vi.fn().mockResolvedValue(null),
  fetchOrganizationsTree: vi.fn().mockResolvedValue([]),
  fetchProfessionalsCatalog: vi.fn().mockResolvedValue([]),
  cancelAppointment: vi.fn(),
  createRequest: vi.fn(),
}));

// Espejo del estado del chat para aserciones sin acoplarse al DOM interno.
const mirror = vi.hoisted(() => ({
  chat: [] as ChatMessage[],
  voiceResult: null as ChatMessage | null,
}));

function Harness({ message = "hola" }: { message?: string }) {
  const { chat, sendChat, sendVoiceMessage, backToLogin } = useApp();
  mirror.chat = chat;
  return (
    <div>
      <button type="button" onClick={() => sendChat(message)}>
        send
      </button>
      <button type="button" onClick={backToLogin}>logout</button>
      <button
        type="button"
        onClick={() => {
          void sendVoiceMessage("hola por voz").then((m) => {
            mirror.voiceResult = m;
          });
        }}
      >
        voice
      </button>
      <span data-testid="last-bot">
        {[...chat].reverse().find((m) => m.role === "bot")?.text ?? ""}
      </span>
      <span data-testid="has-cta">
        {[...chat].reverse().find((m) => m.role === "bot")?.cta ? "yes" : "no"}
      </span>
    </div>
  );
}

function renderApp(message?: string) {
  return render(
    <I18nProvider>
      <AppProvider>
        <Harness message={message} />
      </AppProvider>
    </I18nProvider>,
  );
}

describe("AppContext — consolidación del streaming del asistente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(streamChatMessage).mockReset();
    vi.mocked(sendChatMessage).mockReset();
    localStorage.clear();
    localStorage.setItem("copp_access_token", "demo-access-token");
    mirror.chat = [];
    mirror.voiceResult = null;
    vi.mocked(requireLegalConsent).mockResolvedValue(undefined);
  });

  it("sobreescribe el mensaje con la respuesta canónica del done (sin pasadas concatenadas)", async () => {
    // El stream pinta dos pasadas concatenadas (lo que hoy produce el bug):
    // el turno final debe quedar EXACTAMENTE con la respuesta canónica.
    vi.mocked(streamChatMessage).mockResolvedValueOnce({
      reply: "Puedo ayudarte con eso. Puedo ayudarte con eso.",
      answer: "Puedo ayudarte con eso.",
      threadId: "proactive-10247381",
      suggestions: null,
    });

    renderApp();
    act(() => {
      fireEvent.click(screen.getByText("send"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("last-bot").textContent).toBe(
        "Puedo ayudarte con eso.",
      );
    });
  });

  it("sin `answer` (backend anterior) pinta la respuesta acumulada del stream", async () => {
    vi.mocked(streamChatMessage).mockResolvedValueOnce({
      reply: "Hola María",
      threadId: "proactive-10247381",
      suggestions: null,
    });

    renderApp();
    act(() => {
      fireEvent.click(screen.getByText("send"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("last-bot").textContent).toBe("Hola María");
    });
  });

  it("asigna la sugerencia appointment como CTA del mensaje (normalizada por threadApi)", async () => {
    vi.mocked(streamChatMessage).mockResolvedValueOnce({
      reply: "Agendemos.",
      threadId: "proactive-10247381",
      suggestions: [{ type: "appointment", ctaText: "Agenda tu cita aquí" }],
    });

    renderApp();
    act(() => {
      fireEvent.click(screen.getByText("send"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("has-cta").textContent).toBe("yes");
    });
  });

  it("sendVoiceMessage retorna el mensaje del bot consolidado (voz D4)", async () => {
    vi.mocked(streamChatMessage).mockResolvedValueOnce({
      reply: "fragments",
      answer: "Tu plan está listo.",
      threadId: "proactive-10247381",
      suggestions: null,
    });

    renderApp();
    act(() => {
      fireEvent.click(screen.getByText("voice"));
    });

    await waitFor(() => {
      expect(mirror.voiceResult?.text).toBe("Tu plan está listo.");
    });
  });

  it("no hace streaming ni POST si el paciente cancela la autorización", async () => {
    vi.mocked(requireLegalConsent).mockRejectedValueOnce(consentFailure("CONSENT_CANCELLED"));
    renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(requireLegalConsent).toHaveBeenCalledWith("chat", "es"));
    expect(streamChatMessage).not.toHaveBeenCalled();
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it.each(["CONSENT_REQUIRED", "CONSENT_DOCUMENT_UNAVAILABLE"])("no reintenta chat bloqueante tras %s del stream", async code => {
    vi.mocked(streamChatMessage).mockRejectedValueOnce(consentFailure(code, code === "CONSENT_REQUIRED" ? 403 : 503));
    renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(streamChatMessage).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(mirror.chat.filter(message => message.role === "bot" && message.id !== "welcome")).toHaveLength(0);
  });

  it.each(["es", "en"])("un fallo no inventa síntomas, progreso ni citas (%s)", async language => {
    localStorage.setItem("antares_lang", language);
    vi.mocked(streamChatMessage).mockRejectedValue(new Error("Network unavailable"));
    vi.mocked(sendChatMessage).mockRejectedValue(new Error("Network unavailable"));
    const message = "Me duele el pecho; quiero ver mi progreso y agendar una cita";
    renderApp(message);
    fireEvent.click(screen.getByText("send"));
    const expected = language === "en"
      ? "The assistant is unavailable right now. Please try again in a few minutes."
      : "El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.";
    await waitFor(() => expect(screen.getByTestId("last-bot").textContent).toBe(expected));
    expect(mirror.chat.filter(m => m.role === "user").map(m => m.text)).toEqual([message]);
    const replies = mirror.chat.filter(m => m.role !== "user");
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ role: "bot", kind: "service-error" });
    expect(replies[0].executionId).toBeUndefined();
    expect(replies[0].cta).toBeUndefined();
    expect(replies[0].text).not.toMatch(/HbA1c|Carlos|65 kg|alarma/);
  });

  it("usa una respuesta real bloqueante cuando el stream falla antes de emitir tokens", async () => {
    vi.mocked(streamChatMessage).mockRejectedValueOnce(new Error("Stream unavailable"));
    vi.mocked(sendChatMessage).mockResolvedValueOnce({
      reply: "Consulta las instrucciones de tu plan aprobado.",
      threadId: "proactive-10247381",
      executionId: "real-execution",
    });
    renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByTestId("last-bot").textContent).toBe("Consulta las instrucciones de tu plan aprobado."));
    expect(mirror.chat.find(m => m.role === "bot")?.executionId).toBe("real-execution");
    expect(mirror.chat.some(m => m.kind === "service-error")).toBe(false);
  });

  it("retira una respuesta parcial interrumpida sin repetir herramientas automáticamente", async () => {
    vi.mocked(streamChatMessage).mockImplementationOnce(async (_text, _thread, callbacks) => {
      callbacks?.onToken?.("Tu presión significa que debes");
      throw new Error("Stream interrupted");
    });
    renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(mirror.chat.some(m => m.kind === "service-error")).toBe(true));
    expect(mirror.chat.some(m => m.text.includes("Tu presión significa"))).toBe(false);
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("una respuesta vacía termina como indisponibilidad, no como burbuja vacía", async () => {
    vi.mocked(streamChatMessage).mockResolvedValueOnce({ reply: " ", threadId: "thread" });
    vi.mocked(sendChatMessage).mockResolvedValueOnce({ reply: "", threadId: "thread" });
    renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(mirror.chat.some(m => m.kind === "service-error")).toBe(true));
    expect(mirror.chat.filter(m => m.role === "bot").every(m => m.text.trim().length > 0)).toBe(true);
  });

  it("la vía de voz devuelve el mismo aviso honesto si ambos transportes fallan", async () => {
    vi.mocked(streamChatMessage).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error("Offline"));
    renderApp(); fireEvent.click(screen.getByText("voice"));
    await waitFor(() => expect(mirror.voiceResult?.kind).toBe("service-error"));
    expect(mirror.voiceResult?.text).toBe("El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.");
  });

  it("un fallo tardío no inserta avisos en otra sesión", async () => {
    let rejectBlocking!: (error: Error) => void;
    vi.mocked(streamChatMessage).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(sendChatMessage).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectBlocking = reject; }));
    renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("logout"));
    await act(async () => { rejectBlocking(new Error("Offline")); });
    expect(mirror.chat.some(m => m.kind === "service-error")).toBe(false);
  });
});
