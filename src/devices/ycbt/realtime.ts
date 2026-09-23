import type { HealthSample, MetricKind } from "../types";
import { MEASURE_MODE, OP, bleSecondsToMs } from "./protocol";
import type { YcbtPacket } from "./protocol";
import { readUint16LE, readUint24LE, readUint32LE } from "../util";

// Decodifica los paquetes de medida en vivo (grupo 0x06xx) que el anillo
// envía por C3 después de AppControlReal START.

/**
 * Rango plausible de SpO2: un barrido en calentamiento emite 0 o valores
 * basura; el SDK del fabricante gatea igual (su `spo2Range`). Sin este filtro
 * una mala lectura entra como si fuera medida.
 */
const SPO2_MIN = 70;
const SPO2_MAX = 100;

function plausibleSpo2(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value >= SPO2_MIN && value <= SPO2_MAX ? value : undefined;
}

export function parseRealtimePacket(
  packet: YcbtPacket,
  deviceId: string,
): HealthSample[] {
  switch (packet.type) {
    case OP.LIVE_STATUS:
      return parseLiveStatus(packet.payload, deviceId);
    case OP.UPLOAD_HEART:
      return single(deviceId, "heart_rate", packet.payload[0], "bpm");
    case OP.UPLOAD_BLOOD_OXYGEN:
      return single(deviceId, "spo2", plausibleSpo2(packet.payload[0]), "%");
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

/**
 * Estado en vivo (0x0600): [pasos u16][distancia u16][kcal u16]. Son los
 * acumulados del día (eltipo `max`), no incrementos.
 */
function parseLiveStatus(
  payload: Uint8Array,
  deviceId: string,
): HealthSample[] {
  if (payload.length < 6) return [];
  const samples: HealthSample[] = [];
  const steps = readUint16LE(payload, 0);
  const distance = readUint16LE(payload, 2);
  const calories = readUint16LE(payload, 4);
  if (steps) samples.push(...single(deviceId, "steps", steps, "count"));
  if (distance) samples.push(...single(deviceId, "distance", distance, "m"));
  if (calories) samples.push(...single(deviceId, "calories", calories, "kcal"));
  return samples;
}

/**
 * Push `04 13` de la medida en curso: [tipo][estado][valor][fracción?].
 * El tipo es el mismo modo con el que se lanzó `03 2f`.
 */
export function parseMeasurementStatus(
  payload: Uint8Array,
  deviceId: string,
): HealthSample[] {
  if (payload.length < 3) return [];
  const mode = payload[0] ?? 0;
  const value = payload[2] ?? 0;
  const fraction = payload[3] ?? 0;
  switch (mode) {
    case MEASURE_MODE.heart_rate:
      return single(deviceId, "heart_rate", value, "bpm");
    case MEASURE_MODE.blood_pressure: {
      if (!value || !fraction) return [];
      return single(deviceId, "blood_pressure", value, "mmHg", fraction);
    }
    case MEASURE_MODE.spo2:
      return single(deviceId, "spo2", plausibleSpo2(value), "%");
    case MEASURE_MODE.temperature: {
      const temp = Number.parseFloat(`${value}.${fraction}`);
      return single(deviceId, "temperature", temp, "°C");
    }
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
    "blood_pressure",
    systolic,
    "mmHg",
    diastolic,
  );
  const hr = payload[2] ?? 0;
  if (hr) samples.push(...single(deviceId, "heart_rate", hr, "bpm"));
  const hrv = payload[3] ?? 0;
  if (hrv) samples.push(...single(deviceId, "hrv", hrv, "ms"));
  const spo2 = plausibleSpo2(payload[4]);
  if (spo2) samples.push(...single(deviceId, "spo2", spo2, "%"));
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
  const spo2 = plausibleSpo2(payload[10]);
  const respiration = payload[11] ?? 0;
  const temp = (payload[12] ?? 0) + (payload[13] ?? 0) / 10;
  const wearing = payload[14] ?? 0;

  // Tramas de calentamiento: todo en cero hasta que el anillo toma contacto.
  if (!steps && !hr && !systolic && !spo2) return [];

  const samples: HealthSample[] = [];
  if (hr) samples.push(...single(deviceId, "heart_rate", hr, "bpm"));
  if (spo2) samples.push(...single(deviceId, "spo2", spo2, "%"));
  if (systolic) {
    samples.push(
      ...single(deviceId, "blood_pressure", systolic, "mmHg", diastolic),
    );
  }
  if (respiration) {
    samples.push(...single(deviceId, "respiratory_rate", respiration, "rpm"));
  }
  if (temp > 0) samples.push(...single(deviceId, "temperature", temp, "°C"));
  if (steps) samples.push(...single(deviceId, "steps", steps, "count"));
  if (distance) samples.push(...single(deviceId, "distance", distance, "m"));
  if (calories) samples.push(...single(deviceId, "calories", calories, "kcal"));
  samples.push(...single(deviceId, "wearing", wearing ? 1 : 0, "bool"));
  return samples;
}

/** Cambio de contacto: [0:4] ts BLE, [4] 1 = puesto, 0 = fuera. */
function parseWearing(payload: Uint8Array, deviceId: string): HealthSample[] {
  if (payload.length < 5) return [];
  const ts = bleSecondsToMs(readUint32LE(payload, 0));
  const worn = payload[4] ? 1 : 0;
  return [
    {
      metric: "wearing",
      value: worn,
      unit: "bool",
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
