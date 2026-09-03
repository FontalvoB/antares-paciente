import type { MealCode } from '../services/program/nutrition-service'

/**
 * Mapa canónico mealType ↔ mealCode (D4, SPEC nutrition-intake-adherence):
 * Desayuno→des, Almuerzo→alm, Snack(Merienda)→mer, Cena→cen. `agua` es
 * hidratación y nunca entra en este mapa (no es un tipo de comida del plan).
 *
 * Corrige dos bugs vivos: el fallthrough por prefijo de NutritionPage (que
 * mapeaba Snack → cen) y el id crudo de Lessons (mealTypeLower 'desayuno'
 * nunca matcheaba los códigos 'des').
 */
const MEAL_TYPE_TO_CODE: Readonly<Record<string, MealCode>> = {
  desayuno: 'des',
  almuerzo: 'alm',
  merienda: 'mer',
  snack: 'mer',
  cena: 'cen',
}

/**
 * Convierte un MealType del plan (ej. "Desayuno", "Snack") al MealCode del
 * log (des/alm/mer/cen). Normaliza mayúsculas/espacios; devuelve null para
 * tipos desconocidos — nunca un fallthrough silencioso.
 */
export function mealTypeToCode(mealType: string): MealCode | null {
  const key = mealType.trim().toLowerCase()
  return MEAL_TYPE_TO_CODE[key] ?? null
}