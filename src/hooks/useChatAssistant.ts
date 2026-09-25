/**
 * Hook del asistente clínico unificado — Fase 9 (Antares AI), móvil.
 *
 * Envuelve `src/services/chat/chat-service.ts` con estado de UI listo para
 * consumir desde `ChatPage` (hilo longitudinal continuo con memoria y
 * paginación progresiva server-driven):
 *
 * - `sendMessage`: envío optimista (el mensaje del usuario se pinta de
 *   inmediato), bandera `isGenerating` ("escribiendo...") y la respuesta del
 *   bot con `executionId` + `suggestions` para `ChatFeedbackAction`/CTA.
 *   Ante fallo de red el mensaje del usuario se conserva y `error` guarda el
 *   mensaje amigable (502/503) con `retryLastMessage` para reintentar.
 * - `loadOlderMessages`: antepone la página anterior (`fetchThreadHistory`
 *   con cursor `before`); con backends sin `messages` cae al `lastMessage`.
 * - `sendFeedback`: delega a `sendChatFeedback` enlazado al `executionId`.
 *
 * El paciente se resuelve en el backend desde el JWT (anti-IDOR): el hook
 * solo maneja `threadId`. Al cambiar de hilo el estado se reinicia (el
 * consumidor también puede remontar con `key={threadId}`).
 *
 * verbatimModuleSyntax: type imports con `import type`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchThreadHistory,
  sendChatFeedback,
  sendChatMessage,
} from "../services/chat/chat-service";
import type { ChatMessage, ChatSuggestion } from "../services/chat/types";

/**
 * Mensaje de la conversación con metadatos de UI. Extiende el `ChatMessage`
 * del servicio (wire `{ role, text }`) con id local estable para `key` de
 * React, el `executionId` del bot (feedback + trazabilidad) y sus
 * `suggestions` (CTA de cita). Asignable a `ChatMessage[]`.
 */
export interface AssistantMessage extends ChatMessage {
  /** Id local estable para `key` de React. */
  id: string;
  role: "user" | "bot";
  /** Id de ejecución de la respuesta del bot (ausente en mensajes user). */
  executionId?: string;
  /** Sugerencias de acción del bot. Ausente = sin sugerencia. */
  suggestions?: ChatSuggestion[] | null;
}

export interface UseChatAssistantOptions {
  /** Tamaño de página del historial (default 10, igual que `ChatPage`). */
  pageSize?: number;
  /** Mensajes con los que arranca la conversación (hidratación). */
  initialMessages?: AssistantMessage[];
}

const DEFAULT_PAGE_SIZE = 10;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "No fue posible procesar la solicitud.";
}

function toRole(role: string): "user" | "bot" {
  return role === "user" ? "user" : "bot";
}

