import { VitaActions } from "../components/chat/VitaActions";
import {
  APPOINTMENTS_ENABLED,
  appointmentLinksForDisplay,
  isAppointmentAction,
} from "../utils/appointmentsVisibility";
import {
  IonActionSheet,
  IonAlert,
  IonToast,
  IonBadge,
  IonButton,
  IonChip,
  IonIcon,
  IonNote,
  IonProgressBar,
  IonTextarea,
  IonSpinner,
  IonSkeletonText,
} from "@ionic/react";
import { CameraSource } from "@capacitor/camera";
import {
  attachOutline,
  trashOutline,
  barbellOutline,
  cameraOutline,
  closeCircle,
  documentOutline,
  imagesOutline,
  informationCircle,
  mic,
  nutritionOutline,
  calendarOutline,
  pulseOutline,
  trendingUpOutline,
  stop as stopIcon,
  send as sendIcon,
} from "ionicons/icons";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Screen } from "../components/Screen";
import vitaPortrait from "../assets/vita-coach.png";
import { ChatRichText } from "../components/ChatRichText";
import { ChatFeedbackAction } from "../components/chat/ChatFeedbackAction";
import { ArchiveVitaAttachmentModal } from "../components/chat/ArchiveVitaAttachmentModal";
import { useApp } from "../context/AppContext";
import { useVitaAttachmentDraft } from "../hooks/useVitaAttachmentDraft";
import { useI18n, useT } from "../i18n/I18nContext";
import { fetchThreadState, uploadLabExam } from "../utils/threadApi";
import {
  captureChatImage,
  dataUrlToBlob,
} from "../services/media/camera-service";
import {
  VITA_ATTACHMENT_LIMIT,
  VITA_FILE_ACCEPT,
} from "../services/chat/vita-attachments-service";
import type { PendingVitaAttachment } from "../services/chat/vita-attachments-service";
import { localizedError } from "../utils/localizedError";
import { queryClient } from "../utils/queryClient";
import {
  canShowChatAction,
  chatTextForDisplay,
} from "../utils/chatNutritionVisibility";

const quick = [
  ["Hábitos", "¿Cómo puedo organizar mis hábitos diarios?", pulseOutline],
  ["Progreso", "¿Cómo va mi progreso esta semana?", trendingUpOutline],
  [
    "Ejercicios",
    "¿Qué ejercicios me corresponden hoy según mi rutina?",
    barbellOutline,
  ],
  ["Nutrición", "¿Qué debo comer hoy según mi plan?", nutritionOutline],
  ...(APPOINTMENTS_ENABLED
    ? [["Agendar", "Agenda una cita con el médico para hoy", calendarOutline]]
    : []),
];

/** Mensajes visibles por tramo del historial progresivo. */
const PAGE_SIZE = 10;
/** Distancia al tope (px) que dispara la carga del tramo anterior. */
const SCROLL_TOP_THRESHOLD = 48;
/** Un intento inicial y tres relecturas; nunca polling permanente. */
const VOICE_SYNC_RETRY_MS = [1000, 2000, 4000];

