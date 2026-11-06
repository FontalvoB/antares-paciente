import { addDaysToISO, toLocalISODate } from "../utils/dates";
import { putNewestSample } from "../utils/samples";
import { applySample, newDayStore } from "./day-totals";
import type { DayStore } from "./day-totals";
import type { DeviceInfo, HealthSample, MetricKind } from "./types";

const VERSION = 1;
const KEY_PREFIX = "antares_wearable_samples:v1:";
/** El historial local es una caché; el último valor de cada métrica se conserva aparte. */
export const SAMPLE_HISTORY_LIMIT = 4096;
export const SAMPLE_HISTORY_DAYS = 7;
export const SAMPLE_TOTALS_DAYS = 30;

const METRICS = new Set<MetricKind>([
  "heart_rate", "spo2", "blood_pressure", "temperature", "respiratory_rate",
  "hrv", "stress", "steps", "distance", "calories", "sleep", "glucose",
  "wearing", "battery",
]);

export interface SampleSnapshot {
  accountId: string;
  deviceId: string;
  latest: Partial<Record<MetricKind, HealthSample>>;
  history: HealthSample[];
  info: DeviceInfo;
  lastSyncAt: number | null;
  /** Días separados para reintentar el upsert de ingesta tras quedarse sin red. */
  days: Record<string, DayStore>;
  /** Alias al acumulado del día local actual dentro de `days`. */
  day: DayStore;
  updatedAt: number;
  retention: {
    droppedSamples: number;
    droppedDays: number;
    oldestRetainedAt: number | null;
  };
}

type SerializedDay = Omit<DayStore, "buckets"> & {
  buckets: Array<[number, { steps: number; distance: number }]>;
};

type SnapshotPatch = { info?: DeviceInfo; lastSyncAt?: number | null };

