import { VitaActions } from "../components/chat/VitaActions";
import {APPOINTMENTS_ENABLED, appointmentLinksForDisplay, isAppointmentAction} from "../utils/appointmentsVisibility";
import {
  IonActionSheet,
  IonBadge,
  IonButton,
  IonIcon,
  IonTextarea,
  IonAvatar,
  IonSpinner,
} from "@ionic/react";
import { CameraSource } from "@capacitor/camera";
import {
  attachOutline,
  barbellOutline,
  cameraOutline,
  closeCircle,
  documentOutline,
  imagesOutline,
  informationCircle,
  medkit,
  mic,
  nutritionOutline,
  calendarOutline,
  pulseOutline,
  trendingUpOutline,
  stop as stopIcon,
  send as sendIcon,
} from "ionicons/icons";
import { motion } from "framer-motion";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Screen } from "../components/Screen";
import vitaPortrait from "../assets/vita-coach.png";
import { ChatRichText } from "../components/ChatRichText";
import { ChatFeedbackAction } from "../components/chat/ChatFeedbackAction";
import { useApp } from "../context/AppContext";
import { useI18n, useT } from "../i18n/I18nContext";
import { fetchThreadState, uploadLabExam } from "../utils/threadApi";
import { captureChatImage } from "../services/media/camera-service";
import { localizedError } from "../utils/localizedError";
import {
  canShowChatAction,
  chatTextForDisplay,
} from "../utils/chatNutritionVisibility";

const quick = [
  ["Hábitos", "¿Cómo puedo organizar mis hábitos diarios?", pulseOutline],
  ["Progreso", "¿Cómo va mi progreso esta semana?", trendingUpOutline],
  ["Ejercicios", "¿Qué ejercicios me corresponden hoy según mi rutina?", barbellOutline],
  ["Nutrición", "¿Qué debo comer hoy según mi plan?", nutritionOutline],
  ...(APPOINTMENTS_ENABLED ? [["Agendar", "Agenda una cita con el médico para hoy", calendarOutline]] : []),
];

/** Mensajes visibles por tramo del historial progresivo. */
const PAGE_SIZE = 10;
/** Distancia al tope (px) que dispara la carga del tramo anterior. */
const SCROLL_TOP_THRESHOLD = 48;

