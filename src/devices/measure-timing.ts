/**
 * Instrumentación de tiempos de una medida puntual: START → primer dato →
 * cierre. Las notas van al Registro BLE (`ble.noteDiagnostic`) y sirven para
 * comparar nuestros tiempos contra la app oficial (banda H59 y anillo R88)
 * antes de tocar políticas o meter buffer-first.
 */
export type MeasureTimingEvent = "start" | "first" | "done";

export interface MeasureTiming {
  /** Driver que tomó la medida. */
  device: "colmi" | "ycbt";
  /** Métrica medida o, si no se conoce, el modo crudo del protocolo. */
  kind: string;
  event: MeasureTimingEvent;
  /** ms desde el inicio de la medida (no aplica a `start`). */
  elapsedMs?: number;
  /** Lecturas acumuladas al cerrar. */
  readings?: number;
  /** Cómo cerró: completada, timeout, replaced… (solo en `done`). */
  outcome?: string;
}

const EVENT_LABEL: Record<MeasureTimingEvent, string> = {
  start: "inicio",
  first: "primer dato",
  done: "cierre",
};

function seconds(ms: number | undefined): string {
  return ((ms ?? 0) / 1000).toFixed(1);
}

/** Nota legible en español, mismo tono que el resto del Registro BLE. */
export function formatMeasureTiming(timing: MeasureTiming): string {
  const head = `[${timing.device}] medida ${timing.kind}: ${
    EVENT_LABEL[timing.event]
  }`;
  if (timing.event === "start") return head;
  if (timing.event === "first")
    return `${head} en ${seconds(timing.elapsedMs)} s`;
  const outcome = timing.outcome ? ` ${timing.outcome}` : "";
  return `${head}${outcome} en ${seconds(timing.elapsedMs)} s (${
    timing.readings ?? 0
  } lectura(s))`;
}
