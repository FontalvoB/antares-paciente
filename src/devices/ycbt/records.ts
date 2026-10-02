import type { HealthSample } from "../types";
import { readUint16LE, readUint24LE, readUint32LE } from "../util";
import { ringTimeToMs } from "./protocol";

// Decodificadores de los registros del grupo Health (0x05). Siempre corren
// sobre el buffer COMPLETO reensamblado: el anillo concatena registros y corta
// el stream en límites de trama, así que un registro puede cruzar dos tramas.
// Layouts tomados del SDK del fabricante (DataUnpack.unpackHealthData).

const MAX_SLEEP_SESSION_MIN = 24 * 60;

/** Ritmo cardíaco plausible en reposo/actividad. */
const HR_MIN = 20;
const HR_MAX = 250;
/** Saturación plausible (descarta ceros de calentamiento). */
const SPO2_MIN = 70;
const SPO2_MAX = 100;
/** Temperatura corporal plausible. */
const TEMP_MIN = 30;
const TEMP_MAX = 45;
/** Presión plausible. */
const BP_MIN = 40;
const BP_MAX = 260;

export function decodeHistory(
  key: string,
  buffer: Uint8Array,
  deviceId: string,
): HealthSample[] {
  switch (key) {
    case "sport":
      return decodeSport(buffer, deviceId);
    case "sleep":
      return decodeSleep(buffer, deviceId);
    case "heart":
      return decodeHeart(buffer, deviceId);
    case "blood":
      return decodeBlood(buffer, deviceId);
    case "all":
      return decodeCombined(buffer, deviceId);
    case "spo2":
      return decodeSpo2(buffer, deviceId);
    default:
      return [];
  }
}

function sample(
  deviceId: string,
  metric: HealthSample["metric"],
  value: number,
  unit: string,
  ts: number,
  extra: Partial<HealthSample> = {},
): HealthSample {
  // Los decoders de este archivo son del volcado del historial del anillo.
  return { metric, value, unit, ts, deviceId, source: "history", ...extra };
}

/** Corta el buffer en registros de tamaño fijo (descarta el resto corto). */
function records(buffer: Uint8Array, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i + size <= buffer.length; i += size) {
    out.push(buffer.subarray(i, i + size));
  }
  return out;
}

/**
 * Sport (query 0x02, registros de 14 B):
 * `[inicio:u32][fin:u32][pasos:u16@8][distancia:u16@10][kcal:u16@12]`.
 * Son cubetas por intervalo (aditivas): se emiten con `agg: 'sum'` para que
 * el acumulado diario sume cubetas distintas y sea idempotente al re-sincronizar.
 */
function decodeSport(buffer: Uint8Array, deviceId: string): HealthSample[] {
  const out: HealthSample[] = [];
  for (const r of records(buffer, 14)) {
    const ts = ringTimeToMs(readUint32LE(r, 0));
    const steps = readUint16LE(r, 8);
    const distance = readUint16LE(r, 10);
    if (steps > 0) {
      out.push(sample(deviceId, "steps", steps, "count", ts, { agg: "sum" }));
    }
    if (distance > 0) {
      out.push(sample(deviceId, "distance", distance, "m", ts, { agg: "sum" }));
    }
  }
  return out;
}

/**
 * Frecuencia cardíaca (query 0x06, registros de 6 B): `[ts:u32][modo:1][fc:1]`.
 * `fc == 0` es una muestra sin contacto, no una lectura.
 */
function decodeHeart(buffer: Uint8Array, deviceId: string): HealthSample[] {
  const out: HealthSample[] = [];
  for (const r of records(buffer, 6)) {
    const hr = r[5] ?? 0;
    if (hr < HR_MIN || hr > HR_MAX) continue;
    out.push(
      sample(
        deviceId,
        "heart_rate",
        hr,
        "bpm",
        ringTimeToMs(readUint32LE(r, 0)),
      ),
    );
  }
  return out;
}

