import { apiFetch } from "../../../utils/apiClient";
import { getAccessToken } from "../../../utils/authApi";
import { sessionUserId } from "../../../utils/sessionIdentity";
import type { DailyCheckin } from "../checkin/close-day";
import { readWellnessConsent } from "../privacy/privacy-consent-store";

const PLAN = "/api/v1/people/me";

export const MOTOR_PLAN_STATE = {
  active: "Plan activo",
  paused: "Plan en pausa",
  maint: "Plan en mantenimiento",
  locked: "Plan bloqueado",
} as const;

export interface MotorDay {
  today: number;
  todayLocalDate: string;
  timeZoneId?: string;
  status: { state: "active" | "paused" | "maint" };
  logStatus: "open" | "recorded" | "missing";
  streak: number;
  exercise?: MotorExerciseSession | null;
}

type MotorText = { es: string; en: string };
interface MotorTechnique { n: string; s: string[]; b: string; m: string; e: string; h: string }

export interface MotorExerciseSession {
  type: string;
  name: MotorText;
  week: number;
  level: number;
  minutes: number;
  deload: boolean;
  phase: { name: MotorText; level: number };
  items: {
    id: string;
    minutes: number;
    lowImpact: boolean;
    description: MotorText;
    guide: { es: MotorTechnique; en: MotorTechnique };
    strength: { sets: number; reps: number; restSeconds: number; holdSeconds: number; repsInReserve: string } | null;
  }[];
  nextUnlocks: { id: string; week: number; name: MotorText }[];
}

export function motorPlanUserId() {
  return sessionUserId(getAccessToken());
}

function isMotorDay(day: MotorDay | null | undefined): day is MotorDay {
  return Boolean(day && Number.isInteger(day.today) && day.today >= 1 && day.today <= 365 &&
    /^\d{4}-\d{2}-\d{2}$/.test(day.todayLocalDate) && day.status &&
    ["active", "paused", "maint"].includes(day.status.state));
}

function cacheKey(owner: string) {
  return "wellness.motor-day.v1." + encodeURIComponent(owner);
}

export function cachedMotorDay(owner: string, now = new Date()): MotorDay | undefined {
  if (!readWellnessConsent("sensitive-data", owner)) return undefined;
  try {
    const day: MotorDay | null = JSON.parse(localStorage.getItem(cacheKey(owner)) ?? "null");
    if (!isMotorDay(day) || !day.timeZoneId) return undefined;
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: day.timeZoneId, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) => parts.find((value) => value.type === type)?.value;
    return [part("year"), part("month"), part("day")].join("-") === day.todayLocalDate ? day : undefined;
  } catch {
    return undefined;
  }
}

export function clearCachedMotorDay(owner: string) {
  try { localStorage.removeItem(cacheKey(owner)); } catch { /* almacenamiento no disponible */ }
}

export async function readMotorDay(expectedUserId: string, signal: AbortSignal) {
  const day = await apiFetch<MotorDay>(PLAN + "/plan", { expectedUserId, signal });
  if (!isMotorDay(day)) throw new Error("Invalid Motor 365 day");
  if (day.timeZoneId && readWellnessConsent("sensitive-data", expectedUserId)) {
    try {
      const { today, todayLocalDate, timeZoneId, status, logStatus, streak } = day;
      localStorage.setItem(cacheKey(expectedUserId), JSON.stringify({ today, todayLocalDate, timeZoneId, status, logStatus, streak }));
    } catch { /* el día recibido sigue disponible para esta pantalla */ }
  }
  return day;
}

export function sendMotorClosure(expectedUserId: string, day: number, input: DailyCheckin) {
  return apiFetch<void>(PLAN + "/logs/" + day, {
    expectedUserId,
    method: "PUT",
    body: {
      adh: input.adherence / 100, sleep: input.sleepHours, energy: input.energy, pain: input.pain,
      sym: input.symptoms, w: input.weightKg, waist: input.waistCm, ex: input.exercised,
    },
  });
}
