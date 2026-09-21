import type { HealthSample, MetricKind } from '../types';
import { OP, bleSecondsToMs } from './protocol';
import type { YcbtPacket } from './protocol';
import { readUint16LE, readUint24LE, readUint32LE } from '../util';

// Decodifica los paquetes de medida en vivo (grupo 0x06xx) que el anillo
// envía por C3 después de AppControlReal START.

export function parseRealtimePacket(
  packet: YcbtPacket,
  deviceId: string,
): HealthSample[] {
  switch (packet.type) {
    case OP.UPLOAD_HEART:
      return single(deviceId, 'heart_rate', packet.payload[0], 'bpm');
    case OP.UPLOAD_BLOOD_OXYGEN:
      return single(deviceId, 'spo2', packet.payload[0], '%');
    case OP.UPLOAD_BLOOD:
      return parseBlood(packet.payload, deviceId);
    case OP.UPLOAD_COMPREHENSIVE:
      return parseComprehensive(packet.payload, deviceId);
    case OP.UPLOAD_WEARING:
      return parseWearing(packet.payload, deviceId);
    default:
      return [];
  }
}

/** Presión arterial: [0] sistólica, [1] diastólica, [2] FC, [3] HRV, [4] SpO2. */
function parseBlood(payload: Uint8Array, deviceId: string): HealthSample[] {
  const systolic = payload[0] ?? 0;
  const diastolic = payload[1] ?? 0;
  if (!systolic) return [];
  const samples = single(
    deviceId,
    'blood_pressure',
    systolic,
    'mmHg',
    diastolic,
  );
  const hr = payload[2] ?? 0;
  if (hr) samples.push(...single(deviceId, 'heart_rate', hr, 'bpm'));
  const hrv = payload[3] ?? 0;
  if (hrv) samples.push(...single(deviceId, 'hrv', hrv, 'ms'));
  const spo2 = payload[4] ?? 0;
  if (spo2) samples.push(...single(deviceId, 'spo2', spo2, '%'));
  return samples;
}

/** Estado integral (~1/s): pasos, distancia, calorías, FC, presión, SpO2… */
function parseComprehensive(
  payload: Uint8Array,
  deviceId: string,
): HealthSample[] {
  if (payload.length < 20) return [];
  const steps = readUint24LE(payload, 0);
  const distance = readUint16LE(payload, 3);
  const calories = readUint16LE(payload, 5);
  const hr = payload[7] ?? 0;
  const systolic = payload[8] ?? 0;
  const diastolic = payload[9] ?? 0;
  const spo2 = payload[10] ?? 0;
  const respiration = payload[11] ?? 0;
  const temp = (payload[12] ?? 0) + (payload[13] ?? 0) / 10;
  const wearing = payload[14] ?? 0;

  // Tramas de calentamiento: todo en cero hasta que el anillo toma contacto.
  if (!steps && !hr && !systolic && !spo2) return [];

  const samples: HealthSample[] = [];
  if (hr) samples.push(...single(deviceId, 'heart_rate', hr, 'bpm'));
  if (spo2) samples.push(...single(deviceId, 'spo2', spo2, '%'));
  if (systolic) {
    samples.push(
      ...single(deviceId, 'blood_pressure', systolic, 'mmHg', diastolic),
    );
  }
  if (respiration) {
    samples.push(...single(deviceId, 'respiratory_rate', respiration, 'rpm'));
  }
  if (temp > 0) samples.push(...single(deviceId, 'temperature', temp, '°C'));
  if (steps) samples.push(...single(deviceId, 'steps', steps, 'count'));
  if (distance) samples.push(...single(deviceId, 'distance', distance, 'm'));
  if (calories) samples.push(...single(deviceId, 'calories', calories, 'kcal'));
  samples.push(...single(deviceId, 'wearing', wearing ? 1 : 0, 'bool'));
  return samples;
}

/** Cambio de contacto: [0:4] ts BLE, [4] 1 = puesto, 0 = fuera. */
function parseWearing(payload: Uint8Array, deviceId: string): HealthSample[] {
  if (payload.length < 5) return [];
  const ts = bleSecondsToMs(readUint32LE(payload, 0));
  const worn = payload[4] ? 1 : 0;
  return [
    {
      metric: 'wearing',
      value: worn,
      unit: 'bool',
      ts: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
      deviceId,
    },
  ];
}

function single(
  deviceId: string,
  metric: MetricKind,
  value: number | undefined,
  unit: string,
  value2?: number,
): HealthSample[] {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return [];
  return [
    {
      metric,
      value,
      value2,
      unit,
      ts: Date.now(),
      deviceId,
    },
  ];
}
