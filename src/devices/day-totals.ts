import type { HealthSample } from "./types";

// Acumulado del día de UN dispositivo. Vive separado del contexto para poder
// testearlo y para que el reset al cambiar de wearable sea explícito: los datos
// de la banda no deben verse cuando está conectado el anillo.

export interface DeviceDayTotals {
  steps: number | null;
  distanceM: number | null;
  activityKcal: number | null;
  sleepMinutes: number | null;
}

export const EMPTY_TOTALS: DeviceDayTotals = {
  steps: null,
  distanceM: null,
  activityKcal: null,
  sleepMinutes: null,
};

export interface DayStore {
  /** Día local (yyyy-mm-dd) al que pertenece el acumulado. */
  date: string;
  /** Contadores acumulados del dispositivo (pasos/distancia/kcal en vivo). */
  counters: { steps: number; distance: number; calories: number };
  /** Cubetas del historial (aditivas), deduplicadas por hora de inicio. */
  buckets: Map<number, { steps: number; distance: number }>;
  sleep: { ts: number; minutes: number } | null;
}

export function newDayStore(date: string): DayStore {
  return {
    date,
    counters: { steps: 0, distance: 0, calories: 0 },
    buckets: new Map(),
    sleep: null,
  };
}

/**
 * Totales del día: los contadores del dispositivo (pasos/distancia/kcal en
 * vivo) son acumulados y mandan; las cubetas del historial (aditivas) cubren lo
 * registrado cuando el teléfono no estaba conectado.
 */
export function totalsOf(store: DayStore): DeviceDayTotals {
  let bucketSteps = 0;
  let bucketDistance = 0;
  for (const bucket of store.buckets.values()) {
    bucketSteps += bucket.steps;
    bucketDistance += bucket.distance;
  }
  const steps = Math.max(store.counters.steps, bucketSteps);
  const distanceM = Math.max(store.counters.distance, bucketDistance);
  return {
    steps: steps > 0 ? Math.round(steps) : null,
    distanceM: distanceM > 0 ? Math.round(distanceM) : null,
    activityKcal:
      store.counters.calories > 0 ? Math.round(store.counters.calories) : null,
    sleepMinutes: store.sleep?.minutes ?? null,
  };
}

/**
 * Aplica una muestra al acumulado. Devuelve true si cambió algo (para no
 * repintar ni marcar ingesta por muestras que no aportan al día).
 */
export function applySample(store: DayStore, sample: HealthSample): boolean {
  switch (sample.metric) {
    case "steps":
    case "distance": {
      const field = sample.metric === "steps" ? "steps" : "distance";
      if (sample.agg === "sum") {
        const bucket = store.buckets.get(sample.ts) ?? {
          steps: 0,
          distance: 0,
        };
        bucket[field] = sample.value;
        store.buckets.set(sample.ts, bucket);
      } else if (sample.value > store.counters[field]) {
        store.counters[field] = sample.value;
      }
      return true;
    }
    case "calories":
      if (sample.value > store.counters.calories) {
        store.counters.calories = sample.value;
        return true;
      }
      return false;
    case "sleep":
      if (!store.sleep || sample.ts > store.sleep.ts) {
        store.sleep = { ts: sample.ts, minutes: sample.value };
        return true;
      }
      return false;
    default:
      return false;
  }
}
