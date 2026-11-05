const PREFIX = 'antares:daily-protocol-reminder:v1:'
const seenInSession = new Set<string>()

export function reminderKey(enrollmentId: string, localDate: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(enrollmentId) && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? `${PREFIX}${enrollmentId}:${localDate}` : null
}
export function wasProtocolReminderSeen(key: string): boolean {
  if (seenInSession.has(key)) return true
  try { return localStorage.getItem(key) === 'seen' } catch { return false }
}
export function markProtocolReminderSeen(key: string) {
  seenInSession.add(key)
  try { localStorage.setItem(key, 'seen') } catch { /* La memoria evita repeticiones si el almacenamiento está bloqueado. */ }
}
