import { describe, expect, it } from 'vitest';
import {
  BLE_EPOCH_OFFSET,
  PacketStream,
  bleSecondsToMs,
  buildPacket,
  crc16,
  decodeErrorPayload,
  makeBleTime,
  msToBleSeconds,
  parsePacket,
} from '../ycbt/protocol';

// Vectores calculados con la implementación de referencia del protocolo.
describe('crc16', () => {
  it('coincide con los vectores conocidos', () => {
    expect(crc16(new Uint8Array([0x02, 0x01, 0x08, 0x00, 0x47, 0x46]))).toBe(0x169b);
    expect(
      crc16(new Uint8Array([0x03, 0x09, 0x0a, 0x00, 0x01, 0x00, 0x02, 0xa0])),
    ).toBe(0xf1b9);
    expect(crc16(new Uint8Array([0x06, 0x01, 0x07, 0x00, 0x48]))).toBe(0xe661);
    expect(crc16(new Uint8Array([]))).toBe(0xffff);
  });
});

describe('buildPacket / parsePacket', () => {
  it('construye la trama con longitud total y CRC little-endian', () => {
    const frame = buildPacket(0x0201, [0x47, 0x46]);
    expect(Array.from(frame)).toEqual([
      0x02, 0x01, 0x08, 0x00, 0x47, 0x46, 0x9b, 0x16,
    ]);
  });

  it('parsea ida y vuelta tipo, grupo, clave y payload', () => {
    const parsed = parsePacket(buildPacket(0x0309, [0x01, 0x00, 0x02, 0xa0]));
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe(0x0309);
    expect(parsed?.group).toBe(3);
    expect(parsed?.key).toBe(0x09);
    expect(Array.from(parsed?.payload ?? [])).toEqual([0x01, 0x00, 0x02, 0xa0]);
  });

  it('admite tramas sin payload', () => {
    const parsed = parsePacket(buildPacket(0x021b));
    expect(parsed?.type).toBe(0x021b);
    expect(parsed?.payload.length).toBe(0);
  });

  it('rechaza tramas incompletas, con longitud incoherente o CRC roto', () => {
    expect(parsePacket(new Uint8Array([0x06, 0x01, 0x07]))).toBeNull();

    const wrongLength = buildPacket(0x0601, [0x48]);
    wrongLength[2] = 9;
    expect(parsePacket(wrongLength)).toBeNull();

    const wrongCrc = buildPacket(0x0601, [0x48]);
    wrongCrc[wrongCrc.length - 1] ^= 0xff;
    expect(parsePacket(wrongCrc)).toBeNull();
  });
});

describe('PacketStream', () => {
  it('reensambla tramas partidas entre notificaciones', () => {
    const first = buildPacket(0x0601, [72]);
    const second = buildPacket(0x0602, [98]);
    const stream = new PacketStream();

    expect(stream.push(first.subarray(0, 3))).toEqual([]);

    const merged = new Uint8Array(first.length - 3 + second.length);
    merged.set(first.subarray(3));
    merged.set(second, first.length - 3);

    expect(stream.push(merged).map((p) => p.type)).toEqual([0x0601, 0x0602]);
  });

  it('descarta bytes basura antes de una trama válida', () => {
    const frame = buildPacket(0x0601, [72]);
    const withNoise = new Uint8Array(frame.length + 1);
    withNoise.set(frame, 1);

    const stream = new PacketStream();
    const packets = stream.push(withNoise);
    expect(packets.map((p) => p.type)).toEqual([0x0601]);
    expect(Array.from(packets[0].payload)).toEqual([72]);
  });

  it('reset() descarta el buffer pendiente', () => {
    const frame = buildPacket(0x0601, [72]);
    const stream = new PacketStream();
    stream.push(frame.subarray(0, 4));
    stream.reset();
    expect(stream.push(frame.subarray(4))).toEqual([]);
  });
});

describe('tiempo BLE', () => {
  it('convierte segundos desde 2001 a milisegundos unix', () => {
    expect(BLE_EPOCH_OFFSET).toBe(946684800);
    expect(bleSecondsToMs(0)).toBe(946684800000);
    expect(msToBleSeconds(946684800000)).toBe(0);
    expect(msToBleSeconds(bleSecondsToMs(1234))).toBe(1234);
  });

  it('codifica la fecha con lunes=0 y domingo=6', () => {
    expect(makeBleTime(new Date(2026, 8, 21, 10, 30, 15))).toEqual([
      0xea, 0x07, 9, 21, 10, 30, 15, 0,
    ]);
    expect(makeBleTime(new Date(2026, 8, 20, 0, 0, 0))[7]).toBe(6);
  });
});

describe('decodeErrorPayload', () => {
  it('traduce los códigos de error de un byte', () => {
    expect(decodeErrorPayload(new Uint8Array([0xfb]))).toBe('unsupported-command');
    expect(decodeErrorPayload(new Uint8Array([0xfc]))).toBe('unsupported-key');
    expect(decodeErrorPayload(new Uint8Array([0xfd]))).toBe('bad-length');
    expect(decodeErrorPayload(new Uint8Array([0xfe]))).toBe('bad-data');
    expect(decodeErrorPayload(new Uint8Array([0xff]))).toBe('bad-crc');
    expect(decodeErrorPayload(new Uint8Array([0x01]))).toBeNull();
    expect(decodeErrorPayload(new Uint8Array([]))).toBeNull();
  });
});
