import { describe, expect, it } from 'vitest'
import {
  METRIC_LABELS,
  metricLabel,
  resolveEvolutionViewState,
  resolveHistoryViewState,
  resolveTransformRows,
  resolveWatchCard,
} from '../evolution'
import type {
  ScoresHistoryPointDto,
  ScoresResponseDto,
  TransformationDetailDto,
} from '../../services/program/types'

function makeScores(overrides: Partial<ScoresResponseDto> = {}): ScoresResponseDto {
  return {
    health_score: { current: 72, previous: 70, trend: 'up' },
    ...overrides,
  }
}

describe('resolveEvolutionViewState — números REALES, cero fallbacks fabricados', () => {
  it('payload con health_score.current → data con healthScore real', () => {
    const r = resolveEvolutionViewState({ isLoading: false, isError: false, scores: makeScores() })
    expect(r).toEqual({ state: 'data', healthScore: 72, previousHealthScore: 70 })
  })

  it('payload legacy camelCase (healthScore.score) → data, fallback de lectura no de mock', () => {
    const r = resolveEvolutionViewState({
      isLoading: false,
      isError: false,
      scores: { healthScore: { current: 64, previous: 61, trend: 'up', score: 64 } },
    })
    expect(r).toEqual({ state: 'data', healthScore: 64, previousHealthScore: 61 })
  })

  it('previous null (sin fila previa) → previousHealthScore null: la UI oculta Anterior/Cambio', () => {
    const r = resolveEvolutionViewState({
      isLoading: false,
      isError: false,
      scores: makeScores({ health_score: { current: 72, previous: null, trend: 'flat' } }),
    })
    expect(r).toEqual({ state: 'data', healthScore: 72, previousHealthScore: null })
  })

  it('payload sin health_score → healthScore null (nunca 86 fijo)', () => {
    const r = resolveEvolutionViewState({
      isLoading: false,
      isError: false,
      scores: { transformation_score: { current: 50, trend: 'up' } },
    })
    expect(r).toEqual({ state: 'data', healthScore: null, previousHealthScore: null })
  })

  it('sin payload y cargando → loading', () => {
    expect(resolveEvolutionViewState({ isLoading: true, isError: false, scores: undefined })).toEqual({
      state: 'loading',
    })
  })

  it('sin payload y error → error (la UI muestra retry)', () => {
    expect(resolveEvolutionViewState({ isLoading: false, isError: true, scores: undefined })).toEqual({
      state: 'error',
    })
  })

  it('sin payload, sin loading ni error → empty honesto', () => {
    expect(resolveEvolutionViewState({ isLoading: false, isError: false, scores: undefined })).toEqual({
      state: 'empty',
    })
  })

  it('cache previo gana sobre loading/error (un refetch fallido no borra datos reales)', () => {
    expect(resolveEvolutionViewState({ isLoading: true, isError: true, scores: makeScores() }).state).toBe('data')
  })
})

describe('resolveHistoryViewState — trend card honesta sobre semanas REALES', () => {
  const p = (weekNumber: number, healthScore: number | null = 60): ScoresHistoryPointDto => ({
    weekNumber,
    periodStart: null,
    periodEnd: '2026-09-06',
    healthScore,
    healthPrevious: null,
    transformationScore: null,
  })

  it('≥2 puntos persistidos → data (sparkline real)', () => {
    expect(resolveHistoryViewState({ isLoading: false, isError: false, points: [p(1), p(2)] })).toBe('data')
  })

  it('<2 puntos → empty honesto ("Aún no hay suficientes semanas…")', () => {
    expect(resolveHistoryViewState({ isLoading: false, isError: false, points: [p(1)] })).toBe('empty')
    expect(resolveHistoryViewState({ isLoading: false, isError: false, points: [] })).toBe('empty')
  })

  it('sin puntos y cargando → loading', () => {
    expect(resolveHistoryViewState({ isLoading: true, isError: false, points: undefined })).toBe('loading')
  })

  it('sin puntos y error (404 de backend sin desplegar / network) → empty, NUNCA error wall', () => {
    expect(resolveHistoryViewState({ isLoading: false, isError: true, points: undefined })).toBe('empty')
  })

  it('cache previo con ≥2 puntos gana sobre el error del refetch', () => {
    expect(resolveHistoryViewState({ isLoading: false, isError: true, points: [p(1), p(2)] })).toBe('data')
  })

  it('cache previo con <2 puntos + error → empty (los puntos son la verdad)', () => {
    expect(resolveHistoryViewState({ isLoading: false, isError: true, points: [p(1)] })).toBe('empty')
  })
})

