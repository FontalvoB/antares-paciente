import type { CheckinHistory, DailyCheckin } from "../checkin/close-day";
import {
  localISODate,
  parseLocalDate,
  TOTAL_PLAN_DAYS,
} from "../state/wellness-home-store";
import type { WellnessPlanVersion } from "../state/wellness-home-store";

export type DayStatus = "complete" | "partial" | "missing" | "future";

export interface PlanDay {
  date: string;
  number: number;
  status: DayStatus;
  checkin?: DailyCheckin;
}

export interface PlanMonth {
  id: string;
  days: PlanDay[];
}

export type Period = "7" | "30" | "90" | "month";
export type Measurement = "weightKg" | "waistCm";

export function buildCalendar(start: string, today: string, history: CheckinHistory): PlanMonth[] {
  const date = parseLocalDate(start);
  if (!date) return [];
  const months: PlanMonth[] = [];
  for (let number = 1; number <= TOTAL_PLAN_DAYS; number += 1) {
    const iso = localISODate(date);
    const id = iso.slice(0, 7);
    let month = months.at(-1);
    if (month?.id !== id) {
      month = { id, days: [] };
      months.push(month);
    }
    const checkin = iso <= today ? history[iso] : undefined;
    const status = iso > today ? "future" : !checkin ? "missing" :
      checkin.adherence === 100 ? "complete" : "partial";
    month.days.push({ date: iso, number, status, checkin });
    date.setDate(date.getDate() + 1);
  }
  return months;
}

export function readings(days: readonly PlanDay[], metric: Measurement) {
  return days.flatMap(({ date, number, checkin }) => {
    const value = checkin?.[metric];
    return typeof value === "number" && Number.isFinite(value) ? [{ date, number, value }] : [];
  });
}

function variation(days: readonly PlanDay[], metric: Measurement): number | null {
  const points = readings(days, metric);
  return points.length >= 2 ? points[points.length - 1].value - points[0].value : null;
}

export function summarizeMonth(days: readonly PlanDay[]) {
  let total = 0;
  let count = 0;
  let streak = 0;
  let longestStreak = 0;
  for (const { checkin } of days) {
    const adherence = checkin?.adherence;
    if (typeof adherence === "number" && Number.isFinite(adherence)) {
      total += adherence;
      count += 1;
    }
    // El cierre diario también usa 60 % para la racha de adherencia.
    streak = typeof adherence === "number" && Number.isFinite(adherence) && adherence >= 60 ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }
  return {
    count,
    adherence: count ? total / count : null,
    weight: variation(days, "weightKg"),
    waist: variation(days, "waistCm"),
    longestStreak,
  };
}

export function selectRange(days: readonly PlanDay[], period: Period, month: string, today: string) {
  if (period === "month") return days.filter(({ date }) => date.startsWith(month));
  if (!days.length) return [];
  // Un plan terminado conserva la ventana de su último día.
  const lastDay = days[days.length - 1].date;
  const to = today < lastDay ? today : lastDay;
  const start = parseLocalDate(to);
  if (!start) return [];
  start.setDate(start.getDate() - Number(period) + 1);
  const from = localISODate(start);
  return days.filter(({ date }) => date >= from && date <= to);
}

export function planMilestones(versions: readonly WellnessPlanVersion[], start: string, today: string) {
  return versions.flatMap(({ changedAt, snapshot }) => {
    if (snapshot.startDate !== start || !changedAt) return [];
    const changed = new Date(changedAt);
    if (!Number.isFinite(changed.getTime())) return [];
    const date = localISODate(changed);
    return date <= today ? [{ date, time: changedAt }] : [];
  });
}

