import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMonthCells } from '../monthCells'
import type { CalendarDayDetailDto } from '../../services/program/types'

// Septiembre 2026: el 1 cae martes → pad = 2 (do, lu vacíos).
const YEAR = 2026
const MONTH = 8 // 0-based: septiembre

// Reloj del device fijado al 20/09/2026: los fallbacks device-today de las
// pruebas son deterministas (días 1..19 = pasado).
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

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

function kindOf(cells: { d: number | null; kind: string }[], d: number): string {
  const cell = cells.find((c) => c.d === d)
  if (!cell) throw new Error(`no cell for day ${d}`)
  return cell.kind
}

function okCount(cells: { d: number | null; kind: string }[]): number {
  return cells.filter((c) => c.kind.includes('ok')).length
}

describe('buildMonthCells — mapa mensual con verdad del servidor', () => {
  it('ok = día perfecto; partial = ≥1 completación o puntos; missed = pasado con fila y cero actividad', () => {
    const serverToday = '2026-09-05'
    const cells = buildMonthCells({
      year: YEAR,
      month: MONTH,
      serverTodayIso: serverToday,
      days: [
        day('2026-09-01', 2, { isPerfectDay: true, completedTaskCodes: ['podcast', 'nut'] }), // martes perfecto
        day('2026-09-02', 3, { completedTaskCodes: ['podcast'], points: 150 }), // miércoles parcial
        day('2026-09-03', 4), // jueves pasado, fila con cero actividad → missed
        day('2026-09-20', 7), // domingo futuro con fila → future
      ],
    })
    expect(kindOf(cells, 1)).toBe('ok')
    expect(kindOf(cells, 2)).toBe('partial')
    expect(kindOf(cells, 3)).toBe('missed')
    expect(kindOf(cells, 4)).toBe('nodata') // pasado SIN fila
    expect(kindOf(cells, 20)).toBe('future')
  })

  it('nunca inventa días ok: pasado sin fila → nodata (gris), incluso sin datos del server', () => {
    for (const days of [undefined, null, []]) {
      const cells = buildMonthCells({ year: YEAR, month: MONTH, days })
      expect(kindOf(cells, 1)).toBe('nodata')
      expect(kindOf(cells, 15)).toBe('nodata')
      expect(okCount(cells)).toBe(0)
    }
  })

  it('filas del mock R5.2 (weekday con nombre, no short ISO) no cuentan como dato', () => {
    const cells = buildMonthCells({
      year: YEAR,
      month: MONTH,
      days: [
        day('2026-09-01', 'Tue', { isPerfectDay: true }), // mock-style weekday name
        day('2026-09-02', 'Wed', { completedTaskCodes: ['podcast'] }),
      ],
    })
    expect(kindOf(cells, 1)).toBe('nodata') // la fila mock no es dato real
    expect(kindOf(cells, 2)).toBe('nodata')
    expect(okCount(cells)).toBe(0)
  })

  it('marcador de hoy desde snapshot.todayLocalDate (server) cuando aplica al mes', () => {
    const cells = buildMonthCells({
      year: YEAR,
      month: MONTH,
      serverTodayIso: '2026-09-05',
      days: [day('2026-09-05', 6, { isPerfectDay: true })],
    })
    expect(kindOf(cells, 5)).toBe('ok today')
  })

  it('serverTodayIso de otro mes → fallback al reloj del device (no marca el día)', () => {
    const cells = buildMonthCells({
      year: YEAR,
      month: MONTH,
      serverTodayIso: '2027-01-15',
      days: [day('2026-09-15', 2)],
    })
    // Sin server-today: el 15 no es necesariamente hoy — no se fuerza el marcador.
    expect(kindOf(cells, 15)).not.toContain('today')
  })

  it('contador "días ok" solo cuenta celdas ok respaldadas por el servidor', () => {
    const cells = buildMonthCells({
      year: YEAR,
      month: MONTH,
      serverTodayIso: '2026-09-10',
      days: [
        day('2026-09-01', 2, { isPerfectDay: true }),
        day('2026-09-02', 3, { isPerfectDay: true }),
        day('2026-09-03', 4, { completedTaskCodes: ['podcast'] }),
      ],
    })
    expect(okCount(cells)).toBe(2)
    expect(kindOf(cells, 3)).toBe('partial')
  })

  it('día de hoy con fila y cero actividad → future + marcador today (no perdido)', () => {
    const cells = buildMonthCells({
      year: YEAR,
      month: MONTH,
      serverTodayIso: '2026-09-08',
      days: [day('2026-09-08', 2)],
    })
    expect(kindOf(cells, 8)).toBe('future today')
  })

  it('día de hoy sin fila → kind today (sin base ok/partial)', () => {
    const cells = buildMonthCells({ year: YEAR, month: MONTH, serverTodayIso: '2026-09-08' })
    expect(kindOf(cells, 8)).toBe('today')
  })

  it('ignora filas de OTRO mes (guard de rango por prefijo YYYY-MM)', () => {
    const cells = buildMonthCells({
      year: YEAR,
      month: MONTH,
      serverTodayIso: '2026-09-10',
      days: [
        // Fila de octubre: el día 5 NO debe pintarse 'ok' en septiembre.
        day('2026-10-05', 6, { isPerfectDay: true }),
        day('2026-08-20', 2, { isPerfectDay: true }),
      ],
    })
    expect(kindOf(cells, 5)).toBe('nodata') // pasado sin fila del mes renderizado
    expect(kindOf(cells, 20)).toBe('future') // futuro sin fila
    expect(okCount(cells)).toBe(0)
  })

  it('grilla: celdas vacías de relleno antes del primer día del mes', () => {
    const cells = buildMonthCells({ year: YEAR, month: MONTH })
    expect(cells[0].d).toBeNull()
    expect(cells[1].d).toBeNull()
    expect(cells[2].d).toBe(1)
  })
})