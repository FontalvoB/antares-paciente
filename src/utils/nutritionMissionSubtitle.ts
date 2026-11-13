import type { TodayTaskContentDto } from '../services/program/types'

/** Subtítulo fiel al plan del snapshot; nunca reutiliza el texto fijo de la plantilla. */
export function nutritionMissionSubtitle(content: TodayTaskContentDto | null | undefined, locale: string): string {
  if (!content || content.contentUnavailable) return ''
  const name = content.nutritionPlanName?.trim() || content.title?.trim()
  const calories = content.dailyCalorieTarget
  return [name, calories != null && Number.isFinite(calories) && calories > 0
    ? `${calories.toLocaleString(locale)} kcal` : null].filter(Boolean).join(' · ')
}
