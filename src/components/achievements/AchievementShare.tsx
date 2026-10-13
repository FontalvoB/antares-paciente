import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import {
  arrowBackOutline,
  downloadOutline,
  copyOutline,
  peopleOutline,
  shareSocialOutline,
} from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
import { CommunityMediaUploadError } from "../../utils/community-media";
import { useCommunity } from "../../hooks/useCommunity";
import { useApp } from "../../context/AppContext";
import type { EarnedAchievement } from "../../services/achievements/achievement-store";
import { achievementCopy } from "../../services/achievements/achievement-copy";
import {
  downloadAchievement,
  renderAchievementCard,
  shareAchievementFile,
  type CardFormat,
} from "../../services/achievements/share-card";

export function AchievementShare({
  achievement,
  onBack,
}: {
  achievement: EarnedAchievement;
  onBack: () => void;
}) {
  const t = useT();
  const { showToast } = useApp();
  const { createPost, uploadPostImage } = useCommunity();
  const copy = achievementCopy(achievement, t);
  const [format, setFormat] = useState<CardFormat>("square");
  const [caption, setCaption] = useState(copy.caption);
  const [asset, setAsset] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    let url = "";
    setAsset(null);
    setError("");
    void renderAchievementCard(
      copy.title,
      copy.message,
      t("Un logro para celebrar"),
      format,
    )
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setAsset({
          file: new File([blob], `copp-logro-${format}.png`, {
            type: "image/png",
          }),
          url,
        });
      })
      .catch(() => {
        if (active)
          setError(t("No pudimos preparar la tarjeta. Intenta de nuevo."));
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [copy.title, copy.message, t, format, attempt]);
  async function perform(action: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      if (
        alive.current &&
        !(
          err instanceof Error &&
          (err.name === "AbortError" || /cancel/i.test(err.message))
        )
      )
        setError(
          err instanceof CommunityMediaUploadError
            ? t("No pudimos subir la imagen a Comunidad. Tu tarjeta está lista: puedes descargarla o compartirla en otras apps mientras se restablece el servicio.")
            : t("No se pudo compartir. Tu tarjeta sigue disponible para reintentar."),
        );
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="achievement-share">
      <IonButton fill="clear" disabled={busy} onClick={onBack}>
        <IonIcon slot="start" icon={arrowBackOutline} />
        {t("Volver")}
      </IonButton>
      <h2>{t("Tu constancia merece celebrarse")}</h2>
      <p>{t("Elige un formato y comparte tu logro a tu manera.")}</p>
      <IonSegment className="achievement-format"
        value={format}
        disabled={busy}
        onIonChange={(e) => setFormat(e.detail.value as CardFormat)}
      >
        <IonSegmentButton value="square">{t("Comunidad · cuadrada")}</IonSegmentButton>
        <IonSegmentButton value="story">
          {t("Instagram / Facebook")}
        </IonSegmentButton>
      </IonSegment>
      <p className="achievement-format-hint">{t("Comunidad usa publicaciones cuadradas. El formato vertical es para historias en Instagram, Facebook y otras redes.")}</p>
      {asset ? (
        <img
          className={`achievement-export ${format}`}
          src={asset.url}
          alt={copy.title}
        />
      ) : (
        !error && <IonSpinner />
      )}
      <IonTextarea
        label={t("Mensaje para compartir")}
        labelPlacement="stacked"
        autoGrow
        maxlength={1200}
        value={caption}
        disabled={busy || published}
        onIonInput={(e) => setCaption(e.detail.value || "")}
      />
      <p className="achievement-privacy">
        {t(
          "La tarjeta no incluye mediciones clínicas, nombre ni datos de contacto. Revisa tu mensaje antes de publicarlo.",
        )}
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!asset && (
            <IonButton onClick={() => setAttempt((a) => a + 1)}>
              {t("Reintentar")}
            </IonButton>
          )}
        </div>
      )}
      <div className="achievement-share-actions">
      <IonButton
        className="achievement-community-action"
        disabled={!asset || busy || published || uncertain || !caption.trim()}
        onClick={() =>
          void perform(async () => {
            if (!asset) return;
            // Community has posts, not stories: always publish a square card there.
            const communityFile = format === "square" ? asset.file : new File([
              await renderAchievementCard(copy.title, copy.message, t("Un logro para celebrar"), "square"),
            ], "copp-logro-square.png", { type: "image/png" });
            const key = await uploadPostImage(communityFile, communityFile.type);
            if (!alive.current) return;
            setUncertain(true);
            const post = await createPost(caption.trim(), key);
            if (!post) throw new Error("Missing post confirmation");
            if (alive.current) {
              setUncertain(false);
              setPublished(true);
              showToast(t("Logro publicado en Comunidad"), "ok");
            }
          })
        }
      >
        <IonIcon slot="start" icon={peopleOutline} />
        {published
          ? t("Publicado en Comunidad")
          : busy
            ? t("Compartiendo…")
            : t("Publicar en Comunidad")}
      </IonButton>
      {uncertain && !busy && (
        <p className="achievement-publish-warning" role="alert">
          {t(
            "No pudimos confirmar la publicación. Revisa Comunidad antes de volver a publicar para evitar duplicados.",
          )}
        </p>
      )}
      <IonButton
        className="achievement-external-action"
        fill="outline"
        disabled={!asset || busy}
        onClick={() =>
          void perform(async () => {
            if (!asset) return;
            const status = await shareAchievementFile(
              asset.file,
              copy.title,
              caption,
            );
            if (status === "unsupported") {
              downloadAchievement(asset.file);
              showToast(
                t("Tarjeta descargada. Adjunta la imagen en tu red social."),
              );
            }
          })
        }
      >
        <IonIcon slot="start" icon={shareSocialOutline} />
        {t("Compartir en otras apps")}
      </IonButton>
      </div>
      <p className="achievement-social-hint">
        {t(
          "Instagram, WhatsApp, Facebook o X: elige una app instalada en el menú de tu teléfono. Algunas apps requieren pegar el mensaje por separado.",
        )}
      </p>
      <div className="achievement-share-utilities">
      {!Capacitor.isNativePlatform() && (
        <IonButton
          fill="clear"
          disabled={!asset || busy}
          onClick={() => asset && downloadAchievement(asset.file)}
        >
          <IonIcon slot="start" icon={downloadOutline} />
          {t("Descargar tarjeta")}
        </IonButton>
      )}
      <IonButton
        fill="clear"
        disabled={busy}
        onClick={() =>
          void perform(async () => {
            await navigator.clipboard.writeText(caption);
            showToast(t("Mensaje copiado"));
          })
        }
      >
        <IonIcon slot="start" icon={copyOutline} />
        {t("Copiar mensaje")}
      </IonButton>
      </div>
    </div>
  );
}
