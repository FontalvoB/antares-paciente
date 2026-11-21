import { Capacitor, registerPlugin } from "@capacitor/core";
import { HealthFitness } from "@capacitor/health-fitness";
import { recordDeviceMetrics } from "../program/metrics-history-service";
import type { DeviceMetricsInput } from "../program/metrics-history-service";
import { toLocalISODate } from "../../utils/dates";
import { ApiError } from "../../utils/apiClient";

const HOUR_MS = 3_600_000;
const SLEEP_LOOKBACK_MS = 18 * HOUR_MS;
// Conserva una noche aunque las etapas separadas por un despertar no se solapen.
const MAX_SLEEP_INTERRUPTION_MS = 90 * 60_000;

const units = {
  steps: "steps",
  distance: "m",
  active_energy: "kcal",
  heart_rate: "bpm",
  resting_heart_rate: "bpm",
  sleep: "min",
} as const;

export type HealthMetric = keyof typeof units;
export type HealthSource = "apple-health" | "health-connect";
export type HealthAvailability = "available" | "unavailable" | "not-installed" | "web";
export type HealthPermission = "not-requested" | "unknown" | "granted" | "partial" | "denied";
export type HealthErrorCode = Exclude<HealthAvailability, "available">
  | "permission-denied" | "permission-unknown" | "no-data"
  | "read-failed" | "settings-failed" | "save-failed" | "save-unavailable" | "save-rejected";

export class HealthError extends Error {
  readonly code: HealthErrorCode;

  constructor(code: HealthErrorCode) {
    super(code);
    this.name = "HealthError";
    this.code = code;
  }
}

export interface HealthSample {
  metric: HealthMetric;
  value: number;
  unit: (typeof units)[HealthMetric];
  start: number;
  end: number;
  source: HealthSource;
  id?: string;
}

export interface HealthDay {
  date: string;
  start: number;
  end: number;
  values: Partial<Record<HealthMetric, number>>;
}

interface HealthStatus {
  availability: HealthAvailability;
  granted?: HealthMetric[];
}

type NativeRecord = Pick<HealthSample, "start" | "end" | "value" | "id">;
const native = registerPlugin<{
  status(): Promise<HealthStatus>;
  requestRead(): Promise<void>;
  read(options: { metric: HealthMetric; start: number; end: number }): Promise<{ records: NativeRecord[] }>;
  openSettings(): Promise<void>;
}>("WellnessHealth");

const metrics = Object.keys(units) as HealthMetric[];

export function healthSource(): HealthSource | null {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return "apple-health";
  if (platform === "android") return "health-connect";
  return null;
}

export async function isHealthAvailable(): Promise<HealthStatus> {
  if (!healthSource()) return { availability: "web" };
  if (!Capacitor.isPluginAvailable("WellnessHealth")) return { availability: "unavailable" };
  return native.status();
}

export function getHealthPermission(status: HealthStatus, requested: boolean): HealthPermission {
  if (!requested) return "not-requested";
  if (healthSource() === "apple-health") return "unknown";
  const count = status.granted?.length ?? 0;
  return count === metrics.length ? "granted" : count ? "partial" : "denied";
}

export async function requestHealthPermissions(): Promise<void> {
  const { availability } = await isHealthAvailable();
  if (availability !== "available") throw new HealthError(availability);
  // El plugin oficial no acepta reposo ni energía activa en Android. La solicitud
  // nativa reúne los seis tipos en un solo diálogo y siempre es solo lectura.
  await native.requestRead();
}

export async function openHealthSettings(): Promise<void> {
  const source = healthSource();
  if (!source) throw new HealthError("web");
  if (source === "health-connect") {
    try {
      // En Android 14+ puede no haber aplicación lanzable separada.
      const result: unknown = await HealthFitness.openHealthConnect();
      if (!result) return;
    } catch {
      // Abrir la pantalla del sistema cuando el proveedor integrado no tiene launcher.
    }
  }
  try {
    await native.openSettings();
  } catch {
    throw new HealthError("settings-failed");
  }
}

export async function disconnectHealth(): Promise<void> {
  const source = healthSource();
  if (!source) throw new HealthError("web");
  if (source === "apple-health") {
    await openHealthSettings();
    return;
  }
  const result: unknown = await HealthFitness.disconnectFromHealthConnect();
  if (result) throw new HealthError("settings-failed");
}

export function recentHealthStart(now: Date, days = 7): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
}

