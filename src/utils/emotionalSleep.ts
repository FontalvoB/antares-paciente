import type { HealthSample } from '../devices/types'
import { toLocalISODate } from './dates'

/** El wearable fecha el sueño al despertar: solo hoy corresponde a anoche. */
export function resolveLastNightSleep(sample: HealthSample | undefined, deviceId: string | undefined, now = Date.now(), localDate = toLocalISODate(new Date(now))): { minutes: number; recordedAt: string; deviceId: string; nightDate: string } | null {
  if (!sample || !deviceId || sample.deviceId !== deviceId || sample.deviceId.startsWith('debug') || sample.metric !== 'sleep'
    || !Number.isFinite(sample.ts) || sample.ts > now + 60_000 || now - sample.ts > 36 * 60 * 60_000
    || !Number.isFinite(sample.value) || sample.value <= 0 || sample.value > 1440 || sample.unit !== 'min'
    || sample.sleepDurationVersion !== 1) return null
  const sampleDate = toLocalISODate(new Date(sample.ts))
  if (sampleDate !== localDate) return null
  return { minutes: Math.round(sample.value), recordedAt: new Date(sample.ts).toISOString(), deviceId, nightDate: sampleDate }
}
