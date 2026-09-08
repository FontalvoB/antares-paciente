import { describe, expect, it } from 'vitest'
import { resolveClinicalChests } from '../useClinicalChests'
import type { ScoresResponseDto, TransformationDetailDto } from '../../services/program/types'

function chest(scores: ScoresResponseDto, id: string, week = 6) {
  return resolveClinicalChests(scores, week).find((c) => c.id === id)
}

/**
 * Entrada del detail con la FORMA REAL del wire (backend IndicatorDetailDto):
 * `{ baseline, current, unit, delta, delta_pct, favorable, score }` keyed by
 * código de métrica. SIN `name` ni campos inventados (nunca llegan del backend). `favorable`/`score` son aditivos — solo se incluyen
 * vía overrides cuando el test los necesita (payload previo sin favorable →
 * requires-data).
 */
function detailEntry(
  overrides: Partial<TransformationDetailDto> & { baseline: number; current: number },
): TransformationDetailDto {
  const { baseline, current, ...rest } = overrides
  return {
    baseline,
    current,
    unit: '%',
    delta: current - baseline,
    delta_pct: ((current - baseline) / baseline) * 100,
    ...rest,
  }
}

function scoresWith(detail: Record<string, TransformationDetailDto>): ScoresResponseDto {
  return {
    health_score: {
      current: 70,
      previous: 68,
      trend: 'up',
      dimensions: { adherence: 80, clinical: 70, nutrition: 75, psychology: 60, exercise: 72 },
    },
    transformation_score: {
      current: 60,
      previous: 55,
      trend: 'up',
      week: 6,
      detail,
    },
  }
}

describe('resolveClinicalChests — clin-3ind usa favorable (direccionalidad del backend)', () => {
  it('peso −5% con favorable:true CUENTA como mejora', () => {
    const c = chest(
      scoresWith({
        weight: detailEntry({ baseline: 92, current: 87.4, favorable: true }),
        glucose: detailEntry({ baseline: 95, current: 92, favorable: true }),
      }),
      'clin-3ind',
    )
    expect(c?.progress).toBe(2)
  })

  it('glucosa +5% con favorable:false NO cuenta (subir glucosa no es mejora)', () => {
    const c = chest(
      scoresWith({
        weight: detailEntry({ baseline: 92, current: 87.4, favorable: true }),
        glucose: detailEntry({ baseline: 95, current: 99.8, favorable: false }),
      }),
      'clin-3ind',
    )
    expect(c?.progress).toBe(1) // solo el peso cuenta
  })

  it('payload previo sin favorable → requires-data (no adivinar)', () => {
    const c = chest(
      scoresWith({
        weight: detailEntry({ baseline: 92, current: 87.4 }), // sin favorable
      }),
      'clin-3ind',
    )
    expect(c?.progress).toBeNull()
    expect(c?.status).toBe('requires-data')
  })

  it('sin detail → requires-data', () => {
    const c = chest(scoresWith({}), 'clin-3ind')
    expect(c?.progress).toBeNull()
    expect(c?.status).toBe('requires-data')
  })
})

describe('resolveClinicalChests — clin-hba1c sin sustitución de glucosa', () => {
  it('HbA1c real bajo el umbral 5.7 → logrado', () => {
    const c = chest(
      scoresWith({
        hba1c: detailEntry({ baseline: 6.1, current: 5.5, favorable: true }),
      }),
      'clin-hba1c',
    )
    expect(c?.progress).toBe(1)
    expect(c?.status).toBe('achieved')
  })

  it('glucosa presente pero HbA1c ausente → requires-data (5.7 es umbral de HbA1c-%, no mg/dL)', () => {
    const c = chest(
      scoresWith({
        glucose: detailEntry({ baseline: 95, current: 99.8, favorable: false }),
      }),
      'clin-hba1c',
    )
    expect(c?.progress).toBeNull()
    expect(c?.status).toBe('requires-data')
  })
})

describe('resolveClinicalChests — sanidad básica', () => {
  it('clin-kg: pérdida de peso vs baseline', () => {
    const c = chest(
      scoresWith({
        weight: detailEntry({ baseline: 92, current: 87.4, favorable: true }),
      }),
      'clin-kg',
    )
    expect(c?.progress).toBeCloseTo(4.6)
  })

  it('clin-hs usa el health score actual', () => {
    const c = chest(scoresWith({}), 'clin-hs')
    expect(c?.progress).toBe(70)
  })

  it('sin scores → todos los cofres en requires-data (nunca progreso inventado)', () => {
    const all = resolveClinicalChests(undefined)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((c) => c.status === 'requires-data')).toBe(true)
  })
})