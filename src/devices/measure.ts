import type { HealthSample, MetricKind } from "./types";

/** Una medida se considera vencida si su última lectura supera este tiempo. */
export const MEASURE_STALE_MS = 10 * 60_000;

/**
 * Medidas puntuales que faltan por tomar: sin lectura o con una lectura más
 * vieja que `maxAgeMs`. Es la regla que usa "Sincronizar ahora" para completar
 * con el anillo lo que aún no se ha medido, sin repetir lo recién medido.
 */
export function staleMeasureKinds(
  kinds: readonly MetricKind[],
  samples: Partial<Record<MetricKind, HealthSample>>,
  now: number,
  maxAgeMs: number = MEASURE_STALE_MS,
): MetricKind[] {
  return kinds.filter((kind) => {
    const sample = samples[kind];
    return !sample || now - sample.ts > maxAgeMs;
  });
}
