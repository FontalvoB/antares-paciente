/**
 * Servicio modular de chat IA — Fase 9 (Asistente Clínico Unificado).
 *
 * El paciente conversa con "Antares AI" en un único hilo longitudinal
 * continuo; el backend .NET hace de puente (X-Internal-Key vive solo allí)
 * y delega la ejecución al AI Service. El frontend NUNCA llama al AI Service
 * directo: todo pasa por el Gateway (:5080) vía `apiFetch` (Bearer + refresh
 * single-flight + timeout + ProblemDetails → ApiError).
 *
 * - `sendChatMessage` → POST /api/v1/chat
 * - `sendChatFeedback` → POST /api/v1/chat/feedback
 * - `fetchThreadHistory` → GET /api/v1/threads/{threadId}/messages
 *
 * Errores: 401 (sesión inválida) se propaga como ApiError para que el puente
 * de sesión redirija al login; 502/503 (AI Service caído) se traducen a un
 * mensaje amigable en español; el resto se propaga intacto.
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { apiFetch, ApiError } from "../../utils/apiClient";
import type {
  ChatResult,
  FeedbackRequest,
  FeedbackResult,
  ThreadState,
} from "./types";

const CHAT_PATH = "/api/v1/chat";
const CHAT_FEEDBACK_PATH = "/api/v1/chat/feedback";

/** Mensaje amigable cuando el asistente no está disponible (502/503). */
export const CHAT_UNAVAILABLE_MESSAGE =
  "El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.";

/**
 * Traduce 502/503 a mensaje amigable en español. Cualquier otro error
 * (401 sesión inválida, 4xx de negocio, timeout, red) se propaga intacto.
 */
function toFriendlyChatError(error: unknown): unknown {
  if (
    error instanceof ApiError &&
    (error.status === 502 || error.status === 503)
  ) {
    return new ApiError({
      message: CHAT_UNAVAILABLE_MESSAGE,
      status: error.status,
      title: error.title,
      detail: error.detail,
      code: error.code,
      correlationId: error.correlationId,
      errors: error.errors,
      errorType: error.errorType,
    });
  }
  return error;
}

/**
 * Envía un mensaje al asistente clínico unificado.
 *
 * @throws ApiError — 401 sesión inválida, 502/503 con mensaje amigable,
 *   resto propagado. Nunca retorna null: el llamador muestra error + reintento.
 */
export async function sendChatMessage(
  message: string,
  threadId: string,
): Promise<ChatResult> {
  const text = message.trim();
  if (!text) throw new Error("El mensaje no puede estar vacío.");
  if (!threadId.trim()) throw new Error("El threadId no puede estar vacío.");
  try {
    return await apiFetch<ChatResult>(CHAT_PATH, {
      method: "POST",
      body: { message: text, threadId },
    });
  } catch (error) {
    throw toFriendlyChatError(error);
  }
}

/**
 * Registra la calificación de una respuesta del bot enlazada a su
 * `executionId` y `threadId` (1-5 estrellas; pulgar arriba = 5, pulgar
 * abajo = 1).
 *
 * @throws ApiError — 401 sesión inválida, 502/503 con mensaje amigable,
 *   resto propagado. Error de validación local via `Error` sin status.
 */
export async function sendChatFeedback(
  feedback: FeedbackRequest,
): Promise<FeedbackResult> {
  if (!feedback.executionId.trim()) {
    throw new Error("El executionId no puede estar vacío.");
  }
  if (!feedback.threadId.trim()) {
    throw new Error("El threadId no puede estar vacío.");
  }
  if (
    !Number.isInteger(feedback.rating) ||
    feedback.rating < 1 ||
    feedback.rating > 5
  ) {
    throw new Error("La calificación debe ser un entero entre 1 y 5.");
  }
  try {
    return await apiFetch<FeedbackResult>(CHAT_FEEDBACK_PATH, {
      method: "POST",
      body: {
        executionId: feedback.executionId,
        threadId: feedback.threadId,
        rating: feedback.rating,
        ...(feedback.comment != null ? { comment: feedback.comment } : {}),
      },
    });
  } catch (error) {
    throw toFriendlyChatError(error);
  }
}

/**
 * Lee una página del hilo longitudinal continuo (paginación server-driven:
 * `limit` = tamaño de página, `before` = cursor desde el más nuevo;
 * omitidos = página más reciente).
 *
 * @throws ApiError — 401 sesión inválida, 502/503 con mensaje amigable,
 *   resto propagado. No degrada a null: el llamador decide (vacío honesto o
 *   error + reintento).
 */
export async function fetchThreadHistory(
  threadId: string,
  limit?: number,
  before?: number,
): Promise<ThreadState> {
  if (!threadId.trim()) throw new Error("El threadId no puede estar vacío.");
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (before != null) params.set("before", String(before));
  const query = params.toString();
  const path =
    `/api/v1/threads/${encodeURIComponent(threadId)}/messages` +
    (query ? `?${query}` : "");
  try {
    return await apiFetch<ThreadState>(path, { method: "GET" });
  } catch (error) {
    throw toFriendlyChatError(error);
  }
}
