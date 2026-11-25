import { toLocalISODate } from "../../../utils/dates";

export const VITAL_METRICS = {
  heartRate: { label: "Frecuencia cardíaca", unit: "lpm", series: ["Frecuencia cardíaca"] },
  bloodPressure: { label: "Presión arterial", unit: "mmHg", series: ["Sistólica", "Diastólica"] },
  oxygen: { label: "Saturación de oxígeno (SpO₂)", unit: "%", series: ["Saturación de oxígeno (SpO₂)"] },
  steps: { label: "Pasos", unit: "pasos", series: ["Pasos"] },
  sleep: { label: "Sueño", unit: "h", series: ["Sueño"] },
  weight: { label: "Peso", unit: "kg", series: ["Peso"] },
  temperature: { label: "Temperatura", unit: "°C", series: ["Temperatura"] },
  glucose: { label: "Glucosa", unit: "mg/dL", series: ["Glucosa"] },
} as const;

export const VITAL_SOURCES = { manual: "Manual", apple: "Apple", watch: "Reloj" } as const;
export type VitalMetric = keyof typeof VITAL_METRICS;
export const VITAL_METRIC_IDS = Object.keys(VITAL_METRICS) as VitalMetric[];
export type VitalSource = keyof typeof VITAL_SOURCES;
export type VitalValue = number | { systolic: number; diastolic: number };

export interface VitalReading {
  value: VitalValue;
  source: VitalSource;
  measuredAt: string;
  timezoneOffset: number;
}

export interface VitalDay extends VitalReading {
  date: string;
  previous: VitalReading[];
}

export type Vitals = Partial<Record<VitalMetric, Record<string, VitalDay>>>;

export function validVitalValue(metric: VitalMetric, value: VitalValue): boolean {
  if (metric === "bloodPressure") {
    return typeof value === "object" && Number.isFinite(value.systolic) &&
      Number.isFinite(value.diastolic) && value.diastolic > 0 && value.systolic > value.diastolic;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  switch (metric) {
    case "temperature": return value >= -273.15;
    case "steps": return Number.isSafeInteger(value) && value >= 0;
    case "sleep": return value >= 0 && value <= 24;
    case "oxygen": return value > 0 && value <= 100;
    default: return value > 0;
  }
}

function storageKey(owner: string) {
  return "wellness.vitals.v1." + encodeURIComponent(owner);
}

export function loadVitals(owner: string): Vitals {
  const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey(owner)) ?? "{}");
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    throw new Error("Invalid vitals storage");
  }
  return stored as Vitals;
}

export async function saveVital(
  owner: string,
  metric: VitalMetric,
  value: VitalValue,
  source: VitalSource,
  measuredAt = new Date(),
): Promise<Vitals> {
  if (!validVitalValue(metric, value) || !Object.hasOwn(VITAL_SOURCES, source)) {
    throw new RangeError("Invalid vital reading");
  }
  const date = toLocalISODate(measuredAt);
  const reading: VitalReading = {
    value,
    source,
    measuredAt: measuredAt.toISOString(),
    timezoneOffset: measuredAt.getTimezoneOffset(),
  };

  const persist = () => {
    const vitals = loadVitals(owner);
    const days = vitals[metric] ?? {};
    const existing = days[date];
    const readings = [...(existing?.previous ?? [])];
    if (existing) {
      const { date: _date, previous: _previous, ...current } = existing;
      readings.unshift(current);
    }
    const duplicate = readings.some((item) =>
      item.measuredAt === reading.measuredAt && item.source === source &&
      JSON.stringify(item.value) === JSON.stringify(value),
    );
    if (duplicate) return vitals;
    // ISO ordena cronológicamente. Si se repite la hora, gana la escritura más reciente.
    readings.unshift(reading);
    readings.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    const [current, ...previous] = readings;
    const next = { ...vitals, [metric]: { ...days, [date]: { ...current, date, previous } } };
    window.localStorage.setItem(storageKey(owner), JSON.stringify(next));
    return next;
  };

  return navigator.locks ? navigator.locks.request(storageKey(owner), persist) : persist();
}

