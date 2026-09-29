import { Capacitor } from "@capacitor/core";
import { getAccessToken } from "./authApi";
import { getApiBaseUrl } from "./apiBaseUrl";
import type { ChatImageAttachment, ChatSuggestion } from "../types";

/** Mensaje individual del historial del thread (rol user | bot). */
export interface ThreadMessage {
  role: string;
  text: string;
}

/** Resumen del historial de un thread devuelto por el backend .NET (proxy → AI Service). */
export interface ThreadState {
  threadId: string;
  messageCount: number;
  lastMessage: string | null;
  /** ¿Quedan páginas más antiguas por cargar? (paginación server-driven). */
  hasMore?: boolean;
  /** Cursor de la próxima página (offset desde el más nuevo); null = no hay más. */
  nextCursor?: number | null;
  /**
   * Página de mensajes solicitada (cronológica, el más antiguo primero; el
   * backend pagina sobre los mensajes visibles). Ausente/null con backends
   * anteriores: en ese caso el consumidor cae al fallback de `lastMessage`.
   */
  messages?: ThreadMessage[] | null;
}

/**
 * Lee el estado del thread estable del paciente vía el backend .NET
 * (GET /api/v1/threads/{threadId}/messages). El frontend NUNCA llama al
 * AI Service directo: el backend hace de puente (X-Internal-Key vive solo
 * allí). La paginación es server-driven: `limit` (tamaño de página) y
 * `before` (cursor desde el más nuevo; omitido/null = página más reciente).
 * Devuelve null si el thread no existe, el backend falla o la respuesta no
 * es parseable (degradación a chat vacío, nunca romper).
 */
export async function fetchThreadState(
  threadId: string,
  userId: string,
  options: { limit?: number; before?: number | null } = {},
): Promise<ThreadState | null> {
  try {
    const accessToken = getAccessToken();
    const params = new URLSearchParams();
    params.set("userId", userId);
    if (options.limit != null) params.set("limit", String(options.limit));
    if (options.before != null) params.set("before", String(options.before));
    const url = `${getApiBaseUrl()}/api/v1/threads/${encodeURIComponent(threadId)}/messages?${params.toString()}`;
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
  /**
   * Respuesta canónica consolidada del AI Service (evento `done`, change
   * agente-asistente-citas D1). Ausente con backends previos: el consumidor
   * cae a `reply` (tokens acumulados).
   */
  answer?: string | null;
  /** Sugerencias de acción del bot (v1: appointment CTA). Ausente = sin sugerencia. */
  suggestions?: ChatSuggestion[] | null;
}

/**
 * Normaliza de forma tolerante las sugerencias del asistente: el AI Service
 * emite snake_case (`cta_text`) y el DTO TypeScript espera `ctaText`
 * (agente-asistente-citas D2). Entradas malformadas se descartan.
 */
export function normalizeSuggestions(raw: unknown): ChatSuggestion[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatSuggestion[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const ctaText = rec.ctaText ?? rec.cta_text;
    if (typeof rec.type !== "string" || typeof ctaText !== "string") continue;
    out.push({
      type: rec.type,
      ctaText,
      reason: typeof rec.reason === "string" ? rec.reason : null,
      urgency: typeof rec.urgency === "string" ? rec.urgency : undefined,
    });
  }
  return out;
}

/** Cuerpo JSON de chat: texto + adjunto de imagen opcional (D3). */
function chatBody(
  message: string,
  threadId: string,
  image?: ChatImageAttachment,
): string {
  return JSON.stringify({
    message,
    threadId,
    ...(image
      ? { imageData: image.base64, imageMimeType: image.mimeType }
      : {}),
  });
}

/**
 * Envía un mensaje de chat al backend .NET (POST /api/v1/chat).
 * El backend inyecta la identidad del usuario desde el JWT y delega
 * la ejecución al AI Service persistiendo el estado en LangGraph.
 * La imagen opcional viaja en el cuerpo (`imageData`/`imageMimeType`): con
 * backends anteriores los campos extra se ignoran (compatible hacia atrás).
 */
export async function sendChatMessage(
  message: string,
  threadId: string,
  image?: ChatImageAttachment,
): Promise<ChatResult> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: chatBody(message, threadId, image),
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

  const result = (await res.json()) as ChatResult;
  // El .NET devuelve camelCase; la normalización es defensiva para aceptar
  // también passthrough directo del AI Service (snake_case).
  return { ...result, suggestions: normalizeSuggestions(result.suggestions) };
}

