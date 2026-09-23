// Protocolo YCBT (familia Yucheng / anillo R88).
// Trama: [tipo_hi][tipo_lo][len_lo][len_hi][payload...][crc_lo][crc_hi]
// - tipo = (grupo << 8) | clave, big-endian
// - len = bytes totales de la trama (cabecera + payload + CRC), little-endian
// - CRC-16 sobre cabecera+payload, little-endian
// Referencia: documentación reversa de Open-RingBridge (R01L / chip JieLi AC632N).

export const YCBT_SERVICE = "be940000-7333-be46-b7ae-689e71722bd5";
/** Canal bidireccional: comandos de la app y respuestas/ACK del dispositivo. */
export const YCBT_CHAR_C1 = "be940001-7333-be46-b7ae-689e71722bd5";
/** Canal de notificaciones: medidas en vivo y bloques de historial. */
export const YCBT_CHAR_C3 = "be940003-7333-be46-b7ae-689e71722bd5";
/** Autenticación JieLi (RCSP): si existe, hay que suscribirse o el anillo calla. */
export const JL_CHAR_WRITE = "0000ae01-0000-1000-8000-00805f9b34fb";
export const JL_CHAR_NOTIFY = "0000ae02-0000-1000-8000-00805f9b34fb";
/** Servicio estándar de frecuencia cardíaca (cualquier dispositivo compatible). */
export const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
export const HR_CHAR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";

/** UUIDs a los que la app necesita acceso en web (Web Bluetooth). */
export const BLE_ACCESS_SERVICES: string[] = [
  YCBT_SERVICE,
  HR_SERVICE,
  "0000ae00-0000-1000-8000-00805f9b34fb",
];

export const OP = {
  SET_TIME: 0x0100,
  SET_HEART_MONITOR: 0x010c,
  SET_SPO2_MONITOR: 0x0126,
  GET_DEVICE_INFO: 0x0200,
  GET_SUPPORT_FUNCTION: 0x0201,
  GET_DEVICE_NAME: 0x0203,
  GET_CHIP_SCHEME: 0x021b,
  /** Empuja el estado en vivo (pasos/distancia/kcal) por el canal 0x0600. */
  LIVE_STATUS_PUSH: 0x0309,
  /** Medida bajo demanda: [enable, modo]. Un modo a la vez. */
  LIVE_MEASUREMENT: 0x032f,
  UPLOAD_COMPREHENSIVE: 0x060a,
  UPLOAD_HEART: 0x0601,
  UPLOAD_BLOOD_OXYGEN: 0x0602,
  UPLOAD_BLOOD: 0x0603,
  UPLOAD_BODY_DATA: 0x0610,
  UPLOAD_WEARING: 0x0613,
  /** Estado en vivo: pasos/distancia/kcal (u16 cada uno). */
  LIVE_STATUS: 0x0600,
  /** Batería empujada por el anillo: [cargando, porcentaje]. */
  LIVE_BATTERY: 0x0615,
} as const;

/** Payload de LIVE_STATUS_PUSH: activa el stream 0x0600. */
export const LIVE_STATUS_ON = [0x01, 0x00, 0x02];
/** Payload de LIVE_STATUS_PUSH: lo desactiva. */
export const LIVE_STATUS_OFF = [0x00, 0x00, 0x02];

/** Modos del comando 0x032f (el byte de modo elige el sensor/LED). */
export const MEASURE_MODE = {
  heart_rate: 0x00,
  blood_pressure: 0x01,
  spo2: 0x02,
  temperature: 0x04,
  hrv: 0x0a,
} as const;

export const MEASURE_ENABLE = 0x01;
export const MEASURE_DISABLE = 0x00;

/** Tipos de historial del grupo Health (0x05). */
export interface YcbtHistoryType {
  key: string;
  /** `05 <query>` pide el volcado completo de este tipo. */
  query: number;
  /** El `cmd` que traen las tramas de datos (distinto del query). */
  ack: number;
  /** Tamaño fijo de registro; null = variable (sesiones de sueño). */
  stride: number | null;
}

