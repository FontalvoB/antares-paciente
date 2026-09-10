import type {
  NutritionIntakeLogDto,
  ProgramSnapshotDto,
} from "../services/program/types";
import type { MealCode } from "../services/program/nutrition-service";

/**
 * Resolvers puros del intake nutricional (de-mock de NutritionPage) — misma
 * filosofía que `nutritionProgress.ts` (S4): verdad server-side desde
 * `content.nutritionIntakeLogs` del snapshot `nut` (SIEMPRE materializado,
 * `[]` sin logs — pin S1), sin datos fabricados. Sin snapshot → estado
 * vacío honesto (zeros / null), nunca un número inventado.
 *
 * Regla de determinismo: mismo input → mismo output. Sin side-effects.
 */

export interface IntakeTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface PlanTargets {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

export type MealLogSource = "manual" | "ai_photo";

export type TrendDirection = "up" | "down" | "flat" | null;

/** Contenido `nut` del snapshot (undefined sin snapshot o sin tarea nut). */
function nutContent(snapshot: ProgramSnapshotDto | null | undefined) {
  return snapshot?.todayTasks?.find((task) => task.taskCode === "nut")?.content;
}

/**
 * Log de una comida del snapshot (para detalle/edición). Incluye el
 * marcador optimista de `todayNutritionLogged`? NO: el detalle necesita la
 * verdad con valores (intake + foodAnalysisId), que solo existe server-side.
 * Sin log → null (pendiente).
 */
export function findMealLog(
  snapshot: ProgramSnapshotDto | null | undefined,
  mealCode: MealCode,
): NutritionIntakeLogDto | null {
  if (mealCode === "agua") return null;
  const log = (nutContent(snapshot)?.nutritionIntakeLogs ?? []).find(
    (l) => l.mealCode === mealCode,
  );
  return log ?? null;
}

/** Suma defensiva de un campo numérico nullable de los logs. */
function sumOf<
  K extends "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "waterMl",
>(logs: NutritionIntakeLogDto[], field: K): number {
  let total = 0;
  for (const log of logs) {
    const value = log[field];
    if (typeof value === "number" && Number.isFinite(value)) total += value;
  }
  return total;
}

/**
 * Totales de macros del día desde los logs reales del servidor, EXCLUYENDO
 * `agua` (la hidratación nunca cuenta como comida — mismo criterio que
 * `deriveLoggedMeals` y el gate backend). Sin snapshot / sin logs → zeros.
 */
export function deriveIntakeTotals(
  snapshot: ProgramSnapshotDto | null | undefined,
): IntakeTotals {
  const logs = (nutContent(snapshot)?.nutritionIntakeLogs ?? []).filter(
    (log) => log.mealCode !== "agua",
  );
  return {
    calories: sumOf(logs, "calories"),
    proteinG: sumOf(logs, "proteinG"),
    carbsG: sumOf(logs, "carbsG"),
    fatG: sumOf(logs, "fatG"),
    fiberG: sumOf(logs, "fiberG"),
  };
}

/**
 * Vasos de agua del día: suma `waterMl` de los logs `agua` / 250 (ml por
 * vaso), redondeado hacia abajo (floor). Sin logs → 0. Nunca inventa
 * progreso: la meta de 8 vasos es una guía de la UI, no un target del wire.
 */
export function deriveWaterGlasses(
  snapshot: ProgramSnapshotDto | null | undefined,
): number {
  const logs = (nutContent(snapshot)?.nutritionIntakeLogs ?? []).filter(
    (log) => log.mealCode === "agua",
  );
  return Math.floor(sumOf(logs, "waterMl") / 250);
}

/**
 * Source del primer log del día con ese mealCode (nunca `agua`):
 * `'manual'` | `'ai_photo'`; null si no hay log. Sin snapshot → null.
 * El backend materializa `source` como string ('manual'|'ai_photo') — se
 * normaliza defensivamente: cualquier valor distinto de 'ai_photo' cuenta
 * como 'manual' (contrato wire de NutritionIntakeLogDto).
 */
export function deriveMealSource(
  snapshot: ProgramSnapshotDto | null | undefined,
  mealCode: MealCode,
): MealLogSource | null {
  const log = (nutContent(snapshot)?.nutritionIntakeLogs ?? []).find(
    (l) => l.mealCode === mealCode && l.mealCode !== "agua",
  );
  if (!log) return null;
  return log.source === "ai_photo" ? "ai_photo" : "manual";
}

/**
 * Targets diarios del plan desde `content.daily*Target` (wire
 * TodayTaskContentDto). Campos ausentes → null (la UI oculta la fila/barra —
 * honesto, sin fallbacks fabricados).
 */
export function derivePlanTargets(
  snapshot: ProgramSnapshotDto | null | undefined,
): PlanTargets {
  const content = nutContent(snapshot);
  return {
    calories: content?.dailyCalorieTarget ?? null,
    proteinG: content?.dailyProteinTarget ?? null,
    carbsG: content?.dailyCarbsTarget ?? null,
    fatG: content?.dailyFatTarget ?? null,
    fiberG: content?.dailyFiberTarget ?? null,
  };
}

/**
 * Dirección de tendencia entre dos valores (p.ej. adherencia de esta semana
 * vs la anterior): 'up' | 'down' | 'flat'; null cuando falta cualquiera de
 * los dos (no hay tendencia computable — la UI no dibuja flecha).
 */
export function deriveTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
): TrendDirection {
  if (current == null || previous == null) return null;
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}
