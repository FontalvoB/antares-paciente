import type { HealthSample, MetricKind } from "../devices/types";

/**
 * Guarda la muestra por métrica conservando SIEMPRE la más reciente. El volcado
 * de historial entrega lecturas con su marca original y no debe pisar una
 * medida recién tomada: si no, la tarjeta mostraría "Hace N min" justo después
 * de medir. Una lectura nueva con la misma marca también reemplaza (llega el
 * valor definitivo).
 */
export function putNewestSample(
  prev: Partial<Record<MetricKind, HealthSample>>,
  sample: HealthSample,
): Partial<Record<MetricKind, HealthSample>> {
  const current = prev[sample.metric];
  if (current && current.ts > sample.ts) return prev;
  return { ...prev, [sample.metric]: sample };
}
