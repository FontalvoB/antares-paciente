import { describe, it, expect } from 'vitest'
import { applyOptimistic, reconcileSnapshot } from '../useCompleteTask'
import type {
  CompleteTaskResponseDto,
  ProgramSnapshotDto,
  TodayTaskDto,
} from '../../services/program/types'

// --- Helpers (mismo shape que el snapshot real del programa) ---

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

function makeSnapshot(tasks: TodayTaskDto[] = [makeTask()]): ProgramSnapshotDto {
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
    todayBonusAvailable: false,
    todayPointsMax: 0,
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

function makeResponse(
  overrides: Partial<CompleteTaskResponseDto> = {},
): CompleteTaskResponseDto {
  return {
    taskCompletionId: 'tc-1',
    pointsAwarded: 80,
    xpBalanceAfter: 180,
    isPerfectDay: true,
    dailyBonusAwarded: 50,
    streakCurrent: 3,
    freezesRemaining: 1,
    dayPoints: 150,
    dayPointsMax: 650,
    ...overrides,
  }
}

// --- Tests ---

describe('applyOptimistic — vitals merge (vital-signs-tracking)', () => {
  it('writes submitted vitals into content.recentVitals with measuredAt as recordedAt', () => {
    const snap = makeSnapshot()
    const out = applyOptimistic(snap, 'vitals', {
      heartRate: 72,
      systolic: 118,
      diastolic: 76,
      measuredAt: '2026-09-02T21:43:00.000Z',
    })

    const task = out.todayTasks[0]
    expect(task.status).toBe('Completed')
    expect(task.content?.recentVitals).toEqual({
      heartRate: 72,
      systolic: 118,
      diastolic: 76,
      recordedAt: '2026-09-02T21:43:00.000Z',
    })
    // XP estimado se sigue aplicando (comportamiento previo intacto).
    expect(out.xp.balance).toBe(150)
  })

  it('falls back to now (ISO) as recordedAt when measuredAt is missing', () => {
    const out = applyOptimistic(makeSnapshot(), 'vitals', { heartRate: 72 })
    const recordedAt = out.todayTasks[0].content?.recentVitals?.recordedAt
    expect(recordedAt).toBeTruthy()
    expect(new Date(recordedAt as string).toISOString()).toBe(recordedAt)
  })

  it('no-op when vitals is null/undefined — no recentVitals written', () => {
    for (const vitals of [null, undefined]) {
      const snap = makeSnapshot()
      const out = applyOptimistic(snap, 'vitals', vitals)
      expect(out.todayTasks[0].status).toBe('Completed')
      expect(out.todayTasks[0].content?.recentVitals).toBeUndefined()
    }
  })

  it('no-op when every vital field is null — behaves exactly as before', () => {
    const snap = makeSnapshot()
    const out = applyOptimistic(snap, 'vitals', {
      heartRate: null,
      glucose: null,
      measuredAt: '2026-09-02T21:43:00.000Z',
    })
    expect(out.todayTasks[0].status).toBe('Completed')
    expect(out.todayTasks[0].content?.recentVitals).toBeUndefined()
  })

  it('ignores the vitals payload for non-vitals tasks', () => {
    const snap = makeSnapshot([makeTask({ taskCode: 'podcast', points: 30 })])
    const out = applyOptimistic(snap, 'podcast', { heartRate: 72 })
    expect(out.todayTasks[0].status).toBe('Completed')
    expect(out.todayTasks[0].content?.recentVitals).toBeUndefined()
  })

  it('creates content.recentVitals when the task content is null', () => {
    const snap = makeSnapshot([makeTask({ content: null })])
    const out = applyOptimistic(snap, 'vitals', { temperatureC: 36.6 })
    expect(out.todayTasks[0].content?.recentVitals?.temperatureC).toBe(36.6)
    expect(out.todayTasks[0].content?.recentVitals?.recordedAt).toBeTruthy()
  })

  it('merges submitted values over prior recentVitals (optimistic ≡ eventual server truth)', () => {
    const snap = makeSnapshot([
      makeTask({ content: { title: 'Signos vitales', recentVitals: { heartRate: 60, glucose: 95 } } }),
    ])
    const out = applyOptimistic(snap, 'vitals', { heartRate: 72, measuredAt: '2026-09-02T21:43:00.000Z' })
    // El servidor reconcilia con last-value-per-metric (90 días): lo no
    // enviado hoy conserva su valor previo, lo enviado se sobreescribe y
    // recordedAt avanza — el estado optimista coincide con el post-refetch.
    expect(out.todayTasks[0].content?.title).toBe('Signos vitales')
    expect(out.todayTasks[0].content?.recentVitals).toEqual({
      heartRate: 72,
      glucose: 95,
      recordedAt: '2026-09-02T21:43:00.000Z',
    })
  })

  it('already-completed task → returns the same snapshot (no double write)', () => {
    const snap = makeSnapshot([
      makeTask({ status: 'Completed', completedAt: '2026-09-02T08:00:00.000Z' }),
    ])
    const out = applyOptimistic(snap, 'vitals', { heartRate: 72 })
    expect(out).toBe(snap)
    expect(out.todayTasks[0].content?.recentVitals).toBeUndefined()
  })

  it('does not mutate the input snapshot (immutability)', () => {
    const snap = makeSnapshot([makeTask({ content: null })])
    applyOptimistic(snap, 'vitals', { heartRate: 72 })
    expect(snap.todayTasks[0].status).toBe('Pending')
    expect(snap.todayTasks[0].content).toBeNull()
    expect(snap.xp.balance).toBe(100)
  })
})

describe('reconcileSnapshot — todayBonusAvailable "still earnable" semantics (nutraceutico wire)', () => {
  it('perfect day → sets todayBonusAvailable=false (bonus already earned today)', () => {
    const snap = { ...makeSnapshot(), todayBonusAvailable: true }
    const out = reconcileSnapshot(snap, makeResponse({ isPerfectDay: true, dailyBonusAwarded: 50 }))
    expect(out?.todayBonusAvailable).toBe(false)
  })

  it('not a perfect day → preserves the previous cached value (still earnable)', () => {
    const snap = { ...makeSnapshot(), todayBonusAvailable: true }
    const out = reconcileSnapshot(snap, makeResponse({ isPerfectDay: false, dailyBonusAwarded: 0 }))
    expect(out?.todayBonusAvailable).toBe(true)
  })

  it('not a perfect day on an already-earned day → keeps false', () => {
    const snap = { ...makeSnapshot(), todayBonusAvailable: false }
    const out = reconcileSnapshot(snap, makeResponse({ isPerfectDay: false, dailyBonusAwarded: 0 }))
    expect(out?.todayBonusAvailable).toBe(false)
  })

  it('perfect day with a hypothetical 0-amount rule → still marks the bonus earned', () => {
    const snap = { ...makeSnapshot(), todayBonusAvailable: true }
    const out = reconcileSnapshot(snap, makeResponse({ isPerfectDay: true, dailyBonusAwarded: 0 }))
    expect(out?.todayBonusAvailable).toBe(false)
  })

  it('undefined snapshot → returns undefined (no-op)', () => {
    expect(reconcileSnapshot(undefined, makeResponse())).toBeUndefined()
  })

  it('still reconciles xp / streak / day points', () => {
    const snap = makeSnapshot()
    const out = reconcileSnapshot(snap, makeResponse({ xpBalanceAfter: 300, streakCurrent: 9, dayPoints: 230 }))
    expect(out?.xp.balance).toBe(300)
    expect(out?.streak.current).toBe(9)
    expect(out?.todayPoints).toBe(230)
  })
})

describe('applyOptimistic — nutraceutico wire code (rename regression guard)', () => {
  it('completes the nutraceutico task with the renamed wire code', () => {
    const snap = makeSnapshot([makeTask({ taskCode: 'nutraceutico', points: 80 })])
    const out = applyOptimistic(snap, 'nutraceutico')
    expect(out.todayTasks[0].status).toBe('Completed')
    expect(out.todayTasks[0].completedAt).toBeTruthy()
    expect(out.xp.balance).toBe(180)
  })
})