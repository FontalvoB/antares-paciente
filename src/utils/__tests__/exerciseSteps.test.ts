import { describe, expect, it } from 'vitest'
import { resolveStationSec } from '../exerciseSteps'
import type { ExerciseItemDto } from '../../services/program/types'

// Matriz defensiva (W4): un durationSecs negativo/0 nunca debe producir una
// estación de 0s (eso avanzaba el circuito al instante y regalaba puntos).
const ex = (over: Partial<ExerciseItemDto>): ExerciseItemDto => ({
  name: 'x',
  sortOrder: 0,
  ...over,
})

describe('resolveStationSec — duración real defensiva de una estación', () => {
  it('durationSecs positivo manda', () => {
    expect(resolveStationSec(ex({ durationSecs: 120 }))).toBe(120)
    expect(resolveStationSec(ex({ durationSecs: 5, restSeconds: 30, sets: 3 }))).toBe(5)
  })

  it('durationSecs null → deriva de restSeconds × sets', () => {
    expect(resolveStationSec(ex({ durationSecs: null, restSeconds: 30, sets: 3 }))).toBe(90)
    expect(resolveStationSec(ex({ durationSecs: null, restSeconds: 30, sets: null }))).toBe(30)
  })

  it('durationSecs 0 o negativo → rechazado (no 0s); cae a restSeconds o default', () => {
    expect(resolveStationSec(ex({ durationSecs: 0 }))).toBe(45)
    expect(resolveStationSec(ex({ durationSecs: -30, restSeconds: 30, sets: 2 }))).toBe(60)
    expect(resolveStationSec(ex({ durationSecs: -30 }))).toBe(45)
  })

  it('restSeconds negativo/0 → default 45 (no duraciones negativas)', () => {
    expect(resolveStationSec(ex({ durationSecs: null, restSeconds: -10, sets: 3 }))).toBe(45)
    expect(resolveStationSec(ex({ durationSecs: null, restSeconds: 0 }))).toBe(45)
  })

  it('sin duración ni descanso → 45 (default del contrato)', () => {
    expect(resolveStationSec(ex({ durationSecs: null, restSeconds: null }))).toBe(45)
    expect(resolveStationSec(ex({}))).toBe(45)
  })
})