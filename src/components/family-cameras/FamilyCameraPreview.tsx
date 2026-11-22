import { useEffect, useState } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { videocamOffOutline } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { ApiError } from "../../utils/apiClient";
import { getFamilyCameraFrame } from "../../services/family-cameras/family-camera-service";

export function FamilyCameraPreview({ cameraId, accountId }: { cameraId: string; accountId: string }) {
  const { t } = useI18n();
  const [image, setImage] = useState("");
  const [failure, setFailure] = useState<"access" | "connection">();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let request: AbortController | undefined;
    let timer: number | undefined;
    const cancel = () => {
      window.clearTimeout(timer);
      request?.abort();
    };
    const refresh = async () => {
      const controller = new AbortController();
      request = controller;
      try {
        const frame = await getFamilyCameraFrame(cameraId, accountId, controller.signal);
        if (controller.signal.aborted) return;
        setImage(`data:image/jpeg;base64,${frame.image}`);
        timer = window.setTimeout(() => void refresh(), 1200);
      } catch (error) {
        if (controller.signal.aborted) return;
        setImage("");
        setFailure(error instanceof ApiError && [401, 403, 404].includes(error.status) ? "access" : "connection");
      }
    };
    const onVisibility = () => {
      cancel();
      setImage("");
      if (!document.hidden) {
        setFailure(undefined);
        void refresh();
      }
    };
    if (!document.hidden) void refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancel();
    };
  }, [cameraId, accountId, attempt]);

  return (
    <div className="family-camera-preview">
      {image ? (
        <img src={image} alt={t("Imagen de la cámara")} />
      ) : failure ? (
        <div className="family-camera-feed-message" role="status">
          <IonIcon icon={videocamOffOutline} aria-hidden="true" />
          <p>{failure === "access" ? t("El acceso a esta cámara ya no está disponible.") : t("No pudimos conectar con la cámara.")}</p>
          {failure === "connection" && (
            <IonButton fill="clear" onClick={() => { setFailure(undefined); setAttempt((value) => value + 1); }}>
              {t("Reintentar")}
            </IonButton>
          )}
        </div>
      ) : (
        <div className="family-camera-feed-message" role="status">
          <IonSpinner aria-hidden="true" />
          <p>{t("Conectando con la cámara…")}</p>
        </div>
      )}
    </div>
  );
}
