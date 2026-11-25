import { addDaysToISO, toLocalISODate } from "../../../utils/dates";
import type { VitalDay, VitalMetric, Vitals, VitalValue } from "./vitals-store";

export const VITAL_WINDOWS = [7, 30, 90] as const;
export type VitalWindow = typeof VITAL_WINDOWS[number];
export type VitalTrend = "improving" | "worsening" | "steady";

export const TREND_LABELS: Record<VitalTrend, string> = {
  improving: "Mejorando",
  worsening: "Empeorando",
  steady: "Manteniéndose",
};

// Cambio mínimo en la variación diaria media, en unidades canónicas.
export const VARIATION_THRESHOLD: Record<VitalMetric, number> = {
  heartRate: 2,
  bloodPressure: 2,
  oxygen: 1,
  steps: 100,
  sleep: 0.25,
  weight: 0.25,
  temperature: 0.2,
  glucose: 3,
};

export function vitalHistory(vitals: Vitals, metric: VitalMetric, days: VitalWindow, now = new Date()): VitalDay[] {
  const today = toLocalISODate(now);
  const start = addDaysToISO(today, 1 - days);
  return Object.values(vitals[metric] ?? {})
    .filter(({ date }) => date >= start && date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function vitalSeries(value: VitalValue): number[] {
  return typeof value === "number" ? [value] : [value.systolic, value.diastolic];
}

/** Distancia entre fechas de calendario, sin horas o transiciones de horario de verano. */
export function calendarDays(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

/**
 * Compara la variación diaria del último intervalo con la media de los
 * anteriores. Menos variación = mejorando, más = empeorando. En presión se
 * promedian ambos componentes. No se interpreta el nivel ni se usan metas clínicas.
 */
export function vitalTrend(metric: VitalMetric, history: readonly VitalDay[]): VitalTrend | null {
  const ordered = [...new Map(history.map((day) => [day.date, day])).values()]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length < 3) return null;
  const variations = ordered.slice(1).map((day, index) => {
    const previous = ordered[index];
    const values = vitalSeries(day.value);
    const before = vitalSeries(previous.value);
    const total = values.reduce((sum, value, series) => sum + Math.abs(value - before[series]), 0);
    return total / values.length / calendarDays(previous.date, day.date);
  });
  const latest = variations.pop()!;
  const average = variations.reduce((sum, value) => sum + value, 0) / variations.length;
  const delta = latest - average;
  const threshold = VARIATION_THRESHOLD[metric];
  if (delta <= -threshold) return "improving";
  if (delta >= threshold) return "worsening";
  return "steady";
}