export const HISTORY_TYPES: readonly YcbtHistoryType[] = [
  { key: "sport", query: 0x02, ack: 0x11, stride: 14 },
  { key: "sleep", query: 0x04, ack: 0x13, stride: null },
  { key: "heart", query: 0x06, ack: 0x15, stride: 6 },
  { key: "blood", query: 0x08, ack: 0x17, stride: 8 },
  { key: "all", query: 0x09, ack: 0x18, stride: 20 },
  { key: "spo2", query: 0x1a, ack: 0x22, stride: 6 },
];

/** `05 80`: termina un volcado (y, saliendo, es el ACK obligatorio). */
export const HISTORY_TERMINAL_KEY = 0x80;
/** CRC del buffer reconstruido correcto. */
export const HISTORY_ACK_OK = 0x00;
/** CRC roto: el anillo puede reenviar. */
export const HISTORY_ACK_CRC = 0x04;
/** El SDK considera "sin datos" un header de 9 bytes o menos. */
export const HISTORY_HEADER_MIN = 10;

/** Grupo DevControl (0x04): pushes del anillo; la app solo escribe el ACK. */
export const DEV_CONTROL_GROUP = 0x04;
/** `04 0e`: resultado de una medida puntual (sin valor). */
export const DEV_MEASUREMENT_RESULT = 0x0e;
/** `04 13`: estado/resultado en vivo de la medida en curso. */
export const DEV_MEASUREMENT_STATUS = 0x13;

/** ACK de un push DevControl: `04 <key> 00` (el anillo reintenta sin él). */
export function deviceAckType(key: number): number {
  return (DEV_CONTROL_GROUP << 8) | key;
}

export interface YcbtCapabilities {
  steps: boolean;
  sleep: boolean;
  heartRate: boolean;
  bloodPressure: boolean;
  spo2: boolean;
  hrv: boolean;
  manualHeartRate: boolean;
  manualBloodPressure: boolean;
  manualSpo2: boolean;
}

interface CapabilityBit {
  byte: number;
  bit: number;
  /** Longitud mínima del bitmap antes de leer ese byte (gates del SDK). */
  minLength: number;
  key: keyof YcbtCapabilities;
}

const CAPABILITY_BITS: readonly CapabilityBit[] = [
  { byte: 0, bit: 7, minLength: 14, key: "steps" },
  { byte: 0, bit: 6, minLength: 14, key: "sleep" },
  { byte: 0, bit: 3, minLength: 14, key: "heartRate" },
  { byte: 0, bit: 0, minLength: 14, key: "bloodPressure" },
  { byte: 1, bit: 3, minLength: 14, key: "spo2" },
  { byte: 1, bit: 1, minLength: 14, key: "hrv" },
  { byte: 15, bit: 1, minLength: 18, key: "manualHeartRate" },
  { byte: 15, bit: 2, minLength: 18, key: "manualBloodPressure" },
  { byte: 15, bit: 3, minLength: 18, key: "manualSpo2" },
];

/** Bitmap `02 01` (bit 7 = MSB). Sin bits conocidos → todas en false. */
export function parseCapabilities(payload: Uint8Array): YcbtCapabilities {
  const caps: YcbtCapabilities = {
    steps: false,
    sleep: false,
    heartRate: false,
    bloodPressure: false,
    spo2: false,
    hrv: false,
    manualHeartRate: false,
    manualBloodPressure: false,
    manualSpo2: false,
  };
  for (const entry of CAPABILITY_BITS) {
    if (payload.length < entry.minLength || entry.byte >= payload.length)
      continue;
    if (((payload[entry.byte] ?? 0) >> entry.bit) & 1) caps[entry.key] = true;
  }
  return caps;
}

export interface YcbtPacket {
  type: number;
  group: number;
  key: number;
  payload: Uint8Array;
}

