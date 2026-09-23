// Protocolo Colmi / PubuWear (banda H59, app oficial QWatch Pro).
// Canal de datos = Nordic UART; tramas fijas de 16 bytes:
//   [cmd][payload 14B][checksum]   ·   checksum = suma(primeros 15) & 0xFF
// En las respuestas, el bit alto del comando (cmd | 0x80) indica error.
// Referencia: notas de ingeniería inversa de OpenH59 (H59_V2.0, nRF52832).

export const COLMI_SERVICE = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
/** App → banda (comandos). */
export const COLMI_CHAR_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
/** Banda → app (notificaciones). */
export const COLMI_CHAR_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

export const COLMI_FRAME_SIZE = 16;
export const COLMI_PAYLOAD_SIZE = 14;

export const CMD = {
  SET_TIME: 1,
  BATTERY: 3,
  /** Historial de sueño por UART (segmentos crudos). */
  SLEEP_HISTORY: 13,
  /** Curva de FC del día, 1 punto cada 5 min (288 puntos). */
  HR_HISTORY: 21,
  HR_LOG: 22,
  /** Curvas por slot: estrés y HRV (1 valor cada 30 min). */
  STRESS_HISTORY: 55,
  HRV_HISTORY: 57,
  /** Pasos/calorías/distancia por slot de 15 min. */
  STEPS: 67,
  START_REALTIME: 105,
  STOP_REALTIME: 106,
} as const;

/** Comandos cuyo `cmd` de respuesta es el mismo (grupo histórico). */
export const COLMI_HISTORY_CMDS: readonly number[] = [
  CMD.STEPS,
  CMD.HR_HISTORY,
  CMD.STRESS_HISTORY,
  CMD.HRV_HISTORY,
  CMD.SLEEP_HISTORY,
];

// ─── Canal "rico" (bc) ─────────────────────────────────────────────────────
// Segunda característica de la banda: históricos detallados (sueño por fases y
// SpO2 por hora) con protocolo propio de tramas variables:
//   bc | type(1) | len(2 LE) | crc16-modbus(2 LE) | body
// La banda solo entrega estos datos tras un login/init en el mismo canal.
// Referencia: implementación OpenH59 (band.py), verificada byte a byte contra
// la app oficial.

export const COLMI_BC_SERVICE = "de5bf728-d711-4e47-af26-65e3012a5dc7";
export const COLMI_BC_WRITE = "de5bf72a-d711-4e47-af26-65e3012a5dc7";
export const COLMI_BC_NOTIFY = "de5bf729-d711-4e47-af26-65e3012a5dc7";

export const BC_MAGIC = 0xbc;
export const BC_LOGIN = 0x4a;
export const BC_INIT = 0x30;
export const BC_SLEEP = 0x27;
export const BC_SPO2 = 0x2a;

/** CRC-16/MODBUS (poly 0xA001 reflejado, init 0xFFFF), como el canal bc. */
export function crc16Modbus(data: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
  }
  return crc & 0xffff;
}

/** Trama del canal bc: cabecera + CRC del body. */
export function bcFrame(
  type: number,
  body: number[] | Uint8Array = [],
): Uint8Array {
  const bytes = Uint8Array.from(body);
  const frame = new Uint8Array(6 + bytes.length);
  frame[0] = BC_MAGIC;
  frame[1] = type & 0xff;
  frame[2] = bytes.length & 0xff;
  frame[3] = (bytes.length >> 8) & 0xff;
  const crc = crc16Modbus(bytes);
  frame[4] = crc & 0xff;
  frame[5] = (crc >> 8) & 0xff;
  frame.set(bytes, 6);
  return frame;
}

/**
 * Respuesta a una medida en vivo: la banda responde con el MISMO cmd 105 (0x69)
 * que usa la petición (el bit 0x80 marca error). Estaba como 69 (0x45) por un
 * error de transcripción y por eso ninguna medida en vivo se decodificaba.
 */
export const CMD_REALTIME_RESPONSE = 105;

/** Tipos de medida del comando 105. */
export const MEASURE_TYPE = {
  heart_rate: 1,
  blood_pressure: 2,
  spo2: 3,
  stress: 8,
  hrv: 10,
} as const;

