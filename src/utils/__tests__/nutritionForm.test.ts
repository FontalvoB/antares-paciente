import { describe, it, expect } from 'vitest'

import type { NutritionMealDto } from '../../services/program/types'
import {
  buildPlanTargets,
  prefillIntakeForm,
  buildHydrationIntake,
  EMPTY_INTAKE_FORM,
} from '../nutritionForm'

function meal(partial: Partial<NutritionMealDto>): NutritionMealDto {
  return {
    mealType: 'Cena',
    sortOrder: 1,
    ...partial,
  }
}

describe('buildPlanTargets (SPEC "Plan-backed prefill")', () => {
  it('maps plan-day meals via mealTypeToCode — Snack → mer, Cena → cen (D4)', () => {
    const targets = buildPlanTargets([
      meal({ mealType: 'Desayuno', calories: 380, proteinG: 20 }),
      meal({ mealType: 'Snack', calories: 200 }),
      meal({ mealType: 'Cena', calories: 600 }),
    ])

    expect([...targets.keys()]).toEqual(['des', 'mer', 'cen'])
    expect(targets.get('des')).toEqual({ calories: 380, proteinG: 20 })
    // Snack NO cae en 'cen' (bug del fallthrough por prefijo, B3).
    expect(targets.get('mer')).toEqual({ calories: 200 })
    expect(targets.get('cen')).toEqual({ calories: 600 })
  })

  it('unknown meal types are skipped, never a silent fallthrough', () => {
    const targets = buildPlanTargets([meal({ mealType: 'Colación' })])
    expect(targets.size).toBe(0)
  })

  it('no plan data (null/undefined/[]) → empty map → form opens with empty defaults', () => {
    expect(buildPlanTargets(null).size).toBe(0)
    expect(buildPlanTargets(undefined).size).toBe(0)
    expect(buildPlanTargets([]).size).toBe(0)
  })

  it('null macro fields are treated as absent', () => {
    const targets = buildPlanTargets([
      meal({ mealType: 'Cena', calories: 600, proteinG: null, carbsG: undefined }),
    ])
    expect(targets.get('cen')).toEqual({ calories: 600 })
  })
})

describe('prefillIntakeForm (SPEC "Plan-backed prefill" editable / "No plan prefill")', () => {
  it('plan target → form prefilled (cen 600 kcal) and editable as strings', () => {
    const form = prefillIntakeForm({ calories: 600, proteinG: 30 })
    expect(form).toEqual({ calories: '600', proteinG: '30', carbsG: '', fatG: '', fiberG: '' })
  })

  it('no target → empty defaults (spec "No plan prefill")', () => {
    expect(prefillIntakeForm(undefined)).toEqual(EMPTY_INTAKE_FORM)
    expect(prefillIntakeForm({})).toEqual(EMPTY_INTAKE_FORM)
  })

  it('zero is a valid prefill value (not treated as absent)', () => {
    expect(prefillIntakeForm({ calories: 0 }).calories).toBe('0')
  })
})

describe('buildHydrationIntake (SPEC "Hydration log execution")', () => {
  it('glasses × 250 ml with source manual (wire: mealCode agua + intake.waterMl)', () => {
    expect(buildHydrationIntake(1)).toEqual({ waterMl: 250, source: 'manual' })
    expect(buildHydrationIntake(3)).toEqual({ waterMl: 750, source: 'manual' })
    expect(buildHydrationIntake(8)).toEqual({ waterMl: 2000, source: 'manual' })
  })
})