export function ChatPage() {
  const {
    chat,
    chatGenerating, cancelChat, retryChat, voiceOpen, voiceMinimized, chatHistoryRevision,
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
  // Progressive disclosure del compositor (+): hoja de acciones de adjuntos.
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
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
  const nearEnd = useRef(true);
  const [newMessages, setNewMessages] = useState(false);
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
  const previousVoiceOpen = useRef(voiceOpen);
  const historyRevisionSeen = useRef(chatHistoryRevision);
  useEffect(() => {
    if ((previousVoiceOpen.current && !voiceOpen) || historyRevisionSeen.current !== chatHistoryRevision) historyLoaded.current = null;
    historyRevisionSeen.current = chatHistoryRevision;
    previousVoiceOpen.current = voiceOpen;
    if (historyLoaded.current === threadId) return;
    if (!userId) return;
    let cancelled = false;
    void fetchThreadState(threadId, userId, { limit: PAGE_SIZE }).then(
      (state) => {
        if (cancelled) return;
        // Marcar al terminar el intento vigente, nunca antes de la respuesta:
        // StrictMode puede cancelar el primero. Incluso un historial vacío
        // evita volver a consultar por cada token o callback de voz.
        historyLoaded.current = threadId;
        // Página más reciente cuando el backend la expone (roles user/bot
        // mapeados); fallback al último mensaje con backends anteriores.
        const history = (state?.messages ?? [])
          .filter((m) => Boolean(m.text && m.text.trim().length > 0))
          .map((m) => ({
            ...m,
            role: m.role === "user" ? ("user" as const) : ("bot" as const),
          }));
        let more = Boolean(state?.hasMore);
        if (!history.length) {
          if (!state?.lastMessage) return;
          history.push({ text: state.lastMessage, role: "bot" as const });
          // El fallback de un único mensaje no deja tramos anteriores.
          more = false;
        }
        setHasMore(more);
        setNextCursor(state?.nextCursor ?? null);
        hydrateChat(history);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [threadId, userId, hydrateChat, voiceOpen, chatHistoryRevision]);

  useEffect(() => {
    if (prependingRef.current) {
      // El cambio de chat.length viene de anteponer mensajes: el anclaje ya
      // compensó la posición, no hay que saltar al final.
      prependingRef.current = false;
      return;
    }
    if (nearEnd.current) end.current?.scrollIntoView({ behavior: "instant", block: "end" });
    else setNewMessages(true);
  }, [chat, uploading]);

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
    if (!el) return;
    nearEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    if (nearEnd.current) setNewMessages(false);
    if (loadingMore || !hasMore || !userId) return;
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
            ...m,
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

  // Se filtra solo la presentación: el historial original sigue disponible
  // para reactivar Nutrición. Un mensaje compuesto solo por una URL oculta
  // no debe convertirse en una burbuja vacía con «escribiendo» permanente.
  const visibleChat = chat.map((message) => ({
    ...message,
    displayText: message.role === "user" ? message.text : appointmentLinksForDisplay(chatTextForDisplay(message.text)),
    visibleCta: message.cta && (APPOINTMENTS_ENABLED || !isAppointmentAction(message.cta.type, message.cta.ctaText)) && canShowChatAction(message.cta.type, message.cta.ctaText)
      ? message.cta : null,
  })).filter((message) => !message.text || message.displayText.trim() || message.image || message.visibleCta);

  const send = (msg = text) => {
    if (uploading || chatGenerating) return;
    const v = msg.trim();
    if (!v) return;
    nearEnd.current = true; setNewMessages(false);
    sendChat(v, pendingImage ?? undefined);
    setPendingImage(null);
    setText("");
  };

  /**
   * Adjunto conversacional desde el ActionSheet del compositor (+).
   * REUTILIZA `captureChatImage` (una sola configuración de captura: Base64
   * q75, ancho 1280, orientación corregida) para mantener el payload
   * multimodal en el presupuesto del backend; la fuente (cámara o galería)
   * la elige la hoja de acciones del propio chat. Cancelación o permiso
   * denegado → silencioso (nunca rompe el compositor).
   */
  const attachFromSource = async (source: CameraSource) => {
    if (uploading) return;
    try {
      const photo = await captureChatImage(source, lang);
      if (photo) setPendingImage(photo);
    } catch {
      // El usuario canceló: no mostrar ruido.
    }
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
          // No presentar el análisis de un servidor antiguo como verificación
          // clínica. El estado pendiente también permanece visible sin conexión.
          text: result.verificationStatus === "pending_review"
            ? t("Documento guardado. Los valores detectados están pendientes de verificación y no se han añadido a tus mediciones. Tu equipo puede revisar el archivo original.")
            : t("Documento recibido. Consulta el archivo original con tu equipo para verificar sus valores."),
          kind: result.verificationStatus === "pending_review" ? "lab-exam-pending" : "lab-exam",
        },
      ]);
    } catch (err: unknown) {
      showToast(localizedError(err, { t, lang }, "Error al procesar el examen."), "err");
    } finally {
      setUploading(false);
    }
  };

  const isEmpty = !chat.length || chat.every(message => message.id === "welcome");
  const quickActions = <div className={`chat-quick-actions${isEmpty ? " is-empty" : ""}`} aria-label={t("Acciones rápidas del chat")}>
    {quick.filter(([label]) => canShowChatAction("", label)).map(([label, question, icon]) => <IonButton key={label} fill="clear" className="chat-quick-action" disabled={chatGenerating || uploading} onClick={() => send(t(question))}>
      <IonIcon icon={icon} aria-hidden="true" /><span>{t(label)}</span>
    </IonButton>)}
  </div>;

  return (
    <Screen className="chat-kb chat-reference">
      <header className="vita-chat-header">
        <IonAvatar className="vita-header-avatar"><img src={vitaPortrait} alt="" /></IonAvatar>
        <div className="vita-header-copy"><h1>Vita</h1><p role="status">{chatGenerating ? t("Preparando tu respuesta…") : t("Tu coach de salud y bienestar")}</p></div>
        <IonButton fill="clear" className="vita-header-call" aria-label={t("Agente de voz")} onClick={openVoice}><IonIcon icon={mic} /></IonButton>
        <IonButton fill="clear" className="vita-header-sos" aria-label={t("Botón de pánico")} onClick={openPanic}><IonIcon icon={medkit} /></IonButton>
      </header>
      {voiceOpen && voiceMinimized && <div className="vita-call-space" />}
      {!isEmpty && quickActions}
      <div
        ref={listRef}
        className="screen-scroll chat-list"
        onScroll={handleScroll}
      >
        {isEmpty && <div className="vita-chat-welcome">
          <img src={vitaPortrait} alt={t("Vita, tu coach de bienestar")} />
          <h2>{t("Hola, {nombre}", { nombre: user.nombre.split(" ")[0] || t("Paciente") })}</h2>
          <p>{t("Soy Vita. Pregúntame sobre tu programa y tus hábitos.")}</p>
          {quickActions}
          <IonButton className="bt bt-primary" expand="block" onClick={openVoice}><IonIcon icon={mic} slot="start" />{t("Hablar con Vita")}</IonButton>
        </div>}
        {/* Alcance de Vita: educación y apoyo al plan publicado, sin sustituir al equipo. */}
        <div className="chat-disclaimer" role="note">
          <IonIcon
            icon={informationCircle}
            aria-hidden="true"
            className="chat-disclaimer-ico"
          />
          <span>
            {t(
              "Vita te orienta sobre hábitos y te ayuda a seguir tu plan publicado. No diagnostica ni cambia tratamientos.",
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
        {visibleChat.filter(message => message.id !== "welcome").map((m, index) => {
          const isLastInGroup =
            index === visibleChat.length - 1 || visibleChat[index + 1].role !== m.role;
          const isUser = m.role === "user";
          return (
          <div
            key={m.id}
            className={`chat-row${isUser ? " chat-row-user" : ""}${isLastInGroup ? " chat-row-group-end" : " chat-row-group-middle"}`}
          >
            {!isUser && isLastInGroup ? (
              <div
                className={`chat-avatar${m.role === "alert" ? " chat-avatar-alert" : ""}`}
                aria-hidden="true"
              >
                {m.role === "alert" ? (
                  "!"
                ) : (
                  <img src={vitaPortrait} alt="" className="vita-chat-avatar" />
                )}
              </div>
            ) : !isUser ? (
              <div className="chat-avatar chat-avatar-spacer" aria-hidden="true" />
            ) : null}
            <div className="chat-msg">
              <div
                className={`bub ${isUser ? "bub-usr" : m.role === "alert" ? "bub-alert" : "bub-bot"}`}
                role={m.kind === "service-error" ? "status" : undefined}
                data-execution-id={m.executionId}
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
                {m.role === "user" ? m.text : <ChatRichText text={m.id === "welcome" ? t("Hola {nombre}, soy Vita, tu coach asignada. ¿En qué te puedo ayudar hoy?", { nombre: user.nombre.split(" ")[0] || t("Paciente") }) : m.displayText} />}
                {!m.text && m.delivery === "streaming" && <IonSpinner name="dots" aria-label={t("Preparando tu respuesta…")} />}
                {m.delivery === "interrupted" && <p className="vita-delivery">{t("Respuesta interrumpida")}</p>}
                {(m.delivery === "failed" || m.delivery === "interrupted") && m.channel !== "voice" && m.id === [...chat].reverse().find(message => message.role === "bot" && message.channel !== "voice")?.id && <IonButton fill="clear" disabled={chatGenerating} onClick={retryChat}>{t("Reintentar respuesta")}</IonButton>}
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
                {m.role === "bot" && m.visibleCta && (
                  <IonButton
                    expand="block"
                    size="small"
                    className="cta-button"
                    aria-label={m.visibleCta.ctaText}
                    onClick={openBookingWizard}
                  >
                    {t(m.visibleCta.ctaText)}
                  </IonButton>
                )}
                {m.role === "bot" && (m.kind === "lab-exam" || m.kind === "lab-exam-pending") && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 8,
                    }}
                  >
                    <IonBadge color="medium">{t(m.kind === "lab-exam-pending" ? "Pendiente de verificación" : "Documento recibido")}</IonBadge>
                    <IonButton
                      size="small"
                      fill="clear"
                      aria-label={t("Ver mi historia")}
                      onClick={() => navigate("hc")}
                    >
                      {t("Ver mi historia")}
                    </IonButton>
                  </div>
                )}
                {m.actions?.length ? <VitaActions actions={m.actions} /> : null}
                {/* Feedback clínico (Fase 9): solo en respuestas reales del
                    backend con executionId; fallbacks locales no se califican. */}
                {m.role === "bot" && m.executionId && (
                  <ChatFeedbackAction
                    executionId={m.executionId}
                    threadId={m.threadId ?? threadId}
                  />
                )}
              </div>
              <div className="chat-time">{m.time}</div>
            </div>
            {isUser && (isLastInGroup ? (
              <div className="chat-avatar chat-avatar-user" aria-hidden="true">
                {userInitial}
              </div>
              ) : <div className="chat-avatar chat-avatar-spacer" aria-hidden="true" />)}
          </div>
          );
        })}
        {uploading && (
          <div className="chat-row">
            <div className="chat-avatar" aria-hidden="true">
              <img src={vitaPortrait} alt="" className="vita-chat-avatar" />
            </div>
            <div className="chat-msg">
              <div className="bub bub-bot chat-uploading">
                <IonSpinner name="crescent" style={{ width: 16, height: 16 }} />
                <span>{t("Analizando examen de laboratorio…")}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      {newMessages && <IonButton className="vita-new-messages" fill="solid" onClick={() => { nearEnd.current = true; setNewMessages(false); end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }}>{t("Ver mensajes nuevos")}</IonButton>}
      {pendingImage && (
        // Miniatura removible del adjunto pendiente (D3): preview + descarte,
        // sobre el composer (patrón ChatGPT) para que el adjunto se vea
        // junto al mensaje que lo llevará.
        <div
          className="chat-pending-image"
          role="status"
          aria-label={t("Imagen lista para enviar")}
        >
          <img src={pendingImage.dataUrl} alt={t("Imagen adjunta")} />
          <span>{t("Imagen lista para enviar")}</span>
          <IonButton
            size="small"
            fill="clear"
            className="chat-pending-remove"
            aria-label={t("Quitar imagen adjunta")}
            onClick={() => setPendingImage(null)}
          >
            <IonIcon icon={closeCircle} style={{ fontSize: 22 }} />
          </IonButton>
        </div>
      )}
      {/* Compositor ChatGPT-style: [+ adjuntos] [voz] [entrada] [enviar].
          El + abre la hoja de acciones (progressive disclosure) con las
          fuentes de adjuntos; los mismos handlers subyacentes. */}
      <div className="composer chat-composer">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,application/pdf"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
        <IonButton
          className="bt bt-round chat-plus"
          aria-label={t("Adjuntar al chat")}
          disabled={uploading}
          onClick={() => setAttachSheetOpen(true)}
        >
          <IonIcon icon={attachOutline} style={{ fontSize: 22 }} />
        </IonButton>
        <IonButton
          className="bt bt-round chat-voice"
          aria-label={t("Agente de voz")}
          disabled={uploading}
          onClick={openVoice}
        >
          <IonIcon icon={mic} style={{ fontSize: 20 }} />
        </IonButton>
        <IonTextarea
          rows={1}
          autoGrow
          enterkeyhint="send"
          className="chat-inp"
          aria-label={t("Escribe un mensaje…")}
          value={text}
          disabled={uploading}
          onIonInput={(e) => setText(e.detail.value ?? "")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          placeholder={t("Escribe un mensaje…")}
        />
        <motion.span
          className="chat-send-wrap"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <IonButton
            className="bt bt-round chat-send"
            aria-label={chatGenerating ? t("Detener respuesta") : t("Enviar")}
            disabled={uploading || (!chatGenerating && !text.trim())}
            onClick={() => chatGenerating ? cancelChat() : send()}
          >
            <IonIcon icon={chatGenerating ? stopIcon : sendIcon} style={{ fontSize: 20 }} />
          </IonButton>
        </motion.span>
      </div>
      <IonActionSheet
        isOpen={attachSheetOpen}
        onDidDismiss={() => setAttachSheetOpen(false)}
        header={t("Adjuntar al chat")}
        buttons={[
          {
            text: t("Tomar foto"),
            icon: cameraOutline,
            handler: () => void attachFromSource(CameraSource.Camera),
          },
          {
            text: t("Fotos"),
            icon: imagesOutline,
            handler: () => void attachFromSource(CameraSource.Photos),
          },
          {
            text: t("Archivo"),
            icon: documentOutline,
            handler: () => fileInputRef.current?.click(),
          },
          { text: t("Cancelar"), role: "cancel" as const },
        ]}
      />
    </Screen>
  );
}
