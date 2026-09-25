/**
 * Tests unitarios del servicio modular de chat (Fase 9, móvil).
 *
 * Se mockea `apiFetch` (frontera tipada hacia el Gateway) en vez del `fetch`
 * global: el servicio delega auth/timeout/refresh/ProblemDetails al cliente
 * compartido y solo mapea 502/503 a mensaje amigable. Cobertura: éxito,
 * validación local, 401 sesión inválida (se propaga) y 502/503 (mensaje
 * amigable en español).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const apiFetchMock = vi.fn();

vi.mock("../../../utils/apiClient", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;
    readonly title?: string;
    readonly detail?: string;
    readonly code?: string;
    readonly correlationId?: string;
    readonly errors?: Record<string, string[]>;
    readonly errorType: "TIMEOUT" | "network" | "server" | "business";
    constructor(opts: {
      message: string;
      status?: number;
      title?: string;
      detail?: string;
      code?: string;
      correlationId?: string;
      errors?: Record<string, string[]>;
      errorType?: "TIMEOUT" | "network" | "server" | "business";
    }) {
      super(opts.message);
      this.name = "ApiError";
      this.status = opts.status ?? 0;
      this.title = opts.title;
      this.detail = opts.detail;
      this.code = opts.code;
      this.correlationId = opts.correlationId;
      this.errors = opts.errors;
      this.errorType = opts.errorType ?? "server";
    }
  },
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { ApiError } from "../../../utils/apiClient";
import {
  CHAT_UNAVAILABLE_MESSAGE,
  fetchThreadHistory,
  sendChatFeedback,
  sendChatMessage,
} from "../chat-service";

describe("sendChatMessage — POST /api/v1/chat", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("envía message + threadId y devuelve la respuesta del bot", async () => {
    apiFetchMock.mockResolvedValue({
      reply: "Hola, soy Antares AI.",
      threadId: "thread-1",
      executionId: "exec-1",
      agent: "clinico",
    });
    const result = await sendChatMessage("Hola", "thread-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/chat", {
      method: "POST",
      body: { message: "Hola", threadId: "thread-1" },
    });
    expect(result.reply).toBe("Hola, soy Antares AI.");
    expect(result.executionId).toBe("exec-1");
  });

  it("rechaza mensaje vacío sin llamar a la red", async () => {
    await expect(sendChatMessage("   ", "thread-1")).rejects.toThrow(
      "El mensaje no puede estar vacío.",
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("502 indisponibilidad del AI Service → mensaje amigable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Bad Gateway", status: 502 }),
    );
    await expect(sendChatMessage("Hola", "thread-1")).rejects.toThrow(
      CHAT_UNAVAILABLE_MESSAGE,
    );
  });

  it("503 mantenimiento → mensaje amigable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Service Unavailable", status: 503 }),
    );
    await expect(sendChatMessage("Hola", "thread-1")).rejects.toThrow(
      CHAT_UNAVAILABLE_MESSAGE,
    );
  });

  it("401 sesión inválida se propaga sin enmascarar", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Unauthorized", status: 401 }),
    );
    await expect(sendChatMessage("Hola", "thread-1")).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("sendChatFeedback — POST /api/v1/chat/feedback", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("envía executionId + rating y devuelve ok", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });
    const result = await sendChatFeedback({ executionId: "exec-1", rating: 5 });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/chat/feedback", {
      method: "POST",
      body: { executionId: "exec-1", rating: 5 },
    });
    expect(result.ok).toBe(true);
  });

  it("incluye el comentario opcional cuando se informa", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });
    await sendChatFeedback({
      executionId: "exec-1",
      rating: 4,
      comment: "Muy clara la explicación.",
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/chat/feedback", {
      method: "POST",
      body: {
        executionId: "exec-1",
        rating: 4,
        comment: "Muy clara la explicación.",
      },
    });
  });

  it("rechaza rating fuera de 1-5 sin llamar a la red", async () => {
    await expect(
      sendChatFeedback({ executionId: "exec-1", rating: 0 }),
    ).rejects.toThrow("La calificación debe ser un entero entre 1 y 5.");
    await expect(
      sendChatFeedback({ executionId: "exec-1", rating: 6 }),
    ).rejects.toThrow("La calificación debe ser un entero entre 1 y 5.");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("502 → mensaje amigable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Bad Gateway", status: 502 }),
    );
    await expect(
      sendChatFeedback({ executionId: "exec-1", rating: 5 }),
    ).rejects.toThrow(CHAT_UNAVAILABLE_MESSAGE);
  });

  it("401 sesión inválida se propaga", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Unauthorized", status: 401 }),
    );
    await expect(
      sendChatFeedback({ executionId: "exec-1", rating: 1 }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("fetchThreadHistory — GET /api/v1/threads/{id}/messages", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("pide la página más reciente sin params y devuelve el estado", async () => {
    apiFetchMock.mockResolvedValue({
      threadId: "thread-1",
      messageCount: 2,
      lastMessage: "¿Te sentís mejor?",
      messages: [
        { role: "user", text: "Hola" },
        { role: "bot", text: "¿Te sentís mejor?" },
      ],
    });
    const state = await fetchThreadHistory("thread-1");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/threads/thread-1/messages",
      { method: "GET" },
    );
    expect(state.messageCount).toBe(2);
    expect(state.messages).toHaveLength(2);
  });

  it("propaga limit + before como query de paginación", async () => {
    apiFetchMock.mockResolvedValue({
      threadId: "thread-1",
      messageCount: 30,
      lastMessage: null,
      hasMore: true,
      nextCursor: 10,
      messages: [{ role: "bot", text: "Antiguo" }],
    });
    const state = await fetchThreadHistory("thread-1", 10, 20);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/threads/thread-1/messages?limit=10&before=20",
      { method: "GET" },
    );
    expect(state.hasMore).toBe(true);
    expect(state.nextCursor).toBe(10);
  });

  it("503 → mensaje amigable", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Service Unavailable", status: 503 }),
    );
    await expect(fetchThreadHistory("thread-1")).rejects.toThrow(
      CHAT_UNAVAILABLE_MESSAGE,
    );
  });

  it("401 sesión inválida se propaga", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Unauthorized", status: 401 }),
    );
    await expect(fetchThreadHistory("thread-1")).rejects.toMatchObject({
      status: 401,
    });
  });
});
