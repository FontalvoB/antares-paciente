import { describe, expect, it } from 'vitest'
import { resolveLastNightSleep } from '../emotionalSleep'
import type { HealthSample } from '../../devices/types'

const now = new Date(2026, 10, 5, 10).getTime()
const sample: HealthSample = { metric: 'sleep', value: 427, unit: 'min', ts: new Date(2026, 10, 5, 7).getTime(), deviceId: 'ring', source: 'history', sleepDurationVersion: 1 }
describe('sueño de anoche para evaluación emocional', () => {
  it('conserva minutos, fecha de despertar y dispositivo', () => {
    expect(resolveLastNightSleep(sample, 'ring', now)).toEqual({ minutes: 427, recordedAt: new Date(sample.ts).toISOString(), deviceId: 'ring', nightDate: '2026-11-05' })
  })
  it.each([
    { ...sample, deviceId: 'other' }, { ...sample, deviceId: 'debug-ring' },
    { ...sample, ts: now - 24 * 3600_000 }, { ...sample, ts: now + 5 * 60_000 },
    { ...sample, sleepDurationVersion: undefined }, { ...sample, value: 0 },
    { ...sample, value: 1441 }, { ...sample, value: NaN }, { ...sample, unit: 'h' },
  ])('no rellena con datos ajenos, viejos, sin recalcular o inválidos (%#)', invalid => {
    expect(resolveLastNightSleep(invalid as HealthSample, 'ring', now)).toBeNull()
  })
  it('no asigna una noche a una fecha de programa diferente', () => {
    expect(resolveLastNightSleep(sample, 'ring', now, '2026-11-04')).toBeNull()
  })
})
