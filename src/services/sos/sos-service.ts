import { getAccessToken } from "../../utils/authApi";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

/**
 * Cliente SOS real (change sos-panic-real, REQ-SOS-01/02/05 — app móvil).
 * Contrato del backend:
 *  - POST   /api/v1/sos/alerts            → activa (aud=app), exige encabezado
 *    `Idempotency-Key` UUIDv4; 201 crea, 200 idempotente, 409 conflicto,
 *    422 contacto sin teléfono E.164, 400 payload/coords inválidas,
 *    429 rate-limit con `Retry-After`.
 *  - GET    /api/v1/sos/alerts/active     → alerta activa del paciente (404 = ninguna).
 *  - POST   /api/v1/sos/alerts/{id}/cancel → cancelación del dueño (aud=app).
 *
 * La identidad SIEMPRE la resuelve el backend por el JWT (anti-IDOR): el
 * cliente nunca envía patientId. El destinatario/contenido del SMS viven
 * solo en el servidor; la app nunca los envía.
 *
 * Flujo exclusivamente real: no existe simulación local. Cada operación
 * llama al backend y cualquier fallo se propaga tal cual (`SosServiceError`
 * o error de red); la app nunca fabrica una alerta ni un éxito simulado.
 */

export interface SosCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Signos vitales incluidos en la alerta. Por ahora el cliente envía valores
 * demo (constantes del overlay); cuando exista una fuente real (wearable o
 * telemetría) se reemplazan aquí sin tocar el backend.
 */
export interface SosVitalsDto {
  heartRate?: number | null;
  spo2?: number | null;
  bloodPressure?: string | null;
}

/** Alerta SOS (DTO mínimo según REQ-SOS-01/03; campos extra ignorados). */
export interface SosAlertDto {
  id: string;
  /** "Activa" | "Atendida" | "Cancelada" (string por compatibilidad). */
  status: string;
  createdAt: string;
  attendedAt?: string | null;
  cancelledAt?: string | null;
  /**
   * Estado del canal SMS reportado por el backend (REQ-SOS-03):
   * "Enviado" | "Fallido" | "Timeout" | "NoConfigurado" | "Pendiente".
   * La UI lo usa para copy honesto (BUG-01): solo con "Enviado" se afirma
   * entrega al contacto de emergencia.
   */
  smsChannelStatus?: string | null;
  /**
   * Estado del canal de voz reportado por el backend (llamada TTS al contacto):
   * "Enviado" | "Fallido" | "Timeout" | "NoConfigurado" | "Pendiente".
   * La UI lo usa para copy honesto (BUG-01): solo con "Enviado" se afirma
   * que se realizó la llamada.
   */
  voiceChannelStatus?: string | null;
  /**
   * Estado del canal push al equipo clínico (backend): "Enviado" | "Fallido" |
   * "Timeout" | "NoConfigurado" | "Pendiente".
   */
  pushChannelStatus?: string | null;
  /**
   * Estado del canal de correo al contacto de emergencia (backend):
   * "Enviado" | "Fallido" | "Timeout" | "NoConfigurado" | "Pendiente" |
   * "SinDestino" (el contacto no tiene correo registrado: no se envía nada).
   */
  emailChannelStatus?: string | null;
  /** Entrega reportada por Twilio (statusCallback SMS): "delivered" | "undelivered" | "failed" | "sent" | "queued". */
  smsDeliveryStatus?: string | null;
  /** Estado de la llamada reportado por Twilio: "completed" | "no-answer" | "busy" | "failed" | "canceled" | "in-progress" | "ringing" | "initiated" | "queued". */
  voiceCallStatus?: string | null;
  /** Respuesta detectada por Twilio (si hay detección de máquina): "human" | "machine_start". */
  voiceAnsweredBy?: string | null;
  /** Duración de la llamada en segundos (reportada al completarse). */
  voiceDurationSeconds?: number | null;
  /** Ubicación persistida de la alerta. Null = no compartida (BUG-01 b). */
  location?: { latitude: number; longitude: number } | null;
}

