/**
 * Entrada única de Vita (KAN-167): agente acompañante persistente con voz,
 * texto e imagen. Es la única API pública de la carpeta:
 *
 *   <VitaEntry module="diet" summary={{ mealsLogged: 2, mealsTotal: 4 }} />
 *
 * - `module` identifica la pantalla de origen, separa el historial local y
 *   elige las sugerencias rápidas.
 * - `summary` es un resumen corto del estado visible; se sanea en
 *   `context.ts` y nunca debe incluir datos personales.
 *
 * El disparador (`VitaOrb`) es un orbe flotante que puede minimizarse a una
 * pestaña compacta y muestra como máximo un aviso proactivo por día local.
 * El panel es un `IonModal` (foco atrapado, cierre con Escape, botón y fondo)
 * que devuelve el foco al disparador. La voz reutiliza el agente global
 * (`openVoice`); el texto y las imágenes, el servicio de chat existente.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
  IonActionSheet,
  IonButton,
  IonChip,
  IonIcon,
  IonModal,
  IonNote,
  IonProgressBar,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import { CameraSource } from "@capacitor/camera";
import {
  attachOutline,
  cameraOutline,
  close,
  closeCircle,
  documentOutline,
  imagesOutline,
  informationCircle,
  mic,
  removeOutline,
  send as sendIcon,
  trashOutline,
} from "ionicons/icons";
import vitaPortrait from "../../../assets/vita-coach.png";
import { ChatRichText } from "../../../components/ChatRichText";
import { VitaActions } from "../../../components/chat/VitaActions";
import { useApp } from "../../../context/AppContext";
import { useVitaAttachmentDraft } from "../../../hooks/useVitaAttachmentDraft";
import { useI18n } from "../../../i18n/I18nContext";
import { captureChatImage, dataUrlToBlob } from "../../../services/media/camera-service";
import { VITA_ATTACHMENT_LIMIT, VITA_FILE_ACCEPT } from "../../../services/chat/vita-attachments-service";
import { setVitaVoiceOrigin } from "../../../services/chat/vita-origin";
import { chatTextForDisplay } from "../../../utils/chatNutritionVisibility";
import { buildVitaModuleContext } from "./context";
import type { VitaModuleId, VitaModuleSummary } from "./context";
import { markVitaNudgeShown, readVitaMinimized, shouldShowVitaNudge, writeVitaMinimized } from "./dock";
import { useVitaConversation } from "./useVitaConversation";
import { useVitaTapTurn } from "./useVitaTapTurn";
import { VitaOrb } from "./VitaOrb";
import { onVitaPanelRequest, setVitaPanelExpanded } from "./panel-store";
import "./vita.css";

export interface VitaEntryProps {
  /** Pantalla de origen: separa el historial y viaja como contexto. */
  module: VitaModuleId;
  /** Resumen corto del estado visible (sin datos personales). */
  summary?: VitaModuleSummary;
  /**
   * `true` (por defecto): orbe flotante propio. `false`: sin orbe ni aviso; el
   * panel lo abren disparadores de la propia pantalla con `useVitaPanel()`
   * (cabeceras con orbe de Vita, como `WellnessFrame`).
   */
  docked?: boolean;
}

/** Nombre visible del módulo (clave i18n en español). */
const MODULE_LABEL: Record<VitaModuleId, string> = {
  home: "Inicio",
  protocol: "Protocolo",
  diet: "Dieta",
  exercise: "Ejercicio",
  "close-day": "Cerrar el día",
  goal: "Objetivo",
  profile: "Perfil",
  privacy: "Privacidad",
  notifications: "Notificaciones",
  vitals: "Signos vitales",
  plan: "Tu Plan de Bienestar",
  year: "Año 365",
};

