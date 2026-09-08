import { describe, it, expect, vi, beforeEach } from 'vitest'

// Contract test del wire boundary del snapshot (Fix 3): backends antiguos /
// payloads de cola offline pueden emitir `nutribiotico`; la frontera del
// servicio debe normalizarlo a `nutraceutico` para que hooks/UI/tests solo
// vean el código canónico.
const apiFetchMock = vi.fn()

vi.mock('../../../utils/apiClient', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

import { getSnapshot, normalizeTaskCode, normalizeSnapshotTasks } from '../program-service'
import type { ProgramSnapshotDto, TodayTaskDto } from '../types'

function makeTask(overrides: Partial<TodayTaskDto> = {}): TodayTaskDto {
  return {
    taskCode: 'vitals',
    title: 'Signos vitales',
    short: 'Registra tus signos',
    points: 50,
    status: 'Pending',
    completedAt: null,
    ...overrides,
  }
}

function makeSnapshot(tasks: TodayTaskDto[]): ProgramSnapshotDto {
  return {
    enrollmentId: 'enr-1',
    template: {
      id: 'tpl-1',
      code: 'default-83w',
      name: 'Demo',
      totalWeeks: 83,
      currentWeekNumber: 1,
      currentWeekStatus: 'Active',
      currentWeekStartDateLocal: '2026-09-01',
      currentWeekEndDateLocal: '2026-09-07',
    },
    todayLocalDate: '2026-09-02',
    todayTasks: tasks,
    todayPoints: 0,
    todayBonusAvailable: true,
    todayPointsMax: 650,
    xp: { balance: 100, level: '1', nextLevelAt: 1000 },
    streak: {
      current: 0,
      longest: 0,
      freezesRemaining: 0,
      multiplierActive: 1,
      multiplierEndsAt: null,
      multiplierRemainingHours: 0,
    },
    nextMilestoneDays: 0,
    calendar: [],
  }
}

describe('normalizeTaskCode — wire code legado nutribiotico → nutraceutico', () => {
  it('normaliza el valor legado', () => {
    expect(normalizeTaskCode('nutribiotico')).toBe('nutraceutico')
  })

  it('deja intactos los códigos canónicos', () => {
    expect(normalizeTaskCode('vitals')).toBe('vitals')
    expect(normalizeTaskCode('podcast')).toBe('podcast')
    expect(normalizeTaskCode('nutraceutico')).toBe('nutraceutico')
  })
})

describe('normalizeSnapshotTasks — mapea todayTasks en la frontera', () => {
  it('reescribe SOLO la tarea legada y conserva el resto del snapshot', () => {
    const snap = makeSnapshot([
      makeTask({ taskCode: 'nutribiotico' as TodayTaskDto['taskCode'], title: 'Tomar nutracéutico' }),
      makeTask({ taskCode: 'podcast' }),
    ])
    const out = normalizeSnapshotTasks(snap)
    expect(out.todayTasks[0].taskCode).toBe('nutraceutico')
    expect(out.todayTasks[0].title).toBe('Tomar nutracéutico')
    expect(out.todayTasks[1].taskCode).toBe('podcast')
    expect(out.todayLocalDate).toBe(snap.todayLocalDate)
  })

  it('no-op (misma referencia) cuando no hay códigos legados', () => {
    const snap = makeSnapshot([makeTask({ taskCode: 'nutraceutico' })])
    expect(normalizeSnapshotTasks(snap)).toBe(snap)
  })
})

describe('getSnapshot — normaliza en la frontera del servicio', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('devuelve el snapshot con el wire code legado ya normalizado', async () => {
    apiFetchMock.mockResolvedValue(
      makeSnapshot([
        makeTask({ taskCode: 'nutribiotico' as TodayTaskDto['taskCode'] }),
        makeTask({ taskCode: 'ejercicio' }),
      ]),
    )
    const snap = await getSnapshot()
    expect(snap.todayTasks[0].taskCode).toBe('nutraceutico')
    expect(snap.todayTasks[1].taskCode).toBe('ejercicio')
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/program/me/snapshot', { method: 'GET' })
  })
})