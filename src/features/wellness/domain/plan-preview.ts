/**
 * Vista previa del plan para la pantalla final de KAN-136.
 *
 * Replica SOLO las fórmulas que la persona ve en el resumen (kcal, macros,
 * agua, IMC y semanas estimadas) usando los mismos parámetros del motor v5.2.
 * El plan real de 365 días lo calcula el backend (KAN-130); este cálculo es
 * una vista previa y no se persiste como verdad.
 */

import { bmiOf } from "./gate";
import type {
  ObjectiveDraft,
  PlanPreview,
  WellnessActivity,
  WellnessGoal,
} from "./types";

const ACTIVITY_FACTOR: Record<WellnessActivity, number> = {
  1: 1.2,
  2: 1.375,
  3: 1.55,
  4: 1.725,
};

const PACE_PCT: Record<WellnessGoal, Record<"s" | "m" | "max", number>> = {
  bajar: { s: 0.1, m: 0.15, max: 0.2 },
  masa: { s: 0.05, m: 0.1, max: 0.15 },
  def: { s: 0.05, m: 0.1, max: 0.12 },
};

const PROTEIN_PER_KG: Record<WellnessGoal, number> = {
  bajar: 1.6,
  masa: 1.8,
  def: 2.0,
};

const PROTEIN_CAP = 2.2;
const CARB_MIN_G = 80;
const FLOOR_FEMALE = 1200;
const FLOOR_MALE = 1500;
/** Día 1 del plan siempre es día de entrenamiento en los tres patrones. */
const FAT_TRAIN = 0.24;

/** BMR Mifflin-St Jeor. */
export function basalMetabolicRate(draft: ObjectiveDraft): number {
  const weight = draft.weightKg ?? 0;
  const height = draft.heightCm ?? 0;
  const age = draft.age ?? 0;
  return 10 * weight + 6.25 * height - 5 * age + (draft.sex === "M" ? 5 : -161);
}

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

/** Reparto de macros del motor v5.2 (proteína g/kg, grasa 24 %, carbohidrato resto). */
export function macrosFor(kcal: number, weightKg: number, goal: WellnessGoal) {
  const proteinG = Math.round(
    Math.min(PROTEIN_CAP, PROTEIN_PER_KG[goal]) * weightKg,
  );
  let fatG = Math.round((kcal * FAT_TRAIN) / 9);
  let carbsG = Math.round((kcal - 4 * proteinG - 9 * fatG) / 4);
  if (carbsG < CARB_MIN_G) {
    carbsG = CARB_MIN_G;
    fatG = Math.round((kcal - 4 * proteinG - 4 * carbsG) / 9);
  }
  return { proteinG, carbsG, fatG };
}

/**
 * Construye la vista previa. Devuelve `null` si faltan los datos mínimos; la
 * compuerta ya impide llegar aquí sin ellos.
 */
export function buildPlanPreview(draft: ObjectiveDraft): PlanPreview | null {
  const { goal, weightKg, heightCm, age, activity, targetWeightKg } = draft;
  if (
    !goal ||
    !weightKg ||
    !heightCm ||
    age === null ||
    !activity ||
    !targetWeightKg
  ) {
    return null;
  }

  const bmr = basalMetabolicRate(draft);
  const tdee = bmr * ACTIVITY_FACTOR[activity];
  const pct = PACE_PCT[goal][draft.pace] ?? PACE_PCT[goal].m;
  const rawKcal = goal === "masa" ? tdee * (1 + pct) : tdee * (1 - pct);
  const floor = draft.sex === "M" ? FLOOR_MALE : FLOOR_FEMALE;
  const kcal = roundTo(Math.max(floor, rawKcal), 10);
  const { proteinG, carbsG, fatG } = macrosFor(kcal, weightKg, goal);
  const bmi = bmiOf(draft) ?? 0;
  const kcalPerDay = tdee * pct;
  const energyPerKg = goal === "masa" ? 6500 : 7700;
  const kgPerWeek = (kcalPerDay * 7) / energyPerKg;
  const estimatedWeeks = Math.round(
    Math.abs(targetWeightKg - weightKg) / Math.max(kgPerWeek, 0.05),
  );

  return {
    day: 1,
    totalDays: 365,
    goal,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: Math.max(25, Math.round((14 * kcal) / 1000)),
    waterMl: Math.round((35 * weightKg) / 250) * 250,
    bmi: Math.round(bmi * 10) / 10,
    estimatedWeeks,
  };
}
