import { describe, expect, it } from 'vitest'
import { isoWeekday, mapWeekCheckins, weekTodayIndex } from '../weekStrip'
import type { CalendarDayDetailDto } from '../../services/program/types'

function day(
  localDate: string,
  weekday: string | number,
  overrides: Partial<CalendarDayDetailDto> = {},
): CalendarDayDetailDto {
  return {
    localDate,
    // El wire del backend emite short ISO numérico; el tipo frontend lo
    // declara string (drift pre-existente) — el helper Number() tolera ambos.
    weekday: weekday as string,
    weekNumber: 12,
    isPerfectDay: false,
    points: 0,
    bonusAwarded: 0,
    completedTaskCodes: [],
    ...overrides,
  }
}

describe('mapWeekCheckins — franja alineada al weekday ISO de la semana del programa', () => {
  // Semana NO-lunes: miércoles 2026-09-02 → martes 2026-09-08.
  const weekStart = '2026-09-02'
  const weekEnd = '2026-09-08'

  it('indexa por weekday ISO (1=lunes..7=domingo), NO por orden de llegada', () => {
    const days = [
      day('2026-09-04', 5, { completedTaskCodes: ['podcast'] }), // viernes — llega primero
      day('2026-09-02', 3, { completedTaskCodes: ['vitals'] }), // miércoles
      day('2026-09-03', 4, { isPerfectDay: true, completedTaskCodes: ['nut'] }), // jueves perfecto
    ]
    const cells = mapWeekCheckins(days, weekStart, weekEnd)
    expect(cells.map((c) => c.done)).toEqual([false, false, true, true, true, false, false])
    expect(cells[3].perfect).toBe(true)
    expect(cells[2].perfect).toBe(false)
    expect(cells[2].hasData).toBe(true)
    // Días sin fila → hasData:false (neutral), nunca done.
    expect(cells[0]).toEqual({ done: false, perfect: false, hasData: false })
    expect(cells[1]).toEqual({ done: false, perfect: false, hasData: false })
    expect(cells[6]).toEqual({ done: false, perfect: false, hasData: false })
  })

  it('un día "cuenta" para la racha con ≥1 completación; cero completaciones → no', () => {
    const cells = mapWeekCheckins(
      [
        day('2026-09-02', 3, { completedTaskCodes: ['vitals', 'nut'], points: 230 }),
        day('2026-09-04', 5), // viernes sin completaciones ni puntos
      ],
      weekStart,
      weekEnd,
    )
    expect(cells[2].done).toBe(true)
    expect(cells[4].done).toBe(false)
    expect(cells[4].hasData).toBe(true)
  })

  it('criterio de actividad alineado al mapa mensual: perfecto sin codes o points>0 también cuentan', () => {
    const cells = mapWeekCheckins(
      [
        // Payload previo: isPerfectDay sin completedTaskCodes (perfect ⇒ ≥1
        // completación por definición) — el mes lo pinta verde, la franja también.
        day('2026-09-02', 3, { isPerfectDay: true }),
        day('2026-09-03', 4, { points: 120 }), // puntos sin completaciones listadas
        day('2026-09-04', 5), // cero actividad
      ],
      weekStart,
      weekEnd,
    )
    expect(cells[2].done).toBe(true)
    expect(cells[3].done).toBe(true)
    expect(cells[4].done).toBe(false)
  })

  it('ignora filas fuera del rango de la semana (p.ej. ventana today-6..today del snapshot)', () => {
    const days = [
      day('2026-09-02', 3, { completedTaskCodes: ['podcast'] }),
      day('2026-09-09', 3, { completedTaskCodes: ['podcast'] }), // miércoles SIGUIENTE
      day('2026-08-31', 1, { isPerfectDay: true }), // lunes previo
    ]
    const cells = mapWeekCheckins(days, weekStart, weekEnd)
    expect(cells[2].done).toBe(true)
    expect(cells[0].hasData).toBe(false) // 08-31 ignorada
    expect(cells[2].perfect).toBe(false) // 09-09 ignorada (no sobreescribe)
  })

  it('tolera weekday como string en el wire', () => {
    const cells = mapWeekCheckins(
      [day('2026-09-04', '5', { completedTaskCodes: ['podcast'] })],
      weekStart,
      weekEnd,
    )
    expect(cells[4].done).toBe(true)
  })

  it('null/undefined days → 7 celdas vacías (hasData:false)', () => {
    for (const days of [null, undefined]) {
      const cells = mapWeekCheckins(days, weekStart, weekEnd)
      expect(cells).toHaveLength(7)
      expect(cells.every((c) => !c.done && !c.perfect && !c.hasData)).toBe(true)
    }
  })

  it('weekday inválido (mock R5.2 con nombres) → fila descartada', () => {
    const cells = mapWeekCheckins(
      [day('2026-09-02', 'Wed', { completedTaskCodes: ['podcast'] })],
      weekStart,
      weekEnd,
    )
    expect(cells[2].hasData).toBe(false)
  })
})

describe('weekTodayIndex — el marcador es el SLOT de la grilla (weekday ISO - 1), no el offset de semana', () => {
  // Semana NO-lunes: miércoles 2026-09-02 → martes 2026-09-08.
  it('semana que arranca en miércoles: el día de inicio cae en el slot X (índice 2), nunca en L', () => {
    // Contrato ANTIGUO (offset dentro de la semana) devolvía 0 — anti-revert:
    // si volviera el offset o el orden de llegada, esta aserción falla.
    expect(weekTodayIndex('2026-09-02', '2026-09-02')).toBe(2) // miércoles → slot X
  })

  it('hoy a mitad de semana → su slot por weekday', () => {
    expect(weekTodayIndex('2026-09-02', '2026-09-04')).toBe(4) // viernes → slot V
    expect(weekTodayIndex('2026-09-02', '2026-09-06')).toBe(6) // domingo → slot D
  })

  it('hoy = fin de semana del programa → slot del martes (índice 1)', () => {
    expect(weekTodayIndex('2026-09-02', '2026-09-08')).toBe(1) // martes → slot M
  })

  it('semana lunes-primero (caso canónico): slot == offset', () => {
    expect(weekTodayIndex('2026-08-31', '2026-08-31')).toBe(0) // lunes → slot L
    expect(weekTodayIndex('2026-08-31', '2026-09-06')).toBe(6) // domingo → slot D
  })

  it('fuera de rango → null (fallback al marcador device)', () => {
    expect(weekTodayIndex('2026-09-02', '2026-09-09')).toBeNull() // miércoles siguiente
    expect(weekTodayIndex('2026-09-02', '2026-08-31')).toBeNull()
  })

  it('sin fechas del server → null', () => {
    expect(weekTodayIndex(null, '2026-09-04')).toBeNull()
    expect(weekTodayIndex(undefined, undefined)).toBeNull()
    expect(weekTodayIndex('2026-09-02', null)).toBeNull()
  })
})

describe('isoWeekday — weekday ISO puro (1=lunes..7=domingo)', () => {
  it('miércoles=3, viernes=5, domingo=7, martes=2, lunes=1', () => {
    expect(isoWeekday('2026-09-02')).toBe(3) // miércoles
    expect(isoWeekday('2026-09-04')).toBe(5) // viernes
    expect(isoWeekday('2026-09-06')).toBe(7) // domingo
    expect(isoWeekday('2026-09-08')).toBe(2) // martes
    expect(isoWeekday('2026-08-31')).toBe(1) // lunes
  })

  it('null con fecha inválida', () => {
    expect(isoWeekday('no-date')).toBeNull()
  })
})