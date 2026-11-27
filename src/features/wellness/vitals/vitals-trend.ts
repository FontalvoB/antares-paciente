import { addDaysToISO, toLocalISODate } from "../../../utils/dates";
import type { VitalDay, VitalMetric, Vitals, VitalValue } from "./vitals-store";

export const VITAL_WINDOWS = [7, 30, 90] as const;
export type VitalWindow = typeof VITAL_WINDOWS[number];

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