/** Sugerencias rápidas por módulo (claves i18n en español). */
const MODULE_PROMPTS: Record<VitaModuleId, readonly string[]> = {
  home: ["¿Qué me conviene priorizar hoy?", "¿Cómo voy con mi plan esta semana?"],
  protocol: ["¿Cómo completo mi protocolo de hoy?", "¿Qué paso me queda pendiente?"],
  diet: ["¿Qué puedo comer hoy según mi plan?", "Dame ideas para mi próxima comida."],
  exercise: ["¿Cómo hago mi rutina de hoy?", "¿Cómo adapto la rutina si tengo poco tiempo?"],
  "close-day": ["¿Cómo cierro mi día con buenos hábitos?", "¿Qué puedo mejorar mañana?"],
  goal: ["¿Cómo elijo un objetivo realista?", "¿Qué cambia si ajusto mi objetivo?"],
  profile: ["¿Qué puedo ajustar en mi plan?", "¿Cómo uso mejor la app?"],
  privacy: ["¿Qué datos uso en la app y para qué?", "¿Cómo exporto o borro mis datos?"],
  notifications: ["¿Qué recordatorios me conviene activar?", "¿Cómo ajusto mis horarios de aviso?"],
  vitals: ["¿Cómo registro mis signos vitales?", "¿Cómo leo la tendencia de mis registros?"],
  plan: ["¿Qué incluye mi plan de bienestar?", "¿Por dónde empiezo esta semana?"],
  year: ["¿Cómo leo mi calendario del año?", "¿Qué me dice mi resumen del mes?"],
};

/** Retraso del aviso proactivo para no competir con la entrada de la pantalla. */
const NUDGE_DELAY_MS = 900;
/** El aviso se retira solo para no tapar contenido de forma prolongada. */
const NUDGE_VISIBLE_MS = 8000;

