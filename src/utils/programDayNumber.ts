/** Día lógico del programa, a partir de la semana y fecha local del servidor. */
export function programDayNumber(week: number | undefined, weekStart: string | null | undefined, today: string | null | undefined): number | null {
  if (!Number.isInteger(week) || week! < 1 || !weekStart || !today || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null
  const difference = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000
  return Number.isInteger(difference) && difference >= 0 && difference < 7 ? (week! - 1) * 7 + difference + 1 : null
}
