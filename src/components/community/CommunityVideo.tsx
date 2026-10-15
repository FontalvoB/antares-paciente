import { IonButton } from "@ionic/react";
import { useState, type ComponentProps } from "react";
import { useI18n } from "../../i18n/I18nContext";

/** Error visible para adjuntos ausentes o sin un stream reproducible. */
export function CommunityVideo({ src, onError, onLoadedMetadata, preload = "auto", ...props }: Omit<ComponentProps<"video">, "src"> & { src?: string }) {
  const { t } = useI18n();
  const [failedSrc, setFailedSrc] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  if (src && failedSrc === src) return <div role="status" style={{ padding: 20, textAlign: "center", background: "var(--bg)", color: "var(--ink)", borderRadius: 16 }}>
    <p>{t("No se pudo reproducir este video. El archivo puede no estar disponible o tener un formato incompatible.")}</p>
    <IonButton fill="outline" onClick={() => { setFailedSrc(undefined); setAttempt(a => a + 1); }}>{t("Reintentar")}</IonButton>
  </div>;
  return <video {...props} preload={preload === 'metadata' ? 'auto' : preload} src={src}
    onLoadedMetadata={event => {
      const video = event.currentTarget;
      // iOS can leave a gray surface at time zero until a frame is decoded.
      if (!props.poster && video.currentTime === 0 && Number.isFinite(video.duration) && video.duration > 0) {
        try { video.currentTime = Math.min(0.1, video.duration / 2); } catch { /* Some streams cannot seek until buffered. */ }
      }
      onLoadedMetadata?.(event);
    }} key={`${src}-${attempt}`} onError={event => { setFailedSrc(src); onError?.(event); }} />;
}
