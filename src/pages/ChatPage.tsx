import {
  IonBadge,
  IonButton,
  IonIcon,
  IonInput,
  IonSpinner,
} from "@ionic/react";
import {
  attach,
  cameraOutline,
  closeCircle,
  informationCircle,
  medkit,
  mic,
  send as sendIcon,
} from "ionicons/icons";
import { motion } from "framer-motion";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { PageHeader } from "../components/PageHeader";
import { Screen } from "../components/Screen";
import { ChatRichText } from "../components/ChatRichText";
import { ChatFeedbackAction } from "../components/chat/ChatFeedbackAction";
import { useApp } from "../context/AppContext";
import { useI18n, useT } from "../i18n/I18nContext";
import { captureChatImage } from "../services/media/camera-service";
import { fetchThreadState, uploadLabExam } from "../utils/threadApi";

const quick = [
  ["¿Qué comer?", "¿Qué debo comer hoy según mi plan?"],
  ["Síntomas", "Tengo dolor en el pecho, ¿qué hago?"],
  ["Agendar", "Agenda una cita con el médico para hoy"],
  ["Progreso", "¿Cómo va mi progreso esta semana?"],
  ["Meditar", "Quiero meditar y calmar mi ansiedad"],
];

/** Mensajes visibles por tramo del historial progresivo. */
const PAGE_SIZE = 10;
/** Distancia al tope (px) que dispara la carga del tramo anterior. */
const SCROLL_TOP_THRESHOLD = 48;

