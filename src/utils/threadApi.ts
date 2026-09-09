import { getAccessToken } from "./authApi";
import { getApiBaseUrl } from "./apiBaseUrl";

/** Resumen del historial de un thread devuelto por el backend .NET (proxy → AI Service). */
export interface ThreadState {
  threadId: string;
  messageCount: number;
  lastMessage: string | null;
}

/**
 * Lee el estado del thread estable del paciente vía el backend .NET
 * (GET /api/v1/threads/{threadId}/messages). El frontend NUNCA llama al
 * AI Service directo: el backend hace de puente (X-Internal-Key vive solo
 * allí). Devuelve null si el thread no existe, el backend falla o la
 * respuesta no es parseable (degradación a chat vacío, nunca romper).
 */
export async function fetchThreadState(
  threadId: string,
  userId: string,
): Promise<ThreadState | null> {
  try {
    const accessToken = getAccessToken();
    const url = `${getApiBaseUrl()}/api/v1/threads/${encodeURIComponent(threadId)}/messages?userId=${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ThreadState;
    return data;
  } catch (error) {
    console.warn("[thread] No se pudo cargar el historial del thread:", error);
    return null;
  }
}

export interface ChatResult {
  reply: string;
  threadId: string;
  executionId?: string;
  agent?: string;
}

/**
 * Envía un mensaje de chat al backend .NET (POST /api/v1/chat).
 * El backend inyecta la identidad del usuario desde el JWT y delega
 * la ejecución al AI Service persistiendo el estado en LangGraph.
 */
export async function sendChatMessage(
  message: string,
  threadId: string,
): Promise<ChatResult> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      threadId,
    }),
  });

  if (!res.ok) {
    let errorMsg = `Error al enviar mensaje (${res.status})`;
    try {
      const data = (await res.json()) as Record<string, unknown>;
      if (data && typeof data.error === "string") errorMsg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }

  return (await res.json()) as ChatResult;
}

export interface StreamCallbacks {
  /** Cada fragmento de texto del agente, en orden, para pintado en vivo. */
  onToken?: (token: string) => void;
}

/**
 * Chat con streaming SSE vía el backend .NET (POST /api/v1/chat/stream,
 * relay crudo del AI Service). Lanza si el HTTP falla (el llamador cae al
 * fallback local). Robusto a líneas JSON cortadas entre chunks de red.
 */
export async function streamChatMessage(
  message: string,
  threadId: string,
  callbacks: StreamCallbacks = {},
): Promise<ChatResult> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, threadId }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Error al enviar mensaje (${res.status})`);
  }

  let reply = "";
  let outThreadId = threadId;
  let executionId: string | undefined;
  let streamError: string | null = null;
  let pending = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("event: ")) return;
    if (!trimmed.startsWith("data: ")) return;
    const data = trimmed.slice("data: ".length);
    if (!data || data === "{}") return;
    try {
      const parsed = JSON.parse(data) as {
        type?: string;
        token?: string;
        content?: string;
        error?: string;
        thread_id?: string;
        execution_id?: string;
      };
      // El AI Service emite {"type":"token","content":"..."}.
      const piece = parsed.content ?? parsed.token;
      if (parsed.type === "token" && piece) {
        reply += piece;
        callbacks.onToken?.(piece);
      } else if (parsed.type === "error" && parsed.error) {
        streamError = parsed.error;
      } else if (parsed.thread_id || parsed.execution_id) {
        if (parsed.thread_id) outThreadId = parsed.thread_id;
        if (parsed.execution_id) executionId = parsed.execution_id;
      }
    } catch {
      /* data no-JSON: se ignora */
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    if (pending.trim()) handleLine(pending);
  } finally {
    reader.releaseLock();
  }

  if (streamError) throw new Error(streamError);
  if (!reply) throw new Error("El agente no respondió.");
  return { reply, threadId: outThreadId, executionId };
}
