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
import { normalizeThreadHistory } from "../../utils/threadHistoryMetadata";
import {
  isLegalConsentError,
  legalConsentOwner,
  requireLegalConsent,
} from "../../utils/legalConsents";
import type { ChatLanguage } from "../../utils/threadApi";
import type {
  ChatResult,
  ChatSendOptions,
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
  if (isLegalConsentError(error)) return error;
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
 * `language` (idioma de la app, 'es' | 'en'): señal explícita por turno que
 * el AI Service usa para responder en el idioma de la app — habilita cambiar
 * de idioma a mitad de conversación. Opcional: con backends anteriores el
 * campo extra se ignora (compatible hacia atrás).
 *
 * `supportsVita` (siempre true): opt-in obligatorio del cliente APP para que
 * el AI Service active el agente Vita (persona, tools y RAG). El backend
 * valida la autorización server-side (JWT `aud=app` + módulo habilitado); sin
 * este campo la ejecución cae en `agentTypeId=base` con `tools_used=[]` y
 * `rag_sources=[]`. Enviarlo no concede acceso por sí mismo.
 *
 * `options.moduleContext` (KAN-167): módulo de origen + resumen acotado del
 * estado visible, ya saneado por el llamador. Campo aditivo: un backend que
 * no lo conozca lo ignora.
 *
 * @throws ApiError — 401 sesión inválida, 502/503 con mensaje amigable,
 *   resto propagado. Nunca retorna null: el llamador muestra error + reintento.
 */
export async function sendChatMessage(
  message: string,
  threadId: string,
  language?: ChatLanguage,
  attachmentIds?: string[],
  signal?: AbortSignal,
  options?: ChatSendOptions,
): Promise<ChatResult> {
  const text = message.trim();
  if (!text) throw new Error("El mensaje no puede estar vacío.");
  if (!threadId.trim()) throw new Error("El threadId no puede estar vacío.");
  const expectedUserId = legalConsentOwner();
  await requireLegalConsent("chat", language, signal);
  try {
    return await apiFetch<ChatResult>(CHAT_PATH, {
      method: "POST",
      ...(attachmentIds?.length ? { expectedUserId, timeoutMs: 65_000 } : {}),
      ...(signal ? { signal } : {}),
      body: {
        message: text,
        threadId,
        supportsVita: true,
        ...(attachmentIds?.length ? { attachmentIds } : {}),
        ...(language ? { language } : {}),
        ...(options?.moduleContext ? { moduleContext: options.moduleContext } : {}),
      },
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
  await requireLegalConsent("chat");
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
    return normalizeThreadHistory(
      await apiFetch<ThreadState>(path, { method: "GET" }),
    );
  } catch (error) {
    throw toFriendlyChatError(error);
  }
}