// --- Fixture de detail con la FORMA REAL del wire (backend IndicatorDetailDto):
// `{ baseline, current, unit, delta, delta_pct, favorable, score }` keyed by
// código de métrica. Sin `name` ni campos inventados que el backend nunca emite.

function detail(
  metricCode: string,
  baseline: number,
  current: number,
  opts: Partial<TransformationDetailDto> = {},
): Record<string, TransformationDetailDto> {
  return {
    [metricCode]: {
      baseline,
      current,
      unit: '%',
      delta: current - baseline,
      delta_pct: ((current - baseline) / baseline) * 100,
      ...opts,
    },
  }
}

describe('METRIC_LABELS / metricLabel — códigos REALES del catálogo del backend', () => {
  it('códigos conocidos → label i18n mapeado', () => {
    expect(METRIC_LABELS['weight']).toBe('Peso')
    expect(METRIC_LABELS['glucose_fasting']).toBe('Glucosa')
    expect(METRIC_LABELS['hba1c']).toBe('HbA1c')
    expect(METRIC_LABELS['body_fat']).toBe('Índice de grasa')
    expect(METRIC_LABELS['systolic_bp']).toBe('Presión sistólica')
    expect(METRIC_LABELS['diastolic_bp']).toBe('Presión diastólica')
    expect(METRIC_LABELS['bmi']).toBe('IMC')
  })

  it('código desconocido → passthrough raw (honesto, nunca nombre inventado)', () => {
    expect(metricLabel('some_future_metric')).toBe('some_future_metric')
  })
})

describe('resolveWatchCard — card "Índice de grasa" SOLO con delta_pct real', () => {
  it('body_fat + delta_pct presente (favorable true, delta negativo) → card con −|pct|', () => {
    expect(resolveWatchCard(detail('body_fat', 30, 28.5, { favorable: true, delta_pct: -5 }))).toEqual({
      delta: '−5',
    })
  })

  it('body_fat + delta_pct presente (favorable false) → card con +|pct|', () => {
    expect(resolveWatchCard(detail('body_fat', 30, 31.5, { favorable: false, delta_pct: 5 }))).toEqual({
      delta: '+5',
    })
  })

  it('body_fat SIN delta_pct (payload previo sin el campo aditivo) → null: la card NO se renderiza', () => {
    expect(resolveWatchCard(detail('body_fat', 30, 28.5, { delta_pct: undefined }))).toBeNull()
  })

  it('detail sin body_fat (aunque haya otras métricas) → null', () => {
    expect(resolveWatchCard(detail('weight', 90, 85))).toBeNull()
  })

  it('sin detail → null', () => {
    expect(resolveWatchCard(null)).toBeNull()
    expect(resolveWatchCard(undefined)).toBeNull()
    expect(resolveWatchCard({})).toBeNull()
  })
})

describe('resolveTransformRows — filas con label mapeado por código de métrica', () => {
  it('entradas del wire (sin name) → rows con label mapeado y key = código', () => {
    const rows = resolveTransformRows({
      ...detail('weight', 90, 85),
      ...detail('glucose_fasting', 118, 108, { favorable: true }),
    })
    expect(rows).not.toBeNull()
    expect(rows?.map((r) => [r.metricCode, r.label])).toEqual([
      ['weight', 'Peso'],
      ['glucose_fasting', 'Glucosa'],
    ])
    expect(rows?.[0].base).toBe('90 %')
    expect(rows?.[0].cur).toBe('85 %')
  })

  it('código desconocido → label raw (el código mismo)', () => {
    const rows = resolveTransformRows(detail('unknown_code', 10, 12))
    expect(rows?.[0].label).toBe('unknown_code')
    expect(rows?.[0].metricCode).toBe('unknown_code')
  })

  it('sin detail o vacío → null (la UI degrada a requires-data, jamás filas fabricadas)', () => {
    expect(resolveTransformRows(null)).toBeNull()
    expect(resolveTransformRows(undefined)).toBeNull()
    expect(resolveTransformRows({})).toBeNull()
  })
})