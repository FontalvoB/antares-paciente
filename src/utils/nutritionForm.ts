import type { MealCode, NutritionIntakePayload } from '../services/program/nutrition-service'
import type { NutritionMealDto } from '../services/program/types'
import { mealTypeToCode } from './mealTypeToCode'

/**
 * Helpers puros de formulario nutricional (SPEC nutrition-intake-adherence /
 * nutrition-page-integration): extraídos de NutritionPage para poder testear
 * el prefill del plan y el shape de hidratación sin renderizar la página
 * completa (B6). Regla de determinismo: mismo input → mismo output.
 */

export interface IntakeFormState {
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  fiberG: string
}

export interface MealTarget {
  calories?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  fiberG?: number
}

export const EMPTY_INTAKE_FORM: IntakeFormState = {
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
}

/**
 * Mapa plan-day → metas por MealCode vía `mealTypeToCode` (D4): alimenta el
 * prefill del modal de registro. Tipos desconocidos se omiten (nunca un
 * fallthrough silencioso); sin plan → mapa vacío → formulario en blanco.
 */
export function buildPlanTargets(
  meals: NutritionMealDto[] | null | undefined,
): Map<MealCode, MealTarget> {
  const map = new Map<MealCode, MealTarget>()
  for (const meal of meals ?? []) {
    const code = mealTypeToCode(meal.mealType)
    if (code) {
      map.set(code, {
        calories: meal.calories ?? undefined,
        proteinG: meal.proteinG ?? undefined,
        carbsG: meal.carbsG ?? undefined,
        fatG: meal.fatG ?? undefined,
        fiberG: meal.fiberG ?? undefined,
      })
    }
  }
  return map
}

/**
 * Prefill del formulario desde la meta del plan (editable: el modal sigue
 * siendo un formulario controlado). Sin meta → valores vacíos.
 */
export function prefillIntakeForm(target: MealTarget | undefined): IntakeFormState {
  if (!target) return { ...EMPTY_INTAKE_FORM }
  return {
    calories: target.calories != null ? String(target.calories) : '',
    proteinG: target.proteinG != null ? String(target.proteinG) : '',
    carbsG: target.carbsG != null ? String(target.carbsG) : '',
    fatG: target.fatG != null ? String(target.fatG) : '',
    fiberG: target.fiberG != null ? String(target.fiberG) : '',
  }
}

/**
 * Intake de hidratación para el log: mealCode 'agua' + `waterMl` = vasos × 250
 * (SPEC nutrition-page-integration "Hydration log execution"). El caller fija
 * el mealCode 'agua' — aquí solo el payload del intake (mismo shape anidado
 * que logMeal, B2).
 */
export function buildHydrationIntake(glasses: number): NutritionIntakePayload {
  return { waterMl: glasses * 250, source: 'manual' }
}