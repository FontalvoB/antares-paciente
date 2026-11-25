/**
 * DTOs del módulo de chat IA (Fase 9, móvil).
 *
 * Wire camelCase del backend .NET (ASP.NET default). El paciente se resuelve
 * en el backend desde el JWT (anti-IDOR): el cliente nunca envía ids de
 * usuario. Todos los campos de respuesta son tolerantes (opcionales con
 * defaults) para no romper ante evolución del contrato (R7.1).
 *
 * verbatimModuleSyntax: importar estos tipos con `import type`.
 */

import type { HistoryMessage } from "../../utils/chatHistory";
import type { ThreadHistoryMetadata } from "../../utils/threadHistoryMetadata";
import type { ChatSuggestion as SharedChatSuggestion } from "../../types";
import type { VitaAttachmentReading } from "./vita-attachments-service";
import type { VitaAction } from "../../utils/vitaActions";

/** Mensaje individual del historial del thread (rol user | bot). */
export interface ChatMessage extends HistoryMessage {
  role: string;
  text: string;
}

/** Sugerencia de acción emitida por el bot (v1: CTA de cita). */
export type ChatSuggestion = SharedChatSuggestion;

/** Respuesta del backend al enviar un mensaje (POST /api/v1/chat). */
export interface ChatResult {
  reply: string;
  threadId: string;
  executionId?: string;
  agent?: string;
  /** Respuesta canónica del evento SSE, si el servidor la emite. */
  answer?: string | null;
  actions?: VitaAction[];
  attachments?: VitaAttachmentReading[] | null;
  /** Sugerencias de acción del bot. Ausente = sin sugerencia. */
  suggestions?: ChatSuggestion[] | null;
}

/** Calificación de una respuesta del bot (POST /api/v1/chat/feedback). */
export interface FeedbackRequest {
  /** Id de ejecución de la respuesta calificada (viene en `ChatResult`). */
  executionId: string;
  /** Id del hilo al que pertenece la respuesta calificada. */
  threadId: string;
  /** Calificación 1-5 (5 = útil, 1 = no útil). */
  rating: number;
  /** Comentario opcional del paciente. */
  comment?: string;
}

/** Respuesta del backend al registrar el feedback. */
export interface FeedbackResult {
  ok: boolean;
}

/** Página del historial de un thread (GET /api/v1/threads/{id}/messages). */
export interface ThreadState extends ThreadHistoryMetadata {
  threadId: string;
  messageCount: number;
  lastMessage: string | null;
  /** ¿Quedan páginas más antiguas por cargar? (paginación server-driven). */
  hasMore?: boolean;
  /** Cursor de la próxima página (offset desde el más nuevo); null = fin. */
  nextCursor?: number | null;
  /**
   * Página de mensajes solicitada (cronológica, el más antiguo primero).
   * Ausente/null con backends anteriores: el consumidor cae al fallback de
   * `lastMessage`.
   */
  messages?: ChatMessage[] | null;
}

/**
 * Contexto acotado del módulo desde el que se abre Vita (KAN-167).
 *
 * Solo viaja un identificador de módulo y un resumen corto del estado visible
 * (números, banderas y etiquetas). Nunca datos personales: nombre, correo,
 * teléfono, documento, dirección ni identificadores de paciente. El saneado
 * vive en `features/wellness/vita/context.ts`; el backend puede ignorar el
 * campo sin romper el contrato (propiedad opcional y aditiva).
 */
export interface ChatModuleContext {
  module: string;
  summary: Record<string, string | number | boolean>;
}

/** Opciones adicionales y opcionales de un turno de chat. */
export interface ChatSendOptions {
  moduleContext?: ChatModuleContext;
}
