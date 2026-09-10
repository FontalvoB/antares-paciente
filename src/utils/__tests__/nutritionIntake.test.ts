import { describe, expect, it } from 'vitest'

import type {
  NutritionIntakeLogDto,
  ProgramSnapshotDto,
  TodayTaskContentDto,
  TodayTaskDto,
} from '../../services/program/types'
import {
  deriveIntakeTotals,
  deriveMealSource,
  derivePlanTargets,
  deriveTrend,
  deriveWaterGlasses,
} from '../nutritionIntake'

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

function log(partial: Partial<NutritionIntakeLogDto> & Pick<NutritionIntakeLogDto, 'mealCode'>): NutritionIntakeLogDto {
  return {
    localDate: '2026-08-24',
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    waterMl: null,
    source: 'manual',
    foodAnalysisId: null,
    createdAt: '2026-08-24T12:00:00Z',
    ...partial,
  }
}

describe('deriveIntakeTotals — suma real de macros (excluye agua)', () => {
  it('devuelve zeros con snapshot null/undefined (nunca inventa)', () => {
    expect(deriveIntakeTotals(null)).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
    expect(deriveIntakeTotals(undefined)).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
  })

  it('devuelve zeros sin tarea nut o sin logs (lista materializada vacía)', () => {
    expect(deriveIntakeTotals(snapshotWith(undefined))).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
    expect(deriveIntakeTotals(snapshotWith(nutTask({ nutritionIntakeLogs: [] })))).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
  })

  it('suma los macros de los logs de comidas y EXCLUYE los de agua', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [
        log({ mealCode: 'des', calories: 300, proteinG: 15, carbsG: 30, fatG: 5, fiberG: 3 }),
        log({ mealCode: 'alm', calories: 450, proteinG: 25.5, carbsG: 40, fatG: 12, fiberG: 6 }),
        log({ mealCode: 'agua', calories: 999, waterMl: 750 }),
      ],
    }))
    expect(deriveIntakeTotals(snap)).toEqual({
      calories: 750,
      proteinG: 40.5,
      carbsG: 70,
      fatG: 17,
      fiberG: 9,
    })
  })

  it('trata campos null como 0 (no contamina la suma)', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [
        log({ mealCode: 'cen', calories: null, proteinG: 18, carbsG: null, fatG: null, fiberG: null }),
      ],
    }))
    expect(deriveIntakeTotals(snap)).toEqual({ calories: 0, proteinG: 18, carbsG: 0, fatG: 0, fiberG: 0 })
  })
})

describe('deriveWaterGlasses — vasos reales (floor, 250 ml por vaso)', () => {
  it('devuelve 0 sin snapshot o sin logs de agua', () => {
    expect(deriveWaterGlasses(null)).toBe(0)
    expect(deriveWaterGlasses(snapshotWith(nutTask({ nutritionIntakeLogs: [] })))).toBe(0)
  })

  it('suma waterMl de los logs agua / 250 con floor', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [
        log({ mealCode: 'agua', waterMl: 250 }),
        log({ mealCode: 'agua', waterMl: 500 }),
        log({ mealCode: 'agua', waterMl: 500 }),
      ],
    }))
    expect(deriveWaterGlasses(snap)).toBe(5) // 1250 / 250
  })

  it('redondea hacia abajo (floor) y salta waterMl null', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [
        log({ mealCode: 'agua', waterMl: 250 }),
        log({ mealCode: 'agua', waterMl: null }),
        log({ mealCode: 'agua', waterMl: 250 }),
      ],
    }))
    expect(deriveWaterGlasses(snap)).toBe(2) // 500/250
    const partial = snapshotWith(nutTask({ nutritionIntakeLogs: [log({ mealCode: 'agua', waterMl: 600 })] }))
    expect(deriveWaterGlasses(partial)).toBe(2) // 600/250 = 2.4 → 2
  })

  it('ignora los logs de comidas (no agua)', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [log({ mealCode: 'des', waterMl: 5000 })],
    }))
    expect(deriveWaterGlasses(snap)).toBe(0)
  })
})

describe('deriveMealSource — source real del primer log por comida', () => {
  it('devuelve null sin snapshot, sin log o para una comida no registrada', () => {
    expect(deriveMealSource(null, 'des')).toBeNull()
    expect(deriveMealSource(snapshotWith(undefined), 'alm')).toBeNull()
    expect(deriveMealSource(snapshotWith(nutTask({ nutritionIntakeLogs: [] })), 'cen')).toBeNull()
  })

  it('devuelve "manual" para logs manuales', () => {
    const snap = snapshotWith(nutTask({ nutritionIntakeLogs: [log({ mealCode: 'des', source: 'manual' })] }))
    expect(deriveMealSource(snap, 'des')).toBe('manual')
  })

  it('devuelve "ai_photo" para logs con foto', () => {
    const snap = snapshotWith(nutTask({ nutritionIntakeLogs: [log({ mealCode: 'mer', source: 'ai_photo' })] }))
    expect(deriveMealSource(snap, 'mer')).toBe('ai_photo')
  })

  it('toma el PRIMER log con ese mealCode (orden del servidor)', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [
        log({ mealCode: 'alm', source: 'ai_photo' }),
        log({ mealCode: 'alm', source: 'manual' }),
      ],
    }))
    expect(deriveMealSource(snap, 'alm')).toBe('ai_photo')
  })

  it('nunca responde con un log de agua', () => {
    const snap = snapshotWith(nutTask({
      nutritionIntakeLogs: [log({ mealCode: 'agua', source: 'manual' })],
    }))
    expect(deriveMealSource(snap, 'des')).toBeNull()
  })
})

describe('derivePlanTargets — targets reales del content (null si ausentes)', () => {
  it('devuelve todos null sin snapshot o sin content', () => {
    const zeros = { calories: null, proteinG: null, carbsG: null, fatG: null, fiberG: null }
    expect(derivePlanTargets(null)).toEqual(zeros)
    expect(derivePlanTargets(snapshotWith(undefined))).toEqual(zeros)
    expect(derivePlanTargets(snapshotWith(nutTask({})))).toEqual(zeros)
  })

  it('mapea los daily*Target del content', () => {
    const snap = snapshotWith(nutTask({
      dailyCalorieTarget: 1800,
      dailyProteinTarget: 168,
      dailyCarbsTarget: 90,
      dailyFatTarget: 50,
      dailyFiberTarget: 28,
    }))
    expect(derivePlanTargets(snap)).toEqual({ calories: 1800, proteinG: 168, carbsG: 90, fatG: 50, fiberG: 28 })
  })

  it('deja null los targets parciales', () => {
    const snap = snapshotWith(nutTask({ dailyCalorieTarget: 1600, dailyProteinTarget: 120 }))
    expect(derivePlanTargets(snap)).toEqual({ calories: 1600, proteinG: 120, carbsG: null, fatG: null, fiberG: null })
  })
})

describe('deriveTrend — dirección de tendencia (sube/baja/igual/null)', () => {
  it('devuelve up/down/flat según la comparación', () => {
    expect(deriveTrend(96, 88)).toBe('up')
    expect(deriveTrend(88, 96)).toBe('down')
    expect(deriveTrend(90, 90)).toBe('flat')
  })

  it('devuelve null si falta cualquiera de los valores', () => {
    expect(deriveTrend(null, 88)).toBeNull()
    expect(deriveTrend(88, null)).toBeNull()
    expect(deriveTrend(undefined, undefined)).toBeNull()
    expect(deriveTrend(88, undefined)).toBeNull()
  })
})