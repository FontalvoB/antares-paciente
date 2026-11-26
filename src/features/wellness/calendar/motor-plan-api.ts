import { apiFetch } from "../../../utils/apiClient";
import { getAccessToken } from "../../../utils/authApi";
import { sessionUserId } from "../../../utils/sessionIdentity";
import type { DailyCheckin } from "../checkin/close-day";
import type { MealId } from "../nutrition/meal-catalog";
import { readWellnessConsent } from "../privacy/privacy-consent-store";

const PLAN = "/api/v1/people/me";
export const MOTOR_CLOSURE_CONFIRMED = "wellness-motor-closure-confirmed";

export const MOTOR_PLAN_STATE = {
  active: "Plan activo",
  paused: "Plan en pausa",
  maint: "Plan en mantenimiento",
  locked: "Plan bloqueado",
} as const;

export interface MotorNutritionTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
}

export interface MotorMealPlan {
  vegetarian: boolean;
  dairyFree: boolean;
  simplified: boolean;
  totals: MotorMealTotals;
  meals: {
    id: MealId;
    name: MotorText;
    targetKcal: number;
    options: {
      id: number;
      items: { food: string; name: MotorText; grams: number }[];
      totals: MotorMealTotals;
    }[];
  }[];
}

interface MotorMealTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MotorDay {
  mealPlan?: MotorMealPlan;
  why?: MotorText[];
  lighterDinner?: boolean;
  nutrition?: MotorNutritionTargets;
  today: number;
  todayLocalDate: string;
  startDate?: string;
  timeZoneId?: string;
  status: { state: "active" | "paused" | "maint" };
  logStatus: "open" | "recorded" | "missing";
  streak: number;
  exercise?: MotorExerciseSession | null;
  real?: boolean;
  engine_ver?: string;
  params_version?: number;
  syncedAt?: string;
  personId?: string;
  sync?: {
    personId: string;
    logs: { day: number; date: string; adherence: number; weightKg: number | null; waistCm: number | null; completedExercise: boolean }[];
    events: { d: number; k: string; es: string; en: string }[];
  };
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
    ["active", "paused", "maint"].includes(day.status.state) &&
    (!day.sync || (typeof day.sync.personId === "string" && Array.isArray(day.sync.logs) && Array.isArray(day.sync.events))));
}

function cacheKey(owner: string) {
  return "wellness.motor-day.v1." + encodeURIComponent(owner);
}

function readMotorCache(owner: string): MotorDay | undefined {
  if (!readWellnessConsent("sensitive-data", owner)) return undefined;
  try {
    const day: MotorDay | null = JSON.parse(localStorage.getItem(cacheKey(owner)) ?? "null");
    return isMotorDay(day) && day.real === true ? day : undefined;
  } catch {
    return undefined;
  }
}

export function cachedMotorPerson(owner: string) {
  return readMotorCache(owner)?.personId;
}

export function isCurrentMotorDay(day: MotorDay, now = new Date()): boolean {
  if (!day.timeZoneId) return false;
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: day.timeZoneId, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) => parts.find((value) => value.type === type)?.value;
    return [part("year"), part("month"), part("day")].join("-") === day.todayLocalDate;
  } catch {
    return false;
  }
}

export function cachedMotorDay(owner: string): MotorDay | undefined {
  const day = readMotorCache(owner);
  return day && isCurrentMotorDay(day) ? day : undefined;
}

export function clearCachedMotorDay(owner: string) {
  try { localStorage.removeItem(cacheKey(owner)); } catch { /* almacenamiento no disponible */ }
}

export async function readMotorDay(expectedUserId: string, signal: AbortSignal, historyDays: number, includeMenu = false) {
  const params = new URLSearchParams();
  if (readWellnessConsent("sensitive-data", expectedUserId)) {
    params.set("includeSync", "true");
    params.set("historyDays", String(historyDays));
  }
  if (includeMenu) params.set("includeMenu", "true");
  const query = params.toString();
  const day = await apiFetch<MotorDay>(PLAN + "/plan" + (query ? `?${query}` : ""), { expectedUserId, signal, cache: "no-store" });
  if (!isMotorDay(day) || day.real !== true) throw new Error("Invalid Motor 365 day");
  if (signal.aborted || motorPlanUserId() !== expectedUserId) throw new DOMException("Session changed", "AbortError");
  const personId = day.sync?.personId;
  const syncedAt = new Date().toISOString();
  if (day.timeZoneId && readWellnessConsent("sensitive-data", expectedUserId)) {
    try {
      const { today, todayLocalDate, timeZoneId, status, logStatus, streak, engine_ver, params_version } = day;
      localStorage.setItem(cacheKey(expectedUserId), JSON.stringify({
        today, todayLocalDate, timeZoneId, status, logStatus, streak, engine_ver, params_version, syncedAt, personId, real: true,
      }));
    } catch { /* el día recibido sigue disponible para esta pantalla */ }
  }
  return { ...day, personId, syncedAt };
}

export function sendMotorClosure(expectedUserId: string, personId: string, day: number, input: DailyCheckin) {
  return apiFetch<void>(`/api/v1/people/${encodeURIComponent(personId)}/logs/${day}?createIfAbsent=true`, {
    expectedUserId,
    method: "PUT",
    body: {
      adh: input.adherence / 100, sleep: input.sleepHours, energy: input.energy, pain: input.pain,
      sym: input.symptoms, w: input.weightKg, waist: input.waistCm, ex: input.exercised,
    },
  });
}

export async function confirmStoredMotorClosure(expectedUserId: string, personId: string, day: number) {
  const result = await apiFetch<MotorDay>(
    `/api/v1/people/${encodeURIComponent(personId)}/plan/${day}?includeSync=true&historyDays=1`,
    { expectedUserId, cache: "no-store" },
  );
  return isMotorDay(result) && result.real === true && result.sync?.personId === personId &&
    result.sync.logs.some(log => log.day === day);
}