export function ChatPage() {
  const {
    chat,
    sendChat,
    openPanic,
    openVoice,
    threadId,
    user,
    hydrateChat,
    prependChatMessages,
    openBookingWizard,
    appendChatMessages,
    showToast,
    navigate,
  } = useApp();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  // Imagen conversacional pendiente (agente-asistente-citas D3): miniatura
  // removible en el compositor; viaja con el próximo mensaje como multimodal.
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);
  // Paginación server-driven: `hasMore`/`nextCursor` los define el backend y
  // `loadingMore` cubre la carga del tramo anterior al llegar al tope.
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Contador que solo dispara el efecto de anclaje tras cada fetch de página
  // (éxito o error) para compensar el scroll y apagar `loadingMore`.
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Posición del scroll previa a insertar mensajes por encima: permite
  // compensar el scrollTop y que el contenido visible no salte.
  const anchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(
    null,
  );
  // Marca que el próximo cambio de `chat.length` viene de anteponer mensajes:
  // evita que el efecto de scroll al final salte y anule el anclaje.
  const prependingRef = useRef(false);
  // Hilo al que pertenece el fetch en vuelo: si un push cambia de thread a
  // mitad de la carga, la respuesta vieja se descarta por completo.
  const threadIdRef = useRef(threadId);

  const userId = (user.id || user.cedula || user.email || "").trim();

  // Al abrir el chat se intenta cargar la última página del thread estable: si
  // el backend inyectó un mensaje del bot (push proactivo), se muestra al inicio.
  const historyLoaded = useRef<string | null>(null);
  useEffect(() => {
    if (historyLoaded.current === threadId) return;
    if (!userId) return;
    let cancelled = false;
    void fetchThreadState(threadId, userId, { limit: PAGE_SIZE }).then(
      (state) => {
        if (cancelled) return;
        // Página más reciente cuando el backend la expone (roles user/bot
        // mapeados); fallback al último mensaje con backends anteriores.
        const history = (state?.messages ?? [])
          .filter((m) => Boolean(m.text && m.text.trim().length > 0))
          .map((m) => ({
            text: m.text,
            role: m.role === "user" ? ("user" as const) : ("bot" as const),
          }));
        let more = Boolean(state?.hasMore);
        if (!history.length) {
          if (!state?.lastMessage) return;
          history.push({ text: state.lastMessage, role: "bot" as const });
          // El fallback de un único mensaje no deja tramos anteriores.
          more = false;
        }
        // El ref se marca SOLO cuando la hidratación se aplica: en StrictMode
        // (dev) el efecto corre dos veces y el primer fetch queda cancelado; con
        // el ref marcado de antemano el segundo intento se saltaba y el mensaje
        // proactivo nunca aparecía.
        historyLoaded.current = threadId;
        setHasMore(more);
        setNextCursor(state?.nextCursor ?? null);
        hydrateChat(history);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [threadId, userId, hydrateChat]);

  useEffect(() => {
    if (prependingRef.current) {
      // El cambio de chat.length viene de anteponer mensajes: el anclaje ya
      // compensó la posición, no hay que saltar al final.
      prependingRef.current = false;
      return;
    }
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, uploading]);

  // Un hilo nuevo arranca siempre con la última página y sin paginación previa.
  useEffect(() => {
    threadIdRef.current = threadId;
    setHasMore(false);
    setNextCursor(null);
    setLoadingMore(false);
    anchorRef.current = null;
    // Un prepend en vuelo del hilo anterior quedará descartado: se libera la
    // marca para que el próximo mensaje del hilo nuevo vuelva a scrollear.
    prependingRef.current = false;
  }, [threadId]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore || !userId) return;
    if (el.scrollTop > SCROLL_TOP_THRESHOLD) return;
    if (nextCursor == null) {
      // hasMore sin cursor (backend viejo o inconsistente): se apaga la
      // paginación para no reintentar la misma página en loop.
      setHasMore(false);
      return;
    }
    anchorRef.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
    };
    prependingRef.current = true;
    setLoadingMore(true);
    const requestThreadId = threadId;
    void fetchThreadState(threadId, userId, {
      limit: PAGE_SIZE,
      before: nextCursor,
    }).then((state) => {
      // El hilo cambió mientras el fetch estaba en vuelo (push): la página
      // pertenece al hilo anterior y se descarta por completo.
      if (requestThreadId !== threadIdRef.current) return;
      // Respuesta degradada (messageCount 0): el backend devolvió 200 con el
      // historial vacío tras un fallo del AI service. No significa "no hay
      // más páginas": se conservan hasMore/nextCursor para reintentar.
      if (state && (state.messageCount ?? 0) === 0) {
        prependingRef.current = false;
        setPagesLoaded((n) => n + 1);
        return;
      }
      if (state) {
        const older = (state.messages ?? [])
          .filter((m) => Boolean(m.text && m.text.trim().length > 0))
          .map((m) => ({
            text: m.text,
            role: m.role === "user" ? ("user" as const) : ("bot" as const),
          }));
        // Sin dedup por texto: un mensaje repetido entre páginas es legítimo.
        if (older.length) prependChatMessages(older);
        setHasMore(Boolean(state.hasMore));
        setNextCursor(state.nextCursor ?? null);
      } else {
        // Fetch fallido: no se tocan hasMore/nextCursor para poder reintentar
        // en el próximo scroll; no hubo prepend, así que se libera la marca.
        prependingRef.current = false;
      }
      // Dispara el efecto de anclaje (y apaga loadingMore) aunque falle.
      setPagesLoaded((n) => n + 1);
    });
  };

  // Scroll anchoring: los mensajes viejos se insertan por encima del
  // contenido visible, así que se suma el delta de altura al scrollTop para
  // que el mensaje que el usuario estaba mirando quede en el mismo lugar.
  useLayoutEffect(() => {
    const el = listRef.current;
    const anchor = anchorRef.current;
    if (!el || !anchor) return;
    anchorRef.current = null;
    const delta = el.scrollHeight - anchor.scrollHeight;
    if (delta > 0) {
      el.scrollTop = anchor.scrollTop + delta;
    } else {
      // La página no agregó nodos al DOM (vacía, degradada o filtrada): el
      // efecto de [chat.length] no corre, así que se libera la marca aquí
      // para no saltarse el scroll al final del próximo mensaje nuevo.
      prependingRef.current = false;
    }
    setLoadingMore(false);
  }, [pagesLoaded]);

  const t = useT();
  const { lang } = useI18n();

  // Inicial del microavatar del usuario (solo presentación).
  const userInitial =
    (user.nombre || "?").trim().charAt(0).toUpperCase() || "?";

  const send = (msg = text) => {
    if (uploading) return;
    const v = msg.trim();
    if (!v) return;
    sendChat(v, pendingImage ?? undefined);
    setPendingImage(null);
    setText("");
  };

  /** Captura (cámara o galería) para el contexto conversacional (D3). */
  const handleCaptureImage = async () => {
    if (uploading || pendingImage) return;
    const image = await captureChatImage();
    if (image) setPendingImage(image);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      showToast(t("El archivo excede el límite de 20 MB."), "err");
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const type = file.type ? file.type.split(";")[0].trim().toLowerCase() : "";
    const isAllowedExt = [".jpg", ".jpeg", ".png", ".pdf"].includes(ext);
    const isAllowedType = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ].includes(type);
    if (!isAllowedExt && !isAllowedType) {
      showToast(
        t("Tipo de archivo no permitido. Solo se aceptan JPEG, PNG o PDF."),
        "err",
      );
      return;
    }

    setUploading(true);
    try {
      const result = await uploadLabExam(file, threadId, lang);
      appendChatMessages([
        {
          role: "user",
          text: `📄 ${file.name}`,
        },
        {
          role: "bot",
          text: result.summary,
          kind: "lab-exam",
        },
      ]);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : t("Error al procesar el examen.");
      showToast(errorMsg, "err");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen className="chat-kb">
      <PageHeader
        title={t("Chat")}
        sub={t("Copp Adresd AI · en línea 24/7")}
        trailing={
          <IonButton
            className="bt bt-round"
            style={
              {
                "--background": "var(--red-l)",
                "--color": "var(--panic)",
              } as CSSProperties
            }
            aria-label={t("Botón de pánico")}
            onClick={openPanic}
          >
            <IonIcon icon={medkit} />
          </IonButton>
        }
      />
      <div className="chip-scroll">
        {quick.map(([l, q]) => (
          <button
            key={l}
            type="button"
            className="qrchip"
            onClick={() => send(t(q))}
          >
            {t(l)}
          </button>
        ))}
      </div>
      <div
        ref={listRef}
        className="screen-scroll"
        onScroll={handleScroll}
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Disclaimer clínico preventivo (Fase 9): no invasivo, siempre
            visible al inicio del listado. No sustituye atención de urgencia:
            ante síntomas de alarma el chat sugiere activar SOS. */}
        <div className="chat-disclaimer" role="note">
          <IonIcon
            icon={informationCircle}
            aria-hidden="true"
            className="chat-disclaimer-ico"
          />
          <span>
            {t(
              "Asistente clínico inteligente (no sustituye una consulta médica de urgencia)",
            )}
          </span>
        </div>
        {hasMore ? (
          <div className="chat-history-hint" role="status">
            {loadingMore ? (
              <>
                <IonSpinner name="crescent" style={{ width: 14, height: 14 }} />
                <span>{t("Cargando mensajes anteriores…")}</span>
              </>
            ) : (
              <span>
                {t("Desliza hacia arriba para ver mensajes anteriores")}
              </span>
            )}
          </div>
        ) : chat.length > PAGE_SIZE ? (
          <div className="chat-history-hint" role="status">
            <span>{t("Inicio de la conversación")}</span>
          </div>
        ) : null}
        {chat.map((m) => (
          <div
            key={m.id}
            className={`chat-row${m.role === "user" ? " chat-row-user" : ""}`}
          >
            {m.role !== "user" ? (
              <div
                className={`chat-avatar${m.role === "alert" ? " chat-avatar-alert" : ""}`}
                aria-hidden="true"
              >
                {m.role === "alert" ? "!" : "AI"}
              </div>
            ) : (
              <div className="chat-avatar chat-avatar-user" aria-hidden="true">
                {userInitial}
              </div>
            )}
            <div className="chat-msg">
              <div
                className={`bub ${m.role === "user" ? "bub-usr" : m.role === "alert" ? "bub-alert" : "bub-bot"}`}
              >
                {m.role === "user" && m.image && (
                  // Miniatura de la imagen conversacional adjunta (D3):
                  // ancho acotado, radius de marca, sin recargar el hilo.
                  <img
                    src={m.image.dataUrl}
                    alt={t("Imagen adjunta")}
                    style={{
                      display: "block",
                      maxWidth: 220,
                      maxHeight: 220,
                      width: "100%",
                      objectFit: "cover",
                      borderRadius: 12,
                      marginBottom: m.text ? 8 : 0,
                    }}
                  />
                )}
                {m.role === "user" ? m.text : <ChatRichText text={m.text} />}
                {m.role === "alert" && (
                  <IonButton
                    expand="block"
                    size="small"
                    className="cta-button"
                    aria-label={t("Activar protocolo de emergencia")}
                    onClick={openPanic}
                  >
                    {t("Activar protocolo de emergencia")}
                  </IonButton>
                )}
                {m.role === "bot" && m.cta && (
                  <IonButton
                    expand="block"
                    size="small"
                    className="cta-button"
                    aria-label={m.cta.ctaText}
                    onClick={openBookingWizard}
                  >
                    {t(m.cta.ctaText)}
                  </IonButton>
                )}
                {m.role === "bot" && m.kind === "lab-exam" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 8,
                    }}
                  >
                    <IonBadge color="success">{t("Examen procesado")}</IonBadge>
                    <IonButton
                      size="small"
                      fill="clear"
                      aria-label={t("Ver todas las métricas")}
                      onClick={() => navigate("hc")}
                    >
                      {t("Ver todas las métricas")}
                    </IonButton>
                  </div>
                )}
                {/* Feedback clínico (Fase 9): solo en respuestas reales del
                    backend con executionId; fallbacks locales no se califican. */}
                {m.role === "bot" && m.executionId && (
                  <ChatFeedbackAction executionId={m.executionId} />
                )}
              </div>
              <div className="chat-time">{m.time}</div>
            </div>
          </div>
        ))}
        {uploading && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexDirection: "row",
            }}
          >
            <div className="chat-avatar" aria-hidden="true">
              AI
            </div>
            <div>
              <div
                className="bub bub-bot"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IonSpinner name="crescent" style={{ width: 16, height: 16 }} />
                <span>{t("Analizando examen de laboratorio…")}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="composer">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,application/pdf"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
        <IonButton
          className="bt bt-round"
          style={
            {
              "--background": "var(--blue-l)",
              "--color": "var(--blue)",
            } as CSSProperties
          }
          aria-label={t("Agente de voz")}
          disabled={uploading}
          onClick={openVoice}
        >
          <IonIcon icon={mic} style={{ fontSize: 20 }} />
        </IonButton>
        {/* Foto conversacional (D3): cámara o galería con prompt nativo. */}
        <IonButton
          className="bt bt-round"
          style={
            {
              "--background": "var(--teal-l)",
              "--color": "var(--teal)",
            } as CSSProperties
          }
          aria-label={t("Adjuntar imagen al chat")}
          disabled={uploading || !!pendingImage}
          onClick={() => void handleCaptureImage()}
        >
          <IonIcon icon={cameraOutline} style={{ fontSize: 20 }} />
        </IonButton>
        <IonButton
          className="bt bt-round"
          style={
            {
              "--background": "var(--blue-l)",
              "--color": "var(--blue)",
            } as CSSProperties
          }
          aria-label={t("Adjuntar examen")}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <IonIcon icon={attach} style={{ fontSize: 20 }} />
        </IonButton>
        <IonInput
          className="chat-inp"
          value={text}
          disabled={uploading}
          onIonInput={(e) => setText(e.detail.value ?? "")}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("Escribe un mensaje…")}
        />
        <motion.span
          className="chat-send-wrap"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <IonButton
            className="bt bt-round"
            style={
              {
                "--background": "var(--navy)",
                "--color": "#fff",
              } as CSSProperties
            }
            aria-label={t("Enviar")}
            disabled={uploading}
            onClick={() => send()}
          >
            <IonIcon icon={sendIcon} style={{ fontSize: 20 }} />
          </IonButton>
        </motion.span>
      </div>
      {pendingImage && (
        // Miniatura removible del adjunto pendiente (D3): preview + descarte.
        <div
          className="chat-pending-image"
          role="status"
          aria-label={t("Imagen lista para enviar")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            background: "var(--teal-l)",
            borderTop: "1px solid var(--bd)",
          }}
        >
          <img
            src={pendingImage.dataUrl}
            alt={t("Imagen adjunta")}
            style={{
              width: 52,
              height: 52,
              objectFit: "cover",
              borderRadius: 10,
            }}
          />
          <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>
            {t("Imagen lista para enviar")}
          </span>
          <IonButton
            size="small"
            fill="clear"
            aria-label={t("Quitar imagen adjunta")}
            style={{ marginLeft: "auto", color: "var(--panic)" }}
            onClick={() => setPendingImage(null)}
          >
            <IonIcon icon={closeCircle} style={{ fontSize: 22 }} />
          </IonButton>
        </div>
      )}
    </Screen>
  );
}
