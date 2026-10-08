import { IonButton } from "@ionic/react";
import { useState, type ComponentProps } from "react";
import { useI18n } from "../../i18n/I18nContext";

/** Error visible para adjuntos ausentes o sin un stream reproducible. */
export function CommunityVideo({ src, onError, ...props }: Omit<ComponentProps<"video">, "src"> & { src?: string }) {
  const { t } = useI18n();
  const [failedSrc, setFailedSrc] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  if (src && failedSrc === src) return <div role="status" style={{ padding: 20, textAlign: "center", background: "var(--bg)", color: "var(--ink)", borderRadius: 16 }}>
    <p>{t("No se pudo reproducir este video. El archivo puede no estar disponible o tener un formato incompatible.")}</p>
    <IonButton fill="outline" onClick={() => { setFailedSrc(undefined); setAttempt(a => a + 1); }}>{t("Reintentar")}</IonButton>
  </div>;
  return <video {...props} src={src} key={`${src}-${attempt}`} onError={event => { setFailedSrc(src); onError?.(event); }} />;
}
