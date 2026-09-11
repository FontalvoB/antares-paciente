import { IonBadge, IonButton, IonIcon, IonInput, IonSpinner } from "@ionic/react";
import { attach, medkit, mic, send as sendIcon } from "ionicons/icons";
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
import { useApp } from "../context/AppContext";
import { useI18n, useT } from "../i18n/I18nContext";
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
    openBookingWizard,
    appendChatMessages,
    showToast,
    navigate,
  } = useApp();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  // Ventana de historial visible: arranca en los últimos 10 y crece de a 10
  // a medida que el usuario scrollea hacia arriba.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Posición del scroll previa a insertar mensajes por encima: permite
  // compensar el scrollTop y que el contenido visible no salte.
  const anchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(
    null,
  );

  // Al abrir el chat se intenta cargar el historial del thread estable: si el
  // backend inyectó un mensaje del bot (push proactivo), se muestra al inicio.
  const historyLoaded = useRef<string | null>(null);
  useEffect(() => {
    if (historyLoaded.current === threadId) return;
    const userId = (user.id || user.cedula || user.email || "").trim();
    if (!userId) return;
    let cancelled = false;
    void fetchThreadState(threadId, userId).then((state) => {
      if (cancelled) return;
      // Historial completo cuando el backend lo expone (roles user/bot
      // mapeados); fallback al último mensaje con backends anteriores.
      const history = (state?.messages ?? [])
        .filter((m) => Boolean(m.text && m.text.trim().length > 0))
        .map((m) => ({
          text: m.text,
          role: m.role === "user" ? ("user" as const) : ("bot" as const),
        }));
      if (!history.length) {
        if (!state?.lastMessage) return;
        history.push({ text: state.lastMessage, role: "bot" as const });
      }
      // El ref se marca SOLO cuando la hidratación se aplica: en StrictMode
      // (dev) el efecto corre dos veces y el primer fetch queda cancelado; con
      // el ref marcado de antemano el segundo intento se saltaba y el mensaje
      // proactivo nunca aparecía.
      historyLoaded.current = threadId;
      // Una hidratación fresca siempre abre con la ventana mínima.
      setVisibleCount(PAGE_SIZE);
      hydrateChat(history);
    });
    return () => {
      cancelled = true;
    };
  }, [threadId, user.id, user.cedula, user.email, hydrateChat]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, uploading]);

  // Un hilo nuevo (o rehidratado) arranca siempre con los últimos 10.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [threadId]);

  const visibleMessages = chat.slice(-visibleCount);
  const hasOlderMessages = visibleCount < chat.length;

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loadingMore || !hasOlderMessages) return;
    if (el.scrollTop > SCROLL_TOP_THRESHOLD) return;
    anchorRef.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
    };
    setLoadingMore(true);
    setVisibleCount((count) => Math.min(count + PAGE_SIZE, chat.length));
  };

  // Scroll anchoring: los mensajes nuevos se insertan por encima del
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
    }
    setLoadingMore(false);
  }, [visibleCount]);

  const t = useT();
  const { lang } = useI18n();

  const send = (msg = text) => {
    if (uploading) return;
    const v = msg.trim();
    if (!v) return;
    sendChat(v);
    setText("");
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
    const isAllowedType = ["image/jpeg", "image/png", "application/pdf"].includes(type);
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
        err instanceof Error
          ? err.message
          : t("Error al procesar el examen.");
      showToast(errorMsg, "err");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen className="chat-kb">
      <PageHeader
        title={t("Chat")}
        sub={t("ANTARES AI · en línea 24/7")}
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
        {hasOlderMessages ? (
          <div className="chat-history-hint" role="status">
            {loadingMore ? (
              <>
                <IonSpinner
                  name="crescent"
                  style={{ width: 14, height: 14 }}
                />
                <span>{t("Cargando mensajes anteriores…")}</span>
              </>
            ) : (
              <span>{t("Desliza hacia arriba para ver mensajes anteriores")}</span>
            )}
          </div>
        ) : chat.length > PAGE_SIZE ? (
          <div className="chat-history-hint" role="status">
            <span>{t("Inicio de la conversación")}</span>
          </div>
        ) : null}
        {visibleMessages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              gap: 8,
              flexDirection: m.role === "user" ? "row-reverse" : "row",
            }}
          >
            {m.role !== "user" && (
              <div
                className="avatar"
                style={{
                  width: 28,
                  height: 28,
                  fontSize: 11,
                  background:
                    m.role === "alert"
                      ? "var(--panic)"
                      : "linear-gradient(145deg,#1a6ad8,#20c8ff)",
                }}
              >
                {m.role === "alert" ? "!" : "AI"}
              </div>
            )}
            <div>
              <div
                className={`bub ${m.role === "user" ? "bub-usr" : m.role === "alert" ? "bub-alert" : "bub-bot"}`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {m.role === "user" ? m.text : <ChatRichText text={m.text} />}
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
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--mu)",
                  marginTop: 4,
                  textAlign: m.role === "user" ? "right" : "left",
                }}
              >
                {m.time}
              </div>
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
            <div
              className="avatar"
              style={{
                width: 28,
                height: 28,
                fontSize: 11,
                background: "linear-gradient(145deg,#1a6ad8,#20c8ff)",
              }}
            >
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
                <IonSpinner
                  name="crescent"
                  style={{ width: 16, height: 16 }}
                />
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
      </div>
    </Screen>
  );
}
