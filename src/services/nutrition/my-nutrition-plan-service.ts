/**
 * Plan alimentario self-service — `GET /api/v1/me/nutrition-plan` (Fase 8, móvil).
 *
 * El paciente se resuelve en el backend desde el JWT (anti-IDOR): el cliente
 * nunca envía ids. Sin plan asignado el backend responde 404 y el servicio
 * devuelve `null` (estado vacío honesto); cualquier otro error viaja como
 * ApiError — el consumidor degrada a error + reintento, nunca a mocks (R5.2).
 *
 * Wire camelCase del backend (ASP.NET default). Todos los campos son
 * opcionales: el endpoint aún no está desplegado en todos los entornos y el
 * contrato puede crecer sin romper al cliente.
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { apiFetch, ApiError } from "../../utils/apiClient";

const MY_NUTRITION_PLAN_PATH = "/api/v1/me/nutrition-plan";

/** Comida configurada del plan (wire de `NutritionPlanDay`). */
export interface MyNutritionPlanMealDto {
  /** Tipo de comida del ERP (Desayuno, Almuerzo, Cena, Snack/Merienda). */
  mealType?: string | null;
  /** Descripción de la comida (ej. "Ensalada de pollo con aguacate"). */
  description?: string | null;
  /** Alimentos/ingredientes recomendados. */
  foods?: string | null;
  /** Calorías estimadas de la comida. */
  calories?: number | null;
  /** Gramos de proteína / carbohidratos / grasa / fibra. */
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  /** Agua sugerida con la comida, en ml. */
  waterMl?: number | null;
  /** Notas del nutricionista (porciones, preparación). */
  notes?: string | null;
  /** Horario sugerido de la comida (ej. "7:00"). */
  suggestedTime?: string | null;
  /** Orden de la comida dentro del día. */
  sortOrder?: number | null;
}

/** Día del plan con sus comidas (wire de `NutritionPlanDay` agrupado). */
export interface MyNutritionPlanDayDto {
  /** Número del día dentro del plan (1, 2, 3...). */
  dayNumber?: number | null;
  /** Meta de agua del día en ml. */
  dailyWaterMl?: number | null;
  meals?: MyNutritionPlanMealDto[] | null;
}

/** Plan de alimentación activo del paciente (wire de `NutritionPlan`). */
export interface MyNutritionPlanDto {
  name?: string | null;
  description?: string | null;
  /** Condición objetivo (Obesidad, Diabetes, Mantenimiento...). */
  targetCondition?: string | null;
  /** Metas diarias: calorías (kcal), macros (g) y agua (ml). */
  dailyCalorieTarget?: number | null;
  dailyProteinTarget?: number | null;
  dailyCarbsTarget?: number | null;
  dailyFatTarget?: number | null;
  dailyFiberTarget?: number | null;
  dailyWaterMl?: number | null;
  /** Restricciones/alergias (gluten, lactosa...). */
  allergens?: string | null;
  /** Horarios preferidos de comida del plan. */
  mealTiming?: string | null;
  /** Comidas del día (forma plana) o por días del ciclo. */
  meals?: MyNutritionPlanMealDto[] | null;
  days?: MyNutritionPlanDayDto[] | null;
}

/**
 * Lee el plan de alimentación activo del paciente autenticado.
 *
 * @returns El plan asignado, o `null` con 404 (sin plan asignado o sin
 *   perfil de paciente vinculado).
 * @throws ApiError — propagado, nunca tragado (401 sesión inválida, 5xx,
 *   red). 404 se absorbe como `null` por contrato de la tarea 2.1.
 */
export async function getMyNutritionPlan(): Promise<MyNutritionPlanDto | null> {
  try {
    return await apiFetch<MyNutritionPlanDto>(MY_NUTRITION_PLAN_PATH, {
      method: "GET",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
