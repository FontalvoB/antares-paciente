/**
 * Nutrition log service — connects to POST /api/v1/program/nutrition/log.
 * Source of truth: MOBILE-INTEGRATION-SPEC.md §R2 (nutrition/log row)
 * and MOBILE-INTEGRATION-TASKS.md task 2.4.
 *
 * 409 HABIT_ALREADY_LOGGED propagates as ApiError — caller decides UX.
 */

import { apiFetch } from "../../utils/apiClient";
import type { NutritionLogResultDto } from "./types";

/** Valid meal codes — exhaustive union matching the backend enum. */
export type MealCode = "des" | "alm" | "mer" | "cen" | "agua";

const VALID_MEAL_CODES: ReadonlySet<string> = new Set<MealCode>([
  "des",
  "alm",
  "mer",
  "cen",
  "agua",
]);

/**
 * Intake nutricional opcional del log (SPEC nutrition-intake-adherence):
 * espejo del `NutritionIntakePayload` del backend. Los 8 campos son
 * opcionales; el cliente NUNCA envía contexto de plan (patientId y plan-day
 * se resuelven server-side). Con `source: 'ai_photo'` + `foodAnalysisId` se
 * persiste un análisis de foto confirmado en lugar de descartarlo.
 */
export interface NutritionIntakePayload {
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  waterMl?: number | null;
  source?: "manual" | "ai_photo" | string | null;
  foodAnalysisId?: string | null;
}

/**
 * Log a single meal or hydration event for the current patient.
 *
 * WIRE SHAPE (B2, locked by contract test): el backend enlaza el intake como
 * bloque ANIDADO `intake` (`LogNutritionRequest.Intake`, `NutritionIntakePayload?`)
 * — un shape aplanado en top-level se descartaría en silencio. El cliente
 * envía SIEMPRE `{ mealCode, localDate?, intake? }`; clientes viejos sin
 * intake siguen funcionando (el campo se omite).
 *
 * @param mealCode - The meal/hydration code (des, alm, mer, cen, agua).
 * @param localDate - Optional local date (YYYY-MM-DD). Defaults to server-side today.
 * @param intake - Optional enriched intake (calories/macros/water/source/
 *   foodAnalysisId). Hydration logs pass mealCode 'agua' + waterMl.
 * @returns The server response with xpAwarded (0 if already logged via 409 handling upstream).
 * @throws ApiError with code 'HABIT_ALREADY_LOGGED' on duplicate (409).
 */
export async function logMeal(
  mealCode: MealCode,
  localDate?: string,
  intake?: NutritionIntakePayload,
): Promise<NutritionLogResultDto> {
  // Edge validation — fail fast before hitting the network
  if (!VALID_MEAL_CODES.has(mealCode)) {
    throw new Error(
      `Invalid mealCode: '${mealCode}'. Must be one of: des, alm, mer, cen, agua`,
    );
  }

  return apiFetch<NutritionLogResultDto>("/api/v1/program/nutrition/log", {
    method: "POST",
    body: {
      mealCode,
      ...(localDate !== undefined && { localDate }),
      // Intake ANIDADO (shape del backend); los campos del payload viajan
      // verbatim dentro del bloque. Sin intake → shape anterior intacto.
      ...(intake !== undefined && { intake }),
    },
  });
}

/**
 * Actualiza el intake de una comida ya registrada (mismo día, mismo
 * HabitCheck: sin duplicados, sin XP adicional). 404 si no existe log.
 */
export async function updateMeal(
  mealCode: MealCode,
  localDate?: string,
  intake?: NutritionIntakePayload,
): Promise<NutritionLogResultDto> {
  if (!VALID_MEAL_CODES.has(mealCode)) {
    throw new Error(
      `Invalid mealCode: '${mealCode}'. Must be one of: des, alm, mer, cen, agua`,
    );
  }

  return apiFetch<NutritionLogResultDto>(
    `/api/v1/program/nutrition/log/${mealCode}`,
    {
      method: "PUT",
      body: {
        ...(localDate !== undefined && { localDate }),
        ...(intake !== undefined && { intake }),
      },
    },
  );
}
