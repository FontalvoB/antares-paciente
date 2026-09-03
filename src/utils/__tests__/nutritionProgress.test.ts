import { describe, expect, it } from 'vitest'

import type { ProgramSnapshotDto, TodayTaskContentDto, TodayTaskDto } from '../../services/program/types'
import { deriveLoggedMeals } from '../nutritionProgress'

function nutTask(content: TodayTaskContentDto): TodayTaskDto {
  return { taskCode: 'nut', title: 'Nutrición', short: '', points: 150, status: 'Pending', completedAt: null, content }
}

function snapshotWith(nut: TodayTaskDto | undefined, extra?: Partial<ProgramSnapshotDto>): ProgramSnapshotDto {
  return {
    enrollmentId: 'e1',
    template: { id: 't1', code: 'c', name: 'n', totalWeeks: 83, currentWeekNumber: 1, currentWeekStatus: 'Active', currentWeekStartDateLocal: '2026-08-24', currentWeekEndDateLocal: '2026-08-30' },
    todayLocalDate: '2026-08-24',
    todayTasks: nut ? [nut] : [],
    todayPoints: 0,
    todayBonusAvailable: false,
    todayPointsMax: 900,
    xp: { balance: 0, level: '1', nextLevelAt: 100 },
    streak: { current: 0, longest: 0, freezesRemaining: 0, multiplierActive: 0, multiplierEndsAt: null, multiplierRemainingHours: 0 },
    nextMilestoneDays: 7,
    calendar: [],
    ...extra,
  }
}

describe('deriveLoggedMeals (S4 — server truth)', () => {
  it('devuelve [] con snapshot null (nunca null)', () => {
    expect(deriveLoggedMeals(null)).toEqual([])
    expect(deriveLoggedMeals(undefined)).toEqual([])
  })

  it('devuelve [] sin tarea nut en el snapshot', () => {
    expect(deriveLoggedMeals(snapshotWith(undefined))).toEqual([])
  })

  it('devuelve [] cuando no hay logs de intake (pin S1: lista materializada vacía)', () => {
    const snap = snapshotWith(nutTask({ nutritionIntakeLogs: [] }))
    expect(deriveLoggedMeals(snap)).toEqual([])
  })

  it('devuelve los mealCodes del servidor en orden, excluyendo agua (hidratación no gatea)', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [
        { mealCode: 'des', localDate: '2026-08-24', calories: 300, proteinG: 15, carbsG: 30, fatG: 5, fiberG: 3, waterMl: null, source: 'manual', foodAnalysisId: null, createdAt: '2026-08-24T12:00:00Z' },
        { mealCode: 'alm', localDate: '2026-08-24', calories: 450, proteinG: 25.5, carbsG: 40, fatG: 12, fiberG: 6, waterMl: null, source: 'manual', foodAnalysisId: null, createdAt: '2026-08-24T13:00:00Z' },
        { mealCode: 'agua', localDate: '2026-08-24', calories: null, proteinG: null, carbsG: null, fatG: null, fiberG: null, waterMl: 750, source: 'manual', foodAnalysisId: null, createdAt: '2026-08-24T14:00:00Z' },
      ],
    }))
    expect(deriveLoggedMeals(snap)).toEqual(['des', 'alm'])
  })

  it('respeta la capa optimista todayNutritionLogged cuando existe (marcador client-only sobre la verdad server)', () => {
    const snap = {
      ...snapshotWith(nutTask({
        nutritionIntakeLogs: [{ mealCode: 'des', localDate: '2026-08-24', calories: 300, proteinG: 15, carbsG: 30, fatG: 5, fiberG: 3, waterMl: null, source: 'manual', foodAnalysisId: null, createdAt: '2026-08-24T12:00:00Z' }],
      })),
      todayNutritionLogged: ['des', 'alm'],
    } as ProgramSnapshotDto & { todayNutritionLogged?: string[] }
    expect(deriveLoggedMeals(snap)).toEqual(['des', 'alm'])
  })
})