function windows(from: Date, to: Date): HealthDay[] {
  const days: HealthDay[] = [];
  for (let start = new Date(from); start < to;) {
    const midnight = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const end = Math.min(midnight.getTime(), to.getTime());
    days.push({ date: toLocalISODate(start), start: start.getTime(), end, values: {} });
    start = new Date(end);
  }
  return days;
}

function mapRecord(metric: HealthMetric, source: HealthSource, row: NativeRecord): HealthSample | null {
  if (![row.value, row.start, row.end].every(Number.isFinite) || row.value < 0 || row.end <= row.start) return null;
  const value = metric === "sleep" ? (row.end - row.start) / 60_000 : row.value;
  return { metric, value, unit: units[metric], start: row.start, end: row.end, source, id: row.id };
}

export async function readHealthData(from: Date, to: Date, status?: HealthStatus): Promise<HealthSample[]> {
  const source = healthSource();
  if (!source) throw new HealthError("web");
  const { availability, granted } = status ?? await isHealthAvailable();
  if (availability !== "available") throw new HealthError(availability);
  const allowed = source === "apple-health" ? metrics : granted ?? [];
  if (!allowed.length) throw new HealthError("permission-denied");
  const days = windows(from, to);
  if (!days.length) throw new HealthError("no-data");
  const samples = new Map<string, HealthSample>();
  for (const metric of allowed) {
    const ranges = metric === "sleep"
      ? [{ start: from.getTime() - SLEEP_LOOKBACK_MS, end: to.getTime() }]
      : days;
    for (const { start, end } of ranges) {
      let records: NativeRecord[];
      try {
        ({ records } = await native.read({ metric, start, end }));
      } catch (error) {
        if ((error as { code?: string })?.code === "permission-denied") throw new HealthError("permission-denied");
        throw new HealthError("read-failed");
      }
      for (const row of records) {
        const sample = mapRecord(metric, source, row);
        if (!sample) continue;
        const key = [source, metric, sample.id ?? `${sample.start}/${sample.end}`].join(":");
        samples.set(key, sample);
      }
    }
  }
  if (!samples.size) throw new HealthError("no-data");
  return [...samples.values()];
}

export function summarizeHealthData(samples: HealthSample[], from: Date, to: Date): HealthDay[] {
  const days = windows(from, to);
  const byStart = new Map(days.map(day => [day.start, day]));
  const byDate = new Map(days.map(day => [day.date, day]));
  const sleep = samples.filter(sample => sample.metric === "sleep").sort((a, b) => a.start - b.start);
  for (const sample of samples) {
    if (sample.metric === "sleep") continue;
    const day = byStart.get(sample.start);
    if (day?.end === sample.end) day.values[sample.metric] = sample.value;
  }

  let sessionEnd = -Infinity;
  let duration = 0;
  const applySleep = () => {
    if (!duration || sessionEnd < +from || sessionEnd > +to) return;
    const day = byDate.get(toLocalISODate(new Date(sessionEnd)));
    if (day) day.values.sleep = (day.values.sleep ?? 0) + duration / 60_000;
  };
  for (const interval of sleep) {
    if (interval.start - sessionEnd > MAX_SLEEP_INTERRUPTION_MS) {
      applySleep();
      duration = 0;
    }
    // Une fuentes y etapas solapadas, sin contar pausas sin datos como sueño.
    duration += Math.max(0, interval.end - Math.max(interval.start, sessionEnd));
    sessionEnd = Math.max(sessionEnd, interval.end);
  }
  applySleep();
  return days.filter(day => Object.keys(day.values).length > 0);
}

export function healthDeviceMetrics(day: HealthDay): DeviceMetricsInput | null {
  const fields = {
    steps: day.values.steps,
    distanceM: day.values.distance,
    activityKcal: day.values.active_energy,
    sleepMinutes: day.values.sleep,
  };
  const supported = Object.fromEntries(Object.entries(fields).filter(([, value]) => value != null && value >= 1));
  if (!Object.keys(supported).length) return null;
  return { ...supported, recordedAt: new Date(day.start + Math.floor((day.end - day.start) / 2)).toISOString() };
}

/** El servidor conserva una fila por día y código con origen device. */
export async function persistHealthDay(input: DeviceMetricsInput, userId: string, signal: AbortSignal) {
  try {
    return await recordDeviceMetrics(input, { expectedUserId: userId, signal });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 403 || error.status === 404 || error.code === "NO_ACTIVE_ENROLLMENT") {
        throw new HealthError("save-unavailable");
      }
      if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        throw new HealthError("save-rejected");
      }
    }
    throw new HealthError("save-failed");
  }
}
