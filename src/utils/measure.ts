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
 * Etiqueta del cronómetro: `Midiendo {métrica}… {restantes}s` mientras está
 * dentro del tiempo esperado y `Ajustando el sensor… ({transcurrido}s)` después.
 */
export function measurePhaseLabel(
  kind: MetricKind,
  phase: MeasurePhase,
  elapsedSeconds: number,
  t: Translate,
): string {
  const metric = t(MEASURE_SHORT[kind] ?? "Medición");
  if (phase.phase === "measuring") {
    return t("Midiendo {metric}… {seconds}s", {
      metric,
      seconds: String(Math.ceil(phase.remainingMs / 1000)),
    });
  }
  return t("Ajustando el sensor… ({seconds}s)", {
    seconds: String(elapsedSeconds),
  });
}
