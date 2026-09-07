/**
 * Resolución de la franja semanal de Nutracéutico (NB strip).
 *
 * Fuente de verdad: `nbWeekDays` del snapshot (7 booleans, indexados por
 * `template.currentWeekStartDateLocal + i` — el inicio de semana de la
 * INSCRIPCIÓN, que solo accidentalmente cae en lunes; p.ej. enrolls manuales
 * o `BulkEnrollPatientsCommand` aceptan cualquier día de inicio). Por eso el
 * índice de HOY y las letras visibles se derivan de las fechas del SERVIDOR,
 * nunca de supuestos device-based (lunes-primero).
 *
 * Funciones puras para poder testear la derivación sin montar componentes.
 * El estado optimista local (`takenToday`) gana SOLO para la celda de hoy
 * cuando el arreglo aún dice false (la completación acaba de ocurrir y el
 * refetch no ha aterrizado).
 */

/** Días entre dos fechas YYYY-MM-DD, en UTC — matemática de fecha pura, sin reloj ni TZ del device. */
export function daysBetweenISO(a: string, b: string): number | null {
  const pa = a.split('-').map(Number)
  const pb = b.split('-').map(Number)
  if (pa.length !== 3 || pb.length !== 3 || pa.some(Number.isNaN) || pb.some(Number.isNaN)) {
    return null
  }
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2])
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2])
  return Math.round((db - da) / 86_400_000)
}

/**
 * Índice de HOY dentro de `nbWeekDays` (semana del servidor): días entre el
 * inicio de semana de la inscripción y el `todayLocalDate` del snapshot.
 * null cuando las fechas faltan/son inválidas o el índice cae fuera de 0..6
 * (hoy no pertenece a la semana del arreglo → el arreglo NO aplica y la UI
 * cae a la derivación legada).
 */
export function nbServerTodayIndex(
  weekStartDateLocal: string | null | undefined,
  todayLocalDate: string | null | undefined,
): number | null {
  if (!weekStartDateLocal || !todayLocalDate) return null
  const diff = daysBetweenISO(weekStartDateLocal, todayLocalDate)
  if (diff === null || diff < 0 || diff > 6) return null
  return diff
}

/**
 * Letra visible de la celda `dayIndex` de la semana del servidor
 * (weekStartDateLocal + dayIndex), en el locale actual ('narrow').
 * null cuando falta la fecha del servidor (API previa → la UI usa el
 * fallback device WEEK_LABELS L..D).
 */
export function nbWeekLabel(
  weekStartDateLocal: string | null | undefined,
  dayIndex: number,
  lang: 'es' | 'en',
): string | null {
  if (!weekStartDateLocal) return null
  const parts = weekStartDateLocal.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + dayIndex)
  const label = dt.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'narrow' })
  return label || null
}

/**
 * Estado "ok" de una celda de la franja. `todayIdx` debe ser el índice YA
 * resuelto: derivado del servidor (`nbServerTodayIndex`) cuando la semana del
 * servidor aplica, o el índice device (lunes-primero) en el fallback legado.
 *
 * - Arreglo del servidor presente (7 ítems): verdad del servidor para todas
 *   las celdas; la celda de hoy refleja además el estado optimista local
 *   cuando el arreglo aún dice false.
 * - Fallback (API previa sin `nbWeekDays`, arreglo corto, o índice fuera de
 *   rango → el componente pasa null): derivación local legada — hoy refleja
 *   el estado local, los días pasados se marcan ok y los futuros no.
 */
export function resolveNbDayOk(
  dayIndex: number,
  todayIdx: number,
  nbWeekDays: boolean[] | null | undefined,
  takenToday: boolean,
): boolean {
  if (nbWeekDays && nbWeekDays.length === 7) {
    if (dayIndex === todayIdx) {
      return nbWeekDays[dayIndex] === true || takenToday
    }
    return nbWeekDays[dayIndex] === true
  }
  // Fallback local legado (API sin nbWeekDays): pasado ok, futuro no, hoy = estado local.
  if (dayIndex === todayIdx) return takenToday
  return dayIndex < todayIdx
}