export function useChatAssistant(
  threadId: string,
  options: UseChatAssistantOptions = {},
) {
  const { pageSize = DEFAULT_PAGE_SIZE, initialMessages = [] } = options;
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const threadRef = useRef(threadId);
  const initialRef = useRef(initialMessages);
  const idRef = useRef(0);
  const pendingRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const cursorRef = useRef<number | null>(null);
  const exhaustedRef = useRef(false);
  const lastUserTextRef = useRef<string | null>(null);

  // Cambio de hilo: la conversación anterior no pertenece al hilo nuevo.
  useEffect(() => {
    if (threadRef.current === threadId) return;
    threadRef.current = threadId;
    idRef.current = 0;
    pendingRef.current = 0;
    loadingOlderRef.current = false;
    cursorRef.current = null;
    exhaustedRef.current = false;
    lastUserTextRef.current = null;
    setMessages(initialRef.current);
    setIsGenerating(false);
    setError(null);
    setHasMore(false);
    setIsLoadingOlder(false);
  }, [threadId]);

  /**
   * Vuelo de red compartido por `sendMessage` y `retryLastMessage`: pide la
   * respuesta del bot y la agrega. El mensaje del usuario ya está en la
   * lista (optimista o previo); ante fallo solo se registra `error` para
   * que la UI muestre error + reintento sin perder la conversación.
   */
  const requestReply = useCallback(async (content: string): Promise<void> => {
    pendingRef.current += 1;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await sendChatMessage(content, threadRef.current);
      idRef.current += 1;
      const botMessage: AssistantMessage = {
        id: `chat-${idRef.current}`,
        role: "bot",
        text: result.reply,
        ...(result.executionId ? { executionId: result.executionId } : {}),
        ...(result.suggestions != null
          ? { suggestions: result.suggestions }
          : {}),
      };
      setMessages((prev) => [...prev, botMessage]);
      lastUserTextRef.current = null;
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      pendingRef.current -= 1;
      if (pendingRef.current <= 0) {
        pendingRef.current = 0;
        setIsGenerating(false);
      }
    }
  }, []);

  /**
   * Envía un mensaje con pintado optimista del usuario. Vacío = no-op (sin
   * llamada a la red). Acepta envíos concurrentes: `isGenerating` se apaga
   * cuando termina el último vuelo en curso.
   */
  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const content = text.trim();
      if (!content) return;
      lastUserTextRef.current = content;
      idRef.current += 1;
      const userMessage: AssistantMessage = {
        id: `chat-${idRef.current}`,
        role: "user",
        text: content,
      };
      setMessages((prev) => [...prev, userMessage]);
      await requestReply(content);
    },
    [requestReply],
  );

  /**
   * Reintenta la última respuesta fallida sin duplicar el mensaje del
   * usuario (ya está en la lista). Sin error pendiente o con un vuelo en
   * curso = no-op.
   */
  const retryLastMessage = useCallback(async (): Promise<void> => {
    const lastText = lastUserTextRef.current;
    if (!lastText || pendingRef.current > 0) return;
    await requestReply(lastText);
  }, [requestReply]);

  /**
   * Registra la calificación de una respuesta del bot. Ante fallo se
   * registra `error` y se propaga para que el llamador decida (reintento
   * silencioso o aviso).
   */
  const sendFeedback = useCallback(
    async (
      executionId: string,
      rating: number,
      comment?: string,
    ): Promise<void> => {
      try {
        await sendChatFeedback(
          comment != null
            ? { executionId, rating, comment }
            : { executionId, rating },
        );
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [],
  );

  /**
   * Carga la página anterior del hilo y la antepone (paginación
   * server-driven: `limit` + cursor `before`). La primera llamada pide la
   * página más reciente; las siguientes usan el cursor devuelto. La
   * paginación queda intacta ante fallos para reintentar en el próximo
   * scroll; cuando el servidor indica fin no se vuelve a pedir.
   */
  const loadOlderMessages = useCallback(async (): Promise<void> => {
    if (loadingOlderRef.current || exhaustedRef.current) return;
    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      const state = await fetchThreadHistory(
        threadRef.current,
        pageSize,
        cursorRef.current ?? undefined,
      );
      const page = (state.messages ?? []).filter((m) =>
        Boolean(m.text && m.text.trim().length > 0),
      );
      if (page.length > 0) {
        const older: AssistantMessage[] = page.map((m) => {
          idRef.current += 1;
          return {
            id: `hist-${idRef.current}`,
            role: toRole(m.role),
            text: m.text,
          };
        });
        setMessages((prev) => [...older, ...prev]);
        const more = Boolean(state.hasMore);
        setHasMore(more);
        cursorRef.current = state.nextCursor ?? null;
        if (!more) exhaustedRef.current = true;
      } else if (state.lastMessage && state.lastMessage.trim().length > 0) {
        // Backends anteriores sin `messages`: fallback al último mensaje.
        idRef.current += 1;
        const fallback: AssistantMessage = {
          id: `hist-${idRef.current}`,
          role: "bot",
          text: state.lastMessage,
        };
        setMessages((prev) => [fallback, ...prev]);
        setHasMore(false);
        exhaustedRef.current = true;
      } else if ((state.messageCount ?? 0) === 0) {
        // Respuesta degradada (200 con historial vacío tras fallo del AI
        // Service): no significa "fin"; se conserva la paginación para
        // reintentar sin marcar fin.
      } else {
        const more = Boolean(state.hasMore);
        setHasMore(more);
        cursorRef.current = state.nextCursor ?? null;
        if (!more) exhaustedRef.current = true;
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [pageSize]);

  return {
    messages,
    isGenerating,
    error,
    hasMore,
    isLoadingOlder,
    sendMessage,
    sendFeedback,
    loadOlderMessages,
    retryLastMessage,
  };
}
