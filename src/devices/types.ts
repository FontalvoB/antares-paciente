// Capa de dispositivos: modelo canónico de datos de salud.
// Cualquier wearable (anillo, banda, reloj o sensor BLE estándar) se traduce
// a HealthSample para que la app no dependa del protocolo de cada vendor.

export type MetricKind =
  | "heart_rate"
  | "spo2"
  | "blood_pressure"
  | "temperature"
  | "respiratory_rate"
  | "hrv"
  | "stress"
  | "steps"
  | "distance"
  | "calories"
  | "sleep"
  | "glucose"
  | "wearing"
  | "battery";

/** Medida puntual normalizada. */
export interface HealthSample {
  metric: MetricKind;
  value: number;
  /** Segunda componente del par (p. ej. diastólica en presión arterial). */
  value2?: number;
  unit: string;
  /** Epoch en milisegundos. */
  ts: number;
  deviceId: string;
  /**
   * Cómo acumular la muestra en el día. `max` (por defecto) = contador
   * acumulado del anillo (pasos/distancia/kcal en vivo); `sum` = cubeta
   * aditiva del historial (varios registros por día).
   */
  agg?: "sum" | "max";
  /**
   * Procedencia: `history` = volcado del propio registro del dispositivo (una
   * lectura puede ser vieja aunque el slot del RTC la marque como reciente);
   * `live` (por defecto) = stream en vivo o medida puntual de esta sesión.
   */
  source?: "live" | "history";
}

/** Familia de protocolo detectada para un dispositivo. */
export type DeviceKind = "ycbt" | "colmi" | "hrs" | "unknown";

/** Datos de identidad/estado que el dispositivo reporta al conectar. */
export interface DeviceInfo {
  name?: string;
  battery?: number;
  firmware?: string;
  wearing?: boolean;
}

export interface DeviceDescriptor {
  /** Id del plugin BLE (MAC en Android, UUID en iOS/web). */
  deviceId: string;
  name: string;
  kind: DeviceKind;
  rssi?: number;
  uuids?: string[];
  /** Ya emparejado/conectado a nivel de sistema (Ajustes del teléfono). */
  paired?: boolean;
}

/** Códigos de error de la capa de dispositivos (se traducen en la UI). */
export type WearableErrorCode =
  | "bluetooth-off"
  | "permission-denied"
  | "scan-unavailable"
  | "connection-failed"
  | "unsupported-device"
  | "no-data"
  | "unknown";

export type SampleSink = (sample: HealthSample) => void;
export type InfoSink = (info: DeviceInfo) => void;

/**
 * Cómo terminó una medida puntual.
 * - `completed`: llegó la lectura (la ventana se cierra sola o al alcanzar el objetivo).
 * - `refused`: el firmware rechazó el comando `03 2f` (sensor no disponible).
 * - `failed`: el anillo reportó `04 0e` con resultado 2 (contacto/movimiento).
 * - `cancelled`: el anillo canceló la medida (u otra la reemplazó).
 * - `timeout`: se agotó la ventana sin ninguna lectura.
 * - `no-signal`: se agotó la ventana sin NI SIQUIERA tramas del sensor (el
 *   anillo estuvo mudo: probable falta de contacto, no lentitud).
 * - `disconnected`: la sesión se cerró con la medida en curso.
 */
export type MeasureOutcome =
  | "completed"
  | "refused"
  | "failed"
  | "cancelled"
  | "replaced"
  | "timeout"
  | "no-signal"
  | "disconnected";

export type MeasureCallback = (ok: boolean, reason: MeasureOutcome) => void;

/**
 * Ventana y umbral de reintento de una medida puntual. La UI los usa para el
 * cronómetro, así que el número que ve el usuario es el mismo que aplica el
 * driver (una sola fuente de verdad).
 */
export interface MeasurePolicy {
  windowMs: number;
  retryMs?: number;
  /**
   * Lecturas aceptadas para cerrar (por defecto 3). La FC de la banda usa 2:
   * dos lecturas distintas ya prueban enganche (el eco es bit-idéntico), y 3
   * dejaba fuera calentamientos tardíos reales.
   */
  target?: number;
}

/** Sesión activa con un dispositivo. La implementa cada driver. */
export interface DeviceSession {
  readonly descriptor: DeviceDescriptor;
  /** true si el driver permite medidas bajo demanda (SpO2, presión…). */
  readonly supportsMeasure?: boolean;
  /** Métricas con botón "Medir ahora" (si el driver las declara). */
  readonly measureKinds?: MetricKind[];
  start(onSample: SampleSink, onInfo: InfoSink): Promise<void>;
  stop(): Promise<void>;
  /**
   * Lanza una medida puntual; los resultados llegan por el mismo onSample.
   * `onDone(false, reason)` = la medida no produjo lectura.
   */
  measure?(kind: MetricKind, onDone?: MeasureCallback): void;
  /**
   * Detiene la medida en curso (botón Cancelar de la vista de foco): para el
   * sensor, limpia temporizadores y avisa `onDone(false, "cancelled")` una
   * sola vez. Sin medida en curso no hace nada.
   */
  stopMeasure?(): void;
  /** Ventana/umbral de la medida de una métrica (para el cronómetro de la UI). */
  measurePolicy?(kind: MetricKind): MeasurePolicy | undefined;
  /** Vuelve a pedir info del dispositivo (batería/firmware) si aplica. */
  requestInfo?(): void;
  /** Pausa el trabajo periódico cuando la app pasa a segundo plano. */
  setAppActive?(active: boolean): void;
  /** Sincroniza el historial almacenado en el dispositivo (sueño, pasos…). */
  syncHistory?(): Promise<void>;
}
