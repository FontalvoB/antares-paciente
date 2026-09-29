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
import { streamChatMessage } from "../../utils/threadApi";
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

function Harness() {
  const { chat, sendChat, sendVoiceMessage } = useApp();
  mirror.chat = chat;
  return (
    <div>
      <button type="button" onClick={() => sendChat("hola")}>
        send
      </button>
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

function renderApp() {
  return render(
    <I18nProvider>
      <AppProvider>
        <Harness />
      </AppProvider>
    </I18nProvider>,
  );
}

describe("AppContext — consolidación del streaming del asistente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("copp_access_token", "demo-access-token");
    mirror.chat = [];
    mirror.voiceResult = null;
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
});