export function ChatPage() {
  const reducedMotion = useReducedMotion();
  const {
    chat,
    chatGenerating,
    cancelChat,
    retryChat,
    voiceOpen,
    chatHistoryRevision,
    chatClearing,
    clearChat,
    captureChatGuard,
    observeChatHistory,
    chatHistoryEpoch,
    sendChat,
    openPanic,
    openVoice,
    threadId,
    user,
    hydrateChat,
    captureHistoryHydrator,
    prependChatMessages,
    openBookingWizard,
    appendChatMessages,
    showToast,
    navigate,
  } = useApp();
  const [text, setText] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearError, setClearError] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const clearingRef = useRef(false);
  const clearTarget = useRef<string | null>(null);
  const clearConversation = async () => {
    if (clearingRef.current || clearTarget.current !== historyScopeRef.current)
      return;
    clearingRef.current = true;
    const sourceScope = historyScopeRef.current;
    try {
      await clearChat();
      if (sourceScope === historyScopeRef.current) setClearSuccess(true);
    } catch {
      if (sourceScope === historyScopeRef.current) setClearError(true);
    } finally {
      clearingRef.current = false;
    }
  };
  const [uploading, setUploading] = useState(false);
  // Progressive disclosure del compositor (+): hoja de acciones de adjuntos.
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    file: PendingVitaAttachment;
    scope: string;
  } | null>(null);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set());
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  // Paginación server-driven: `hasMore`/`nextCursor` los define el backend y
  // `loadingMore` cubre la carga del tramo anterior al llegar al tope.
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [historyState, setHistoryState] = useState<{
    scope: string | null;
    status: "loading" | "ready" | "error";
  }>({ scope: null, status: "loading" });
  const [olderHistoryError, setOlderHistoryError] = useState(false);
  // Contador que solo dispara el efecto de anclaje tras cada fetch de página
  // (éxito o error) para compensar el scroll y apagar `loadingMore`.
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const [newMessages, setNewMessages] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labFileInputRef = useRef<HTMLInputElement>(null);
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
  const historyScope = `${userId}\0${threadId}`;
  const historyScopeRef = useRef(historyScope);
  historyScopeRef.current = historyScope;
  const attachmentScope = `${historyScope}\0${chatHistoryEpoch}`;
  const attachmentScopeRef = useRef(attachmentScope);
  attachmentScopeRef.current = attachmentScope;
  const draft = useVitaAttachmentDraft(
    threadId,
    attachmentScope,
    captureChatGuard,
  );
  const composerBusy = uploading || draft.phase !== null;
  const paginationController = useRef<AbortController | null>(null);
  const hydrateRef = useRef(hydrateChat);
  hydrateRef.current = hydrateChat;
  const captureHistoryRef = useRef(captureHistoryHydrator);
  captureHistoryRef.current = captureHistoryHydrator;
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const historyScrollRef = useRef<number | null>(null);
  const historyHydratingRef = useRef(false);
  const historyApiRef = useRef({ captureChatGuard, observeChatHistory });
  historyApiRef.current = { captureChatGuard, observeChatHistory };

  // Al abrir el chat se intenta cargar la última página del thread estable: si
  // el backend inyectó un mensaje del bot (push proactivo), se muestra al inicio.
  const historyLoaded = useRef<string | null>(null);
  const previousVoiceOpen = useRef(voiceOpen);
  const historyRevisionSeen = useRef(chatHistoryRevision);
  useEffect(() => {
    if (
      (previousVoiceOpen.current && !voiceOpen) ||
      historyRevisionSeen.current !== chatHistoryRevision
    )
      historyLoaded.current = null;
    historyRevisionSeen.current = chatHistoryRevision;
    previousVoiceOpen.current = voiceOpen;
    if (historyLoaded.current === historyScope) return;
    if (!userId || chatClearing) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    setHistoryState({ scope: historyScope, status: "loading" });
    paginationController.current?.abort();
    paginationController.current = null;
    setLoadingMore(false);
    anchorRef.current = null;
    prependingRef.current = false;
    const read = async (attempt: number) => {
      const current = historyApiRef.current.captureChatGuard?.();
      const applySnapshot = captureHistoryRef.current?.();
      const applyLegacy = hydrateRef.current;
      const state = await fetchThreadState(threadId, userId, {
        limit: PAGE_SIZE,
        syncVoice: true,
        signal: controller.signal,
      });
      if (
        cancelled ||
        controller.signal.aborted ||
        historyScopeRef.current !== historyScope
      )
        return;
      if (current && !current()) return;
      const observation =
        state && historyApiRef.current.observeChatHistory?.(state);
      if (observation && observation !== "current") return;
      // Marcar al terminar el intento vigente, nunca antes de la respuesta:
      // StrictMode puede cancelar el primero. Incluso un historial vacío
      // evita volver a consultar por cada token o callback de voz.
      historyLoaded.current = historyScope;
      setHistoryState({
        scope: historyScope,
        status: state ? "ready" : "error",
      });
      if (!state) return;
      if (
        !voiceOpen &&
        (state?.voiceSyncStatus === "processing" ||
          state?.voiceSyncStatus === "busy") &&
        attempt < VOICE_SYNC_RETRY_MS.length
      ) {
        retryTimer = setTimeout(() => {
          void read(attempt + 1);
        }, VOICE_SYNC_RETRY_MS[attempt]);
      }
      // Página más reciente cuando el backend la expone (roles user/bot
      // mapeados); fallback al último mensaje con backends anteriores.
      const history = (state?.messages ?? [])
        .filter((m) => Boolean(m.text && m.text.trim().length > 0))
        .map((m) => ({
          ...m,
          role: m.role === "user" ? ("user" as const) : ("bot" as const),
        }));
      let more = Boolean(state?.hasMore);
      let authoritativeText = true;
      if (!history.length) {
        if (!state?.lastMessage) return;
        history.push({ text: state.lastMessage, role: "bot" as const });
        authoritativeText = false; // lastMessage solo no es una página autoritativa.
        // El fallback de un único mensaje no deja tramos anteriores.
        more = false;
      }
      // La consolidación de voz es una sustitución de fuente, no un mensaje
      // entrante: no robar scroll ni mostrar el aviso de mensajes nuevos.
      if (
        listRef.current &&
        chatRef.current.some((message) => message.id !== "welcome")
      ) {
        historyScrollRef.current = listRef.current.scrollTop;
        historyHydratingRef.current = true;
      }
      const applied = applySnapshot
        ? applySnapshot(history, authoritativeText)
        : applyLegacy(history);
      if (applied === false) {
        historyScrollRef.current = null;
        historyHydratingRef.current = false;
        return;
      }
      setHasMore(more);
      setNextCursor(state?.nextCursor ?? null);
    };
    void read(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      controller.abort();
    };
  }, [
    threadId,
    userId,
    historyScope,
    voiceOpen,
    chatHistoryRevision,
    chatClearing,
    historyAttempt,
  ]);

  useLayoutEffect(() => {
    if (historyScrollRef.current != null && listRef.current)
      listRef.current.scrollTop = historyScrollRef.current;
    historyScrollRef.current = null;
  }, [chat]);

  useEffect(() => {
    if (historyHydratingRef.current) {
      historyHydratingRef.current = false;
      return;
    }
    if (prependingRef.current) {
      // El cambio de chat.length viene de anteponer mensajes: el anclaje ya
      // compensó la posición, no hay que saltar al final.
      prependingRef.current = false;
      return;
    }
    if (nearEnd.current)
      end.current?.scrollIntoView({ behavior: "instant", block: "end" });
    else setNewMessages(true);
  }, [chat, uploading]);

  // Un hilo nuevo arranca siempre con la última página y sin paginación previa.
  useEffect(() => {
    threadIdRef.current = threadId;
    setHasMore(false);
    setNextCursor(null);
    setLoadingMore(false);
    setOlderHistoryError(false);
    setNewMessages(false);
    nearEnd.current = true;
    setText("");
    setUploading(false);
    setAttachSheetOpen(false);
    setArchiveTarget(null);
    setArchivedIds(new Set());
    setArchiveSuccess(false);
    anchorRef.current = null;
    // Un prepend en vuelo del hilo anterior quedará descartado: se libera la
    // marca para que el próximo mensaje del hilo nuevo vuelva a scrollear.
    prependingRef.current = false;
    return () => {
      paginationController.current?.abort();
    };
  }, [threadId, userId, chatHistoryEpoch]);

  const handleScroll = (retry = false) => {
    const el = listRef.current;
    if (!el) return;
    nearEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    if (nearEnd.current) setNewMessages(false);
    if (chatClearing || loadingMore || !hasMore || !userId) return;
    if (!retry && el.scrollTop > SCROLL_TOP_THRESHOLD) return;
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
    setOlderHistoryError(false);
    const requestThreadId = threadId;
    const requestScope = historyScope;
    const current = captureChatGuard?.();
    const controller = new AbortController();
    paginationController.current = controller;
    void fetchThreadState(threadId, userId, {
      limit: PAGE_SIZE,
      before: nextCursor,
      signal: controller.signal,
    }).then((state) => {
      // El hilo cambió mientras el fetch estaba en vuelo (push): la página
      // pertenece al hilo anterior y se descarta por completo.
      if (
        controller.signal.aborted ||
        requestThreadId !== threadIdRef.current ||
        requestScope !== historyScopeRef.current
      )
        return;
      if (current && !current()) return;
      if (state && observeChatHistory?.(state) === "stale") return;
      if (current && !current()) return;
      // Respuesta degradada (messageCount 0): el backend devolvió 200 con el
      // historial vacío tras un fallo del AI service. No significa "no hay
      // más páginas": se conservan hasMore/nextCursor para reintentar.
      if (state && (state.messageCount ?? 0) === 0) {
        setOlderHistoryError(true);
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
        setOlderHistoryError(true);
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
  const visibleChat = chat
    .map((message) => ({
      ...message,
      displayText:
        message.role === "user"
          ? message.text
          : appointmentLinksForDisplay(chatTextForDisplay(message.text)),
      visibleCta:
        message.cta &&
        (APPOINTMENTS_ENABLED ||
          !isAppointmentAction(message.cta.type, message.cta.ctaText)) &&
        canShowChatAction(message.cta.type, message.cta.ctaText)
          ? message.cta
          : null,
    }))
    .filter(
      (message) =>
        !message.text ||
        message.displayText.trim() ||
        message.image ||
        message.visibleCta ||
        message.vitaAttachments?.length,
    );

  const send = (msg = text) => {
    if (composerBusy || chatGenerating || chatClearing) return;
    const v =
      msg.trim() ||
      (draft.files.length ? t("Ayúdame a entender estos archivos.") : "");
    if (!v) return;
    const files = draft.take();
    if (!files) return;
    nearEnd.current = true;
    setNewMessages(false);
    if (files.length) sendChat(v, undefined, files);
    else sendChat(v, undefined);
    setText("");
  };

  const attachFromSource = (source: CameraSource) => {
    if (composerBusy || chatClearing || chatGenerating) return;
    void draft.attach(async () => {
      const photo = await captureChatImage(source, lang);
      if (!photo) return null;
      const extension = photo.mimeType === "image/png" ? "png" : "jpg";
      return new File(
        [dataUrlToBlob(photo.dataUrl)],
        `${t("Foto adjunta")}.${extension}`,
        { type: photo.mimeType },
      );
    });
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (file && !composerBusy && !chatClearing && !chatGenerating)
      void draft.attach(() => file);
  };

  const handleLabFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (labFileInputRef.current) {
      labFileInputRef.current.value = "";
    }
    if (!file) return;
    if (composerBusy || chatClearing || chatGenerating) return;
    const current = captureChatGuard?.();

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
      if (current && !current()) return;
      appendChatMessages([
        {
          role: "user",
          text: `📄 ${file.name}`,
        },
        {
          role: "bot",
          // No presentar el análisis de un servidor antiguo como verificación
          // clínica. El estado pendiente también permanece visible sin conexión.
          text:
            result.verificationStatus === "pending_review"
              ? t(
                  "Documento guardado. Los valores detectados están pendientes de verificación y no se han añadido a tus mediciones. Tu equipo puede revisar el archivo original.",
                )
              : t(
                  "Documento recibido. Consulta el archivo original con tu equipo para verificar sus valores.",
                ),
          kind:
            result.verificationStatus === "pending_review"
              ? "lab-exam-pending"
              : "lab-exam",
        },
      ]);
    } catch (err: unknown) {
      if (!current || current())
        showToast(
          localizedError(err, { t, lang }, "Error al procesar el examen."),
          "err",
        );
    } finally {
      if (!current || current()) setUploading(false);
    }
  };

  const isEmpty =
    !chat.length || chat.every((message) => message.id === "welcome");
  const quickActions = (
    <div
      className={`chat-quick-actions${isEmpty ? " is-empty" : ""}`}
      aria-label={t("Acciones rápidas del chat")}
    >
      {quick
        .filter(([label]) => canShowChatAction("", label))
        .map(([label, question, icon]) => (
          <IonButton
            key={label}
            fill="clear"
            className="chat-quick-action"
            disabled={chatClearing || chatGenerating || composerBusy}
            onClick={() => send(t(question))}
          >
            <span className="chat-quick-content">
              <span className="chat-quick-icon" aria-hidden="true">
                <IonIcon icon={icon} />
              </span>
              <span>{t(label)}</span>
            </span>
          </IonButton>
        ))}
    </div>
  );

  return (
    <Screen className="chat-kb chat-reference">
      <header className="chat-premium-header p3-vita-header">
        <div className="p3-vita-identity">
          <img src={vitaPortrait} alt="" className="p3-vita-avatar" />
          <div>
            <h1>Vita</h1>
            <p role="status">
              {chatGenerating
                ? t("Preparando tu respuesta…")
                : t("Tu coach de salud y bienestar")}
            </p>
          </div>
        </div>
        <div className="p3-vita-actions">
          <IonButton
            fill="clear"
            className="vita-header-clear"
            disabled={chatClearing || clearConfirm || clearError}
            aria-label={t("Limpiar conversación")}
            title={t("Limpiar conversación")}
            onClick={() => {
              clearTarget.current = historyScope;
              setClearConfirm(true);
            }}
          >
            {chatClearing ? (
              <IonSpinner name="crescent" />
            ) : (
              <IonIcon icon={trashOutline} aria-hidden="true" />
            )}
          </IonButton>
          <IonButton
            fill="clear"
            className="p3-vita-voice"
            disabled={chatClearing}
            aria-label={t("Agente de voz")}
            onClick={openVoice}
          >
            <IonIcon icon={mic} slot="icon-only" />
          </IonButton>
          <IonButton
            fill="clear"
            className="chat-panic"
            aria-label={t("SOS · Botón de pánico")}
            onClick={openPanic}
          >
            SOS
          </IonButton>
        </div>
      </header>
      {!isEmpty && quickActions}
      <div
        ref={listRef}
        className="screen-scroll chat-list"
        onScroll={() => handleScroll()}
      >
        {isEmpty && (
          <div className="vita-chat-welcome">
            <img src={vitaPortrait} alt={t("Vita, tu coach de bienestar")} />
            <h2>
              {t("Hola, {nombre}", {
                nombre: user.nombre.split(" ")[0] || t("Paciente"),
              })}
            </h2>
            <p>{t("Soy Vita. Pregúntame sobre tu programa y tus hábitos.")}</p>
            {quickActions}
            <IonButton
              className="bt bt-primary"
              expand="block"
              onClick={openVoice}
            >
              <IonIcon icon={mic} slot="start" />
              {t("Hablar con Vita")}
            </IonButton>
          </div>
        )}
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
        {(historyState.scope !== historyScope ||
          historyState.status === "loading") &&
          !visibleChat.length && (
            <section
              className="wellness-chat-loading"
              role="status"
              aria-busy="true"
              aria-label={t("Cargando conversación…")}
            >
              <p>{t("Cargando conversación…")}</p>
              <div aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <IonSkeletonText
                    key={index}
                    animated={!reducedMotion}
                    className="wellness-skeleton-card"
                  />
                ))}
              </div>
            </section>
          )}
        {historyState.scope === historyScope &&
          historyState.status === "error" && (
            <section className="wellness-chat-state" role="alert">
              <p>
                {t(
                  "No pudimos cargar el historial. Puedes reintentar o seguir conversando.",
                )}
              </p>
              <IonButton
                fill="clear"
                onClick={() => {
                  historyLoaded.current = null;
                  setHistoryAttempt((value) => value + 1);
                }}
              >
                {t("Reintentar")}
              </IonButton>
            </section>
          )}
        {historyState.scope === historyScope &&
          historyState.status === "ready" &&
          !visibleChat.length && (
            <section className="wellness-chat-state" role="status">
              <h2>{t("Tu conversación empieza aquí")}</h2>
              <p>{t("Elige un tema o escribe a Vita cuando quieras.")}</p>
            </section>
          )}
        {olderHistoryError && (
          <div className="wellness-chat-state" role="alert">
            <p>{t("No pudimos cargar los mensajes anteriores.")}</p>
            <IonButton
              fill="clear"
              disabled={loadingMore}
              onClick={() => handleScroll(true)}
            >
              {t("Reintentar")}
            </IonButton>
          </div>
        )}
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
        {visibleChat
          .filter((message) => message.id !== "welcome")
          .map((m, index) => {
            const isLastInGroup =
              index === visibleChat.length - 1 ||
              visibleChat[index + 1].role !== m.role;
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
                      <img
                        src={vitaPortrait}
                        alt=""
                        className="vita-chat-avatar"
                      />
                    )}
                  </div>
                ) : !isUser ? (
                  <div
                    className="chat-avatar chat-avatar-spacer"
                    aria-hidden="true"
                  />
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
                    {isUser &&
                      m.vitaAttachments?.map((file) => (
                        <IonChip
                          key={file.attachmentId}
                          className="vita-file-chip"
                        >
                          <IonIcon icon={documentOutline} aria-hidden="true" />
                          <span>{file.name}</span>
                        </IonChip>
                      ))}
                    {m.role === "user" ? (
                      m.text
                    ) : (
                      <ChatRichText
                        text={
                          m.id === "welcome"
                            ? t(
                                "Hola {nombre}, soy Vita, tu coach asignada. ¿En qué te puedo ayudar hoy?",
                                {
                                  nombre:
                                    user.nombre.split(" ")[0] || t("Paciente"),
                                },
                              )
                            : m.displayText
                        }
                      />
                    )}
                    {m.role === "bot" &&
                      m.vitaAttachments?.map((file) => (
                        <div
                          className="vita-archive-action"
                          key={file.attachmentId}
                        >
                          <span className="vita-archive-filename">
                            {file.name}
                          </span>
                          {file.readable === false && (
                            <IonNote role="status" color="warning">
                              {t(
                                "Vita no pudo leer el contenido de este adjunto.",
                              )}
                            </IonNote>
                          )}
                          {archivedIds.has(file.attachmentId) ? (
                            <IonButton
                              fill="clear"
                              expand="block"
                              onClick={() => navigate("hc")}
                            >
                              {t("Ver mi historia")}
                            </IonButton>
                          ) : (
                            <IonButton
                              fill="outline"
                              expand="block"
                              disabled={chatClearing}
                              onClick={() =>
                                setArchiveTarget({
                                  file,
                                  scope: attachmentScope,
                                })
                              }
                            >
                              {t("Guardar en mi expediente")}
                            </IonButton>
                          )}
                        </div>
                      ))}
                    {m.delivery === "interrupted" && (
                      <p className="vita-delivery">
                        {t("Respuesta interrumpida")}
                      </p>
                    )}
                    {(m.delivery === "failed" ||
                      m.delivery === "interrupted") &&
                      !m.retryUnavailable &&
                      m.channel !== "voice" &&
                      m.id ===
                        [...chat]
                          .reverse()
                          .find(
                            (message) =>
                              message.role === "bot" &&
                              message.channel !== "voice",
                          )?.id && (
                        <IonButton
                          fill="clear"
                          disabled={chatGenerating}
                          onClick={retryChat}
                        >
                          {t("Reintentar respuesta")}
                        </IonButton>
                      )}
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
                    {m.role === "bot" &&
                      (m.kind === "lab-exam" ||
                        m.kind === "lab-exam-pending") && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 8,
                          }}
                        >
                          <IonBadge color="medium">
                            {t(
                              m.kind === "lab-exam-pending"
                                ? "Pendiente de verificación"
                                : "Documento recibido",
                            )}
                          </IonBadge>
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
                    {m.actions?.length ? (
                      <VitaActions actions={m.actions} />
                    ) : null}
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
                {isUser &&
                  (isLastInGroup ? (
                    <div
                      className="chat-avatar chat-avatar-user"
                      aria-hidden="true"
                    >
                      {userInitial}
                    </div>
                  ) : (
                    <div
                      className="chat-avatar chat-avatar-spacer"
                      aria-hidden="true"
                    />
                  ))}
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
      {newMessages && (
        <IonButton
          className="vita-new-messages"
          fill="solid"
          onClick={() => {
            nearEnd.current = true;
            setNewMessages(false);
            end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }}
        >
          {t("Ver mensajes nuevos")}
        </IonButton>
      )}
      <div
        className={`vita-draft${draft.files.length || draft.phase === "uploading" || draft.error ? " vita-draft-active" : ""}`}
      >
        <div role="status" aria-live="polite">
          {draft.phase === "uploading" && t("Subiendo adjunto a Vita…")}
          {draft.phase === "removing" && t("Quitando adjunto…")}
          {!draft.phase &&
            (draft.files.length === VITA_ATTACHMENT_LIMIT
              ? t("Ya tienes el máximo de adjuntos para este mensaje.")
              : draft.files.length > 0 &&
                t(
                  "Los adjuntos se usan temporalmente en el chat. Tú decides si los guardas en tu expediente.",
                ))}
        </div>
        <IonNote aria-live="assertive" color="danger">
          {draft.error}
        </IonNote>
        {draft.phase === "uploading" && (
          <>
            <IonProgressBar type="indeterminate" aria-hidden="true" />
            <IonButton fill="clear" onClick={draft.cancelUpload}>
              {t("Cancelar carga")}
            </IonButton>
          </>
        )}
        <div className="vita-draft-files">
          {draft.files.map((file) => (
            <IonChip className="vita-file-chip" key={file.attachmentId}>
              <IonIcon icon={documentOutline} aria-hidden="true" />
              <span>{file.name}</span>
              <IonButton
                fill="clear"
                disabled={composerBusy || chatClearing}
                aria-label={t("Quitar adjunto: {name}", { name: file.name })}
                onClick={() => void draft.remove(file.attachmentId)}
              >
                <IonIcon
                  slot="icon-only"
                  icon={closeCircle}
                  aria-hidden="true"
                />
              </IonButton>
            </IonChip>
          ))}
        </div>
      </div>
      {/* Compositor ChatGPT-style: [+ adjuntos] [voz] [entrada] [enviar].
          El + abre la hoja de acciones (progressive disclosure) con las
          fuentes de adjuntos; los mismos handlers subyacentes. */}
      <div className="composer chat-composer">
        <input
          type="file"
          ref={fileInputRef}
          accept={VITA_FILE_ACCEPT}
          aria-label={t("Archivo para el chat")}
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
        <input
          type="file"
          ref={labFileInputRef}
          accept="image/jpeg,image/png,application/pdf"
          aria-label={t("Examen de laboratorio")}
          style={{ display: "none" }}
          onChange={handleLabFileSelected}
        />
        <IonButton
          className="bt bt-round chat-plus"
          aria-label={t("Adjuntar al chat")}
          disabled={composerBusy || chatClearing || chatGenerating}
          onClick={() => setAttachSheetOpen(true)}
        >
          <IonIcon icon={attachOutline} style={{ fontSize: 22 }} />
        </IonButton>
        <IonButton
          className="bt bt-round chat-voice"
          aria-label={t("Agente de voz")}
          disabled={composerBusy || chatClearing}
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
          disabled={uploading || chatClearing}
          onIonInput={(e) => setText(e.detail.value ?? "")}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t("Escribe un mensaje…")}
        />
        <motion.span
          className="chat-send-wrap"
          whileTap={reducedMotion ? undefined : { scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <IonButton
            className="bt bt-round chat-send"
            aria-label={chatGenerating ? t("Detener respuesta") : t("Enviar")}
            disabled={
              chatClearing ||
              composerBusy ||
              (!chatGenerating && !text.trim() && !draft.files.length)
            }
            onClick={() => (chatGenerating ? cancelChat() : send())}
          >
            <IonIcon
              icon={chatGenerating ? stopIcon : sendIcon}
              style={{ fontSize: 20 }}
            />
          </IonButton>
        </motion.span>
      </div>
      <IonAlert
        isOpen={clearConfirm}
        onDidDismiss={(event) => {
          setClearConfirm(false);
          if (event.detail.role === "destructive") void clearConversation();
        }}
        header={t("¿Limpiar conversación?")}
        message={t(
          "Se finalizará cualquier llamada y se eliminarán el historial y el contexto de Vita. Tus planes, resultados, documentos e historia clínica se conservan. Esta acción no se puede deshacer.",
        )}
        buttons={[
          { text: t("Cancelar"), role: "cancel" },
          { text: t("Limpiar conversación"), role: "destructive" },
        ]}
      />
      <IonAlert
        isOpen={clearError}
        onDidDismiss={(event) => {
          setClearError(false);
          if (event.detail.role === "retry") void clearConversation();
        }}
        header={t("No se pudo confirmar la limpieza")}
        message={t(
          "No pudimos confirmar el cierre de la llamada o el borrado en el servidor. Reintenta para comprobar y completar la limpieza.",
        )}
        buttons={[
          { text: t("Cancelar"), role: "cancel" },
          { text: t("Reintentar"), role: "retry" },
        ]}
      />
      <IonToast
        isOpen={clearSuccess}
        message={t("Conversación limpiada")}
        duration={2600}
        onDidDismiss={() => setClearSuccess(false)}
      />
      <IonToast
        isOpen={archiveSuccess}
        message={t("Documento guardado en tu expediente.")}
        color="success"
        duration={3200}
        onDidDismiss={() => setArchiveSuccess(false)}
      />
      {archiveTarget?.scope === attachmentScope && !chatClearing && (
        <ArchiveVitaAttachmentModal
          key={archiveTarget.file.attachmentId}
          attachment={archiveTarget.file}
          onCancel={() => setArchiveTarget(null)}
          onSaved={(document) => {
            if (attachmentScopeRef.current !== attachmentScope) return;
            setArchivedIds(
              (previous) => new Set([...previous, document.attachmentId]),
            );
            setArchiveTarget(null);
            setArchiveSuccess(true);
            void queryClient.invalidateQueries({
              queryKey: ["my-documents", user.id],
            });
          }}
        />
      )}
      <IonActionSheet
        isOpen={attachSheetOpen}
        onDidDismiss={() => setAttachSheetOpen(false)}
        header={t("Adjuntar al chat")}
        buttons={[
          ...(draft.files.length < VITA_ATTACHMENT_LIMIT
            ? [
                {
                  text: t("Tomar foto"),
                  icon: cameraOutline,
                  handler: () => attachFromSource(CameraSource.Camera),
                },
                {
                  text: t("Fotos"),
                  icon: imagesOutline,
                  handler: () => attachFromSource(CameraSource.Photos),
                },
                {
                  text: t("Archivo"),
                  icon: documentOutline,
                  handler: () => fileInputRef.current?.click(),
                },
              ]
            : []),
          {
            text: t("Examen de laboratorio"),
            icon: pulseOutline,
            handler: () => labFileInputRef.current?.click(),
          },
          { text: t("Cancelar"), role: "cancel" as const },
        ]}
      />
    </Screen>
  );
}