export interface LabExamUploadResult {
  batchId: string;
  summary: string;
  measurementCount: number;
  detectedMetrics: string[];
  storageKey?: string | null;
}

/**
 * Sube un archivo de examen de laboratorio (imagen o PDF) al backend .NET
 * (POST /api/v1/lab-exams). El backend valida, comprime, almacena en S3,
 * extrae métricas mediante el AI Service y persiste en clinical_measurements.
 */
export async function uploadLabExam(
  file: File,
  threadId?: string,
  language: "es" | "en" = "es",
): Promise<LabExamUploadResult> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  if (threadId) {
    formData.append("threadId", threadId);
  }
  formData.append("language", language);

  const res = await fetch(`${getApiBaseUrl()}/api/v1/lab-exams`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    let errorMsg = `Error al procesar el examen (${res.status})`;
    try {
      const data = (await res.json()) as Record<string, unknown>;
      if (data) {
        if (typeof data.error === "string") {
          errorMsg = data.error;
        } else if (typeof data.error === "object" && data.error !== null) {
          const errObj = data.error as Record<string, unknown>;
          if (typeof errObj.message === "string") {
            errorMsg = errObj.message;
          }
        } else if (typeof data.message === "string") {
          errorMsg = data.message;
        }
      }
    } catch {
      /* ignore */
    }

    if (!errorMsg || errorMsg.startsWith("Error al procesar")) {
      if (res.status === 422) {
        errorMsg =
          "El archivo no pudo ser procesado o excede el límite permitido.";
      } else if (res.status === 502) {
        errorMsg =
          "El servicio de IA no pudo procesar el examen de laboratorio.";
      } else if (res.status === 500) {
        errorMsg = "No fue posible procesar la solicitud.";
      }
    }

    throw new Error(errorMsg);
  }

  return (await res.json()) as LabExamUploadResult;
}

export interface StreamCallbacks {
  /** Cada fragmento de texto del agente, en orden, para pintado en vivo. */
  onToken?: (token: string) => void;
}

/**
 * Chat con streaming SSE vía el backend .NET (POST /api/v1/chat/stream,
 * relay crudo del AI Service). Lanza si el HTTP falla (el llamador cae al
 * fallback local). Robusto a líneas JSON cortadas entre chunks de red.
 *
 * Consolidación canónica (agente-asistente-citas D1.2): el evento `done`
 * trae `answer` con la respuesta final del turno y `suggestions`; el
 * llamador SOBREESCRIBE el texto acumulado con `answer`, eliminando las
 * pasadas duplicadas que el servidor emitiera alrededor de tool-calls.
 */
export async function streamChatMessage(
  message: string,
  threadId: string,
  callbacks: StreamCallbacks = {},
  image?: ChatImageAttachment,
): Promise<ChatResult> {
  // Nativo + CapacitorHttp: el fetch del WebView está parcheado (HTTP nativo,
  // sin streaming de body) — SSE se degradaría a buffering completo. Fallback
  // C1 (design): chat síncrono en nativo, el texto llega en un solo bloque.
  if (Capacitor.isNativePlatform()) {
    const result = await sendChatMessage(message, threadId, image);
    if (result.reply) callbacks.onToken?.(result.reply);
    return result;
  }

  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: chatBody(message, threadId, image),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Error al enviar mensaje (${res.status})`);
  }

  let reply = "";
  let answer: string | null = null;
  let suggestions: ChatSuggestion[] | null = null;
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
        answer?: string;
        suggestions?: unknown;
      };
      // El AI Service emite {"type":"token","content":"..."}.
      const piece = parsed.content ?? parsed.token;
      if (parsed.type === "token" && piece) {
        reply += piece;
        callbacks.onToken?.(piece);
      } else if (parsed.type === "error" && parsed.error) {
        streamError = parsed.error;
      } else if (
        parsed.type === "done" ||
        parsed.answer != null ||
        parsed.suggestions != null
      ) {
        // Evento de finalización del turno (también viaja thread/execution):
        // captura la respuesta canónica y las sugerencias estructuradas.
        if (typeof parsed.answer === "string") answer = parsed.answer;
        suggestions = normalizeSuggestions(parsed.suggestions) ?? suggestions;
        if (parsed.thread_id) outThreadId = parsed.thread_id;
        if (parsed.execution_id) executionId = parsed.execution_id;
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
  if (!reply && !answer) throw new Error("El agente no respondió.");
  return {
    reply: answer || reply,
    answer,
    threadId: outThreadId,
    executionId,
    suggestions,
  };
}
