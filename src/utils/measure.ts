import type { HealthSample, MeasurePolicy, MetricKind } from "../devices/types";
import {
  heartOutline,
  medkitOutline,
  pulseOutline,
  waterOutline,
} from "ionicons/icons";

// Fases del cronómetro de una medida puntual. La ventana y el umbral salen del
// driver (`DeviceSession.measurePolicy`); si no los expone se usan los valores
// de respaldo, que coinciden con la red de seguridad de la pantalla.

/** Respaldo cuando el driver no declara política. */
export const FALLBACK_MEASURE_WINDOW_MS = 45_000;
/** La tarjeta se queda en 100 % este instante al llegar la lectura. */
export const FLASH_MS = 600;
/** …y más al cerrar la última, para leer la tira completa antes de salir. */
export const FLASH_LAST_MS = 1400;
const FALLBACK_RETRY_RATIO = 0.4;
/**
 * Ritmo honesto de la barra por métrica: lo que suele tardar el anillo en
 * entregar (verificado en campo). La ventana del driver es el tope de
 * seguridad, no una promesa de duración: la barra corre sobre esto.
 */
const EXPECTED_MS_BY_KIND: Partial<Record<MetricKind, number>> = {
  heart_rate: 12_000,
  blood_pressure: 15_000,
  spo2: 36_000,
};

export interface MeasurePhase {
  /**
   * 0..0.99 mientras corre (se queda en 99 % si tarda más de lo esperado);
   * 1 SOLO cuando la lectura ya llegó (la UI lo fuerza con `complete`).
   */
  progress: number;
  /** `measuring` = dentro de lo esperado; `adjusting` = el sensor engancha. */
  phase: "measuring" | "adjusting";
  /** Milisegundos que quedan de la fase actual (nunca negativo). */
  remainingMs: number;
  /** Ventana total del driver (tope de seguridad). */
  windowMs: number;
  /** Denominador de la barra / "suele tardar". */
  expectedMs: number;
}

export function measurePhase(
  elapsedMs: number,
  policy?: MeasurePolicy,
  kind?: MetricKind,
): MeasurePhase {
  const windowMs = Math.max(1, policy?.windowMs ?? FALLBACK_MEASURE_WINDOW_MS);
  const expectedMs = Math.max(
    1,
    (kind !== undefined ? EXPECTED_MS_BY_KIND[kind] : undefined) ??
      policy?.retryMs ??
      windowMs * FALLBACK_RETRY_RATIO,
  );
  const elapsed = Math.max(0, elapsedMs);
  const progress = Math.min(0.99, elapsed / expectedMs);

  if (elapsed < expectedMs) {
    return {
      progress,
      phase: "measuring",
      remainingMs: expectedMs - elapsed,
      windowMs,
      expectedMs,
    };
  }
  return {
    progress,
    phase: "adjusting",
    remainingMs: 0,
    windowMs,
    expectedMs,
  };
}

/** Nombre corto por métrica para las etiquetas de progreso. */
export const MEASURE_SHORT: Partial<Record<MetricKind, string>> = {
  heart_rate: "FC",
  spo2: "SpO2",
  blood_pressure: "Presión",
};

/** Icono por métrica (se comparte entre tarjeta, foco y pasos). */
export function measureIcon(kind: MetricKind) {
  switch (kind) {
    case "heart_rate":
      return heartOutline;
    case "spo2":
      return waterOutline;
    case "blood_pressure":
      return medkitOutline;
    default:
      return pulseOutline;
  }
}

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

/**
 * Número ya formateado de una lectura para la vista de foco (valor + clave de
 * unidad para `t()`). Presión llega como par sistólica/diastólica; el resto
 * como entero redondeado. null sin muestra.
 */
export function formatMeasureReading(
  kind: MetricKind,
  sample: HealthSample | undefined,
): { value: string; unit: string } | null {
  if (!sample) return null;
  if (kind === "blood_pressure") {
    if (sample.value2 === undefined) return null;
    return {
      value: `${Math.round(sample.value)}/${Math.round(sample.value2)}`,
      unit: "mmHg",
    };
  }
  if (kind === "heart_rate") {
    return { value: String(Math.round(sample.value)), unit: "lpm" };
  }
  if (kind === "spo2") {
    return { value: String(Math.round(sample.value)), unit: "%" };
  }
  return null;
}