function keyFor(accountId: string, deviceId: string): string {
  if (!accountId.trim() || !deviceId.trim()) {
    throw new Error("La persistencia del wearable requiere cuenta y dispositivo.");
  }
  return `${KEY_PREFIX}${encodeURIComponent(accountId)}:${encodeURIComponent(deviceId)}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 &&
    value <= 8_640_000_000_000_000;
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function dateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toLocalISODate(new Date(`${value}T12:00:00`)) === value;
}

function sampleFrom(value: unknown, deviceId: string): HealthSample | null {
  if (!record(value) || !METRICS.has(value.metric as MetricKind) ||
    typeof value.value !== "number" || !Number.isFinite(value.value) ||
    typeof value.unit !== "string" || value.unit.length > 64 ||
    !timestamp(value.ts) || value.deviceId !== deviceId ||
    (value.value2 !== undefined &&
      (typeof value.value2 !== "number" || !Number.isFinite(value.value2))) ||
    (value.agg !== undefined && value.agg !== "sum" && value.agg !== "max") ||
    (value.source !== undefined && value.source !== "live" && value.source !== "history")) {
    return null;
  }
  return {
    metric: value.metric as MetricKind,
    value: value.value,
    unit: value.unit,
    ts: value.ts,
    deviceId,
    ...(value.value2 !== undefined ? { value2: value.value2 as number } : {}),
    ...(value.agg !== undefined ? { agg: value.agg as HealthSample["agg"] } : {}),
    ...(value.source !== undefined ? { source: value.source as HealthSample["source"] } : {}),
    ...(value.sleepDurationVersion === 1 ? { sleepDurationVersion: 1 as const } : {}),
  };
}

function infoFrom(value: unknown): DeviceInfo | null {
  if (!record(value) ||
    (value.name !== undefined && typeof value.name !== "string") ||
    (value.firmware !== undefined && typeof value.firmware !== "string") ||
    (value.wearing !== undefined && typeof value.wearing !== "boolean") ||
    (value.battery !== undefined &&
      (!nonnegative(value.battery) || value.battery > 100))) return null;
  return {
    ...(value.name !== undefined ? { name: value.name as string } : {}),
    ...(value.firmware !== undefined ? { firmware: value.firmware as string } : {}),
    ...(value.wearing !== undefined ? { wearing: value.wearing as boolean } : {}),
    ...(value.battery !== undefined ? { battery: value.battery as number } : {}),
  };
}

function cloneDay(day: DayStore): DayStore {
  return {
    date: day.date,
    counters: { ...day.counters },
    buckets: new Map([...day.buckets].map(([ts, bucket]) => [ts, { ...bucket }])),
    sleep: day.sleep ? { ...day.sleep } : null,
  };
}

function dayFrom(value: unknown, date: string): DayStore | null {
  if (!record(value) || value.date !== date || !dateKey(date) ||
    !record(value.counters) || !nonnegative(value.counters.steps) ||
    !nonnegative(value.counters.distance) || !nonnegative(value.counters.calories) ||
    !Array.isArray(value.buckets)) return null;
  const day = newDayStore(date);
  day.counters = {
    steps: value.counters.steps,
    distance: value.counters.distance,
    calories: value.counters.calories,
  };
  for (const item of value.buckets) {
    if (!Array.isArray(item) || item.length !== 2 || !timestamp(item[0]) ||
      toLocalISODate(new Date(item[0])) !== date || !record(item[1]) ||
      !nonnegative(item[1].steps) || !nonnegative(item[1].distance)) return null;
    day.buckets.set(item[0], { steps: item[1].steps, distance: item[1].distance });
  }
  if (value.sleep !== null) {
    if (!record(value.sleep) || !timestamp(value.sleep.ts) ||
      !nonnegative(value.sleep.minutes) ||
      toLocalISODate(new Date(value.sleep.ts)) !== date) return null;
    day.sleep = { ts: value.sleep.ts, minutes: value.sleep.minutes };
  }
  return day;
}

function sampleKey(sample: HealthSample): string {
  // Un replay puede corregir una lectura; mismo slot/métrica reemplaza, no suma.
  return `${sample.metric}:${sample.ts}:${sample.agg ?? "max"}`;
}

function withCurrentDay(snapshot: SampleSnapshot, now: number): SampleSnapshot {
  const date = toLocalISODate(new Date(now));
  const days = { ...snapshot.days };
  const cutoff = addDaysToISO(date, 1 - SAMPLE_TOTALS_DAYS);
  let droppedDays = 0;
  for (const key of Object.keys(days)) {
    if (key < cutoff || key > date) {
      delete days[key];
      droppedDays += 1;
    }
  }
  days[date] ??= newDayStore(date);
  return {
    ...snapshot,
    days,
    day: days[date],
    retention: {
      ...snapshot.retention,
      droppedDays: snapshot.retention.droppedDays + droppedDays,
    },
  };
}

export function createSampleSnapshot(
  accountId: string,
  deviceId: string,
  now = Date.now(),
): SampleSnapshot {
  keyFor(accountId, deviceId);
  if (!timestamp(now)) throw new Error("Marca de tiempo del wearable inválida.");
  const day = newDayStore(toLocalISODate(new Date(now)));
  return {
    accountId, deviceId, latest: {}, history: [], info: {}, lastSyncAt: null,
    days: { [day.date]: day }, day, updatedAt: now,
    retention: { droppedSamples: 0, droppedDays: 0, oldestRetainedAt: null },
  };
}

/** JSON inválido se ignora; un fallo real de almacenamiento se propaga al consumidor. */
export function loadSampleSnapshot(
  accountId: string,
  deviceId: string,
  now = Date.now(),
): SampleSnapshot | null {
  const raw = localStorage.getItem(keyFor(accountId, deviceId));
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!record(value) || value.version !== VERSION || value.accountId !== accountId ||
    value.deviceId !== deviceId || !record(value.latest) ||
    !Array.isArray(value.history) || value.history.length > SAMPLE_HISTORY_LIMIT ||
    !record(value.days) || !timestamp(value.updatedAt) ||
    (value.lastSyncAt !== null && !timestamp(value.lastSyncAt)) ||
    !record(value.retention) || !nonnegative(value.retention.droppedSamples) ||
    !Number.isInteger(value.retention.droppedSamples) ||
    !nonnegative(value.retention.droppedDays) || !Number.isInteger(value.retention.droppedDays)) return null;
  const info = infoFrom(value.info);
  if (!info) return null;
  const snapshot = createSampleSnapshot(accountId, deviceId, now);
  snapshot.info = info;
  snapshot.lastSyncAt = value.lastSyncAt as number | null;
  snapshot.updatedAt = value.updatedAt;
  snapshot.retention.droppedSamples = value.retention.droppedSamples;
  snapshot.retention.droppedDays = value.retention.droppedDays;
  for (const [metric, rawSample] of Object.entries(value.latest)) {
    const sample = sampleFrom(rawSample, deviceId);
    if (!sample || sample.metric !== metric) return null;
    snapshot.latest[sample.metric] = sample;
  }
  const dedup = new Map<string, HealthSample>();
  for (const rawSample of value.history) {
    const sample = sampleFrom(rawSample, deviceId);
    if (!sample) return null;
    dedup.set(sampleKey(sample), sample);
  }
  const allHistory = [...dedup.values()].sort((a, b) => a.ts - b.ts);
  snapshot.history = allHistory.filter((sample) =>
    sample.ts >= now - SAMPLE_HISTORY_DAYS * 86_400_000,
  );
  snapshot.retention.droppedSamples += allHistory.length - snapshot.history.length;
  snapshot.retention.oldestRetainedAt = snapshot.history[0]?.ts ?? null;
  for (const [date, rawDay] of Object.entries(value.days)) {
    const day = dayFrom(rawDay, date);
    if (!day) return null;
    snapshot.days[date] = day;
  }
  return withCurrentDay(snapshot, now);
}

/** Una sola escritura atómica. No se tragan cuotas/errores: el journal nativo debe reintentar. */
export function saveSampleSnapshot(snapshot: SampleSnapshot): void {
  const days: Record<string, SerializedDay> = {};
  for (const [date, day] of Object.entries(snapshot.days)) {
    days[date] = { ...day, buckets: [...day.buckets] };
  }
  localStorage.setItem(keyFor(snapshot.accountId, snapshot.deviceId), JSON.stringify({
    version: VERSION,
    accountId: snapshot.accountId,
    deviceId: snapshot.deviceId,
    latest: snapshot.latest,
    history: snapshot.history,
    info: snapshot.info,
    lastSyncAt: snapshot.lastSyncAt,
    updatedAt: snapshot.updatedAt,
    retention: snapshot.retention,
    days,
  }));
}

/** Devuelve el nuevo estado SOLO después de persistirlo; nunca muta el anterior. */
export function recordSampleSnapshot(
  current: SampleSnapshot,
  input: HealthSample,
  now = Date.now(),
): SampleSnapshot {
  const sample = sampleFrom(input, current.deviceId);
  if (!sample || !timestamp(now)) throw new Error("Muestra del wearable inválida.");
  let next = withCurrentDay(current, now);
  const samples = new Map(next.history.map((entry) => [sampleKey(entry), entry]));
  samples.set(sampleKey(sample), sample);
  const all = [...samples.values()].sort((a, b) => a.ts - b.ts);
  const cutoff = now - SAMPLE_HISTORY_DAYS * 86_400_000;
  const history = all.filter((entry) => entry.ts >= cutoff).slice(-SAMPLE_HISTORY_LIMIT);
  next = {
    ...next,
    latest: putNewestSample(next.latest, sample),
    history,
    updatedAt: now,
    retention: {
      ...next.retention,
      droppedSamples: next.retention.droppedSamples + all.length - history.length,
      oldestRetainedAt: history[0]?.ts ?? null,
    },
  };
  const date = toLocalISODate(new Date(sample.ts));
  const today = toLocalISODate(new Date(now));
  const earliest = addDaysToISO(today, 1 - SAMPLE_TOTALS_DAYS);
  if (date >= earliest && date <= today) {
    const day = next.days[date] ? cloneDay(next.days[date]) : newDayStore(date);
    if (applySample(day, sample)) next.days[date] = day;
    if (date === next.day.date) next.day = next.days[date];
  }
  saveSampleSnapshot(next);
  return next;
}

export function updateSampleSnapshot(
  current: SampleSnapshot,
  patch: SnapshotPatch,
  now = Date.now(),
): SampleSnapshot {
  // Los campos ausentes/undefined de un delta no borran la info ya conocida.
  const definedInfo = Object.fromEntries(
    Object.entries(patch.info ?? {}).filter(([, value]) => value !== undefined),
  );
  const info = infoFrom({ ...current.info, ...definedInfo });
  if (!info || !timestamp(now) ||
    (patch.lastSyncAt !== undefined && patch.lastSyncAt !== null && !timestamp(patch.lastSyncAt))) {
    throw new Error("Estado del wearable inválido.");
  }
  const next = {
    ...withCurrentDay(current, now),
    info,
    lastSyncAt: patch.lastSyncAt === undefined ? current.lastSyncAt : patch.lastSyncAt,
    updatedAt: now,
  };
  saveSampleSnapshot(next);
  return next;
}

export function clearSampleSnapshot(accountId: string, deviceId: string): void {
  localStorage.removeItem(keyFor(accountId, deviceId));
}
