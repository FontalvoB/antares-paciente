/** Metadatos aditivos: ausentes en servidores anteriores a la retención mensual. */
export interface ThreadHistoryMetadata {
  historyRevision?: number;
  clearedAt?: string | null;
  resetReason?: "manual" | "monthly" | null;
}

export interface ClearedThread extends ThreadHistoryMetadata {
  threadId: string;
  historyRevision: number;
  clearedAt: string;
  resetReason: "manual" | "monthly";
}

/** Acepta DTO público camelCase y passthrough snake_case sin inventar revisión 0. */
export function normalizeThreadHistory<T extends { threadId: string }>(raw: T): T & ThreadHistoryMetadata {
  const data = raw as T & Record<string, unknown>;
  const revision = data.historyRevision ?? data.history_revision;
  const clearedAt = data.clearedAt !== undefined ? data.clearedAt : data.cleared_at;
  const reason = data.resetReason !== undefined ? data.resetReason : data.reset_reason;
  const fields = { ...raw } as Record<string, unknown>;
  delete fields.historyRevision; delete fields.clearedAt; delete fields.resetReason;
  return {
    ...fields,
    threadId: (data.threadId ?? data.thread_id) as string,
    ...(Number.isSafeInteger(revision) && Number(revision) >= 0 ? { historyRevision: Number(revision) } : {}),
    ...(clearedAt === null || typeof clearedAt === "string" ? { clearedAt } : {}),
    ...(reason === null || reason === "manual" || reason === "monthly" ? { resetReason: reason } : {}),
  } as T & ThreadHistoryMetadata;
}