/** CRC-16 propio del protocolo (no es X25/CCITT estándar). */
export function crc16(bytes: Uint8Array): number {
  let s = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    s = ((((s << 8) & 0xff00) | ((s >> 8) & 0xff)) ^ bytes[i]) & 0xffff;
    s ^= (s & 0xff) >> 4;
    s ^= (s << 12) & 0xffff;
    s ^= ((s & 0xff) << 5) & 0xffff;
  }
  return s & 0xffff;
}

export function buildPacket(type: number, payload: number[] = []): Uint8Array {
  const total = 4 + payload.length + 2;
  const frame = new Uint8Array(total);
  frame[0] = (type >> 8) & 0xff;
  frame[1] = type & 0xff;
  frame[2] = total & 0xff;
  frame[3] = (total >> 8) & 0xff;
  frame.set(payload, 4);
  const crc = crc16(frame.subarray(0, total - 2));
  frame[total - 2] = crc & 0xff;
  frame[total - 1] = (crc >> 8) & 0xff;
  return frame;
}

/** Devuelve null si la trama está incompleta o el CRC no cuadra. */
export function parsePacket(frame: Uint8Array): YcbtPacket | null {
  if (frame.length < 6) return null;
  const total = frame[2] | (frame[3] << 8);
  if (total !== frame.length) return null;
  const expected = frame[total - 2] | (frame[total - 1] << 8);
  if (crc16(frame.subarray(0, total - 2)) !== expected) return null;
  const type = (frame[0] << 8) | frame[1];
  return {
    type,
    group: (type >> 8) & 0xff,
    key: type & 0xff,
    payload: frame.slice(4, total - 2),
  };
}

/** Reensambla tramas a partir de notificaciones BLE (pueden venir partidas). */
export class PacketStream {
  private buffer = new Uint8Array(0);

  push(bytes: Uint8Array): YcbtPacket[] {
    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer);
    merged.set(bytes, this.buffer.length);

    const packets: YcbtPacket[] = [];
    let offset = 0;
    while (merged.length - offset >= 6) {
      const total = merged[offset + 2] | (merged[offset + 3] << 8);
      if (total < 6 || total > 1024) {
        offset += 1;
        continue;
      }
      if (merged.length - offset < total) break;
      const packet = parsePacket(merged.subarray(offset, offset + total));
      if (!packet) {
        offset += 1;
        continue;
      }
      packets.push(packet);
      offset += total;
    }
    this.buffer = merged.slice(offset);
    return packets;
  }

  reset(): void {
    this.buffer = new Uint8Array(0);
  }
}

/** Segundos desde 2000-01-01 UTC. */
export const BLE_EPOCH_OFFSET = 946684800;

export function bleSecondsToMs(seconds: number): number {
  return (seconds + BLE_EPOCH_OFFSET) * 1000;
}

/**
 * El RTC del anillo guarda hora local sin zona (la app le escribe su hora
 * local). Los campos wall-clock viajan como si fueran UTC; se reinterpretan
 * en la zona del teléfono para recuperar el instante real.
 */
export function ringTimeToMs(seconds: number): number {
  const wall = new Date(bleSecondsToMs(seconds));
  const local = new Date(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate(),
    wall.getUTCHours(),
    wall.getUTCMinutes(),
    wall.getUTCSeconds(),
  );
  return local.getTime();
}

export function msToBleSeconds(ms: number): number {
  return Math.floor(ms / 1000) - BLE_EPOCH_OFFSET;
}

/** Fecha local codificada como espera el dispositivo (8 bytes). */
export function makeBleTime(date: Date = new Date()): number[] {
  const jsDay = date.getDay();
  return [
    date.getFullYear() & 0xff,
    (date.getFullYear() >> 8) & 0xff,
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    (jsDay + 6) % 7,
  ];
}

/** Los errores llegan como payload de 1 byte 0xFx. */
export function decodeErrorPayload(payload: Uint8Array): string | null {
  if (payload.length !== 1) return null;
  switch (payload[0]) {
    case 0xfb:
      return "unsupported-command";
    case 0xfc:
      return "unsupported-key";
    case 0xfd:
      return "bad-length";
    case 0xfe:
      return "bad-data";
    case 0xff:
      return "bad-crc";
    default:
      return null;
  }
}
