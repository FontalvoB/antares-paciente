import type { DeviceDayTotals } from "./day-totals";
import type { HealthSample, MetricKind } from "./types";

export const MOCK_DEVICE_ID = "mock-wearable";

export const MOCK_TODAY_TOTALS: DeviceDayTotals = {
  steps: 6240,
  distanceM: 4380,
  activityKcal: 286,
  sleepMinutes: 393,
};

export const MOCK_VITAL_VALUES: Readonly<Record<string, string>> = {
  fc: "72",
  pa: "118/76",
  spo2: "98",
  pasos: "6240",
  sueno: "6.55",
  peso: "72.4",
  temp: "36.7",
  glu: "96",
};

export const MOCK_VITAL_TRENDS: Readonly<Record<string, readonly number[]>> = {
  fc: [68, 71, 69, 74, 70, 73, 72],
  pa: [121, 119, 122, 117, 120, 116, 118],
  spo2: [97, 98, 97, 99, 98, 97, 98],
  pasos: [920, 1840, 2780, 3560, 4490, 5380, 6240],
  sueno: [6.1, 7.0, 6.5, 7.3, 6.8, 6.2, 6.55],
  peso: [74.1, 73.8, 73.6, 73.2, 73.0, 72.7, 72.4],
  temp: [36.6, 36.5, 36.7, 36.6, 36.8, 36.6, 36.7],
  glu: [101, 98, 95, 99, 94, 97, 96],
};

export function createMockWearableSamples(
  now = Date.now(),
): Partial<Record<MetricKind, HealthSample>> {
  const sleepAt = new Date(now);
  sleepAt.setHours(6, 33, 0, 0);

  return {
    heart_rate: {
      metric: "heart_rate",
      value: 72,
      unit: "bpm",
      ts: now,
      deviceId: MOCK_DEVICE_ID,
    },
    blood_pressure: {
      metric: "blood_pressure",
      value: 118,
      value2: 76,
      unit: "mmHg",
      ts: now,
      deviceId: MOCK_DEVICE_ID,
    },
    spo2: {
      metric: "spo2",
      value: 98,
      unit: "%",
      ts: now,
      deviceId: MOCK_DEVICE_ID,
    },
    temperature: {
      metric: "temperature",
      value: 36.7,
      unit: "°C",
      ts: now,
      deviceId: MOCK_DEVICE_ID,
    },
    steps: {
      metric: "steps",
      value: MOCK_TODAY_TOTALS.steps ?? 6240,
      unit: "count",
      ts: now,
      deviceId: MOCK_DEVICE_ID,
    },
    sleep: {
      metric: "sleep",
      value: MOCK_TODAY_TOTALS.sleepMinutes ?? 393,
      unit: "min",
      ts: sleepAt.getTime(),
      deviceId: MOCK_DEVICE_ID,
    },
  };
}

/** Métricas que el demo "mide" bajo demanda (ventanas acortadas). */
export const MOCK_MEASURE_KINDS: MetricKind[] = [
  "heart_rate",
  "spo2",
  "blood_pressure",
];

/**
 * Ventanas acortadas del demo: la secuencia completa (FC → SpO2 → presión)
 * se ve en ~30 s en vez de los 2-3 min de un driver real. La UI calcula su
 * cronómetro con estas mismas ventanas, así el tiempo que ve el usuario es
 * el que realmente aplica la simulación.
 */
export const MOCK_MEASURE_WINDOWS: Partial<Record<MetricKind, number>> = {
  heart_rate: 6_000,
  spo2: 10_000,
  blood_pressure: 12_000,
};

/** Muestra que "mide" el demo al terminar la ventana de una métrica. */
export function mockMeasureSample(
  kind: MetricKind,
  now = Date.now(),
): HealthSample | undefined {
  const sample = createMockWearableSamples(now)[kind];
  return sample ? { ...sample, ts: now } : undefined;
}
