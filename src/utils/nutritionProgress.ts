import type { ProgramSnapshotDto } from '../services/program/types'

/**
 * deriveLoggedMeals — verdad server-side de las comidas registradas hoy
 * (SPEC nutrition-intake-adherence, S4). Lee `content.nutritionIntakeLogs`
 * del snapshot `nut` (el backend SIEMPRE lo materializa: `[]` sin logs — pin
 * S1), devolviendo los mealCodes en orden del servidor y EXCLUYENDO `agua`
 * (la hidratación nunca cuenta como comida del plan — mismo criterio que el
 * gate backend).
 *
 * Capa optimista: el marcador client-only `todayNutritionLogged` (escrito por
 * `useNutritionLog` en el cache de TanStack) se respeta si existe y no está
 * vacío — es el estado optimista POR ENCIMA de la verdad server-side, y se
 * cae solo en refetch. Sin snapshot → `[]` (nunca null).
 */
export function deriveLoggedMeals(snapshot: ProgramSnapshotDto | null | undefined): string[] {
  if (!snapshot) return []

  const optimistic = (
    snapshot as ProgramSnapshotDto & { todayNutritionLogged?: string[] }
  ).todayNutritionLogged
  if (optimistic && optimistic.length > 0) {
    // Mismo invariante que la rama server-truth: agua (hidratación) nunca
    // cuenta como comida del plan — el marcador optimista también la excluye.
    return optimistic.filter((m) => m !== 'agua')
  }

  const nutContent = snapshot.todayTasks?.find((task) => task.taskCode === 'nut')?.content
  return (nutContent?.nutritionIntakeLogs ?? [])
    .filter((log) => log.mealCode !== 'agua')
    .map((log) => log.mealCode)
}