/** Presión (query 0x08, registros de 8 B): `[ts][?][sis@5][dia@6][fc@7]`. */
function decodeBlood(buffer: Uint8Array, deviceId: string): HealthSample[] {
  const out: HealthSample[] = [];
  for (const r of records(buffer, 8)) {
    const ts = ringTimeToMs(readUint32LE(r, 0));
    const systolic = r[5] ?? 0;
    const diastolic = r[6] ?? 0;
    if (
      systolic >= BP_MIN &&
      systolic <= BP_MAX &&
      diastolic >= BP_MIN &&
      diastolic <= BP_MAX
    ) {
      out.push(
        sample(deviceId, "blood_pressure", systolic, "mmHg", ts, {
          value2: diastolic,
        }),
      );
    }
    const hr = r[7] ?? 0;
    if (hr >= HR_MIN && hr <= HR_MAX) {
      out.push(sample(deviceId, "heart_rate", hr, "bpm", ts));
    }
  }
  return out;
}

/**
 * Registro combinado (query 0x09, registros de 20 B):
 * `[ts:u32][pasos:u16@4][fc@6][sis@7][dia@8][spo2@9][resp@10][hrv@11][cvrr@12]`
 * `[tempInt@13][tempFrac@14][grasaInt@15][grasaFrac@16][glucosa@17]`.
 * Los pasos del registro acumulado se omiten a propósito: son un contador del
 * día y el estado en vivo (0x0600) ya lo entrega siempre actualizado.
 */
function decodeCombined(buffer: Uint8Array, deviceId: string): HealthSample[] {
  const out: HealthSample[] = [];
  for (const r of records(buffer, 20)) {
    const ts = ringTimeToMs(readUint32LE(r, 0));
    const systolic = r[7] ?? 0;
    const diastolic = r[8] ?? 0;
    if (
      systolic >= BP_MIN &&
      systolic <= BP_MAX &&
      diastolic >= BP_MIN &&
      diastolic <= BP_MAX
    ) {
      out.push(
        sample(deviceId, "blood_pressure", systolic, "mmHg", ts, {
          value2: diastolic,
        }),
      );
    }
    const spo2 = r[9] ?? 0;
    if (spo2 >= SPO2_MIN && spo2 <= SPO2_MAX)
      out.push(sample(deviceId, "spo2", spo2, "%", ts));
    const resp = r[10] ?? 0;
    if (resp > 0)
      out.push(sample(deviceId, "respiratory_rate", resp, "rpm", ts));
    const hrv = r[11] ?? 0;
    if (hrv > 0) out.push(sample(deviceId, "hrv", hrv, "ms", ts));
    const temp = composite(r[13] ?? 0, r[14] ?? 0);
    if (temp > TEMP_MIN && temp < TEMP_MAX) {
      out.push(sample(deviceId, "temperature", temp, "°C", ts));
    }
  }
  return out;
}

/** SpO2 (query 0x1a, registros de 6 B): `[ts:u32][tipo@4][valor@5]`. */
function decodeSpo2(buffer: Uint8Array, deviceId: string): HealthSample[] {
  const out: HealthSample[] = [];
  for (const r of records(buffer, 6)) {
    const spo2 = r[5] ?? 0;
    if (spo2 < SPO2_MIN || spo2 > SPO2_MAX) continue;
    out.push(
      sample(deviceId, "spo2", spo2, "%", ringTimeToMs(readUint32LE(r, 0))),
    );
  }
  return out;
}

/**
 * Sueño (query 0x04, sesiones de longitud variable): header de 20 B
 * (`[flags:2][largo:u16@2][inicio:u32@4][fin:u32@8]…`) y segmentos de 8 B
 * (`[tag][inicioSegmento:u32][duración:u24]`). El tag se clasifica con
 * `tag & 0x0F`: 1 profundo, 2 ligero, 3 REM, 4 despierto, 5 siesta.
 * Un tag desconocido se ignora (nunca corta la sesión) y los segmentos
 * repetidos por el firmware se deduplican por su hora de inicio.
 */
function decodeSleep(buffer: Uint8Array, deviceId: string): HealthSample[] {
  const standard = decodeSleepStandard(buffer, deviceId);
  return standard.length > 0 ? standard : decodeSleepFallback(buffer, deviceId);
}

