import {
  IonButton,
  IonIcon,
  IonInput,
  IonModal,
  IonTextarea,
} from "@ionic/react";
import {
  add,
  checkmark,
  close,
  documentTextOutline,
  filmOutline,
  fitnessOutline,
  helpCircleOutline,
  imageOutline,
  leafOutline,
  send,
  shieldCheckmarkOutline,
  statsChartOutline,
  sparklesOutline,
  trashOutline,
  trophyOutline,
  videocamOutline,
} from "ionicons/icons";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Profile } from "../../graphql/community";
import { useI18n } from "../../i18n/I18nContext";
import { Avatar } from "./community";

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 100;
const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

type PostType = "text" | "image" | "video" | "poll";

const TYPE_OPTIONS: { id: PostType; labelKey: string; icon: string }[] = [
  { id: "text", labelKey: "Texto", icon: documentTextOutline },
  { id: "image", labelKey: "Imagen", icon: imageOutline },
  { id: "video", labelKey: "Video", icon: filmOutline },
  { id: "poll", labelKey: "Encuesta", icon: statsChartOutline },
];

/** Ideas rápidas para inspirar (modo texto vacío). */
const IDEAS: { icon: string; textKey: string }[] = [
  {
    icon: fitnessOutline,
    textKey: "Mi rutina de hoy: qué hice y cómo me sentí",
  },
  { icon: trophyOutline, textKey: "Un logro que quiero compartir esta semana" },
  { icon: helpCircleOutline, textKey: "Una duda para la comunidad" },
  { icon: leafOutline, textKey: "Un hábito saludable que estoy construyendo" },
];

/** Modal de nueva publicación: selector intuitivo del tipo (texto, imagen o
 *  video), adjuntado con vistas previas, flujo de subida con estados y
 *  celebración al publicar. */
