import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLastNightSleep } from '../emotionalSleep'
import { programDayNumber } from '../programDayNumber'
import { queueCommunityShareDraft, takeCommunityShareDraft } from '../communityShareDraft'
import { markProtocolReminderSeen, reminderKey, wasProtocolReminderSeen } from '../dailyProtocolReminder'
import type { HealthSample } from '../../devices/types'

const now = new Date(2026, 10, 3, 10, 0).getTime()
const sample: HealthSample = { metric: 'sleep', value: 427, unit: 'min', ts: new Date(2026, 10, 3, 7).getTime(), deviceId: 'band', source: 'history', sleepDurationVersion: 1 }

describe('sueño de anoche y contexto del protocolo', () => {
  it('permite el historial nocturno real del dispositivo seleccionado', () => {
    expect(resolveLastNightSleep(sample, 'band', now)?.minutes).toBe(427)
    expect(resolveLastNightSleep({ ...sample, ts: new Date(2026, 10, 2, 7).getTime() }, 'band', now)).toBeNull()
  })
  it.each([
    { ...sample, deviceId: 'otro' }, { ...sample, deviceId: 'debug:band' },
    { ...sample, value: NaN }, { ...sample, value: 1441 }, { ...sample, value: 0 },
    { ...sample, ts: now + 120_000 }, { ...sample, ts: now - 48 * 3600_000 },
    { ...sample, unit: 'h' },
  ])('omite datos ajenos, de prueba, antiguos o inválidos: %j', value => {
    expect(resolveLastNightSleep(value, 'band', now)).toBeNull()
  })
  it('no inventa sueño si no hay dispositivo', () => expect(resolveLastNightSleep(sample, undefined, now)).toBeNull())
  it('usa las fechas locales del servidor aunque cruce mes o año', () => {
    expect(programDayNumber(3, '2026-12-28', '2027-01-01')).toBe(19)
    expect(programDayNumber(3, '2026-12-28', '2027-01-06')).toBeNull()
    expect(programDayNumber(0, '2026-12-28', '2026-12-28')).toBeNull()
  })
  it.each([
    [1, '2026-11-02', '2026-11-02', 1],
    [3, '2026-11-02', '2026-11-08', 21],
    [1, '2028-02-28', '2028-02-29', 2],
    [1, '2026-02-28', '2026-02-30', null],
    [1, '2026-02-30', '2026-03-03', null],
  ])('calcula el día desde fechas reales: semana %s, %s a %s', (week, start, today, expected) => {
    expect(programDayNumber(week, start, today)).toBe(expected)
  })
})

describe('borrador voluntario de comunidad', () => {
  beforeEach(() => { takeCommunityShareDraft(''); vi.useRealTimers() })
  it('solo lo consume la misma cuenta, una vez, sin publicar', () => {
    queueCommunityShareDraft('patient-A', 'Día 19 para estar más sano')
    expect(takeCommunityShareDraft('patient-A')).toBe('Día 19 para estar más sano')
    expect(takeCommunityShareDraft('patient-A')).toBeNull()
  })
  it('descarta un borrador ajeno o caducado', () => {
    queueCommunityShareDraft('patient-A', 'Mi hábito')
    expect(takeCommunityShareDraft('patient-B')).toBeNull()
    queueCommunityShareDraft('patient-A', 'Mi hábito')
    expect(takeCommunityShareDraft('patient-A', Date.now() + 6 * 60_000)).toBeNull()
  })
})

describe('recordatorios por paciente y fecha del servidor', () => {
  it('no genera claves para fallback ni fechas inexistentes', () => {
    expect(reminderKey('mock-enrollment', '2026-11-03')).toBeNull()
    expect(reminderKey('00000000-0000-4000-8000-000000000001', '')).toBeNull()
  })
  it('recuerda un solo aviso y distingue el siguiente día/otra inscripción', () => {
    const key = reminderKey('00000000-0000-4000-8000-000000000001', '2026-11-03')!
    markProtocolReminderSeen(key)
    expect(wasProtocolReminderSeen(key)).toBe(true)
    expect(wasProtocolReminderSeen(reminderKey('00000000-0000-4000-8000-000000000001', '2026-11-04')!)).toBe(false)
    expect(wasProtocolReminderSeen(reminderKey('00000000-0000-4000-8000-000000000002', '2026-11-03')!)).toBe(false)
  })
})