function decodeSleepStandard(
  buffer: Uint8Array,
  deviceId: string,
): HealthSample[] {
  const headerLength = 20;
  const segmentLength = 8;
  const out: HealthSample[] = [];

  let cursor = 0;
  while (cursor + headerLength <= buffer.length) {
    const recordLength = readUint16LE(buffer, cursor + 2);
    const segmentsStart = cursor + headerLength;
    const declared = Math.max(0, recordLength - headerLength) / segmentLength;
    const available = Math.floor(
      (buffer.length - segmentsStart) / segmentLength,
    );
    const segmentCount = Math.min(Math.floor(declared), available);

    let sessionStart = 0;
    let minutes = 0;
    const seenStarts = new Set<number>();
    for (let index = 0; index < segmentCount; index++) {
      const offset = segmentsStart + index * segmentLength;
      const tag = buffer[offset] ?? 0;
      const stage = sleepStage(tag);
      if (stage === null) continue;
      const segmentStart = readUint32LE(buffer, offset + 1);
      if (seenStarts.has(segmentStart)) continue;
      seenStarts.add(segmentStart);
      if (!sessionStart) sessionStart = segmentStart;
      const seconds = readUint24LE(buffer, offset + 5);
      const duration = Math.round(seconds / 60);
      if (duration <= 0) continue;
      minutes = Math.min(MAX_SLEEP_SESSION_MIN, minutes + duration);
    }

    if (sessionStart > 0 && minutes > 0) {
      const startMs = ringTimeToMs(sessionStart);
      out.push(
        sample(deviceId, "sleep", minutes, "min", startMs + minutes * 60_000),
      );
    }
    cursor = segmentsStart + segmentCount * segmentLength;
  }
  return out;
}

/**
 * Some YCBT firmware revisions return sleep segments with a malformed length
 * field or a different stage nibble. Do not fabricate a duration: only accept
 * 8-byte candidates with a valid stage, a plausible ring timestamp and a
 * bounded positive duration. Choose the best aligned run and emit it as one
 * latest sleep session when standard decoding found nothing.
 */
function decodeSleepFallback(
  buffer: Uint8Array,
  deviceId: string,
): HealthSample[] {
  const now = Date.now();
  const minTimestamp = now - 14 * 24 * 60 * 60_000;
  const maxTimestamp = now + 24 * 60 * 60_000;
  let best: Array<{ start: number; minutes: number }> = [];

  for (let offset = 0; offset < Math.min(20, buffer.length); offset++) {
    const run: Array<{ start: number; minutes: number }> = [];
    const seen = new Set<number>();
    for (let cursor = offset; cursor + 8 <= buffer.length; cursor += 8) {
      const stage = sleepStage(buffer[cursor] ?? 0);
      const ringStart = readUint32LE(buffer, cursor + 1);
      const startMs = ringTimeToMs(ringStart);
      const seconds = readUint24LE(buffer, cursor + 5);
      const minutes = Math.round(seconds / 60);
      if (
        stage === null ||
        startMs < minTimestamp ||
        startMs > maxTimestamp ||
        minutes < 1 ||
        minutes > MAX_SLEEP_SESSION_MIN ||
        seen.has(ringStart)
      ) {
        continue;
      }
      seen.add(ringStart);
      run.push({ start: ringStart, minutes });
    }
    const total = run.reduce((sum, segment) => sum + segment.minutes, 0);
    const bestTotal = best.reduce((sum, segment) => sum + segment.minutes, 0);
    if (
      run.length > best.length ||
      (run.length === best.length && total > bestTotal)
    ) {
      best = run;
    }
  }

  const totalMinutes = best.reduce((sum, segment) => sum + segment.minutes, 0);
  if (best.length < 2 || totalMinutes < 20) return [];

  const start = ringTimeToMs(Math.min(...best.map((segment) => segment.start)));
  return [
    sample(
      deviceId,
      "sleep",
      Math.min(totalMinutes, MAX_SLEEP_SESSION_MIN),
      "min",
      start + Math.min(totalMinutes, MAX_SLEEP_SESSION_MIN) * 60_000,
    ),
  ];
}

function sleepStage(tag: number): number | null {
  const lowNibble = tag & 0x0f;
  switch (lowNibble) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return lowNibble;
    default:
      break;
  }

  // A few firmware builds put stage in high nibble while retaining the same
  // stage values. Accept only that explicit variant; all other bytes remain
  // invalid and cannot create fabricated sleep.
  const highNibble = (tag >> 4) & 0x0f;
  return highNibble >= 1 && highNibble <= 5 ? highNibble : null;
}

/** El SDK concatena entero y fracción como texto (`36` + `6` → 36.6). */
function composite(integer: number, fraction: number): number {
  return Number.parseFloat(`${integer}.${fraction}`);
}
