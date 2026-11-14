import type { ChatMessage } from "../types";

export interface HistoryMessage {
  role?: string;
  text: string;
  messageId?: string | null;
  channel?: "voice" | "text";
  status?: "final" | "provider_final" | "partial" | "interrupted" | "failed";
  revision?: number;
  source?: string | null;
  voiceSessionId?: string | null;
  providerMessageId?: string | null;
  sourceEventId?: number | null;
}

/** Solo IDs canónicos explícitos reconcilian; ni texto ni response_id son identidad runtime. */
export function mergeChatHistory(previous: ChatMessage[], history: HistoryMessage[], threadId: string, sessionStates: ReadonlyMap<string, boolean> = new Map()): ChatMessage[] {
  const validatedSessions = new Map(previous.filter(message => message.threadId === threadId && message.voiceRuntime && message.voiceSessionId)
    .map(message => [message.voiceSessionId!, Boolean(message.voiceSessionClosed)]));
  sessionStates.forEach((closed, id) => validatedSessions.set(id, closed));
  // El resto del ID es opaco: puede proceder del runtime o de una importación
  // del proveedor. Solo se reconoce el namespace de una sesión ya vinculada.
  const canonicalSession = (item: HistoryMessage) => {
    if (item.channel !== "voice" || !item.messageId) return undefined;
    if (item.voiceSessionId) return validatedSessions.has(item.voiceSessionId) ? item.voiceSessionId : undefined;
    return [...validatedSessions.keys()].find(id => item.messageId!.startsWith(`voice:${id}:`));
  };
  const represented = new Set(history.map(canonicalSession).filter(Boolean));
  // No inferir utterances a partir de event_id, ordinal o texto. Durante una
  // sesión validada se muestra el SDK; al cerrarla, el snapshot canónico toma
  // la sesión completa (también cuando el resto llega por paginación).
  const remaining = previous.filter(message => message.id !== "welcome" && !(message.voiceRuntime
    && validatedSessions.get(message.voiceSessionId ?? "") === true && !message.messageId && represented.has(message.voiceSessionId ?? "")));
  const ordered: ChatMessage[] = [];
  for (const item of history) {
    // Sin ID canónico no sustituir ni duplicar un grupo provisional vinculado.
    if (!item.messageId && item.voiceSessionId && validatedSessions.has(item.voiceSessionId)
      && previous.some(message => message.voiceSessionId === item.voiceSessionId && !message.messageId)) continue;
    const session = canonicalSession(item);
    if (session && validatedSessions.get(session) === false) continue;
    const id = item.messageId || undefined;
    const existing = id ? [...ordered, ...remaining].find(message => message.role === (item.role === "user" ? "user" : "bot")
      && (message.id === id || message.messageId === id)) : undefined;
    const canonical: ChatMessage = {
      ...existing, ...item, id: id ?? crypto.randomUUID(), messageId: id,
      role: item.role === "user" ? "user" : "bot", time: existing?.time ?? "", threadId,
      delivery: item.status === "interrupted" ? "interrupted" : item.status === "partial" ? "streaming" : item.status === "failed" ? "failed" : "received",
    };
    const message = existing && (existing.revision ?? 0) > (item.revision ?? 0) ? existing : canonical;
    const index = ordered.findIndex(value => value.id === message.id);
    if (index >= 0) ordered[index] = message; else ordered.push(message);
    if (existing) {
      const position = remaining.indexOf(existing);
      if (position >= 0) remaining.splice(position, 1);
    }
  }
  return [...ordered, ...remaining];
}
