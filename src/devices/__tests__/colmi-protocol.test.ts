import { describe, it, expect } from 'vitest';
import {
  CMD,
  CMD_REALTIME_RESPONSE,
  COLMI_FRAME_SIZE,
  FrameStream,
  MEASURE_TYPE,
  buildFrame,
  checksum,
  fromBcd,
  makeSetTimePayload,
  parseBattery,
  parseCapabilities,
  parseFrame,
  toBcd,
} from '../colmi/protocol';
import { parseRealtimeFrame } from '../colmi/realtime';

const DEVICE = 'colmi-test';

function frameOf(cmd: number, payload: number[] = []) {
  const frame = parseFrame(buildFrame(cmd, payload));
  if (!frame) throw new Error('trama inválida');
  return frame;
}

describe('colmi protocol', () => {
  it('calcula el checksum como suma de los primeros 15 bytes', () => {
    expect(checksum(buildFrame(CMD.BATTERY))).toBe(CMD.BATTERY);
    expect(checksum(buildFrame(CMD.START_REALTIME, [1, 1]))).toBe(107);
  });

  it('construye tramas de 16 bytes con payload rellenado a cero', () => {
    const frame = buildFrame(CMD.BATTERY);
    expect(frame.length).toBe(COLMI_FRAME_SIZE);
    expect(Array.from(frame)).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3]);
  });

  it('parsea una trama y separa comando, error y payload', () => {
    const frame = frameOf(CMD.START_REALTIME, [1, 1]);
    expect(frame.cmd).toBe(105);
    expect(frame.error).toBe(false);
    expect(Array.from(frame.payload.slice(0, 3))).toEqual([1, 1, 0]);

    const error = frameOf(0x80 | 105, [1]);
    expect(error.cmd).toBe(105);
    expect(error.error).toBe(true);
  });

  it('rechaza tramas con tamaño o checksum incorrectos', () => {
    expect(parseFrame(buildFrame(CMD.BATTERY).slice(0, 15))).toBeNull();
    const broken = buildFrame(CMD.BATTERY);
    broken[5] = 9;
    expect(parseFrame(broken)).toBeNull();
  });

  it('reensambla notificaciones partidas y descarta bytes basura', () => {
    const stream = new FrameStream();
    const first = buildFrame(CMD.BATTERY);
    const second = buildFrame(CMD.SET_TIME, [1, 2]);

    expect(stream.push(first.slice(0, 7))).toEqual([]);
    const frames = stream.push(first.slice(7));
    expect(frames.length).toBe(1);
    expect(frames[0].cmd).toBe(CMD.BATTERY);

    const noise = new Uint8Array([0x00, ...second]);
    const withNoise = stream.push(noise);
    expect(withNoise.length).toBe(1);
    expect(withNoise[0].cmd).toBe(CMD.SET_TIME);
    expect(Array.from(withNoise[0].payload.slice(0, 2))).toEqual([1, 2]);

    stream.reset();
    expect(stream.push(first.slice(0, 7))).toEqual([]);
  });

  it('codifica la hora en BCD (año de 2 dígitos + 1 final)', () => {
    expect(toBcd(26)).toBe(0x26);
    expect(fromBcd(0x26)).toBe(26);
    const payload = makeSetTimePayload(new Date(2026, 8, 21, 10, 30, 15));
    expect(payload).toEqual([0x26, 0x09, 0x21, 0x10, 0x30, 0x15, 1]);
  });

  it('decodifica el bitmap de capacidades del comando 1', () => {
    const payload = new Uint8Array(14);
    payload[3] = 2 | 4;
    payload[8] = 1;
    payload[13] = 16 | 32;
    expect(parseCapabilities(payload)).toEqual({
      temperature: false,
      sleep: true,
      spo2: true,
      bloodPressure: true,
      stress: true,
      hrv: true,
    });
    expect(parseCapabilities(new Uint8Array(3))).toBeNull();
  });

  it('decodifica la respuesta de batería', () => {
    expect(parseBattery(new Uint8Array([87, 1]))).toEqual({ level: 87, charging: true });
    expect(parseBattery(new Uint8Array([0]))).toBeNull();
  });
});

describe('colmi realtime', () => {
  it('traduce el pulso (tipo 1) y el SpO2 (tipo 3)', () => {
    const hr = parseRealtimeFrame(frameOf(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.heart_rate, 0, 72]), DEVICE);
    expect(hr).toHaveLength(1);
    expect(hr[0]).toMatchObject({ metric: 'heart_rate', value: 72, unit: 'bpm', deviceId: DEVICE });

    const spo2 = parseRealtimeFrame(frameOf(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.spo2, 0, 98]), DEVICE);
    expect(spo2[0]).toMatchObject({ metric: 'spo2', value: 98, unit: '%' });
  });

  it('traduce la presión (tipo 2) con sistólica, diastólica y pulso', () => {
    const samples = parseRealtimeFrame(
      frameOf(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.blood_pressure, 0, 70, 120, 80]),
      DEVICE,
    );
    expect(samples).toHaveLength(2);
    expect(samples[0]).toMatchObject({
      metric: 'blood_pressure',
      value: 120,
      value2: 80,
      unit: 'mmHg',
    });
    expect(samples[1]).toMatchObject({ metric: 'heart_rate', value: 70 });
  });

  it('descarta lecturas inválidas y tipos fuera de alcance', () => {
    expect(parseRealtimeFrame(frameOf(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.blood_pressure, 0, 70, 0, 0]), DEVICE)).toEqual([]);
    expect(parseRealtimeFrame(frameOf(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.heart_rate, 0, 0]), DEVICE)).toEqual([]);
    expect(parseRealtimeFrame(frameOf(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.heart_rate, 1, 72]), DEVICE)).toEqual([]);
    expect(parseRealtimeFrame(frameOf(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.stress, 0, 45]), DEVICE)).toEqual([]);
    expect(parseRealtimeFrame(frameOf(CMD.BATTERY, [87, 0]), DEVICE)).toEqual([]);
  });
});
