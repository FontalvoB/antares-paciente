/** Estado de presentación por cuenta en esta instalación; no almacena datos clínicos. */
const PREFIX = 'antares:vita-welcome:v1:';
const memory = new Map<string, 'pending' | 'seen'>();

export function vitaWelcomeState(accountId: string | null): 'pending' | 'seen' | null {
  if (!accountId) return null;
  let value: string | null = null;
  try { value = localStorage.getItem(PREFIX + accountId); } catch { /* Respaldo durante la sesión. */ }
  return value === 'pending' || value === 'seen' ? value : memory.get(accountId) ?? null;
}

function save(accountId: string, state: 'pending' | 'seen') {
  memory.set(accountId, state);
  try { localStorage.setItem(PREFIX + accountId, state); } catch { /* Respaldo durante la sesión. */ }
}

export function queueVitaWelcome(accountId: string | null) {
  if (accountId && vitaWelcomeState(accountId) !== 'seen') save(accountId, 'pending');
}

export function acknowledgeVitaWelcome(accountId: string) { save(accountId, 'seen'); }
