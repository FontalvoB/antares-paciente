/**
 * Tests unitarios del hook `useChatAssistant` (Fase 9, móvil).
 *
 * Se mockea la frontera del servicio (`chat-service`) con `renderHook` +
 * `act`: estado inicial vacío/hidratado, envío optimista con respuesta del
 * bot (executionId + suggestions), error de red con reintento sin duplicar
 * al usuario, paginación histórica con avance de cursor y envío de feedback.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const sendChatMessageMock = vi.fn();
const sendChatFeedbackMock = vi.fn();
const fetchThreadHistoryMock = vi.fn();

vi.mock("../../services/chat/chat-service", () => ({
  sendChatMessage: (...args: unknown[]) => sendChatMessageMock(...args),
  sendChatFeedback: (...args: unknown[]) => sendChatFeedbackMock(...args),
  fetchThreadHistory: (...args: unknown[]) => fetchThreadHistoryMock(...args),
}));

import { useChatAssistant } from "../useChatAssistant";
import type { ChatResult, ThreadState } from "../../services/chat/types";

beforeEach(() => {
  sendChatMessageMock.mockReset();
  sendChatFeedbackMock.mockReset();
  fetchThreadHistoryMock.mockReset();
});

afterEach(cleanup);

describe("useChatAssistant — estado inicial", () => {
  it("arranca vacío sin llamadas a la red", () => {
    const { result } = renderHook(() => useChatAssistant("thread-1"));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoadingOlder).toBe(false);
    expect(sendChatMessageMock).not.toHaveBeenCalled();
    expect(fetchThreadHistoryMock).not.toHaveBeenCalled();
  });

  it("acepta mensajes iniciales (hidratación)", () => {
    const { result } = renderHook(() =>
      useChatAssistant("thread-1", {
        initialMessages: [{ id: "m-1", role: "bot", text: "Hola" }],
      }),
    );
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.text).toBe("Hola");
  });
});

describe("useChatAssistant — envío optimista y respuesta", () => {
  it("pinta al usuario, marca generando y agrega al bot con executionId + CTA", async () => {
    let resolveReply!: (value: ChatResult) => void;
    sendChatMessageMock.mockImplementationOnce(
      () =>
        new Promise<ChatResult>((resolve) => {
          resolveReply = resolve;
        }),
    );
    const { result } = renderHook(() => useChatAssistant("thread-1"));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.sendMessage("Hola");
    });

    // Optimista: usuario visible y generando sin esperar la red.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.role).toBe("user");
    expect(result.current.messages[0]?.text).toBe("Hola");
    expect(result.current.isGenerating).toBe(true);
    expect(result.current.error).toBeNull();
    expect(sendChatMessageMock).toHaveBeenCalledWith("Hola", "thread-1");

    await act(async () => {
      resolveReply({
        reply: "Hola, soy Antares AI.",
        threadId: "thread-1",
        executionId: "exec-1",
        suggestions: [{ type: "appointment", ctaText: "Agendar cita" }],
      });
      await pending;
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]?.role).toBe("bot");
    expect(result.current.messages[1]?.text).toBe("Hola, soy Antares AI.");
    expect(result.current.messages[1]?.executionId).toBe("exec-1");
    expect(result.current.messages[1]?.suggestions?.[0]?.ctaText).toBe(
      "Agendar cita",
    );
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("ignora texto vacío sin llamar a la red", async () => {
    const { result } = renderHook(() => useChatAssistant("thread-1"));
    await act(async () => {
      await result.current.sendMessage("   ");
    });
    expect(result.current.messages).toEqual([]);
    expect(sendChatMessageMock).not.toHaveBeenCalled();
  });
});

describe("useChatAssistant — error y reintento", () => {
  it("error de red: conserva al usuario, registra error y apaga generando", async () => {
    sendChatMessageMock.mockRejectedValueOnce(
      new Error(
        "El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
      ),
    );
    const { result } = renderHook(() => useChatAssistant("thread-1"));

    await act(async () => {
      await result.current.sendMessage("Hola");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.role).toBe("user");
    expect(result.current.error).toBe(
      "El asistente no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
    );
    expect(result.current.isGenerating).toBe(false);
  });

  it("retryLastMessage reintenta sin duplicar al usuario y limpia el error", async () => {
    sendChatMessageMock.mockRejectedValueOnce(new Error("Fallo de red"));
    const { result } = renderHook(() => useChatAssistant("thread-1"));
    await act(async () => {
      await result.current.sendMessage("Hola");
    });
    expect(result.current.error).toBe("Fallo de red");

    sendChatMessageMock.mockResolvedValueOnce({
      reply: "Ya volví.",
      threadId: "thread-1",
      executionId: "exec-2",
    });
    await act(async () => {
      await result.current.retryLastMessage();
    });

    expect(sendChatMessageMock).toHaveBeenCalledTimes(2);
    expect(sendChatMessageMock).toHaveBeenLastCalledWith("Hola", "thread-1");
    expect(result.current.messages).toHaveLength(2);
    expect(
      result.current.messages.filter((m) => m.role === "user"),
    ).toHaveLength(1);
    expect(result.current.messages[1]?.text).toBe("Ya volví.");
    expect(result.current.error).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it("retryLastMessage sin error pendiente no llama a la red", async () => {
    const { result } = renderHook(() => useChatAssistant("thread-1"));
    await act(async () => {
      await result.current.retryLastMessage();
    });
    expect(sendChatMessageMock).not.toHaveBeenCalled();
  });
});

describe("useChatAssistant — paginación histórica", () => {
  it("antepone el historial y avanza el cursor server-driven", async () => {
    const page1: ThreadState = {
      threadId: "thread-1",
      messageCount: 30,
      lastMessage: null,
      hasMore: true,
      nextCursor: 10,
      messages: [
        { role: "user", text: "Antiguo 1" },
        { role: "bot", text: "Antiguo 2" },
      ],
    };
    fetchThreadHistoryMock.mockResolvedValueOnce(page1);
    const { result } = renderHook(() =>
      useChatAssistant("thread-1", {
        initialMessages: [{ id: "m-9", role: "bot", text: "Reciente" }],
      }),
    );

    await act(async () => {
      await result.current.loadOlderMessages();
    });

    expect(fetchThreadHistoryMock).toHaveBeenCalledWith(
      "thread-1",
      10,
      undefined,
    );
    expect(result.current.messages.map((m) => m.text)).toEqual([
      "Antiguo 1",
      "Antiguo 2",
      "Reciente",
    ]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoadingOlder).toBe(false);

    fetchThreadHistoryMock.mockResolvedValueOnce({
      threadId: "thread-1",
      messageCount: 30,
      lastMessage: null,
      hasMore: false,
      nextCursor: null,
      messages: [{ role: "bot", text: "Más antiguo" }],
    });
    await act(async () => {
      await result.current.loadOlderMessages();
    });

    expect(fetchThreadHistoryMock).toHaveBeenLastCalledWith("thread-1", 10, 10);
    expect(result.current.messages[0]?.text).toBe("Más antiguo");
    expect(result.current.hasMore).toBe(false);
  });

  it("fallo de paginación: registra error y conserva la lista", async () => {
    fetchThreadHistoryMock.mockRejectedValueOnce(new Error("Fallo de red"));
    const { result } = renderHook(() =>
      useChatAssistant("thread-1", {
        initialMessages: [{ id: "m-1", role: "bot", text: "Hola" }],
      }),
    );

    await act(async () => {
      await result.current.loadOlderMessages();
    });

    expect(result.current.error).toBe("Fallo de red");
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.isLoadingOlder).toBe(false);
  });
});

describe("useChatAssistant — feedback", () => {
  it("delega executionId + rating + comentario al servicio", async () => {
    sendChatFeedbackMock.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useChatAssistant("thread-1"));

    await act(async () => {
      await result.current.sendFeedback("exec-1", 5, "Muy útil");
    });

    expect(sendChatFeedbackMock).toHaveBeenCalledWith({
      executionId: "exec-1",
      rating: 5,
      comment: "Muy útil",
    });
    expect(result.current.error).toBeNull();
  });
});
