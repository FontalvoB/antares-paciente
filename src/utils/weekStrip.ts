/**
 * Franja "Esta semana" de la pestaña Racha — alineada a la semana REAL del
 * programa (backend), no a supuestos device-based.
 *
 * La ventana `snapshot.calendar` es today-6..today y NO corresponde a la
 * semana del programa; la verdad de la semana vive en el endpoint de
 * calendario (materializa CADA día con `completedTaskCodes`). Este módulo
 * indexa las celdas por el WEEKDAY ISO de cada fila (1=lunes..7=domingo) —
 * nunca por orden de llegada del arreglo.
 *
 * Semántica de racha (SPEC §17): un día "cuenta" si tiene ≥1 completación
 * (threshold template streak_min_tasks, default 1) — con el mismo criterio
 * de actividad que el mapa mensual (isPerfectDay ⇒ ≥1 completación por
 * definición; points > 0 también es actividad); `perfect` (isPerfectDay =
 * TODAS las tareas) queda disponible para estilos, el ✓ visual = cuenta.
 */

import { daysBetweenISO } from './nbWeekDays'
import type { CalendarDayDetailDto } from '../services/program/types'

export interface WeekStripCell {
  /** Cuenta para la racha: ≥1 completación, día perfecto, o points > 0. */
  done: boolean
  /** Día perfecto (todas las tareas) — disponible para estilos. */
  perfect: boolean
  /** El servidor reportó una fila para este día de la semana. */
  hasData: boolean
}

/** 7 celdas vacías (nodata): sin datos del server NUNCA verdes. */
export function emptyWeekCells(): WeekStripCell[] {
  return Array.from({ length: 7 }, () => ({ done: false, perfect: false, hasData: false }))
}

/**
 * Weekday ISO (1=lunes..7=domingo) de una fecha YYYY-MM-DD — matemática de
 * fecha pura, sin reloj ni TZ del device.
 */
export function isoWeekday(iso: string): number | null {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay()
  return day === 0 ? 7 : day
}

/**
 * Mapea las filas del calendario (ventana semanal del programa) a las 7
 * celdas de la franja, indexadas por weekday ISO. Filas fuera del rango
 * [weekStartIso..weekEndIso] se ignoran (p.ej. la ventana today-6..today del
 * snapshot); días sin fila quedan `hasData:false`.
 */
export function mapWeekCheckins(
  days: CalendarDayDetailDto[] | null | undefined,
  weekStartIso: string | null | undefined,
  weekEndIso: string | null | undefined,
): WeekStripCell[] {
  const cells = emptyWeekCells()
  if (!days) return cells

  for (const row of days) {
    // weekday llega como short ISO (1=lunes..7=domingo); Number() tolera
    // tanto el número como su representación string en el wire.
    const wd = Number(row.weekday)
    if (!Number.isInteger(wd) || wd < 1 || wd > 7) continue
    if (weekStartIso && weekEndIso && (row.localDate < weekStartIso || row.localDate > weekEndIso)) {
      continue
    }
    cells[wd - 1] = {
      // Mismo criterio de actividad que el mapa mensual: completaciones,
      // día perfecto (⇒ ≥1 completación por definición; payloads previos
      // pueden traerlo sin `completedTaskCodes`) o points > 0.
      done:
        (row.completedTaskCodes?.length ?? 0) > 0 ||
        row.isPerfectDay === true ||
        (row.points ?? 0) > 0,
      perfect: row.isPerfectDay,
      hasData: true,
    }
  }
  return cells
}

/**
 * Índice del SLOT de la grilla L..D (0=lunes..6=domingo) donde HOY debe
 * marcarse, derivado de las fechas del SERVIDOR. El marcador es el
 * `weekday ISO - 1` de hoy — NO el offset dentro de la semana del programa:
 * con una semana que arranca en miércoles, el día de inicio cae en el slot
 * 'X' (índice 2), nunca en 'L'. Guard de rango: hoy debe pertenecer a la
 * semana [weekStart..weekStart+6]; fuera → null y el llamador cae al
 * marcador device (weekdayMondayIndex) como fallback documentado.
 */
export function weekTodayIndex(
  weekStartIso: string | null | undefined,
  todayLocalDate: string | null | undefined,
): number | null {
  if (!weekStartIso || !todayLocalDate) return null
  const diff = daysBetweenISO(weekStartIso, todayLocalDate)
  if (diff === null || diff < 0 || diff > 6) return null
  const wd = isoWeekday(todayLocalDate)
  return wd === null ? null : wd - 1
}