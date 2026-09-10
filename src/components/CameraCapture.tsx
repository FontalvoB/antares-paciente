import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  cameraOutline,
  closeOutline,
  imageOutline,
  refreshOutline,
} from "ionicons/icons";
import { useT } from "../i18n/I18nContext";

/**
 * Captura de comida en tres modos según plataforma:
 * - Nativa (Capacitor iOS/Android): plugin @capacitor/camera (la cámara del
 *   SO). getUserMedia NO se usa aquí: WKWebView no entrega frames de cámara
 *   y el video quedaba en negro.
 * - Web con contexto seguro (https/localhost): vista previa en vivo con
 *   getUserMedia + captura por canvas.
 * - Web sin contexto seguro (http por IP LAN): sin vista previa; inputs de
 *   archivo (el de cámara lleva capture="environment" y abre la cámara del SO).
 */
interface Props {
  onCapture: (blob: Blob, fileName: string) => void;
  onCancel: () => void;
}

type CamState = "starting" | "ready" | "error" | "busy";

const MAX_WIDTH = 1280;

function canPreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function CameraCapture({ onCapture, onCancel }: Props) {
  const t = useT();
  const isNative = Capacitor.isNativePlatform();
  const preview = !isNative && canPreview();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CamState>(preview ? "starting" : "ready");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setError(null);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setError(
            t(
              "Permiso de cámara denegado. Actívalo en Ajustes o elige una foto de la galería.",
            ),
          );
        } else {
          setError(
            t(
              "Cámara no disponible en este dispositivo. Elige una foto de la galería.",
            ),
          );
        }
        setState("error");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [preview, attempt, t]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }

  function retry() {
    setError(null);
    setState("starting");
    setAttempt((a) => a + 1);
  }

  function isCancel(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /cancel/i.test(msg);
  }

  async function takeNative(source: CameraSource) {
    setState("busy");
    setError(null);
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        saveToGallery: false,
        resultType: CameraResultType.Uri,
        source,
      });
      if (!photo.webPath) throw new Error("empty");
      const res = await fetch(photo.webPath);
      const blob = await res.blob();
      stopCamera();
      onCapture(blob, `comida-${Date.now()}.jpg`);
    } catch (err) {
      if (isCancel(err)) {
        setState("ready");
        return;
      }
      setError(t("No se pudo leer la imagen. Intenta de nuevo."));
      setState("error");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      cameraInputRef.current?.click();
      return;
    }
    setState("busy");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setState("error");
      setError(t("No se pudo leer la imagen. Intenta de nuevo."));
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob, `comida-${Date.now()}.jpg`);
        } else {
          setError(t("No se pudo leer la imagen. Intenta de nuevo."));
          setState("error");
        }
      },
      "image/jpeg",
      0.9,
    );
  }

  function onTakePhoto() {
    if (isNative) {
      void takeNative(CameraSource.Camera);
    } else if (preview && state === "ready") {
      capture();
    } else {
      cameraInputRef.current?.click();
    }
  }

  function onPickGallery() {
    if (isNative) {
      void takeNative(CameraSource.Photos);
    } else {
      galleryInputRef.current?.click();
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    onCapture(file, file.name);
  }

  if (state === "busy") {
    return (
      <div className="nut-cam-busy">
        <IonSpinner name="crescent" />
        <div>{t("Abriendo cámara…")}</div>
      </div>
    );
  }

  return (
    <div className="nut-cam">
      {state === "starting" && (
        <div className="nut-cam-busy">
          <IonSpinner name="crescent" />
        </div>
      )}

      {state !== "starting" && (
        <>
          {preview && state === "ready" ? (
            <div className="nut-cam-view">
              <video ref={videoRef} playsInline muted />
              <div className="nut-cam-guide" aria-hidden="true">
                <span className="tl" />
                <span className="tr" />
                <span className="bl" />
                <span className="br" />
              </div>
            </div>
          ) : (
            <div className="nut-cam-idle">
              <IonIcon icon={cameraOutline} />
              <strong>{t("Encuadra tu plato en el marco")}</strong>
              <small>
                {t(
                  "Toca “Tomar foto” para usar la cámara o elige una imagen guardada.",
                )}
              </small>
            </div>
          )}

          {state === "error" && error && (
            <div className="nut-cam-error" role="alert">
              <span>{error}</span>
              {preview && (
                <IonButton size="small" fill="outline" onClick={retry}>
                  <IonIcon icon={refreshOutline} slot="start" />
                  {t("Reintentar")}
                </IonButton>
              )}
            </div>
          )}

          <IonButton
            className="nut-cam-main"
            expand="block"
            onClick={onTakePhoto}
            aria-label={t("Tomar fotografía")}
          >
            <IonIcon icon={cameraOutline} slot="start" />
            {t("Tomar foto")}
          </IonButton>
          <div className="nut-cam-actions">
            <IonButton
              className="nut-cam-gallery"
              style={{ flex: 1 }}
              fill="outline"
              onClick={onPickGallery}
            >
              <IonIcon icon={imageOutline} slot="start" />
              {t("Seleccionar imagen")}
            </IonButton>
            <IonButton
              className="nut-cam-close"
              fill="clear"
              onClick={onCancel}
              aria-label={t("Cancelar")}
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </div>
        </>
      )}

      <input
        ref={galleryInputRef}
        data-gallery-input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileSelected}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={onFileSelected}
      />
    </div>
  );
}