export function ComposePostModal({
  open,
  onClose,
  me,
  onPublish,
  onPublishPoll,
  onUploadMedia,
  onToast,
  dark = false,
}: {
  open: boolean;
  onClose: () => void;
  me: Profile | null;
  onPublish: (text: string, mediaKey?: string | null) => Promise<void>;
  /** Publica una encuesta (la pregunta es el body del post). */
  onPublishPoll: (question: string, options: string[]) => Promise<void>;
  /** Sube el adjunto (imagen/video) y devuelve la clave de almacenamiento. */
  onUploadMedia: (file: File, contentType: string) => Promise<string>;
  onToast: (msg: string, kind?: "ok" | "err" | "info" | "warn") => void;
  dark?: boolean;
}) {
  const [type, setType] = useState<PostType>("text");
  const [draft, setDraft] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const mediaRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLIonTextareaElement | null>(null);
  const qRef = useRef<HTMLIonInputElement | null>(null);
  const ideasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; left: number; moved: boolean } | null>(
    null,
  );
  const suppressClickRef = useRef(false);
  const { t } = useI18n();
  const filledOptions = pollOptions
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  const pollReady =
    type === "poll" &&
    pollQuestion.trim().length >= 3 &&
    filledOptions.length >= 2 &&
    filledOptions.length <= 4;
  const hasContent =
    type === "poll" ? pollReady : draft.trim().length > 0 || media !== null;
  const mediaType = type === "video" ? "video" : "image";

  // Drag-to-scroll de las ideas (mouse/pointer); el touch usa el nativo del
  // overflow-x. Tras arrastrar, se suprime el click del chip para que el tap
  // accidental al soltar no inserte la idea.
  function onIdeasPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch" || !ideasRef.current) return;
    dragRef.current = {
      x: e.clientX,
      left: ideasRef.current.scrollLeft,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onIdeasPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || !ideasRef.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    ideasRef.current.scrollLeft = d.left - dx;
  }
  function onIdeasPointerEnd() {
    const d = dragRef.current;
    if (!d) return;
    if (d.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 80);
    }
    dragRef.current = null;
  }

  useEffect(() => {
    if (!open) {
      setType("text");
      setDraft("");
      setMedia(null);
      setPreview(null);
      setUploading(false);
      setPublishing(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      return;
    }
    const t = window.setTimeout(() => {
      if (type === "text") taRef.current?.setFocus();
    }, 300);
    return () => window.clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickType(next: PostType) {
    if (next !== type) {
      setType(next);
      // Al cambiar a un tipo sin archivo (o con archivo que no corresponde),
      // la vista previa anterior se limpia.
      if (
        media &&
        (next === "text" ||
          next === "poll" ||
          (next === "image" && media.type.startsWith("video")) ||
          (next === "video" && media.type.startsWith("image")))
      ) {
        clearMedia();
      }
    }
    if (next === "image" || next === "video") {
      window.setTimeout(() => mediaRef.current?.click(), 120);
    } else if (next === "poll") {
      window.setTimeout(() => qRef.current?.setFocus(), 160);
    } else {
      // Modo texto: abre el teclado automáticamente.
      window.setTimeout(() => taRef.current?.setFocus(), 160);
    }
  }

  function clearMedia() {
    if (preview) URL.revokeObjectURL(preview);
    setMedia(null);
    setPreview(null);
  }

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      onToast(
        t(
          "Debe ser una imagen (JPG, PNG, WEBP, GIF, HEIC) o un video (MP4, WEBM).",
        ),
        "warn",
      );
      return;
    }
    const isVideo = VIDEO_TYPES.includes(file.type);
    const max = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > max * 1024 * 1024) {
      onToast(
        t("El adjunto supera los {max} MB.", { max: String(max) }),
        "warn",
      );
      return;
    }
    if (!isVideo) setType("image");
    else setType("video");
    if (preview) URL.revokeObjectURL(preview);
    setMedia(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handlePublish() {
    const text = draft.trim();
    if ((!text && !media && !pollReady) || publishing || uploading) return;
    setPublishing(true);
    try {
      if (type === "poll") {
        await onPublishPoll(pollQuestion.trim(), filledOptions);
      } else {
        let mediaKey: string | null = null;
        if (media) {
          setUploading(true);
          try {
            mediaKey = await onUploadMedia(media, media.type);
          } finally {
            setUploading(false);
          }
        }
        await onPublish(text, mediaKey);
      }
      setDraft("");
      clearMedia();
      setPollQuestion("");
      setPollOptions(["", ""]);
      setCelebrate(true);
      window.setTimeout(() => setCelebrate(false), 900);
      onToast(t("Publicado en la comunidad"), "ok");
      onClose();
    } catch (e) {
      onToast((e as Error).message, "err");
    } finally {
      setPublishing(false);
    }
  }

  const isVideoPreview = !!preview && media?.type.startsWith("video");

  return (
    <IonModal
      isOpen={open}
      onDidDismiss={onClose}
      className={dark ? "com-dark-surface" : undefined}
    >
      <div className="com-detail">
        <div className="com-detail-head">
          <Avatar
            name={me?.displayName ?? "MG"}
            seedId={me?.id ?? "me"}
            size={42}
            style={{
              boxShadow: "0 0 0 2px var(--wh), 0 2px 8px rgba(16,42,80,0.14)",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="com-post-name">
              {me?.displayName ?? t("Tu perfil")}
            </div>
            <div className="com-post-time">
              {t("Publicando en la comunidad")}
            </div>
          </div>
          <IonButton
            fill="clear"
            size="small"
            className="com-detail-close"
            onClick={onClose}
            aria-label={t("Cerrar")}
          >
            <IonIcon icon={close} />
          </IonButton>
        </div>

        {/* Advertencia de privacidad PHI (Fase 10): visible siempre al
            redactar. No bloquea: recuerda no compartir datos clínicos
            confidenciales; la moderación y el reporte viven en el feed. */}
        <div
          role="note"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            margin: "0 14px 10px",
            padding: "9px 12px",
            borderRadius: 12,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.35)",
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--ion-color-dark)",
          }}
        >
          <IonIcon
            icon={shieldCheckmarkOutline}
            aria-hidden="true"
            style={{ fontSize: 18, flexShrink: 0, color: "#b45309" }}
          />
          <span>
            {t(
              "Cuida tu privacidad: recuerda no compartir datos de historia clínica, números de identificación ni resultados médicos confidenciales.",
            )}
          </span>
        </div>

        {/* Selector del tipo de publicación */}
        <div
          className="cpm-types"
          role="tablist"
          aria-label={t("Tipo de publicación")}
        >
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={type === opt.id}
              className={`cpm-type ${type === opt.id ? "on" : ""}`}
              onClick={() => pickType(opt.id)}
            >
              <IonIcon icon={opt.icon} />
              {t(opt.labelKey)}
            </button>
          ))}
        </div>

        {type !== "poll" && (
          <IonTextarea
            ref={taRef}
            className="fld composer-input comp-input"
            value={draft}
            placeholder={
              type === "text"
                ? t("¿En qué piensas?")
                : t("¿Qué cuenta la publicación?")
            }
            onIonInput={(e) => setDraft(e.detail.value ?? "")}
            autoGrow
            rows={type === "text" ? 3 : 2}
          />
        )}

        {/* Encuesta: pregunta + opciones (2 a 4, editables) */}
        {type === "poll" && (
          <div className="cpm-poll">
            <IonInput
              ref={qRef}
              className="fld"
              label={t("Pregunta")}
              labelPlacement="stacked"
              placeholder={t("¿Qué quieres preguntar a la comunidad?")}
              value={pollQuestion}
              maxlength={300}
              onIonInput={(e) => setPollQuestion(e.detail.value ?? "")}
            />
            <div className="cpm-poll-label">
              {t("Opciones")} <span>({pollOptions.length}/4 · mínimo 2)</span>
            </div>
            {pollOptions.map((opt, i) => (
              <div className="cpm-poll-row" key={i}>
                <IonInput
                  className="fld cpm-poll-opt"
                  placeholder={t("Opción {n}", { n: String(i + 1) })}
                  value={opt}
                  maxlength={100}
                  onIonInput={(e) => {
                    const v = e.detail.value ?? "";
                    setPollOptions((prev) =>
                      prev.map((p, j) => (j === i ? v : p)),
                    );
                  }}
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    className="cpm-poll-remove"
                    aria-label={t("Quitar opción {n}", { n: String(i + 1) })}
                    onClick={() =>
                      setPollOptions((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <button
                type="button"
                className="cpm-poll-add"
                onClick={() => setPollOptions((prev) => [...prev, ""])}
              >
                <IonIcon icon={add} /> {t("Agregar opción")}
              </button>
            )}
          </div>
        )}

        {/* Modo texto (vacío): ideas que inspiran; con texto: ayuda y contador */}
        {type === "text" && !draft.trim() && (
          <div className="cpm-ideas">
            <div className="cpm-ideas-label">
              <IonIcon icon={sparklesOutline} style={{ fontSize: 12 }} />{" "}
              {t("Inspirírate con un toque")}
            </div>
            <div
              className="cpm-ideas-row"
              ref={ideasRef}
              onPointerDown={onIdeasPointerDown}
              onPointerMove={onIdeasPointerMove}
              onPointerUp={onIdeasPointerEnd}
              onPointerCancel={onIdeasPointerEnd}
            >
              {IDEAS.map((idea, i) => (
                <button
                  key={idea.textKey}
                  type="button"
                  className="cpm-idea"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => {
                    if (suppressClickRef.current) return;
                    setDraft(idea.textKey);
                    navigator.vibrate?.(8);
                    window.setTimeout(() => taRef.current?.setFocus(), 60);
                  }}
                >
                  <IonIcon icon={idea.icon} className="cpm-idea-ico" />
                  <span>{t(idea.textKey)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {type === "text" && draft.trim() && (
          <div className="cpm-tipbar">
            <span className="cpm-tipbar-tip">
              <IonIcon icon={sparklesOutline} style={{ fontSize: 12 }} />{" "}
              {t("Sé específico y amable: tu comunidad aprecia los detalles.")}
            </span>
            <span className="cpm-tipbar-count">
              {draft.length}
              <small>/4000</small>
            </span>
          </div>
        )}

        {/* Zona de adjuntar según el tipo */}
        {type !== "text" && type !== "poll" && !media && (
          <button
            type="button"
            className={`cpm-drop ${type === "video" ? "video" : ""}`}
            onClick={() => mediaRef.current?.click()}
          >
            <span className="cpm-drop-ico">
              <IonIcon
                icon={type === "video" ? videocamOutline : imageOutline}
              />
            </span>
            <span className="cpm-drop-title">
              {type === "video" ? t("Agrega un video") : t("Agrega una imagen")}
            </span>
            <span className="cpm-drop-sub">
              {type === "video"
                ? t("MP4, WEBM · hasta {max} MB", { max: String(MAX_VIDEO_MB) })
                : t("JPG, PNG, WEBP · hasta {max} MB", {
                    max: String(MAX_IMAGE_MB),
                  })}
            </span>
          </button>
        )}

        {preview && (
          <div className={`cpm-media-wrap ${isVideoPreview ? "video" : ""}`}>
            {isVideoPreview ? (
              <video
                className="cpm-media"
                src={preview}
                controls
                muted
                playsInline
              />
            ) : (
              <img className="cpm-media" src={preview} alt={t("Adjunto")} />
            )}
            <button
              type="button"
              className="cpm-media-remove"
              onClick={clearMedia}
              aria-label={t("Quitar adjunto")}
            >
              <IonIcon icon={trashOutline} />
            </button>
            {uploading && (
              <div className="cpm-media-uploading">
                <IonIcon icon={sparklesOutline} /> {t("Subiendo adjunto…")}
              </div>
            )}
          </div>
        )}

        <input
          ref={mediaRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm"
          hidden
          onChange={pickFile}
        />

        <div className="cpm-foot">
          <span className="composer-hint">
            <IonIcon icon={sparklesOutline} style={{ fontSize: 13 }} />
            {type === "poll"
              ? t("Encuesta para la comunidad")
              : hasContent && media
                ? mediaType === "video"
                  ? t("Publicación con video")
                  : t("Publicación con imagen")
                : draft.trim()
                  ? t("Publicarás como {name}", {
                      name: me?.displayName ?? t("miembro"),
                    })
                  : t("Comparte con la comunidad")}
          </span>
          <IonButton
            className={`bt bt-mini composer-send ${hasContent ? "bt-pur" : ""}`}
            disabled={publishing || uploading || !hasContent}
            onClick={() => void handlePublish()}
          >
            {uploading ? (
              t("Subiendo…")
            ) : publishing ? (
              t("Publicando…")
            ) : (
              <>
                <IonIcon
                  icon={send}
                  style={{ marginRight: 4, verticalAlign: "-2px" }}
                />{" "}
                {t("Publicar")}
              </>
            )}
          </IonButton>
        </div>
      </div>
      {celebrate && (
        <div className="com-pop" role="status" aria-live="polite">
          <IonIcon icon={checkmark} />
        </div>
      )}
    </IonModal>
  );
}
