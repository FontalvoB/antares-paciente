import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { countryFromCoordinates } from "../../utils/emergencyNumbers";
import type { EmergencyCountry } from "../../utils/emergencyNumbers";
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
  accuracyMeters?: number;
  locationCapturedAt?: string;
}

/**
 * Signos vitales opcionales de una fuente real. Si no existe una lectura
 * utilizable, se omite la métrica; nunca se fabrica una lectura de emergencia.
 */
export interface SosVitalsDto {
  heartRate?: number | null;
  spo2?: number | null;
  bloodPressure?: string | null;
  heartRateObservedAt?: string | null;
  spo2ObservedAt?: string | null;
  bloodPressureObservedAt?: string | null;
}

/** Alerta SOS (DTO mínimo según REQ-SOS-01/03; campos extra ignorados). */
export interface SosAlertDto {
  vitals?: SosVitalsDto & { readings?: Array<{metricCode: string; value: number; unit: string; observedAt: string | null; source: string}> } | null;
  id: string;
  recipients?: Array<{
    id: string; contactOrder: number; maskedPhone?: string | null;
    smsChannelStatus: string; voiceChannelStatus: string; emailChannelStatus?: string | null;
    smsDeliveryStatus?: string | null; voiceCallStatus?: string | null;
  }>;
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

/** GPS actual en nativo o geolocalización del navegador en web. */
export function hasGeolocation(): boolean {
  return Capacitor.isNativePlatform() || (typeof navigator !== "undefined" &&
    typeof navigator.geolocation?.getCurrentPosition === "function");
}

const POSITION_MAX_AGE_MS = 30_000;
const POSITION_REQUEST_MS = 8_000;
let locationFlight: Promise<SosCoordinates | null> | null = null;

interface LocationPosition {
  timestamp: number;
  coords: { latitude: number; longitude: number; accuracy?: number };
}

function normalizePosition(position: LocationPosition): SosCoordinates | null {
  const { latitude, longitude, accuracy } = position.coords;
  const age = Date.now() - position.timestamp;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
    !Number.isFinite(position.timestamp) || position.timestamp <= 0 ||
    age < -5_000 || age > POSITION_MAX_AGE_MS ||
    (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100_000))) return null;
  return {
    latitude, longitude,
    ...(accuracy !== undefined ? { accuracyMeters: accuracy } : {}),
    locationCapturedAt: new Date(position.timestamp).toISOString(),
  };
}

function requestCoordinates(): Promise<SosCoordinates | null> {
  if (locationFlight) return locationFlight;
  if (!hasGeolocation()) return Promise.resolve(null);
  const request = new Promise<SosCoordinates | null>((resolve) => {
    let settled = false;
    const done = (value: SosCoordinates | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    // Incluye permiso del sistema: ningún diálogo bloquea el SOS sin límite.
    const timer = window.setTimeout(() => done(null), POSITION_REQUEST_MS + 500);
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          let permissions = await Geolocation.checkPermissions();
          if (settled) return;
          if (permissions.location !== "granted" && permissions.coarseLocation !== "granted") {
            permissions = await Geolocation.requestPermissions({ permissions: ["location"] });
          }
          if (settled) return;
          if (permissions.location !== "granted" && permissions.coarseLocation !== "granted") {
            done(null); return;
          }
          const position = await Geolocation.getCurrentPosition({
            timeout: POSITION_REQUEST_MS, maximumAge: POSITION_MAX_AGE_MS,
            enableHighAccuracy: false, enableLocationFallback: true,
          });
          if (!settled) done(normalizePosition(position));
        } catch { done(null); }
      })();
    } else {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => done(normalizePosition(position)),
          () => done(null),
          { timeout: POSITION_REQUEST_MS, maximumAge: POSITION_MAX_AGE_MS, enableHighAccuracy: false },
        );
      } catch { done(null); }
    }
  });
  const flight = request.finally(() => { if (locationFlight === flight) locationFlight = null; });
  locationFlight = flight;
  return flight;
}

/**
 * Fix best-effort con plazo total de 2,5 s al activar (el SOS no espera GPS).
 * La detección de país puede dar 8 s al permiso inicial. Ambas operaciones
 * comparten un único request nativo y nunca envían ubicación a un geocodificador.
 */
export function getCoordinatesBestEffort(options: { timeoutMs?: number } = {}): Promise<SosCoordinates | null> {
  const requested = options.timeoutMs ?? 2500;
  const timeout = Number.isFinite(requested) && requested > 0 ? Math.min(requested, POSITION_REQUEST_MS + 500) : 2500;
  return new Promise((resolve) => {
    let settled = false;
    const done = (coordinates: SosCoordinates | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(coordinates);
    };
    const timer = window.setTimeout(() => done(null), timeout);
    void requestCoordinates().then(done, () => done(null));
  });
}

export interface EmergencyLocationResult {
  country: EmergencyCountry | null;
  coordinates: SosCoordinates | null;
  status: "located" | "unavailable" | "unsupported";
}

export async function getEmergencyLocation(): Promise<EmergencyLocationResult> {
  const coordinates = await getCoordinatesBestEffort({ timeoutMs: POSITION_REQUEST_MS });
  if (!coordinates) return { country: null, coordinates: null, status: "unavailable" };
  const country = countryFromCoordinates(coordinates);
  return { country, coordinates, status: country ? "located" : "unsupported" };
}

/** El contrato real usa latitud/longitud planas; la UI consume location. */
function normalizeAlert(value: SosAlertDto & {
  latitude?: number | null; longitude?: number | null;
}): SosAlertDto {
  const latitude = value.latitude ?? value.location?.latitude;
  const longitude = value.longitude ?? value.location?.longitude;
  const valid = typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  return { ...value, location: valid ? { latitude, longitude } : null };
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
        ? {
          latitude: coords.latitude, longitude: coords.longitude,
          ...(coords.accuracyMeters !== undefined ? { accuracyMeters: coords.accuracyMeters } : {}),
          ...(coords.locationCapturedAt ? { locationCapturedAt: coords.locationCapturedAt } : {}),
        }
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
  return normalizeAlert((await res.json()) as SosAlertDto);
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
  if (res.status === 404 || res.status === 204) return null;
  if (!res.ok) {
    const detail = await readDetail(res);
    throw new SosServiceError(res.status, problemMessage(res.status, detail));
  }
  return normalizeAlert((await res.json()) as SosAlertDto);
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
  return normalizeAlert((await res.json()) as SosAlertDto);
}
