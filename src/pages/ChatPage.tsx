import { IonBadge, IonButton, IonIcon, IonInput, IonSpinner } from "@ionic/react";
import { attach, medkit, mic, send as sendIcon } from "ionicons/icons";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  const end = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Al abrir el chat se intenta cargar el historial del thread estable: si el
  // backend inyectó un mensaje del bot (push proactivo), se muestra al inicio.
  const historyLoaded = useRef<string | null>(null);
  useEffect(() => {
    if (historyLoaded.current === threadId) return;
    const userId = (user.id || user.cedula || user.email || "").trim();
    if (!userId) return;
    let cancelled = false;
    void fetchThreadState(threadId, userId).then((state) => {
      if (cancelled || !state?.lastMessage) return;
      // El ref se marca SOLO cuando la hidratación se aplica: en StrictMode
      // (dev) el efecto corre dos veces y el primer fetch queda cancelado; con
      // el ref marcado de antemano el segundo intento se saltaba y el mensaje
      // proactivo nunca aparecía.
      historyLoaded.current = threadId;
      hydrateChat([{ text: state.lastMessage }]);
    });
    return () => {
      cancelled = true;
    };
  }, [threadId, user.id, user.cedula, user.email, hydrateChat]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, uploading]);

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
        className="screen-scroll"
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {chat.map((m) => (
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
