const PREFIX = 'antares:daily-protocol-reminder:v2:'
const REMINDER_INTERVAL_MS = 30 * 60_000
const seenInSession = new Map<string, number>()

export function reminderKey(enrollmentId: string, localDate: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(enrollmentId) && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? `${PREFIX}${enrollmentId}:${localDate}` : null
}
export function wasProtocolReminderSeen(key: string): boolean {
  return protocolReminderDelay(key) > 0
}
/** Tiempo restante desde el último aviso, incluso después de cerrar/reabrir la app. */
export function protocolReminderDelay(key: string): number {
  const now = Date.now()
  let stored = 0
  try { stored = Number(localStorage.getItem(key)) } catch { /* Usa memoria si el almacenamiento está bloqueado. */ }
  const valid = (value: number) => Number.isFinite(value) && value > 0 && value <= now ? value : 0
  const lastSeen = Math.max(valid(stored), valid(seenInSession.get(key) ?? 0))
  return lastSeen ? Math.max(0, REMINDER_INTERVAL_MS - (now - lastSeen)) : 0
}
export function markProtocolReminderSeen(key: string) {
  const now = Date.now()
  seenInSession.set(key, now)
  try { localStorage.setItem(key, String(now)) } catch { /* La memoria conserva la pausa si el almacenamiento está bloqueado. */ }
}
