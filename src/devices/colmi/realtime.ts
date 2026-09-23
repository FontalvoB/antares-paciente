import { CMD_REALTIME_RESPONSE, MEASURE_TYPE } from "./protocol";
import type { ColmiFrame } from "./protocol";
import type { HealthSample, MetricKind } from "../types";

// Respuesta en vivo: 69 <tipo> <err> <b3> <b4> <b5> …
// - FC (1): layout clásico = b3; en este firmware H59 el valor viaja como u16
//   en payload[5..6] en DÉCIMAS de lpm (payload[2] queda en 0). Se aceptan los
//   dos, con gate de plausibilidad para no inventar lecturas.
// - SpO2 (3): valor en b3.
// - Presión (2): b4 = sistólica, b5 = diastólica, b3 = FC.
// - Stress (8) y HRV (10) quedan fuera del alcance actual (HRV sin decodificar).

export interface HeartRateReading {
  bpm: number;
  /** `byte` = layout documentado; `u16` = décimas de lpm del firmware H59. */
  layout: "byte" | "u16";
}

/** Rango plausible de FC (lpm) para el layout en décimas. */
const HR_MIN = 300;
const HR_MAX = 2200;

/**
 * FC de una trama en vivo, tolerando los dos layouts conocidos. Devuelve null
 * si no hay lectura (el ack de la banda llega con todo en cero) o si el valor
 * en décimas cae fuera del rango humano.
 */
export function heartRateFromPayload(
  payload: Uint8Array,
): HeartRateReading | null {
  const classic = payload[2] ?? 0;
  if (classic > 0) return { bpm: classic, layout: "byte" };
  const raw = (payload[5] ?? 0) | ((payload[6] ?? 0) << 8);
  if (raw < HR_MIN || raw > HR_MAX) return null;
  return { bpm: Math.round(raw / 10), layout: "u16" };
}

/** Rango plausible de SpO2 (%) para el layout en décimas. */
const SPO2_RAW_MIN = 500;
const SPO2_RAW_MAX = 1000;

/**
 * SpO2 de una trama en vivo con el mismo criterio que la FC: byte clásico si
 * viene, y si no el u16 en décimas (el firmware H59 que emite la FC así puede
 * usar el mismo layout para el resto de sensores).
 */
export function spo2FromPayload(
  payload: Uint8Array,
): { value: number; layout: "byte" | "u16" } | null {
  const classic = payload[2] ?? 0;
  if (classic > 0) return { value: classic, layout: "byte" };
  const raw = (payload[5] ?? 0) | ((payload[6] ?? 0) << 8);
  if (raw < SPO2_RAW_MIN || raw > SPO2_RAW_MAX) return null;
  return { value: Math.round(raw / 10), layout: "u16" };
}

/** Rangos plausibles de presión (mmHg). */
const SYS_MIN = 60;
const SYS_MAX = 260;
const DIA_MIN = 40;
const DIA_MAX = 160;

export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  /** `byte` = layout documentado; `u16`/`u16x10` = variantes del firmware. */
  layout: "byte" | "u16" | "u16x10";
  heartRate?: number;
}

function plausiblePressure(systolic: number, diastolic: number): boolean {
  return (
    systolic >= SYS_MIN &&
    systolic <= SYS_MAX &&
    diastolic >= DIA_MIN &&
    diastolic <= DIA_MAX &&
    systolic > diastolic
  );
}

/**
 * Presión de una trama en vivo, tolerando layouts: el documentado
 * (`payload[3]`/`payload[4]` con FC en `payload[2]`) y el del firmware H59, que
 * mueve los valores a u16 en `payload[5..6]`/`payload[7..8]` (con o sin
 * décimas). Todas las variantes pasan por el mismo gate de plausibilidad.
 */
export function bloodPressureFromPayload(
  payload: Uint8Array,
): BloodPressureReading | null {
  const sysByte = payload[3] ?? 0;
  const diaByte = payload[4] ?? 0;
  if (plausiblePressure(sysByte, diaByte)) {
    const hr = payload[2] ?? 0;
    return {
      systolic: sysByte,
      diastolic: diaByte,
      layout: "byte",
      ...(hr > 0 ? { heartRate: hr } : {}),
    };
  }

  const sysRaw = (payload[5] ?? 0) | ((payload[6] ?? 0) << 8);
  const diaRaw = (payload[7] ?? 0) | ((payload[8] ?? 0) << 8);
  if (plausiblePressure(sysRaw, diaRaw)) {
    return { systolic: sysRaw, diastolic: diaRaw, layout: "u16" };
  }
  const sys = Math.round(sysRaw / 10);
  const dia = Math.round(diaRaw / 10);
  if (plausiblePressure(sys, dia)) {
    return { systolic: sys, diastolic: dia, layout: "u16x10" };
  }
  return null;
}

export function parseRealtimeFrame(
  frame: ColmiFrame,
  deviceId: string,
): HealthSample[] {
  if (frame.cmd !== CMD_REALTIME_RESPONSE || frame.error) return [];
  const type = frame.payload[0] ?? 0;
  const err = frame.payload[1] ?? 0;
  if (err !== 0) return [];

  const sample = (
    metric: MetricKind,
    value: number,
    unit: string,
    value2?: number,
  ): HealthSample => ({
    metric,
    value,
    ...(value2 === undefined ? {} : { value2 }),
    unit,
    ts: Date.now(),
    deviceId,
  });

  switch (type) {
    case MEASURE_TYPE.heart_rate: {
      const reading = heartRateFromPayload(frame.payload);
      return reading ? [sample("heart_rate", reading.bpm, "bpm")] : [];
    }
    case MEASURE_TYPE.spo2: {
      const reading = spo2FromPayload(frame.payload);
      return reading ? [sample("spo2", reading.value, "%")] : [];
    }
    case MEASURE_TYPE.blood_pressure: {
      const reading = bloodPressureFromPayload(frame.payload);
      if (!reading) return [];
      const samples = [
        sample("blood_pressure", reading.systolic, "mmHg", reading.diastolic),
      ];
      if (reading.heartRate) {
        samples.push(sample("heart_rate", reading.heartRate, "bpm"));
      }
      return samples;
    }
    default:
      return [];
  }
}
