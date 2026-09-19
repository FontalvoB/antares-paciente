import { useCallback, useEffect, useRef, useState } from "react";
import {
  IonButton,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import { close, send } from "ionicons/icons";
import {
  ApiClientError,
  fetchRoomChatMessages,
  sendRoomChatMessage,
} from "../utils/appointmentsApi";
import {
  mergeRoomChatMessages,
  roomChatCursor,
  type RoomChatMessage,
} from "../utils/roomChat";
import { useI18n, useT } from "../i18n/I18nContext";

/**
 * Chat de la consulta dentro de la sala (F3): REST + polling incremental de
 * ~4 s con cursor `after`/`afterId` mientras el panel está montado (se abre =
 * se sondea; se cierra = se detiene). Envío optimista con reconciliación por
 * id y reintento por burbuja; sin adjuntos/edición (alcance F3).
 */

const CHAT_POLL_MS = 4_000;
/** Distancia al fondo (px) para auto-scroll con mensajes nuevos. */
const BOTTOM_THRESHOLD = 80;

interface Props {
  appointmentId: string;
  /** Cita en estado que admite chat (Confirmed/InProgress/Completed). */
  enabled: boolean;
  onClose: () => void;
}

type LoadState = "loading" | "ready" | "error";

function formatChatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RoomChatPanel({ appointmentId, enabled, onClose }: Props) {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const messagesRef = useRef<RoomChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingSeq = useRef(0);
  const firstScrollRef = useRef(true);
  const mountedRef = useRef(true);
  /** Candado sincrónico contra doble Enter (el estado llega tarde). */
  const sendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Carga inicial + polling incremental mientras el panel sigue abierto.
  useEffect(() => {
    if (ended) return;
    let cancelled = false;
    const load = async (initial: boolean) => {
      try {
        const cursor = initial ? null : roomChatCursor(messagesRef.current);
        const batch = await fetchRoomChatMessages(
          appointmentId,
          cursor ?? undefined,
        );
        if (cancelled || !mountedRef.current) return;
        setMessages((prev) => mergeRoomChatMessages(prev, batch));
        setLoadState("ready");
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        // 409: la cita ya no admite chat (Completed/Cancelled/NoShow).
        if (err instanceof ApiClientError && err.status === 409) {
          setEnded(true);
          setLoadState("ready");
          return;
        }
        if (initial) setLoadState("error");
      }
    };
    void load(true);
    const timer = window.setInterval(() => void load(false), CHAT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appointmentId, ended, reloadToken]);

  // Auto-scroll al último mensaje si el usuario está al día en el hilo.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    if (firstScrollRef.current || nearBottom) {
      firstScrollRef.current = false;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const doSend = useCallback(
    async (body: string, localId: string) => {
      try {
        const saved = await sendRoomChatMessage(appointmentId, body);
        if (!mountedRef.current) return;
        setMessages((prev) =>
          mergeRoomChatMessages(
            prev.filter((message) => message.id !== localId),
            [saved],
          ),
        );
        setSendFailed(false);
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof ApiClientError && err.status === 409) {
          setMessages((prev) => prev.filter((m) => m.id !== localId));
          setDraft((current) => (current.trim() ? current : body));
          setEnded(true);
          return;
        }
        setSendFailed(true);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === localId ? { ...message, failed: true } : message,
          ),
        );
      }
    },
    [appointmentId],
  );

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || !enabled || ended || sendingRef.current) return;
    sendingRef.current = true;
    pendingSeq.current += 1;
    const optimistic: RoomChatMessage = {
      id: `local-${Date.now()}-${pendingSeq.current}`,
      appointmentId,
      senderUserId: "me",
      senderRole: "Patient",
      body,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);
    await doSend(body, optimistic.id);
    sendingRef.current = false;
    if (mountedRef.current) setSending(false);
  }, [appointmentId, draft, enabled, ended, doSend]);

  const retrySend = useCallback(
    (message: RoomChatMessage) => {
      if (!enabled || ended || sendingRef.current) return;
      sendingRef.current = true;
      setSendFailed(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, failed: false } : m)),
      );
      setSending(true);
      void doSend(message.body, message.id).finally(() => {
        sendingRef.current = false;
        if (mountedRef.current) setSending(false);
      });
    },
    [doSend, enabled, ended],
  );

  const retryLoad = useCallback(() => {
    setLoadState("loading");
    setReloadToken((token) => token + 1);
  }, []);

  return (
    <IonModal
      isOpen
      onDidDismiss={onClose}
      initialBreakpoint={0.72}
      breakpoints={[0, 0.72, 0.95]}
      className="room-chat-modal"
    >
      <div className="room-chat">
        <header className="room-chat-head">
          <strong>{t("Chat de la consulta")}</strong>
          <IonButton
            fill="clear"
            className="room-chat-close"
            aria-label={t("Cerrar chat")}
            onClick={onClose}
          >
            <IonIcon slot="icon-only" icon={close} />
          </IonButton>
        </header>

        <div className="room-chat-body" ref={listRef}>
          {loadState === "loading" ? (
            <div className="room-chat-empty">
              <IonSpinner name="crescent" />
              <span>{t("Cargando mensajes…")}</span>
            </div>
          ) : loadState === "error" ? (
            <div className="room-chat-empty">
              <span>{t("No se pudieron cargar los mensajes.")}</span>
              <IonButton className="bt bt-primary" onClick={retryLoad}>
                {t("Reintentar")}
              </IonButton>
            </div>
          ) : messages.length === 0 ? (
            <div className="room-chat-empty">
              <span>{t("Sin mensajes todavía.")}</span>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`room-chat-row${
                  message.senderRole === "Patient" ? " mine" : ""
                }`}
              >
                <p className="room-chat-bubble">{message.body}</p>
                <span className="room-chat-meta">
                  {formatChatTime(message.createdAt, locale)}
                  {message.failed ? ` · ${t("No enviado")}` : ""}
                </span>
                {message.failed ? (
                  <IonButton
                    fill="clear"
                    size="small"
                    className="room-chat-retry"
                    onClick={() => retrySend(message)}
                  >
                    {t("Reintentar")}
                  </IonButton>
                ) : null}
              </div>
            ))
          )}
        </div>

        <footer className="room-chat-foot">
          <IonTextarea
            className="room-chat-input"
            value={draft}
            placeholder={t("Escribe un mensaje…")}
            autoGrow
            rows={1}
            disabled={!enabled || ended}
            onIonInput={(event) => setDraft(event.detail.value ?? "")}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <IonButton
            className="room-chat-send"
            aria-label={t("Enviar mensaje")}
            disabled={!enabled || ended || sending || !draft.trim()}
            onClick={() => void handleSend()}
          >
            <IonIcon slot="icon-only" icon={send} />
          </IonButton>
        </footer>
        {ended || !enabled ? (
          <p className="room-chat-disabled">
            {ended
              ? t("La consulta finalizó")
              : t("El chat no está disponible para esta cita.")}
          </p>
        ) : sendFailed ? (
          <p className="room-chat-error">
            {t("No se pudo enviar el mensaje.")}
          </p>
        ) : null}
      </div>
    </IonModal>
  );
}
