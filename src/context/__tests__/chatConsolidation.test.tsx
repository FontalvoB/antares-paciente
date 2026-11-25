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
import { clearThreadMessages, fetchThreadState, sendChatMessage, streamChatMessage } from "../../utils/threadApi";
import { sendChatMessage as sendAttachmentChat } from "../../services/chat/chat-service";
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
  clearThreadMessages: vi.fn(),
  uploadLabExam: vi.fn(),
  sendChatMessage: vi.fn(),
  streamChatMessage: vi.fn(),
}));
vi.mock("../../utils/legalConsents", async original => ({ ...await original<object>(), requireLegalConsent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../services/chat/chat-service", async original => ({
  ...await original<object>(), sendChatFeedback: vi.fn().mockResolvedValue({ ok: true }), sendChatMessage: vi.fn(),
}));
vi.mock("../../components/Screen", () => ({ Screen: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
// La prueba integra contexto/página/feedback reales; los controles headless evitan
// errores de CSS de Stencil en happy-dom, sin sustituir sus handlers de negocio.
vi.mock("@ionic/react", async original => ({
  ...await original<object>(),
  IonButton: ({ children, onClick, disabled, "aria-label": label }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean; "aria-label"?: string }>) => <button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
  IonAvatar: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  IonAlert: ({ isOpen, header, message, buttons, onDidDismiss }: any) => isOpen ? <div role="alertdialog" aria-label={header}><p>{message}</p>{buttons.map((button: any) => <button key={button.text} onClick={() => { button.handler?.(); onDidDismiss({ detail: { role: button.role } }); }}>{button.text}</button>)}</div> : null,
  IonToast: ({ isOpen, message }: any) => isOpen ? <div role="status">{message}</div> : null,
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

function Harness({ message = "hola" }: { message?: string }) {
  const app = useApp(); mirror.app = app;
  const { chat, sendChat, sendVoiceMessage, backToLogin, cancelChat, retryChat, authLoading } = app;
  mirror.chat = chat;
  return (
    <div>
      <span data-testid="auth-loading">{String(authLoading)}</span>
      <button type="button" onClick={() => sendChat(message)}>
        send
      </button>
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

async function renderApp(message?: string) {
  // La sesión simulada y los efectos al cambiar de hilo se completan al montar.
  await act(async () => {
    render(
      <I18nProvider>
        <AppProvider>
          <Harness message={message} />
        </AppProvider>
      </I18nProvider>,
    );
  });
  expect(screen.getByTestId("auth-loading").textContent).toBe("false");
  expect(mirror.app?.user.id).toBe("10247381");
  expect(mirror.app?.threadId).toBe("proactive-10247381");
}

describe("AppContext — consolidación del streaming del asistente", () => {
  it("envía el turno con adjuntos por el contrato síncrono y conserva sus avisos", async () => {
    await renderApp();
    const file = { attachmentId: "file-1", kind: "pdf" as const, contentType: "application/pdf",
      name: "fixture.pdf", sizeBytes: 10, pageCount: 1, expiresAt: "2099-02-01T00:00:00Z" };
    vi.mocked(sendAttachmentChat).mockResolvedValueOnce({
      threadId: mirror.app!.threadId, reply: "Vita respondió.",
      attachments: [{ attachmentId: file.attachmentId, kind: "pdf", readable: false }],
    });
    act(() => mirror.app!.sendChat("Revisa el documento", undefined, [file]));
    await waitFor(() => expect(mirror.chat.at(-1)?.vitaAttachments).toEqual([{ ...file, readable: false }]));
    expect(sendAttachmentChat).toHaveBeenCalledWith("Revisa el documento", mirror.app!.threadId, "es", [file.attachmentId], expect.any(AbortSignal));
    expect(streamChatMessage).not.toHaveBeenCalled();
    expect(mirror.chat.at(-1)?.text).toBe("Vita respondió.");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(streamChatMessage).mockReset();
    vi.mocked(sendChatMessage).mockReset();
    vi.mocked(fetchThreadState).mockReset().mockResolvedValue(null);
    vi.mocked(clearThreadMessages).mockReset().mockImplementation(async threadId => ({ threadId, historyRevision: 1, clearedAt: "2026-11-14T20:00:00Z", resetReason: "manual" }));
    localStorage.clear();
    localStorage.setItem("copp_access_token", "demo-access-token");
    mirror.chat = [];
    mirror.voiceResult = null;
    vi.mocked(requireLegalConsent).mockReset().mockResolvedValue(undefined);
  });

  it("limpia solo tras confirmar DELETE; espera voz y bloquea doble envío/turnos", async () => {
    await renderApp();
    await act(async () => mirror.app!.appendChatMessages([{ role: "bot", text: "Anterior" }]));
    const thread = mirror.app!.threadId;
    let finishStop!: () => void;
    const stop = vi.fn(() => new Promise<void>(resolve => { finishStop = resolve; }));
    mirror.app!.registerVoiceStop(stop);
    let pending!: Promise<void>;
    act(() => { pending = mirror.app!.clearChat(); });
    expect(mirror.app!.chatClearing).toBe(true);
    expect(mirror.chat.some(m => m.text === "Anterior")).toBe(true);
    expect(clearThreadMessages).not.toHaveBeenCalled();
    await act(async () => { await mirror.app!.clearChat(); mirror.app!.sendChat("No enviar"); });
    expect(stop).toHaveBeenCalledTimes(1); expect(streamChatMessage).not.toHaveBeenCalled();
    await act(async () => { finishStop(); await pending; });
    expect(clearThreadMessages).toHaveBeenCalledWith(thread, expect.any(AbortSignal));
    expect(mirror.chat).toEqual([]); expect(mirror.app!.threadId).toBe(thread);
    expect(mirror.app!.chatClearing).toBe(false);
    expect(localStorage.getItem("antares:chat-last-seen:10247381")).toBe("0");
  });

  it("no envía DELETE cuando no se confirma el cierre de voz", async () => {
    await renderApp();
    mirror.app!.registerVoiceStop(vi.fn().mockRejectedValue(new Error("voice unavailable")));
    await act(async () => { await expect(mirror.app!.clearChat()).rejects.toThrow("voice unavailable"); });
    expect(clearThreadMessages).not.toHaveBeenCalled(); expect(mirror.app!.chatClearing).toBe(false);
  });

  it("invalida tokens, done, snapshots, voz y reintento anteriores al borrado", async () => {
    let finish!: (value: any) => void;
    let token!: (piece: string) => void;
    let signal!: AbortSignal;
    vi.mocked(streamChatMessage).mockImplementationOnce((_text, _thread, callbacks, _image, _lang, requestSignal) => {
      token = callbacks!.onToken!; signal = requestSignal!;
      return new Promise(resolve => { finish = resolve; });
    });
    await renderApp();
    const snapshot = mirror.app!.captureHistoryHydrator();
    const event = mirror.app!.upsertVoiceMessage;
    const guard = mirror.app!.captureChatGuard();
    fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(streamChatMessage).toHaveBeenCalledTimes(1));
    await act(async () => { await mirror.app!.clearChat(); });
    expect(signal.aborted).toBe(true); expect(guard()).toBe(false);
    await act(async () => {
      token("Tardío"); finish({ reply: "Done viejo", threadId: mirror.app!.threadId });
      expect(snapshot([{ role: "bot", text: "GET viejo" }])).toBe(false);
      event(voiceMessage("old", mirror.app!.threadId, { role: "agent", source: "ai", message: "Voz vieja", event_id: 1 })!);
      mirror.app!.retryChat();
    });
    expect(mirror.chat).toEqual([]); expect(streamChatMessage).toHaveBeenCalledTimes(1);
  });

  it("GET mensual vacío con revisión mayor vacía caché y rechaza revisiones viejas/legacy", async () => {
    await renderApp();
    await act(async () => mirror.app!.appendChatMessages([{ role: "bot", text: "Mes anterior" }]));
    const guard = mirror.app!.captureChatGuard();
    const state = { threadId: mirror.app!.threadId, messageCount: 0, lastMessage: null, messages: [], historyRevision: 2, resetReason: "monthly" as const };
    await act(async () => { expect(mirror.app!.observeChatHistory(state)).toBe("reset"); });
    expect(mirror.chat).toEqual([]); expect(guard()).toBe(false);
    const revision = mirror.app!.chatHistoryRevision;
    await act(async () => {
      expect(mirror.app!.observeChatHistory(state)).toBe("current");
      expect(mirror.app!.observeChatHistory({ ...state, historyRevision: 1 })).toBe("stale");
      expect(mirror.app!.observeChatHistory({ ...state, historyRevision: undefined })).toBe("stale");
    });
    expect(mirror.app!.chatHistoryRevision).toBe(revision);
  });

  it("un reintento anterior al corte mensual no vuelve a enviar el mensaje borrado", async () => {
    vi.mocked(streamChatMessage).mockRejectedValueOnce(new Error("Synthetic unavailable"));
    await renderApp();
    fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(mirror.chat.some(message => message.delivery === "failed")).toBe(true));
    vi.mocked(fetchThreadState).mockResolvedValueOnce({ threadId: mirror.app!.threadId, historyRevision: 1, resetReason: "monthly", messageCount: 0, messages: [], lastMessage: null });
    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(mirror.chat).toEqual([]));
    expect(streamChatMessage).toHaveBeenCalledTimes(1);
  });

  it("logout durante DELETE descarta el resultado y cancela su señal", async () => {
    let finish!: (value: any) => void;
    vi.mocked(clearThreadMessages).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await renderApp();
    const threadId = mirror.app!.threadId;
    let pending!: Promise<void>;
    act(() => { pending = mirror.app!.clearChat(); });
    await waitFor(() => expect(clearThreadMessages).toHaveBeenCalled());
    const requestSignal = vi.mocked(clearThreadMessages).mock.calls[0][1]!;
    await act(async () => { mirror.app!.backToLogin(); });
    await act(async () => {
      finish({ threadId, historyRevision: 1, clearedAt: "2026-11-14T20:00:00Z", resetReason: "manual" });
      await expect(pending).rejects.toThrow("History owner changed");
    });
    expect(requestSignal.aborted).toBe(true); expect(mirror.app!.chatClearing).toBe(false);
    expect(mirror.chat[0].id).toBe("welcome");
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
    await act(async () => { fireEvent.click(screen.getByText("send")); });
    expect(streamChatMessage).toHaveBeenCalledTimes(1);
    const expected = language === "en"
      ? "The assistant is unavailable right now. Please try again in a few minutes."
      : "El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.";
    expect(screen.getByTestId("last-bot").textContent).toBe(expected);
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
