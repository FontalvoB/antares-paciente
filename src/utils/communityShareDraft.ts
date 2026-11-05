/** Intención en memoria: nunca publica y solo puede consumirla la misma sesión. */
let pending: { owner: string; text: string; at: number } | null = null

export function queueCommunityShareDraft(owner: string, text: string) {
  pending = owner && text.trim() ? { owner, text: text.trim(), at: Date.now() } : null
}

export function takeCommunityShareDraft(owner: string, now = Date.now()): string | null {
  const draft = pending
  pending = null
  return draft && draft.owner === owner && now - draft.at >= 0 && now - draft.at < 5 * 60_000 ? draft.text : null
}
