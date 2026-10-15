import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  IonButton,
  IonIcon,
  IonActionSheet,
  IonSpinner,
} from "@ionic/react";
import {
  checkmarkCircleOutline,
  downloadOutline,
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
} from "../../services/achievements/share-card";

export function AchievementShare({
  achievement,
  onBack,
}: {
  achievement: EarnedAchievement;
  onBack: () => void;
}) {
  const t = useT();
  const { showToast, navigate } = useApp();
  const { createPost, uploadPostImage, queuePost } = useCommunity();
  const copy = achievementCopy(achievement, t);
  const [chooseFormat, setChooseFormat] = useState(false);
  const captionRef = useRef(copy.caption);
  const [hasCaption, setHasCaption] = useState(!!copy.caption.trim());
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
      "square",
    )
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setAsset({
          file: new File([blob], "copp-logro-square.png", {
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
  }, [copy.title, copy.message, t, attempt]);
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
  async function shareExternal(format: "square" | "story") {
    await perform(async () => {
      if (!asset) return;
      const file = format === "square" ? asset.file : new File([
        await renderAchievementCard(copy.title, copy.message, t("Un logro para celebrar"), "story"),
      ], "copp-logro-story.png", { type: "image/png" });
      const status = await shareAchievementFile(file, copy.title, captionRef.current);
      if (status === "unsupported") {
        downloadAchievement(file);
        showToast(t("Tarjeta descargada. Adjunta la imagen en tu red social."));
      }
    });
  }
  return (
    <div className="achievement-share">
      <div className="achievement-preview">
        {asset ? <img className="achievement-export" src={asset.url} alt={copy.title} /> :
          !error && <div className="achievement-preview-loading"><IonSpinner /></div>}
        {!Capacitor.isNativePlatform() && <IonButton className="achievement-download" fill="clear"
          aria-label={t("Descargar tarjeta")} disabled={!asset || busy}
          onClick={() => asset && downloadAchievement(asset.file)}>
          <IonIcon slot="icon-only" icon={downloadOutline} />
        </IonButton>}
      </div>
      {published ? (
        <div className="achievement-published" role="status">
          <IonIcon icon={checkmarkCircleOutline} />
          <h3>{t("Compartido con tu comunidad")}</h3>
          <IonButton className="achievement-community-action" expand="block" onClick={() => { onBack(); navigate("com"); }}>
            {t("Ver publicación")}
          </IonButton>
        </div>
      ) : (
        <div className="achievement-caption-field">
          <label htmlFor="achievement-message">{t("Añade un mensaje")}</label>
          <textarea id="achievement-message" className="achievement-caption-input" rows={3} maxLength={1200}
            defaultValue={captionRef.current} disabled={busy}
            onChange={e => {captionRef.current=e.currentTarget.value;setHasCaption(!!e.currentTarget.value.trim())}} />
        </div>
      )}
      {error && <div className="achievement-share-error" role="alert">
        <p>{error}</p>
        {!asset && <IonButton onClick={() => setAttempt((a) => a + 1)}>{t("Reintentar")}</IonButton>}
      </div>}
      {uncertain && !busy && <p className="achievement-publish-warning" role="alert">
        {t("No pudimos confirmar la publicación. Revisa Comunidad antes de volver a publicar para evitar duplicados.")}
      </p>}
      <div className="achievement-share-actions">
        {!published && <IonButton className="achievement-community-action"
          disabled={!asset || busy || uncertain || !hasCaption}
          onClick={() => void perform(async () => {
            if (!asset) return;
            if (queuePost) {
              queuePost({body:captionRef.current.trim(),file:asset.file});
              onBack(); navigate('com'); return;
            }
            const key = await uploadPostImage(asset.file, asset.file.type);
            if (!alive.current) return;
            setUncertain(true);
            const post = await createPost(captionRef.current.trim(), key);
            if (!post) throw new Error("Missing post confirmation");
            if (alive.current) {
              setUncertain(false);
              setPublished(true);
              showToast(t("Logro publicado en Comunidad"), "ok");
            }
          })}>
          <IonIcon slot="start" icon={peopleOutline} />
          {busy ? t("Compartiendo…") : t("Publicar en Comunidad")}
        </IonButton>}
        <IonButton className="achievement-external-action" fill="outline"
          disabled={!asset || busy} onClick={() => setChooseFormat(true)}>
          <IonIcon slot="start" icon={shareSocialOutline} />
          {t("Compartir")}
        </IonButton>
      </div>
      <IonActionSheet isOpen={chooseFormat} header={t("Compartir")}
        onDidDismiss={() => setChooseFormat(false)} buttons={[
          { text: t("Publicación"), handler: () => { void shareExternal("square"); } },
          { text: t("Historia"), handler: () => { void shareExternal("story"); } },
          { text: t("Cancelar"), role: "cancel" },
        ]} />
    </div>
  );
}