export class SosServiceError extends Error {
  readonly status: number;
  /** Segundos sugeridos por el backend ante 429 (encabezado Retry-After). */
  readonly retryAfterSeconds?: number;
  readonly detail?: string;

  constructor(
    status: number,
    message: string,
    options?: { retryAfterSeconds?: number; detail?: string },
  ) {
    super(message);
    this.name = "SosServiceError";
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.detail = options?.detail;
  }
}

/** `true` cuando el navegador expone geolocalización usable. */
export function hasGeolocation(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/**
 * Ubicación best-effort (D6): timeout estricto de 2 s, alta precisión
 * apagada (primer fix rápido). Cualquier fallo → null y la alerta se
 * envía SIN coordenadas: la emergencia nunca se frena por GPS.
 */
export function getCoordinatesBestEffort(): Promise<SosCoordinates | null> {
  if (!hasGeolocation()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: SosCoordinates | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Rango válido server-side igual al backend (REQ-SOS-01).
          if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            done(null);
            return;
          }
          done({ latitude, longitude });
        },
        () => done(null),
        { timeout: 2000, maximumAge: 30_000, enableHighAccuracy: false },
      );
      // Salvaguarda: si el callback no llega, nunca bloquear el flujo.
      window.setTimeout(() => done(null), 2500);
    } catch {
      done(null);
    }
  });
}

/** Mensaje legible según el código de error esperado del módulo SOS. */
function problemMessage(status: number, detail?: string): string {
  if (detail) return detail;
  switch (status) {
    case 400:
      return "Solicitud de SOS inválida.";
    case 409:
      return "Ya tienes una alerta SOS activa.";
    case 422:
      return "Configura un contacto de emergencia con teléfono válido para poder alertar.";
    case 429:
      return "Demasiadas alertas en poco tiempo. Espera unos segundos.";
    default:
      return `Error del servidor (${status})`;
  }
}

async function readRetryAfter(res: Response): Promise<number | undefined> {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

async function readDetail(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { detail?: string; message?: string };
    return body?.detail ?? body?.message ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Activa una alerta SOS real. Genera la `Idempotency-Key` (UUIDv4) por
 * llamada: un reintento de red con OTRA clave crearía otra alerta; la
 * semántica del backend (REQ-SOS-01) gobierna la desduplicación.
 */
export async function activateSosAlert(
  coords?: SosCoordinates | null,
  vitals?: SosVitalsDto | null,
): Promise<SosAlertDto> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/sos/alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // Coordenadas solo si existen (GPS best-effort): sin coordenadas la
    // alerta sigue creándose (D6).
    body: JSON.stringify({
      ...(coords
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : {}),
      ...(vitals ? { vitals } : {}),
    }),
  });

  if (!res.ok) {
    const retryAfter =
      res.status === 429 ? await readRetryAfter(res) : undefined;
    const detail = await readDetail(res);
    throw new SosServiceError(res.status, problemMessage(res.status, detail), {
      retryAfterSeconds: retryAfter,
      detail,
    });
  }
  return (await res.json()) as SosAlertDto;
}

/**
 * Alerta activa del paciente (sondeo ligero del overlay). `null` = no hay
 * alerta activa (nunca creada o ya atendida/cancelada).
 */
export async function fetchActiveSosAlert(): Promise<SosAlertDto | null> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/sos/alerts/active`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await readDetail(res);
    throw new SosServiceError(res.status, problemMessage(res.status, detail));
  }
  return (await res.json()) as SosAlertDto;
}

/** Cancela la alerta activa del paciente dueño (REQ-SOS-05, aud=app). */
export async function cancelSosAlert(id: string): Promise<SosAlertDto> {
  const token = getAccessToken();
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/sos/alerts/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  if (!res.ok) {
    const detail = await readDetail(res);
    throw new SosServiceError(res.status, problemMessage(res.status, detail));
  }
  return (await res.json()) as SosAlertDto;
}
