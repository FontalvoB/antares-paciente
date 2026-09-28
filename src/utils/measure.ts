import type { MeasurePolicy, MetricKind } from "../devices/types";

// Fases del cronómetro de una medida puntual. La ventana y el umbral salen del
// driver (`DeviceSession.measurePolicy`); si no los expone se usan los valores
// de respaldo, que coinciden con la red de seguridad de la pantalla.

/** Respaldo cuando el driver no declara política. */
export const FALLBACK_MEASURE_WINDOW_MS = 45_000;
const FALLBACK_RETRY_RATIO = 0.4;

export interface MeasurePhase {
  /** 0..1 sobre la ventana total (para la barra de progreso). */
  progress: number;
  /** `measuring` = aún dentro del tiempo esperado; `adjusting` = el sensor engancha. */
  phase: "measuring" | "adjusting";
  /** Milisegundos que quedan de la fase actual (nunca negativo). */
  remainingMs: number;
  /** Ventana total aplicada. */
  windowMs: number;
}

export function measurePhase(
  elapsedMs: number,
  policy?: MeasurePolicy,
): MeasurePhase {
  const windowMs = Math.max(1, policy?.windowMs ?? FALLBACK_MEASURE_WINDOW_MS);
  const retryMs = Math.min(
    windowMs,
    Math.max(1, policy?.retryMs ?? windowMs * FALLBACK_RETRY_RATIO),
  );
  const elapsed = Math.max(0, elapsedMs);
  const progress = Math.min(1, elapsed / windowMs);

  if (elapsed < retryMs) {
    return {
      progress,
      phase: "measuring",
      remainingMs: retryMs - elapsed,
      windowMs,
    };
  }
  return {
    progress,
    phase: "adjusting",
    remainingMs: Math.max(0, windowMs - elapsed),
    windowMs,
  };
}

/** Nombre corto por métrica para las etiquetas de progreso. */
export const MEASURE_SHORT: Partial<Record<MetricKind, string>> = {
  heart_rate: "FC",
  spo2: "SpO2",
  blood_pressure: "Presión",
};

type Translate = (source: string, params?: Record<string, string>) => string;

/**
 * Etiqueta de fase de una medida puntual: `Midiendo {métrica}…` mientras corre
 * dentro del tiempo esperado y `Ajustando el sensor…` cuando el sensor ya está
 * enganchando (o el dato llega tarde). Sin cifras: la ventana del driver no es
 * un cronómetro exacto y mostraba segundos engañosos.
 */
export function measurePhaseLabel(
  kind: MetricKind,
  phase: MeasurePhase,
  t: Translate,
): string {
  if (phase.phase === "adjusting") return t("Ajustando el sensor…");
  return t("Midiendo {metric}…", {
    metric: t(MEASURE_SHORT[kind] ?? "Medición"),
  });
}
