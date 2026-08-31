/**
 * Nutrition log service — connects to POST /api/v1/program/nutrition/log.
 * Source of truth: MOBILE-INTEGRATION-SPEC.md §R2 (nutrition/log row)
 * and MOBILE-INTEGRATION-TASKS.md task 2.4.
 *
 * 409 HABIT_ALREADY_LOGGED propagates as ApiError — caller decides UX.
 */

import { apiFetch } from '../../utils/apiClient'
import type { NutritionLogResultDto } from './types'

/** Valid meal codes — exhaustive union matching the backend enum. */
export type MealCode = 'des' | 'alm' | 'mer' | 'cen' | 'agua'

const VALID_MEAL_CODES: ReadonlySet<string> = new Set<MealCode>([
  'des',
  'alm',
  'mer',
  'cen',
  'agua',
])

/**
 * Log a single meal or hydration event for the current patient.
 *
 * @param mealCode - The meal/hydration code (des, alm, mer, cen, agua).
 * @param localDate - Optional local date (YYYY-MM-DD). Defaults to server-side today.
 * @returns The server response with xpAwarded (0 if already logged via 409 handling upstream).
 * @throws ApiError with code 'HABIT_ALREADY_LOGGED' on duplicate (409).
 */
export async function logMeal(
  mealCode: MealCode,
  localDate?: string,
): Promise<NutritionLogResultDto> {
  // Edge validation — fail fast before hitting the network
  if (!VALID_MEAL_CODES.has(mealCode)) {
    throw new Error(
      `Invalid mealCode: '${mealCode}'. Must be one of: des, alm, mer, cen, agua`,
    )
  }

  return apiFetch<NutritionLogResultDto>(
    '/api/v1/program/nutrition/log',
    {
      method: 'POST',
      body: {
        mealCode,
        ...(localDate !== undefined && { localDate }),
      },
    },
  )
}