export function VitaEntry({ module, summary, docked = true }: VitaEntryProps) {
  const { openVoice } = useApp();
  const { t, lang } = useI18n();
  const conversation = useVitaConversation(module, summary);
  const namespace = conversation.namespace;
  // Sin hilo: el adjunto queda sin atar y el backend deriva el hilo del JWT.
  const draft = useVitaAttachmentDraft("", conversation.scope);
  const [open, setOpen] = useState(false);
  const privateVoice = import.meta.env.VITE_VITA_PRIVATE_TURN === "true";
  const tap = useVitaTapTurn(privateVoice && open, lang);
  const [minimized, setMinimized] = useState(readVitaMinimized);
  const [nudge, setNudge] = useState(false);
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const tab = useRef<HTMLIonButtonElement>(null);
  const input = useRef<HTMLIonTextareaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const titleId = `vita-panel-title-${module}`;
  const moduleName = t(MODULE_LABEL[module]);
  const busy = conversation.pending || draft.phase !== null;
  const locale = lang === "en" ? "en-US" : "es-ES";

  // Aviso proactivo: como máximo una vez por día local y por cuenta. Se marca
  // al mostrarse para no insistir aunque no se descarte.
  useEffect(() => {
    if (!docked || minimized || !shouldShowVitaNudge(namespace)) return;
    const timer = window.setTimeout(() => {
      if (!shouldShowVitaNudge(namespace)) return;
      markVitaNudgeShown(namespace);
      setNudge(true);
    }, NUDGE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [docked, namespace, minimized]);

  // Con el panel abierto, los recordatorios superiores (KAN-176) se colocan
  // bajo la cabecera y la nota del panel: se mide su borde real (cambia con el
  // ancho, el idioma y la safe area) y se expone como variable CSS.
  const note = useRef<HTMLParagraphElement>(null);
  const placeOverlays = () => {
    const bottom = note.current?.getBoundingClientRect().bottom;
    // ion-toast suma 10 px a `--ion-safe-area-top`; se deja 8 px de aire.
    if (bottom) document.body.style.setProperty("--vita-overlay-top", `${Math.ceil(bottom) - 2}px`);
  };
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("vita-panel-open");
    window.addEventListener("resize", placeOverlays);
    return () => {
      window.removeEventListener("resize", placeOverlays);
      document.body.classList.remove("vita-panel-open");
      document.body.style.removeProperty("--vita-overlay-top");
    };
  }, [open]);

  useEffect(() => {
    if (!nudge) return;
    const timer = window.setTimeout(() => setNudge(false), NUDGE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  useEffect(() => {
    if (open) listEnd.current?.scrollIntoView?.({ block: "end" });
  }, [open, conversation.messages.length, conversation.pending]);

  const openPanel = () => {
    setNudge(false);
    setOpen(true);
  };

  const setDock = (next: boolean) => {
    writeVitaMinimized(next);
    setMinimized(next);
    setNudge(false);
  };

  // Disparador externo que abrió el panel (modo `docked={false}`): recibe el foco al cerrar.
  const opener = useRef<HTMLElement | null>(null);
  const focusTrigger = () => requestAnimationFrame(() => (trigger.current ?? tab.current ?? opener.current)?.focus());

  useEffect(() => {
    if (docked) return;
    return onVitaPanelRequest(() => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    });
  }, [docked]);

  useEffect(() => {
    if (docked) return;
    setVitaPanelExpanded(open);
  }, [docked, open]);
  useEffect(() => () => { if (!docked) setVitaPanelExpanded(false); }, [docked]);

  const submit = async (value = text, promptKey?: string) => {
    if (busy) return;
    const message = value.trim() || (draft.files.length ? t("Ayúdame a entender estos archivos.") : "");
    if (!message) return;
    const files = draft.take();
    if (!files) return;
    setText("");
    // El foco vuelve al campo: el botón de enviar queda deshabilitado tras enviar.
    void input.current?.setFocus?.();
    await conversation.send({ text: message, attachments: files, promptKey: value === text ? undefined : promptKey });
  };

  const attachFromCamera = (source: CameraSource) => {
    if (busy) return;
    void draft.attach(async () => {
      const photo = await captureChatImage(source, lang);
      if (!photo) return null;
      const extension = photo.mimeType === "image/png" ? "png" : "jpg";
      return new File([dataUrlToBlob(photo.dataUrl)], `${t("Foto adjunta")}.${extension}`, { type: photo.mimeType });
    });
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file && !busy) void draft.attach(() => file);
  };

  const onComposerKey = (event: KeyboardEvent<HTMLIonTextareaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {docked && <VitaOrb
        module={module}
        label={t("Preguntar a Vita sobre {modulo}", { modulo: moduleName })}
        open={open}
        minimized={minimized}
        nudge={nudge}
        triggerRef={trigger}
        tabRef={tab}
        onOpen={openPanel}
        onRestore={() => {
          setDock(false);
          focusTrigger();
        }}
        onDismissNudge={() => {
          setNudge(false);
          focusTrigger();
        }}
      />}

      <IonModal
        isOpen={open}
        className="vita-panel-modal"
        aria-labelledby={titleId}
        onDidPresent={() => {
          placeOverlays();
          void input.current?.setFocus();
        }}
        onDidDismiss={() => {
          setOpen(false);
          setSheetOpen(false);
          focusTrigger();
        }}
      >
        <section
          className="vita-panel"
          data-vita-panel={module}
          onKeyDown={(event) => {
            // Escape cierra aunque el foco esté en un control interno.
            if (event.key === "Escape" && !sheetOpen) {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <header className="vita-panel-head">
            <span className="vita-panel-avatar" aria-hidden="true">
              <img src={vitaPortrait} alt="" />
            </span>
            <div className="vita-panel-identity">
              <h2 id={titleId}>Vita</h2>
              <p role="status">
                {conversation.pending
                  ? t("Preparando tu respuesta…")
                  : t("Contexto: {modulo}", { modulo: moduleName })}
              </p>
            </div>
            <IonButton
              fill="clear"
              className="vita-panel-icon"
              disabled={!conversation.messages.length}
              aria-label={t("Borrar el historial de Vita en {modulo}", { modulo: moduleName })}
              onClick={conversation.clear}
            >
              <IonIcon slot="icon-only" icon={trashOutline} aria-hidden="true" />
            </IonButton>
            <IonButton
              fill="clear"
              className="vita-panel-icon"
              aria-label={t("Minimizar Vita")}
              onClick={() => {
                setOpen(false);
                setDock(true);
              }}
            >
              <IonIcon slot="icon-only" icon={removeOutline} aria-hidden="true" />
            </IonButton>
            <IonButton fill="clear" className="vita-panel-icon" aria-label={t("Cerrar Vita")} onClick={() => setOpen(false)}>
              <IonIcon slot="icon-only" icon={close} aria-hidden="true" />
            </IonButton>
          </header>

          <p ref={note} className="vita-panel-note" role="note">
            <IonIcon icon={informationCircle} aria-hidden="true" />
            <span>{t("Vita te orienta sobre hábitos y te ayuda a seguir tu plan publicado. No diagnostica ni cambia tratamientos.")}</span>
          </p>

          {privateVoice && (tap.error || tap.result || tap.phase !== "idle") && (
            <div className="vita-panel-note" role="status">
              {tap.error && <span>{t(tap.error)}</span>}
              {tap.phase === "preparing" && <span>{t("Preparando el micrófono…")}</span>}
              {tap.phase === "recording" && <span>{t("Grabando. Toca enviar antes de 20 segundos.")}</span>}
              {tap.phase === "sending" && <span>{t("Procesando el turno de voz…")}</span>}
              {tap.result && <div>
                {tap.result.transcript && <p>{tap.result.transcript}</p>}
                <p>{tap.result.reply}</p>
                <IonButton fill="clear" size="small" onClick={tap.play}>{t("Reproducir respuesta")}</IonButton>
              </div>}
              {tap.phase !== "idle" && <IonButton fill="clear" size="small" onClick={tap.cancel}>{t("Cancelar")}</IonButton>}
            </div>
          )}

          <div className="vita-panel-log" role="log" aria-live="polite" aria-label={t("Conversación con Vita")}>
            {!conversation.messages.length && (
              <div className="vita-panel-empty">
                <p>{t("Pregúntame sobre lo que ves en esta pantalla.")}</p>
                <div className="vita-panel-prompts">
                  {MODULE_PROMPTS[module].map((prompt) => (
                    <IonButton key={prompt} fill="outline" size="small" disabled={busy} onClick={() => void submit(t(prompt), prompt)}>
                      {t(prompt)}
                    </IonButton>
                  ))}
                </div>
              </div>
            )}
            {conversation.messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`vita-msg ${isUser ? "vita-msg-user" : "vita-msg-bot"}`}>
                  <div className={`vita-bubble${message.failed ? " vita-bubble-failed" : ""}`} role={message.failed ? "status" : undefined}>
                    {isUser && message.attachments ? (
                      <IonChip className="vita-file-chip">
                        <IonIcon icon={imagesOutline} aria-hidden="true" />
                        <span>{message.attachments === 1 ? t("1 adjunto") : t("{count} adjuntos", { count: String(message.attachments) })}</span>
                      </IonChip>
                    ) : null}
                    {isUser
                      ? <p className={message.text || message.promptKey ? undefined : "vita-msg-private"}>
                          {message.text || (message.promptKey ? t(message.promptKey) : t("Mensaje enviado. Tu texto no se guarda en este dispositivo."))}
                        </p>
                      : message.text
                        ? <ChatRichText text={chatTextForDisplay(message.text)} />
                        : <p className="vita-msg-private">{t("Respuesta no guardada en este dispositivo.")}</p>}
                    {message.actions?.length ? <VitaActions actions={message.actions} /> : null}
                  </div>
                  <span className="vita-msg-time">{time(message.at)}</span>
                </div>
              );
            })}
            {conversation.pending && (
              <div className="vita-msg vita-msg-bot" aria-hidden="true">
                <div className="vita-bubble vita-bubble-typing"><IonSpinner name="dots" /></div>
              </div>
            )}
            <div ref={listEnd} />
          </div>

          {(conversation.notice || draft.error || draft.files.length > 0 || draft.phase) && (
            <div className="vita-panel-draft">
              <div role="status" aria-live="polite">
                {draft.phase === "uploading" && t("Subiendo adjunto a Vita…")}
                {draft.phase === "removing" && t("Quitando adjunto…")}
                {!draft.phase && draft.files.length === VITA_ATTACHMENT_LIMIT && t("Ya tienes el máximo de adjuntos para este mensaje.")}
              </div>
              {(conversation.notice || draft.error) && (
                <IonNote role="alert" color="danger">{conversation.notice || draft.error}</IonNote>
              )}
              {draft.phase === "uploading" && (
                <>
                  <IonProgressBar type="indeterminate" aria-hidden="true" />
                  <IonButton fill="clear" size="small" onClick={draft.cancelUpload}>{t("Cancelar carga")}</IonButton>
                </>
              )}
              <div className="vita-panel-files">
                {draft.files.map((file) => {
                  const name = file.kind === "image" ? t("Imagen adjunta") : t("Archivo");
                  return (
                    <IonChip className="vita-file-chip" key={file.attachmentId}>
                      <IonIcon icon={file.kind === "image" ? imagesOutline : documentOutline} aria-hidden="true" />
                      <span>{name}</span>
                      <IonButton
                        fill="clear"
                        disabled={busy}
                        aria-label={t("Quitar adjunto: {name}", { name })}
                        onClick={() => void draft.remove(file.attachmentId)}
                      >
                        <IonIcon slot="icon-only" icon={closeCircle} aria-hidden="true" />
                      </IonButton>
                    </IonChip>
                  );
                })}
              </div>
            </div>
          )}

          <div className="vita-panel-composer">
            <input
              ref={fileInput}
              type="file"
              accept={VITA_FILE_ACCEPT}
              data-vita-file-input
              aria-label={t("Archivo para el chat")}
              hidden
              onChange={onFile}
            />
            <IonButton
              fill="clear"
              className="vita-panel-tool"
              aria-label={t("Adjuntar al chat")}
              disabled={busy || draft.files.length >= VITA_ATTACHMENT_LIMIT}
              onClick={() => setSheetOpen(true)}
            >
              <IonIcon slot="icon-only" icon={attachOutline} aria-hidden="true" />
            </IonButton>
            {privateVoice ? (
              <IonButton
                fill="clear"
                className="vita-panel-tool"
                aria-label={tap.phase === "recording" ? t("Enviar grabación") : t("Tocar para hablar")}
                disabled={tap.phase === "preparing" || tap.phase === "sending"}
                onClick={() => tap.phase === "recording" ? tap.send() : void tap.start()}
              >
                <IonIcon slot="icon-only" icon={tap.phase === "recording" ? sendIcon : mic} aria-hidden="true" />
              </IonButton>
            ) : (
              <IonButton
                fill="clear"
                className="vita-panel-tool"
                aria-label={t("Hablar con Vita")}
                onClick={() => {
                  // La sesión de voz recibe el mismo contexto acotado del módulo.
                  setVitaVoiceOrigin(buildVitaModuleContext(module, summary));
                  openVoice();
                }}
              >
                <IonIcon slot="icon-only" icon={mic} aria-hidden="true" />
              </IonButton>
            )}
            <IonTextarea
              ref={input}
              rows={1}
              autoGrow
              enterkeyhint="send"
              className="vita-panel-input"
              aria-label={t("Escribe un mensaje…")}
              placeholder={t("Escribe un mensaje…")}
              value={text}
              onIonInput={(event) => setText(event.detail.value ?? "")}
              onKeyDown={onComposerKey}
            />
            <IonButton
              className="vita-panel-send"
              aria-label={t("Enviar")}
              disabled={busy || (!text.trim() && !draft.files.length)}
              onClick={() => void submit()}
            >
              <IonIcon slot="icon-only" icon={sendIcon} aria-hidden="true" />
            </IonButton>
          </div>
        </section>

        <IonActionSheet
          isOpen={sheetOpen}
          header={t("Adjuntar al chat")}
          onDidDismiss={() => setSheetOpen(false)}
          buttons={[
            { text: t("Tomar foto"), icon: cameraOutline, handler: () => attachFromCamera(CameraSource.Camera) },
            { text: t("Fotos"), icon: imagesOutline, handler: () => attachFromCamera(CameraSource.Photos) },
            { text: t("Archivo"), icon: documentOutline, handler: () => fileInput.current?.click() },
            { text: t("Cancelar"), role: "cancel" },
          ]}
        />
      </IonModal>
    </>
  );
}
