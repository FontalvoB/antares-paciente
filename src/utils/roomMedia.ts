/**
 * Preflight de dispositivos para la sala virtual (F3). Verifica disponibilidad
 * y permisos de cámara/micrófono ANTES de conectar, con sonda getUserMedia de
 * parada inmediata (los tracks nunca quedan retenidos).
 *
 * Riesgo documentado en iOS: el WKWebView no entrega frames de cámara a
 * getUserMedia (`src/components/CameraCapture.tsx:13-22`), por eso el
 * resultado nunca bloquea del todo el acceso: si la cámara no está disponible
 * y el micrófono sí, la sala se degrada a una conexión solo con audio.
 */

export type MediaProbeStatus =
  | "checking"
  | "ready"
  | "no-device"
  | "denied"
  | "in-use"
  | "unsupported"
  | "insecure"
  | "error";

export type MediaDeviceKind = "camera" | "microphone";

export interface MediaProbeResult {
  camera: MediaProbeStatus;
  microphone: MediaProbeStatus;
}

interface MediaTrackLike {
  stop: () => void;
}

interface MediaStreamLike {
  getTracks: () => MediaTrackLike[];
}

export interface MediaDevicesLike {
  enumerateDevices?: () => Promise<Array<{ kind: string }>>;
  getUserMedia?: (constraints: {
    audio?: boolean;
    video?: boolean;
  }) => Promise<MediaStreamLike>;
  permissions?: {
    query?: (descriptor: { name: string }) => Promise<{ state: string }>;
  };
}

export interface MediaProbeOptions {
  mediaDevices?: MediaDevicesLike | null;
  secure?: boolean;
}

function defaultMediaDevices(): MediaDevicesLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator.mediaDevices as MediaDevicesLike | undefined) ?? null;
}

function defaultSecure(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext !== false;
}

/**
 * Estado inicial sincrónico: si el WebView no expone getUserMedia (o el
 * contexto no es seguro) no hay nada que sondear y los estados quedan fijos;
 * en cualquier otro caso null = "checking" (la sonda corre en un efecto).
 */
export function initialMediaProbe(
  options: MediaProbeOptions = {},
): MediaProbeResult | null {
  const devices =
    options.mediaDevices !== undefined
      ? options.mediaDevices
      : defaultMediaDevices();
  const secure = options.secure ?? defaultSecure();
  if (!secure) return { camera: "insecure", microphone: "insecure" };
  if (!devices?.getUserMedia) {
    return { camera: "unsupported", microphone: "unsupported" };
  }
  return null;
}

/** Clasifica el error de un getUserMedia al estado de la sonda. */
export function classifyMediaError(err: unknown): MediaProbeStatus {
  const name =
    typeof err === "object" && err !== null
      ? (err as { name?: unknown }).name
      : null;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-device";
    case "NotReadableError":
    case "AbortError":
      return "in-use";
    case "TypeError":
      return "unsupported";
    default:
      return "error";
  }
}

/**
 * Sonda secuencial (cámara y después micrófono) con parada inmediata de los
 * tracks. Nunca lanza: cada dispositivo cae a su estado clasificado.
 */
export async function probeRoomMedia(
  options: MediaProbeOptions = {},
): Promise<MediaProbeResult> {
  const devices =
    options.mediaDevices !== undefined
      ? options.mediaDevices
      : defaultMediaDevices();
  const secure = options.secure ?? defaultSecure();
  if (!secure) return { camera: "insecure", microphone: "insecure" };
  if (!devices?.getUserMedia) {
    return { camera: "unsupported", microphone: "unsupported" };
  }

  let videoCount: number | null = null;
  let audioCount: number | null = null;
  try {
    const list = (await devices.enumerateDevices?.()) ?? [];
    videoCount = list.filter((d) => d.kind === "videoinput").length;
    audioCount = list.filter((d) => d.kind === "audioinput").length;
  } catch {
    /* sin permiso/con soporte parcial: se decide con la sonda */
  }

  const camera = await probeOne(
    devices,
    "camera",
    videoCount,
    await permissionDenied(devices, "camera"),
  );
  const microphone = await probeOne(
    devices,
    "microphone",
    audioCount,
    await permissionDenied(devices, "microphone"),
  );
  return { camera, microphone };
}

async function probeOne(
  devices: MediaDevicesLike,
  kind: MediaDeviceKind,
  deviceCount: number | null,
  denied: boolean,
): Promise<MediaProbeStatus> {
  if (deviceCount === 0) return "no-device";
  if (denied) return "denied";
  try {
    const stream = await devices.getUserMedia!(
      kind === "camera" ? { video: true } : { audio: true },
    );
    stream.getTracks().forEach((track) => track.stop());
    return "ready";
  } catch (err) {
    return classifyMediaError(err);
  }
}

async function permissionDenied(
  devices: MediaDevicesLike,
  kind: MediaDeviceKind,
): Promise<boolean> {
  const query = devices.permissions?.query;
  if (!query) return false;
  try {
    const status = await query({ name: kind });
    return status.state === "denied";
  } catch {
    /* Permissions API parcial (Safari) → se decide con la sonda */
    return false;
  }
}

/**
 * ¿Se puede entrar a la sala con la sonda actual? Solo se bloquea cuando
 * ambos dispositivos fallan por causas recuperables; unsupported/insecure
 * dejan conectar (el SDK de Twilio intenta sus propios tracks) y "checking"
 * no bloquea (la sonda es rápida y no debe congelar el CTA).
 */
export function canJoinWithMedia(probe: MediaProbeResult | null): boolean {
  if (!probe) return true;
  if (probe.camera === "unsupported" || probe.microphone === "unsupported")
    return true;
  if (probe.camera === "insecure" || probe.microphone === "insecure")
    return true;
  const ready = (s: MediaProbeStatus) => s === "ready";
  return ready(probe.camera) || ready(probe.microphone);
}

/** Tracks con los que se entra: solo los dispositivos listos. */
export function mediaPlan(probe: MediaProbeResult | null): {
  audio: boolean;
  video: boolean;
} {
  if (!probe) return { audio: true, video: true };
  if (probe.camera === "unsupported" || probe.microphone === "unsupported")
    return { audio: true, video: true };
  if (probe.camera === "insecure" || probe.microphone === "insecure")
    return { audio: true, video: true };
  return {
    audio: probe.microphone === "ready",
    video: probe.camera === "ready",
  };
}

/** Clave i18n del estado de un dispositivo (label visible en el prejoin). */
export function mediaStatusLabelKey(
  status: MediaProbeStatus,
  kind: MediaDeviceKind,
): string {
  switch (status) {
    case "checking":
      return "Comprobando…";
    case "ready":
      return kind === "camera" ? "Cámara lista" : "Micrófono listo";
    case "no-device":
      return kind === "camera"
        ? "No se detectó cámara"
        : "No se detectó micrófono";
    case "denied":
      return kind === "camera"
        ? "Permiso de cámara denegado"
        : "Permiso de micrófono denegado";
    case "in-use":
      return kind === "camera"
        ? "La cámara está en uso por otra aplicación"
        : "El micrófono está en uso por otra aplicación";
    case "unsupported":
      return "Tu navegador no permite usar la cámara o el micrófono";
    case "insecure":
      return "Necesitas una conexión segura (HTTPS) para usar la cámara y el micrófono";
    default:
      return kind === "camera"
        ? "No se pudo comprobar la cámara"
        : "No se pudo comprobar el micrófono";
  }
}
