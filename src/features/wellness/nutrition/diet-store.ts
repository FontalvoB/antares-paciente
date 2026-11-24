import { completeProtocolStep, loadPlanSnapshot, localISODate } from "../state/wellness-home-store";
import { WATER_SERVING_ML } from "./diet-plan";
import type { DietMacros, DietPreferences, MealChoices } from "./diet-plan";
import { MEAL_IDS } from "./meal-catalog";
import type { MealId } from "./meal-catalog";

const DIET_KEY = "wellness.diet.v1";

export interface PhotoEstimate extends DietMacros {
  grams: number | null;
  fiberG: number | null;
}

export type PhotoDraft = Record<keyof PhotoEstimate, string>;

interface MealLog {
  values: DietMacros | PhotoEstimate;
}

interface DietDayLog {
  eaten: Partial<Record<MealId, MealLog>>;
  choices: MealChoices;
  waterMl: number;
  pending: Partial<Record<MealId, PhotoDraft>>;
}

interface DietHistory {
  simplified: boolean;
  days: Record<string, DietDayLog>;
}

const EMPTY_DAY: DietDayLog = { eaten: {}, choices: {}, waterMl: 0, pending: {} };

function readDiet(): DietHistory {
  try {
    const raw = localStorage.getItem(DIET_KEY);
    const stored = raw && JSON.parse(raw) as DietHistory | null;
    if (stored && stored.days) return stored;
  } catch {
    // Un historial ausente o ilegible se inicia vacío.
  }
  return { simplified: false, days: {} };
}

export function readDietPlanDetails(): DietPreferences & { weightKg?: number } {
  const plan = loadPlanSnapshot() as (DietPreferences & { weightKg?: number }) | null;
  return {
    vegetarian: plan?.vegetarian === true,
    dairyFree: plan?.dairyFree === true,
    weightKg: plan?.weightKg,
  };
}

export function readDietDay(today: Date, startDate: string) {
  const history = readDiet();
  const day = history.days[localISODate(today)] ?? EMPTY_DAY;
  const autoSimple = [1, 2].every((offset) => {
    const previous = new Date(today);
    previous.setDate(previous.getDate() - offset);
    const date = localISODate(previous);
    return date >= startDate &&
      Object.keys(history.days[date]?.eaten ?? {}).length / MEAL_IDS.length < 0.6;
  });
  return { ...day, manualSimple: history.simplified, autoSimple };
}

function updateDay(today: Date, update: (day: DietDayLog) => DietDayLog) {
  const history = readDiet();
  const date = localISODate(today);
  history.days[date] = update(history.days[date] ?? EMPTY_DAY);
  localStorage.setItem(DIET_KEY, JSON.stringify(history));
}

export function setDietSimplified(simplified: boolean) {
  localStorage.setItem(DIET_KEY, JSON.stringify({ ...readDiet(), simplified }));
}

export function saveDishChoice(today: Date, id: MealId, option: number) {
  updateDay(today, (day) => ({
    ...day, choices: { ...day.choices, [id]: option },
  }));
}

export function addWaterServing(today: Date) {
  updateDay(today, (day) => ({ ...day, waterMl: day.waterMl + WATER_SERVING_ML }));
}

export function savePhotoDraft(today: Date, id: MealId, draft?: PhotoDraft) {
  updateDay(today, (day) => ({
    ...day, pending: { ...day.pending, [id]: draft },
  }));
}

export function logDietMeal(today: Date, id: MealId, option: number, values: MealLog["values"]) {
  updateDay(today, (day) => ({
    ...day,
    eaten: { ...day.eaten, [id]: { values } },
    choices: { ...day.choices, [id]: option },
    pending: { ...day.pending, [id]: undefined },
  }));
  completeProtocolStep("diet", today);
}

