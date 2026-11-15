/** Intención en memoria: nunca publica y solo puede consumirla la misma sesión. */
export interface CommunityShareDraft { text: string; file?: File | null }
let pending: CommunityShareDraft & { owner: string; at: number } | null = null

export function queueCommunityShareDraft(owner: string, text: string, file?: File | null) {
  pending = owner && text.trim() ? { owner, text: text.trim(), file, at: Date.now() } : null
}

export function takeCommunityShareDraft(owner: string, now = Date.now()): string | null {
  return takeCommunityShareDraftContent(owner,now)?.text ?? null
}

export function takeCommunityShareDraftContent(owner: string, now = Date.now()): CommunityShareDraft | null {
  const draft = pending
  pending = null
  return draft && draft.owner === owner && now - draft.at >= 0 && now - draft.at < 5 * 60_000 ? {text:draft.text,file:draft.file} : null
}
