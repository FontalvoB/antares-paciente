import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import { AppProvider, useApp } from "../AppContext";
import { I18nProvider } from "../../i18n/I18nContext";
import { fetchThreadState, sendChatMessage, streamChatMessage } from "../../utils/threadApi";
import { ChatPage } from "../../pages/ChatPage";
import { sendChatFeedback } from "../../services/chat/chat-service";
import { consentFailure, requireLegalConsent } from "../../utils/legalConsents";
import type { ChatMessage } from "../../types";
import { voiceMessage } from "../../utils/voiceMessages";

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
vi.mock("../../services/chat/chat-service", async original => ({ ...await original<object>(), sendChatFeedback: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("../../components/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
// La prueba integra contexto/página/feedback reales; los controles headless evitan
// errores de CSS de Stencil en happy-dom, sin sustituir sus handlers de negocio.
vi.mock("@ionic/react", async original => ({
  ...await original<object>(),
  IonButton: ({ children, onClick, disabled, "aria-label": label }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean; "aria-label"?: string }>) => <button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
  IonAvatar: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  IonBadge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  IonIcon: () => null, IonSpinner: () => null, IonTextarea: () => null, IonActionSheet: () => null,
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
  fetchMyAppointments: vi.fn().mockResolvedValue({ items: [] }),
  fetchMyRequests: vi.fn().mockResolvedValue([]),
  fetchMyContext: vi.fn().mockResolvedValue({ patient: null }),
  fetchOrganizationsTree: vi.fn().mockResolvedValue([]),
  fetchProfessionalsCatalog: vi.fn().mockResolvedValue([]),
  fetchSpecialties: vi.fn().mockResolvedValue([]),
  cancelAppointment: vi.fn(),
  createRequest: vi.fn(),
}));

vi.mock("../../utils/patientProfileApi", () => ({ fetchMyPatientProfile: vi.fn().mockRejectedValue(new Error("fixture without profile")), toUserProfile: vi.fn() }));

// Espejo del estado del chat para aserciones sin acoplarse al DOM interno.
const mirror = vi.hoisted(() => ({
  chat: [] as ChatMessage[],
  voiceResult: null as ChatMessage | null,
  app: null as ReturnType<typeof useApp> | null,
}));

function Harness({ message = "hola", withChat = false }: { message?: string; withChat?: boolean }) {
  const [chatOpen, setChatOpen] = useState(withChat);
  const app = useApp(); mirror.app = app;
  const { chat, sendChat, sendVoiceMessage, backToLogin, cancelChat, retryChat, authLoading } = app;
  mirror.chat = chat;
  return (
    <div>
      <span data-testid="auth-loading">{String(authLoading)}</span>
      <button type="button" onClick={() => sendChat(message)}>
        send
      </button>
      <button type="button" onClick={() => setChatOpen(open => !open)}>toggle chat</button>
      {chatOpen && <ChatPage />}
      <button type="button" onClick={backToLogin}>logout</button>
      <button type="button" onClick={cancelChat}>cancel</button>
      <button type="button" onClick={retryChat}>retry</button>
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

async function renderApp(message?: string, withChat = false) {
  const view = render(
    <I18nProvider>
      <AppProvider>
        <Harness message={message} withChat={withChat} />
      </AppProvider>
    </I18nProvider>,
  );
  await waitFor(() => {
    expect(screen.getByTestId("auth-loading").textContent).toBe("false");
    expect(mirror.app?.user.id).toBe("10247381");
    expect(mirror.app?.threadId).toBe("proactive-10247381");
  });
  return view;
}

describe("AppContext — consolidación del streaming del asistente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(streamChatMessage).mockReset();
    vi.mocked(sendChatMessage).mockReset();
    vi.mocked(fetchThreadState).mockReset().mockResolvedValue(null);
    localStorage.clear();
    localStorage.setItem("copp_access_token", "demo-access-token");
    mirror.chat = [];
    mirror.voiceResult = null;
    vi.mocked(requireLegalConsent).mockReset().mockResolvedValue(undefined);
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

    await renderApp();
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

    await renderApp();
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

    await renderApp();
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

    await renderApp();
    act(() => {
      fireEvent.click(screen.getByText("voice"));
    });

    await waitFor(() => {
      expect(mirror.voiceResult?.text).toBe("Tu plan está listo.");
    });
  });

  it("no hace streaming ni POST si el paciente cancela la autorización", async () => {
    vi.mocked(requireLegalConsent).mockRejectedValueOnce(consentFailure("CONSENT_CANCELLED"));
    await renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(requireLegalConsent).toHaveBeenCalledWith("chat", "es", expect.any(AbortSignal)));
    expect(streamChatMessage).not.toHaveBeenCalled();
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it.each(["CONSENT_REQUIRED", "CONSENT_DOCUMENT_UNAVAILABLE"])("no reintenta chat bloqueante tras %s del stream", async code => {
    vi.mocked(streamChatMessage).mockRejectedValueOnce(consentFailure(code, code === "CONSENT_REQUIRED" ? 403 : 503));
    await renderApp(); fireEvent.click(screen.getByText("send"));
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
    await renderApp(message);
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

  it("un fallo antes de tokens exige reintento explicito sin duplicar el usuario", async () => {
    vi.mocked(streamChatMessage).mockRejectedValueOnce(new Error("Network unavailable"));
    vi.mocked(streamChatMessage).mockResolvedValueOnce({ reply: "Respuesta real", threadId: "proactive-10247381", executionId: "execution" });
    await renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(mirror.chat.some(m => m.kind === "service-error")).toBe(true));
    expect(sendChatMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.getByTestId("last-bot").textContent).toBe("Respuesta real"));
    expect(mirror.chat.filter(m => m.role === "user")).toHaveLength(1);
    expect(streamChatMessage).toHaveBeenCalledTimes(2);
  });

  it("retira una respuesta parcial interrumpida sin repetir herramientas automáticamente", async () => {
    vi.mocked(streamChatMessage).mockImplementationOnce(async (_text, _thread, callbacks) => {
      callbacks?.onToken?.("Tu presión significa que debes");
      throw new Error("Stream interrupted");
    });
    await renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(mirror.chat.some(m => m.kind === "service-error")).toBe(true));
    expect(mirror.chat.some(m => m.text.includes("Tu presión significa"))).toBe(false);
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("una respuesta vacía termina como indisponibilidad, no como burbuja vacía", async () => {
    vi.mocked(streamChatMessage).mockResolvedValueOnce({ reply: " ", threadId: "thread" });
    vi.mocked(sendChatMessage).mockResolvedValueOnce({ reply: "", threadId: "thread" });
    await renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(mirror.chat.some(m => m.kind === "service-error")).toBe(true));
    expect(mirror.chat.filter(m => m.role === "bot").every(m => m.text.trim().length > 0)).toBe(true);
  });

  it("la vía de voz devuelve el mismo aviso honesto si ambos transportes fallan", async () => {
    vi.mocked(streamChatMessage).mockRejectedValueOnce(new Error("Offline"));
    vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error("Offline"));
    await renderApp(); fireEvent.click(screen.getByText("voice"));
    await waitFor(() => expect(mirror.voiceResult?.kind).toBe("service-error"));
    expect(mirror.voiceResult?.text).toBe("El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.");
  });

  it("un fallo tardio no inserta avisos en otra sesion", async () => {
    let rejectStream!: (error: Error) => void;
    vi.mocked(streamChatMessage).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectStream = reject; }));
    await renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(streamChatMessage).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("logout"));
    await act(async () => { rejectStream(new Error("Offline")); });
    expect(mirror.chat.some(m => m.kind === "service-error")).toBe(false);
  });
  it("cancelar conserva un solo turno interrumpido y permite reintentar", async () => {
    vi.mocked(streamChatMessage).mockImplementationOnce(async (_text, _thread, callbacks, _image, _lang, signal) => {
      callbacks?.onToken?.("Texto parcial");
      await new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      throw new Error("unreachable");
    });
    await renderApp(); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByTestId("last-bot").textContent).toBe("Texto parcial"));
    fireEvent.click(screen.getByText("cancel"));
    await waitFor(() => expect(mirror.chat.find(m => m.role === "bot")?.delivery).toBe("interrupted"));
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(mirror.chat.filter(m => m.role === "user")).toHaveLength(1);
  });
  it.each([{ turns: 1, tracked: true }, { turns: 2, tracked: true }, { turns: 1, tracked: false }])(
    "envío exitoso→desmontar/montar: $turns turnos, tracker $tracked, solo snapshot y feedback canónico",
    async ({ turns, tracked }) => {
      vi.mocked(streamChatMessage).mockImplementation(async (_text, thread) => ({ reply: "Sí", threadId: thread, executionId: "tracker-live" }));
      await renderApp("Sí", true);
      for (let index = 0; index < turns; index += 1) {
        fireEvent.click(screen.getByText("send"));
        await waitFor(() => expect(mirror.chat.filter(message => message.role === "bot" && message.delivery === "received")).toHaveLength(index + 1));
      }
      const localIds = mirror.chat.map(message => message.id);
      fireEvent.click(screen.getByText("toggle chat"));
      const thread = mirror.app!.threadId;
      const messages = Array.from({ length: turns * 2 }, (_, index) => ({
        messageId: `server:${index}`, role: index % 2 ? "bot" : "user", text: "Sí", channel: "text" as const,
        status: "final" as const, revision: 1, executionId: tracked && index % 2 ? `tracker:${index}` : null,
      }));
      vi.mocked(fetchThreadState).mockResolvedValue({ threadId: thread, messageCount: messages.length, lastMessage: "Sí", messages });
      fireEvent.click(screen.getByText("toggle chat"));
      await waitFor(() => expect(mirror.chat.map(message => message.id)).toEqual(messages.map(message => message.messageId)));
      expect(mirror.chat).toHaveLength(turns * 2);
      expect(mirror.chat.every(message => !localIds.includes(message.id))).toBe(true);
      messages.forEach((message, index) => expect(mirror.chat[index]).toMatchObject(message));
      const feedback = screen.queryAllByLabelText("Calificar respuesta como útil");
      expect(feedback).toHaveLength(tracked ? turns : 0);
      if (tracked) {
        fireEvent.click(feedback.at(-1)!);
        await waitFor(() => expect(sendChatFeedback).toHaveBeenLastCalledWith({ executionId: `tracker:${turns * 2 - 1}`, threadId: thread, rating: 5 }));
      }
      fireEvent.click(screen.getByText("toggle chat"));
      fireEvent.click(screen.getByText("toggle chat"));
      await waitFor(() => expect(mirror.chat).toHaveLength(turns * 2));
      expect(streamChatMessage).toHaveBeenCalledTimes(turns);
    },
  );
  it.each([false, true])("GET atrasado no sustituye texto si empezó otra generación (terminada=%s)", async finished => {
    let finishTurn!: (value: { reply: string; threadId: string }) => void;
    vi.mocked(streamChatMessage).mockResolvedValueOnce({ reply: "Anterior", threadId: "proactive-10247381" })
      .mockImplementationOnce((_text, _thread, callbacks) => {
        callbacks?.onToken?.("En vuelo");
        return new Promise(resolve => { finishTurn = resolve; });
      });
    await renderApp("Sí"); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByTestId("last-bot").textContent).toBe("Anterior"));
    const oldIds = mirror.chat.map(message => message.id);
    const thread = mirror.app!.threadId;
    let finishGet!: (value: Awaited<ReturnType<typeof fetchThreadState>>) => void;
    vi.mocked(fetchThreadState).mockImplementationOnce(() => new Promise(resolve => { finishGet = resolve; }));
    fireEvent.click(screen.getByText("toggle chat"));
    await waitFor(() => expect(finishGet).toBeTypeOf("function"));
    fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByTestId("last-bot").textContent).toBe("En vuelo"));
    if (finished) await act(async () => { finishTurn({ reply: "Final nuevo", threadId: thread }); });
    await act(async () => { finishGet({ threadId: thread, messageCount: 2, lastMessage: "Anterior", messages: [
      { messageId: "server-user", role: "user", text: "Sí" }, { messageId: "server-bot", role: "bot", text: "Anterior", executionId: "tracker" },
    ] }); });
    expect(mirror.chat).toHaveLength(4);
    expect(mirror.chat.slice(0, 2).map(message => message.id)).toEqual(oldIds);
    expect(mirror.chat.some(message => message.id === "server-user")).toBe(false);
    expect(screen.getByTestId("last-bot").textContent).toBe(finished ? "Final nuevo" : "En vuelo");
    if (!finished) await act(async () => { finishTurn({ reply: "Final nuevo", threadId: thread }); });
  });
  it.each(["cuenta", "hilo"])("el hydrator capturado no cruza %s", async change => {
    await renderApp();
    const apply = mirror.app!.captureHistoryHydrator();
    await act(async () => {
      if (change === "cuenta") mirror.app!.backToLogin(); else mirror.app!.setActiveThreadId("otro-hilo");
    });
    let applied = true;
    await act(async () => { applied = apply([{ role: "bot", text: "Privado", messageId: "private" }]); });
    expect(applied).toBe(false); expect(mirror.chat.some(message => message.id === "private")).toBe(false);
  });
  it("snapshot de texto conserva voz provisional, errores y IDs añadidos después del GET", async () => {
    vi.mocked(streamChatMessage).mockImplementationOnce(async (_text, threadId) => ({ reply: "Respuesta", threadId }));
    await renderApp("Pregunta"); fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByTestId("last-bot").textContent).toBe("Respuesta"));
    const thread = mirror.app!.threadId;
    const legacy = voiceMessage("legacy-RAM", thread, { role: "agent", source: "ai", message: "Sí", event_id: 2 })!;
    const linked = { ...voiceMessage("provider", thread, { role: "agent", source: "ai", message: "Sí", event_id: 14 })!, voiceSessionId: "bound", voiceRuntime: "vita" as const };
    await act(async () => {
      mirror.app!.registerVoiceSession("bound", thread);
      mirror.app!.upsertVoiceMessage(legacy); mirror.app!.upsertVoiceMessage(linked);
      mirror.app!.appendChatMessages([{ role: "bot", text: "Error local", kind: "service-error" }]);
    });
    const apply = mirror.app!.captureHistoryHydrator();
    await act(async () => mirror.app!.appendChatMessages([{ role: "bot", text: "Añadido después del GET" }]));
    await act(async () => { expect(apply([
      { role: "user", text: "Pregunta", messageId: "server-user" },
      { role: "bot", text: "Respuesta", messageId: "server-bot", executionId: null },
    ])).toBe(true); });
    expect(mirror.chat).toHaveLength(6);
    expect(mirror.chat.map(message => message.id)).toEqual(expect.arrayContaining(["server-user", "server-bot", legacy.id, linked.id]));
    expect(mirror.chat.map(message => message.text)).toEqual(expect.arrayContaining(["Error local", "Añadido después del GET"]));
    expect(mirror.chat.filter(message => message.text === "Sí")).toHaveLength(2);
  });
  it.each(["legacy", "vita"] as const)("hidratar tras voz %s vinculada sustituye el grupo sin pares duplicados", async voiceRuntime => {
    await renderApp();
    const thread = mirror.app!.threadId;
    const locals = ["user", "agent"].map(role => ({ ...voiceMessage("provider-local", thread, { role: role as "user" | "agent", source: role === "user" ? "user" : "ai", message: "Sí", event_id: 2, response_id: role === "agent" ? "different-uuid" : undefined })!, voiceRuntime, voiceSessionId: "linked-session" }));
    await act(async () => {
      mirror.app!.registerVoiceSession("linked-session", thread);
      locals.forEach(message => mirror.app!.upsertVoiceMessage(message));
    });
    const history = ["user", "bot"].map(role => ({ role, text: "Sí", messageId: `voice:linked-session:provider:${role}:2`, channel: "voice" as const, status: "final" as const, revision: 1 }));
    await act(async () => mirror.app!.hydrateChat(history));
    expect(mirror.chat).toHaveLength(2);
    expect(mirror.chat.map(message => message.id)).toEqual(locals.map(message => message.id));
    await act(async () => {
      mirror.app!.markVoiceSessionClosed("linked-session", thread);
      mirror.app!.hydrateChat(history);
    });
    expect(mirror.chat.map(message => message.id)).toEqual(history.map(message => message.messageId));
    await act(async () => mirror.app!.hydrateChat(history));
    expect(mirror.chat).toHaveLength(2);
    expect(mirror.chat.map(message => message.role)).toEqual(["user", "bot"]);
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(streamChatMessage).not.toHaveBeenCalled();
  });
});
