import type { HealthSample } from '../devices/types'
import { toLocalISODate } from './dates'

/** El wearable fecha el sueño al despertar: solo hoy corresponde a anoche. */
export function resolveLastNightSleep(sample: HealthSample | undefined, deviceId: string | undefined, now = Date.now()): { minutes: number; recordedAt: string } | null {
  if (!sample || !deviceId || sample.deviceId !== deviceId || sample.deviceId.startsWith('debug') || sample.metric !== 'sleep'
    || !Number.isFinite(sample.ts) || sample.ts > now + 60_000 || now - sample.ts > 36 * 60 * 60_000
    || !Number.isFinite(sample.value) || sample.value <= 0 || sample.value > 1440 || sample.unit !== 'min') return null
  const date = new Date(now)
  const sampleDate = toLocalISODate(new Date(sample.ts))
  if (sampleDate !== toLocalISODate(date)) return null
  return { minutes: Math.round(sample.value), recordedAt: new Date(sample.ts).toISOString() }
}
