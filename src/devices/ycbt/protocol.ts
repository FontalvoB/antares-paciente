// Protocolo YCBT (familia Yucheng / anillo R88).
// Trama: [tipo_hi][tipo_lo][len_lo][len_hi][payload...][crc_lo][crc_hi]
// - tipo = (grupo << 8) | clave, big-endian
// - len = bytes totales de la trama (cabecera + payload + CRC), little-endian
// - CRC-16 sobre cabecera+payload, little-endian
// Referencia: documentación reversa de Open-RingBridge (R01L / chip JieLi AC632N).

export const YCBT_SERVICE = 'be940000-7333-be46-b7ae-689e71722bd5';
/** Canal bidireccional: comandos de la app y respuestas/ACK del dispositivo. */
export const YCBT_CHAR_C1 = 'be940001-7333-be46-b7ae-689e71722bd5';
/** Canal de notificaciones: medidas en vivo y bloques de historial. */
export const YCBT_CHAR_C3 = 'be940003-7333-be46-b7ae-689e71722bd5';
/** Autenticación JieLi (RCSP): si existe, hay que suscribirse o el anillo calla. */
export const JL_CHAR_WRITE = '0000ae01-0000-1000-8000-00805f9b34fb';
export const JL_CHAR_NOTIFY = '0000ae02-0000-1000-8000-00805f9b34fb';
/** Servicio estándar de frecuencia cardíaca (cualquier dispositivo compatible). */
export const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HR_CHAR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

/** UUIDs a los que la app necesita acceso en web (Web Bluetooth). */
export const BLE_ACCESS_SERVICES: string[] = [
  YCBT_SERVICE,
  HR_SERVICE,
  '0000ae00-0000-1000-8000-00805f9b34fb',
];

export const OP = {
  SET_TIME: 0x0100,
  SET_UNKNOWN_0109: 0x0109,
  SET_HEART_MONITOR: 0x010c,
  SET_SPO2_MONITOR: 0x0126,
  GET_DEVICE_INFO: 0x0200,
  GET_SUPPORT_FUNCTION: 0x0201,
  GET_DEVICE_NAME: 0x0203,
  GET_NOW_STEP: 0x020c,
  GET_CHIP_SCHEME: 0x021b,
  GET_POWER_STATS: 0x0225,
  APP_CONTROL_STOP: 0x0309,
  APP_CONTROL_START: 0x0309,
  KEEPALIVE: 0x032f,
  UPLOAD_COMPREHENSIVE: 0x060a,
  UPLOAD_HEART: 0x0601,
  UPLOAD_BLOOD_OXYGEN: 0x0602,
  UPLOAD_BLOOD: 0x0603,
  UPLOAD_BODY_DATA: 0x0610,
  UPLOAD_WEARING: 0x0613,
} as const;

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

/** Segundos desde 2001-01-01 UTC. */
export const BLE_EPOCH_OFFSET = 946684800;

export function bleSecondsToMs(seconds: number): number {
  return (seconds + BLE_EPOCH_OFFSET) * 1000;
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
      return 'unsupported-command';
    case 0xfc:
      return 'unsupported-key';
    case 0xfd:
      return 'bad-length';
    case 0xfe:
      return 'bad-data';
    case 0xff:
      return 'bad-crc';
    default:
      return null;
  }
}
