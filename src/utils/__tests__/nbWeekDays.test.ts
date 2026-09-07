import { describe, expect, it } from 'vitest'
import {
  daysBetweenISO,
  nbServerTodayIndex,
  nbWeekLabel,
  resolveNbDayOk,
} from '../nbWeekDays'

describe('resolveNbDayOk — NB weekly strip (server truth + optimistic today)', () => {
  // L M X J V S D — hoy = índice 3 (Jueves) en estos casos.
  const server = [true, true, true, false, false, false, false]

  it('usa la verdad del servidor para días pasados/futuros cuando el arreglo está presente', () => {
    expect(resolveNbDayOk(0, 3, server, false)).toBe(true) // L pasado, server ok
    expect(resolveNbDayOk(1, 3, server, false)).toBe(true) // M pasado, server ok
    expect(resolveNbDayOk(4, 3, server, false)).toBe(false) // V futuro, server no
    expect(resolveNbDayOk(6, 3, server, false)).toBe(false) // D futuro, server no
  })

  it('celda de HOY: server true gana aunque el local diga false', () => {
    expect(resolveNbDayOk(1, 1, server, false)).toBe(true) // hoy con server true
  })

  it('celda de HOY: server false gana cuando el local también es false', () => {
    expect(resolveNbDayOk(3, 3, server, false)).toBe(false)
  })

  it('celda de HOY: el estado optimista local gana cuando el server aún dice false', () => {
    expect(resolveNbDayOk(3, 3, server, true)).toBe(true)
  })

  it('fallback legado cuando el arreglo es null/undefined (API previa)', () => {
    for (const arr of [null, undefined]) {
      expect(resolveNbDayOk(0, 3, arr, false)).toBe(true) // pasado → ok
      expect(resolveNbDayOk(2, 3, arr, false)).toBe(true) // pasado → ok
      expect(resolveNbDayOk(3, 3, arr, false)).toBe(false) // hoy sin tomar → no
      expect(resolveNbDayOk(3, 3, arr, true)).toBe(true) // hoy tomado → ok
      expect(resolveNbDayOk(4, 3, arr, false)).toBe(false) // futuro → no
    }
  })

  it('fallback legado cuando el arreglo es corto (API previa)', () => {
    expect(resolveNbDayOk(1, 3, [true, true, true], false)).toBe(true) // pasado → ok
    expect(resolveNbDayOk(5, 3, [true, true, true], false)).toBe(false) // futuro → no
  })

  it('semana NO-lunes (inicio miércoles): hoy cae en el índice derivado del server', () => {
    // weekStart 2026-09-02 (miércoles) → hoy 2026-09-04 (viernes) = índice 2.
    const wedServer = [true, false, false, false, false, false, false]
    const todayIdx = nbServerTodayIndex('2026-09-02', '2026-09-04')
    expect(todayIdx).toBe(2)
    expect(resolveNbDayOk(0, todayIdx as number, wedServer, false)).toBe(true) // miércoles ok
    expect(resolveNbDayOk(1, todayIdx as number, wedServer, false)).toBe(false) // jueves no
    expect(resolveNbDayOk(2, todayIdx as number, wedServer, false)).toBe(false) // HOY viernes no
    expect(resolveNbDayOk(2, todayIdx as number, wedServer, true)).toBe(true) // HOY tomado → optimista gana
    expect(resolveNbDayOk(3, todayIdx as number, wedServer, false)).toBe(false) // sábado futuro
  })
})

describe('daysBetweenISO — matemática de fecha pura (sin TZ del device)', () => {
  it('diferencia en días entre fechas del mismo mes y entre meses', () => {
    expect(daysBetweenISO('2026-09-01', '2026-09-02')).toBe(1)
    expect(daysBetweenISO('2026-09-02', '2026-09-02')).toBe(0)
    expect(daysBetweenISO('2026-08-31', '2026-09-09')).toBe(9)
    expect(daysBetweenISO('2026-09-04', '2026-09-02')).toBe(-2) // hoy antes del inicio
  })

  it('null con fechas inválidas', () => {
    expect(daysBetweenISO('no-date', '2026-09-02')).toBeNull()
    expect(daysBetweenISO('2026-09-02', '')).toBeNull()
  })
})

describe('nbServerTodayIndex — índice de HOY dentro de la semana del server', () => {
  it('índice en rango 0..6 con inicio de semana NO-lunes', () => {
    // Inicio miércoles 2026-09-02: hoy miércoles = 0, viernes = 2, lunes siguiente = 6.
    expect(nbServerTodayIndex('2026-09-02', '2026-09-02')).toBe(0)
    expect(nbServerTodayIndex('2026-09-02', '2026-09-04')).toBe(2)
    expect(nbServerTodayIndex('2026-09-02', '2026-09-08')).toBe(6)
  })

  it('fuera de rango → null (el arreglo no aplica, la UI cae al fallback)', () => {
    expect(nbServerTodayIndex('2026-09-02', '2026-09-09')).toBeNull() // 7 días después
    expect(nbServerTodayIndex('2026-09-02', '2026-08-31')).toBeNull() // antes del inicio
    expect(nbServerTodayIndex('2026-09-02', '2026-09-30')).toBeNull() // muy lejos
  })

  it('sin fechas del servidor (API previa) → null', () => {
    expect(nbServerTodayIndex(null, '2026-09-04')).toBeNull()
    expect(nbServerTodayIndex(undefined, undefined)).toBeNull()
    expect(nbServerTodayIndex('2026-09-02', null)).toBeNull()
  })
})

describe('nbWeekLabel — letra visible derivada de la semana del server', () => {
  // Inicio miércoles 2026-09-02: es → X J V S D L M; en → W T F S S M T.
  it('es: letras narrow es-ES alineadas al inicio de semana real', () => {
    const labels = [0, 1, 2, 3, 4, 5, 6].map((i) => nbWeekLabel('2026-09-02', i, 'es'))
    expect(labels).toEqual(['X', 'J', 'V', 'S', 'D', 'L', 'M'])
  })

  it('en: letras narrow en-US', () => {
    const labels = [0, 1, 2, 3, 4, 5, 6].map((i) => nbWeekLabel('2026-09-02', i, 'en'))
    expect(labels).toEqual(['W', 'T', 'F', 'S', 'S', 'M', 'T'])
  })

  it('null sin fecha del servidor o con fecha inválida', () => {
    expect(nbWeekLabel(null, 0, 'es')).toBeNull()
    expect(nbWeekLabel(undefined, 0, 'en')).toBeNull()
    expect(nbWeekLabel('basura', 0, 'es')).toBeNull()
  })
})