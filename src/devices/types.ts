// Capa de dispositivos: modelo canónico de datos de salud.
// Cualquier wearable (anillo, banda, reloj o sensor BLE estándar) se traduce
// a HealthSample para que la app no dependa del protocolo de cada vendor.

export type MetricKind =
  | 'heart_rate'
  | 'spo2'
  | 'blood_pressure'
  | 'temperature'
  | 'respiratory_rate'
  | 'hrv'
  | 'steps'
  | 'distance'
  | 'calories'
  | 'glucose'
  | 'wearing'
  | 'battery';

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
}

/** Familia de protocolo detectada para un dispositivo. */
export type DeviceKind = 'ycbt' | 'colmi' | 'hrs' | 'unknown';

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
}

/** Códigos de error de la capa de dispositivos (se traducen en la UI). */
export type WearableErrorCode =
  | 'bluetooth-off'
  | 'permission-denied'
  | 'scan-unavailable'
  | 'connection-failed'
  | 'unsupported-device'
  | 'no-data'
  | 'unknown';

export type SampleSink = (sample: HealthSample) => void;
export type InfoSink = (info: DeviceInfo) => void;

/** Sesión activa con un dispositivo. La implementa cada driver. */
export interface DeviceSession {
  readonly descriptor: DeviceDescriptor;
  /** true si el driver permite medidas bajo demanda (SpO2, presión…). */
  readonly supportsMeasure?: boolean;
  start(onSample: SampleSink, onInfo: InfoSink): Promise<void>;
  stop(): Promise<void>;
  /** Lanza una medida puntual; los resultados llegan por el mismo onSample. */
  measure?(kind: MetricKind): void;
}