export type ColmiMeasureType = (typeof MEASURE_TYPE)[keyof typeof MEASURE_TYPE];

export interface ColmiFrame {
  /** Comando sin el bit de error. */
  cmd: number;
  /** 14 bytes de payload. */
  payload: Uint8Array;
  /** true si el dispositivo respondió error/non soportado. */
  error: boolean;
  raw: Uint8Array;
}

/** Suma de los primeros 15 bytes, módulo 256. */
export function checksum(frame: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < COLMI_FRAME_SIZE - 1; i++) sum += frame[i] ?? 0;
  return sum & 0xff;
}

export function buildFrame(cmd: number, payload: number[] = []): Uint8Array {
  const frame = new Uint8Array(COLMI_FRAME_SIZE);
  frame[0] = cmd & 0xff;
  for (let i = 0; i < Math.min(payload.length, COLMI_PAYLOAD_SIZE); i++) {
    frame[i + 1] = payload[i] & 0xff;
  }
  frame[COLMI_FRAME_SIZE - 1] = checksum(frame);
  return frame;
}

/** Devuelve null si el tamaño o el checksum no cuadran. */
export function parseFrame(bytes: Uint8Array): ColmiFrame | null {
  if (bytes.length !== COLMI_FRAME_SIZE) return null;
  if (checksum(bytes) !== bytes[COLMI_FRAME_SIZE - 1]) return null;
  const cmd = bytes[0] ?? 0;
  return {
    cmd: cmd & 0x7f,
    error: (cmd & 0x80) !== 0,
    payload: bytes.slice(1, COLMI_FRAME_SIZE - 1),
    raw: bytes.slice(),
  };
}

/** Reensambla las notificaciones (pueden venir partidas) en tramas de 16 B. */
export class FrameStream {
  private buffer = new Uint8Array(0);

  push(bytes: Uint8Array): ColmiFrame[] {
    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer);
    merged.set(bytes, this.buffer.length);

    const frames: ColmiFrame[] = [];
    let offset = 0;
    while (merged.length - offset >= COLMI_FRAME_SIZE) {
      const frame = parseFrame(
        merged.subarray(offset, offset + COLMI_FRAME_SIZE),
      );
      if (!frame) {
        offset += 1;
        continue;
      }
      frames.push(frame);
      offset += COLMI_FRAME_SIZE;
    }
    this.buffer = merged.slice(offset);
    return frames;
  }

  reset(): void {
    this.buffer = new Uint8Array(0);
  }
}

export function toBcd(value: number): number {
  return (((Math.floor(value / 10) << 4) | (value % 10)) & 0xff) >>> 0;
}

export function fromBcd(value: number): number {
  return ((value >> 4) & 0x0f) * 10 + (value & 0x0f);
}

/** Payload del comando 1 (hora): BCD de año(2 dígitos), mes, día, h, m, s + 1. */
export function makeSetTimePayload(date: Date = new Date()): number[] {
  return [
    toBcd(date.getFullYear() % 100),
    toBcd(date.getMonth() + 1),
    toBcd(date.getDate()),
    toBcd(date.getHours()),
    toBcd(date.getMinutes()),
    toBcd(date.getSeconds()),
    1,
  ];
}

export interface ColmiCapabilities {
  spo2: boolean;
  bloodPressure: boolean;
  stress: boolean;
  hrv: boolean;
  sleep: boolean;
  /** Solo marketing: la H59 no lleva sensor de temperatura. */
  temperature: boolean;
}

/** La respuesta al comando 1 es el bitmap de capacidades reales. */
export function parseCapabilities(
  payload: Uint8Array,
): ColmiCapabilities | null {
  if (payload.length < COLMI_PAYLOAD_SIZE) return null;
  return {
    temperature: payload[0] === 1,
    sleep: payload[8] === 1,
    spo2: (payload[3] & 2) !== 0,
    bloodPressure: (payload[3] & 4) !== 0,
    stress: (payload[13] & 16) !== 0,
    hrv: (payload[13] & 32) !== 0,
  };
}

/** Respuesta al comando 3: nivel % y si está cargando. */
export function parseBattery(
  payload: Uint8Array,
): { level: number; charging: boolean } | null {
  if (payload.length < 2) return null;
  return { level: payload[0], charging: payload[1] !== 0 };
}
