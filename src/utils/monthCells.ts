/**
 * Mapa mensual de consistencia (pestaña Racha) — celdas derivadas SOLO de la
 * verdad del servidor (endpoint de calendario, materializa cada día). Nunca
 * inventa días 'ok': sin fila del servidor, un día pasado es 'nodata' (gris)
 * o 'missed' (fallido con fila y cero actividad).
 *
 * Kinds: 'empty' (relleno de grilla) · 'future' · 'ok' (día perfecto) ·
 * 'partial' (≥1 completación o puntos sin perfección) · 'missed' (pasado con
 * fila y cero actividad) · 'nodata' (pasado SIN fila del servidor) ·
 * 'today' (marcador, se combina con el kind base vía sufijo " today").
 */

import type { CalendarDayDetailDto } from '../services/program/types'

export type MonthCellKind =
  | 'empty'
  | 'future'
  | 'ok'
  | 'partial'
  | 'missed'
  | 'nodata'
  | 'today'

export interface MonthCell {
  d: number | null
  kind: string
}

export interface MonthCellsOptions {
  /** Año/mes a renderizar (device local). */
  year: number
  /** Mes 0-based (0 = enero). */
  month: number
  /** Filas del servidor para la ventana consultada. */
  days?: CalendarDayDetailDto[] | null
  /** "Hoy" del servidor (snapshot.todayLocalDate) — marcador cuando disponible. */
  serverTodayIso?: string | null
}

/**
 * Una fila es dato REAL del servidor si su weekday es un short ISO válido
 * (1=lunes..7=domingo). El mock de R5.2 (fallback sin cache) emite nombres
 * ('Sun','Mon'…) y NO debe contar como dato: con cero filas reales el mes se
 * pinta 'nodata' — nunca verde.
 */
function isServerRow(row: CalendarDayDetailDto): boolean {
  const wd = Number(row.weekday)
  return Number.isInteger(wd) && wd >= 1 && wd <= 7
}

export function buildMonthCells({
  year,
  month,
  days,
  serverTodayIso,
}: MonthCellsOptions): MonthCell[] {
  const pad = new Date(year, month, 1).getDay()
  const last = new Date(year, month + 1, 0).getDate()

  // Marcador de hoy: fecha del SERVIDOR cuando aplica al mes renderizado;
  // fallback al reloj del device.
  let today = new Date().getDate()
  if (serverTodayIso) {
    const [sy, sm, sd] = serverTodayIso.split('-').map(Number)
    if (sy === year && sm === month + 1 && Number.isInteger(sd)) {
      today = sd
    }
  }

  const dayMap = new Map<number, CalendarDayDetailDto>()
  // Guard de rango espejo de weekStrip: solo filas del mes renderizado.
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  if (days) {
    for (const row of days) {
      if (!isServerRow(row)) continue
      if (!row.localDate.startsWith(monthPrefix)) continue
      const parts = row.localDate.split('-')
      if (parts.length === 3) {
        const dayNum = parseInt(parts[2], 10)
        dayMap.set(dayNum, row)
      }
    }
  }

  const cells: MonthCell[] = []
  for (let i = 0; i < pad; i++) cells.push({ d: null, kind: 'empty' })

  for (let d = 1; d <= last; d++) {
    const calDay = dayMap.get(d)
    let kind: MonthCellKind = 'future'

    if (calDay) {
      if (calDay.isPerfectDay) {
        kind = 'ok'
      } else if ((calDay.completedTaskCodes?.length ?? 0) > 0 || (calDay.points ?? 0) > 0) {
        kind = 'partial'
      } else if (d < today) {
        // Pasado con fila y cero actividad → día perdido (equivalente a
        // status Missed del snapshot).
        kind = 'missed'
      }
    } else if (d < today) {
      // Pasado SIN fila del servidor: sin dato — NUNCA 'ok' (ni el residuo
      // demo que pintaba días verdes inventados).
      kind = 'nodata'
    } else if (d === today) {
      kind = 'today'
    }

    // Marcador de hoy combinado con el kind base (ok/partial/missed today).
    if (d === today && !kind.includes('today')) kind = `${kind} today` as MonthCellKind

    cells.push({ d, kind })
  }
  return cells
}