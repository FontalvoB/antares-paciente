/**
 * Cambio de objetivo desde Perfil (KAN-144).
 *
 * Regenera el plan como una NUEVA versión sin reiniciar el recorrido:
 * - conserva `startDate` (el día N continúa, no vuelve a 1),
 * - archiva la versión anterior en `wellness.plan.versions.v1`,
 * - no toca protocolo, puntos, racha, baterías ni mediciones.
 */

import { EMPTY_OBJECTIVE_DRAFT } from "../domain/draft";
import type {
  ObjectiveDraft,
  PlanPreview,
  WellnessGoal,
} from "../domain/types";
import {
  loadPlanSnapshot,
  localISODate,
  savePlanSnapshot,
  type WellnessPlanSnapshot,
} from "./wellness-home-store";

/**
 * Borrador precargado con el objetivo vigente. PAR-Q/NQS y términos quedan
 * sin responder a propósito: la situación de la persona pudo cambiar y la
 * compuerta debe volver a evaluarse con respuestas actuales.
 */
export function draftFromSnapshot(
  snapshot: WellnessPlanSnapshot | null,
  fallbackName = "",
): ObjectiveDraft {
  if (!snapshot) return { ...EMPTY_OBJECTIVE_DRAFT, name: fallbackName };
  return {
    ...EMPTY_OBJECTIVE_DRAFT,
    name: snapshot.name || fallbackName,
    goal: snapshot.goal,
    sex: snapshot.sex,
    age: snapshot.age,
    heightCm: snapshot.heightCm,
    weightKg: snapshot.weightKg,
    waistCm: snapshot.waistCm,
    targetWeightKg: snapshot.targetWeightKg,
    activity: snapshot.activity,
    // La UI v1 solo ofrece suave/moderado; `max` se reduce a moderado.
    pace: snapshot.pace === "s" ? "s" : "m",
    vegetarian: snapshot.vegetarian,
    dairyFree: snapshot.dairyFree,
  };
}

export type PlanDiffField = "goal" | "kcal" | "proteinG" | "carbsG" | "fatG";

export interface PlanDiffRow {
  field: PlanDiffField;
  before: number | WellnessGoal | null;
  after: number | WellnessGoal;
  changed: boolean;
}

const DIFF_FIELDS: readonly PlanDiffField[] = [
  "goal",
  "kcal",
  "proteinG",
  "carbsG",
  "fatG",
];

/** Qué cambió entre el plan anterior y el nuevo (objetivo y macros). */
export function diffPlans(
  previous: WellnessPlanSnapshot | null,
  next: WellnessPlanSnapshot,
): PlanDiffRow[] {
  return DIFF_FIELDS.map((field) => {
    const before = previous ? previous[field] : null;
    const after = next[field];
    return { field, before, after, changed: before !== after };
  });
}

export interface GoalChangeResult {
  previous: WellnessPlanSnapshot | null;
  next: WellnessPlanSnapshot;
  diff: PlanDiffRow[];
}

/**
 * Guarda la nueva versión del plan a partir del borrador validado y su vista
 * previa. Mantiene nombre y fecha de inicio del plan vigente.
 */
export function changePlanObjective(
  draft: ObjectiveDraft,
  preview: PlanPreview,
  now = new Date(),
): GoalChangeResult {
  const previous = loadPlanSnapshot();
  const next = savePlanSnapshot(
    {
      name: previous?.name || draft.name.trim(),
      goal: preview.goal,
      startDate: previous?.startDate ?? localISODate(now),
      kcal: preview.kcal,
      proteinG: preview.proteinG,
      carbsG: preview.carbsG,
      fatG: preview.fatG,
      waterMl: preview.waterMl,
      totalDays: preview.totalDays,
      createdAt: now.toISOString(),
      sex: draft.sex,
      age: draft.age,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      waistCm: draft.waistCm,
      targetWeightKg: draft.targetWeightKg,
      activity: draft.activity,
      pace: draft.pace,
      vegetarian: draft.vegetarian,
      dairyFree: draft.dairyFree,
    },
    now,
  );
  return { previous, next, diff: diffPlans(previous, next) };
}
