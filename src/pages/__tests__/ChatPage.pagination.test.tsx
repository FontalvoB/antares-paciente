import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPage } from "../ChatPage";
import { fetchThreadState, type ThreadState } from "../../utils/threadApi";

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  uploadLabExam: vi.fn(),
}));

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

interface MockChatMessage {
  id: string;
  role: "bot" | "user" | "alert";
  text: string;
  time: string;
}

// Estado mutable compartido con el mock de AppContext (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  lang: "es" as "es" | "en",
  threadId: "thread-1",
  chat: [] as MockChatMessage[],
  seq: 0,
}));

vi.mock("../../context/AppContext", () => ({
  // Mock stateful mínimo: hydrateChat antepone mensajes deduplicando por texto
  // (igual que el AppContext real) y prependChatMessages antepone SIN dedup
  // (igual que el AppContext real), para que cada página servida por el
  // backend se refleje en el DOM durante el test.
  useApp: () => {
    const [chat, setChat] = useState<MockChatMessage[]>(mockState.chat);
    return {
      chat,
      sendChat: vi.fn(),
      openPanic: vi.fn(),
      openVoice: vi.fn(),
      threadId: mockState.threadId,
      user: { id: "user-1", nombre: "María" },
      hydrateChat: (messages: Array<{ text: string; role?: "bot" | "user" }>) => {
        setChat((prev) => {
          const existing = new Set(prev.map((m) => m.text));
          const fresh = messages
            .filter((m) => !existing.has(m.text))
            .map((m) => ({
              id: `hydrated-${m.text}`,
              role: (m.role ?? "bot") as "bot" | "user",
              text: m.text,
              time: "10:00 AM",
            }));
          if (!fresh.length) return prev;
          return [...fresh, ...prev];
        });
      },
      prependChatMessages: (
        messages: Array<{ text: string; role?: "bot" | "user" }>,
      ) => {
        if (!messages.length) return;
        setChat((prev) => {
          const stamped = messages.map((m) => ({
            id: `prepended-${mockState.seq++}-${m.text}`,
            role: (m.role ?? "bot") as "bot" | "user",
            text: m.text,
            time: "10:00 AM",
          }));
          const isOnlyWelcome = prev.length === 1 && prev[0].id === "welcome";
          return isOnlyWelcome ? stamped : [...stamped, ...prev];
        });
      },
      openBookingWizard: vi.fn(),
      appendChatMessages: vi.fn(),
      showToast: vi.fn(),
      navigate: vi.fn(),
    };
  },
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ t: (key: string) => key, lang: mockState.lang }),
}));

const HISTORY_HINT = "Desliza hacia arriba para ver mensajes anteriores";
const LOADING_LABEL = "Cargando mensajes anteriores…";
const START_LABEL = "Inicio de la conversación";
const PAGE_SIZE = 10;

/** Historial completo simulado: "Mensaje 01" … "Mensaje 25" (cronológico). */
const fullHistory = Array.from({ length: 25 }, (_, i) => ({
  role: (i % 2 === 0 ? "bot" : "user") as "bot" | "user",
  text: `Mensaje ${String(i + 1).padStart(2, "0")}`,
}));

/**
 * Página espejando el contrato del backend: `before` es el offset desde el
 * mensaje más nuevo (omitido/null = página más reciente). `nextCursor` avanza
 * de a PAGE_SIZE hasta agotar el historial.
 */
function pageFor(before?: number | null) {
  const offset = before ?? 0;
  const end = fullHistory.length - offset;
  const start = Math.max(0, end - PAGE_SIZE);
  const messages = fullHistory.slice(start, end);
  const hasMore = start > 0;
  return {
    threadId: "thread-1",
    messageCount: fullHistory.length,
    lastMessage: "Mensaje 25",
    messages,
    hasMore,
    nextCursor: hasMore ? offset + messages.length : null,
  };
}

function getList(container: HTMLElement): HTMLElement {
  const list = container.querySelector(".screen-scroll");
  if (!list) throw new Error("chat scroll container not found");
  return list as HTMLElement;
}

describe("ChatPage — paginación server-driven del historial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.lang = "es";
    mockState.threadId = "thread-1";
    mockState.chat = [];
    vi.mocked(fetchThreadState).mockImplementation(
      async (_threadId, _userId, options) => pageFor(options?.before ?? null),
    );
  });

  it("al abrir pide la página más reciente con { limit: 10 } y la renderiza", async () => {
    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText("Mensaje 25")).toBeTruthy();
    });

    expect(vi.mocked(fetchThreadState)).toHaveBeenCalledWith(
      "thread-1",
      "user-1",
      { limit: PAGE_SIZE },
    );
    expect(screen.getByText("Mensaje 16")).toBeTruthy();
    expect(screen.queryByText("Mensaje 15")).toBeNull();
    expect(screen.queryByText("Mensaje 01")).toBeNull();
    expect(screen.getByText(HISTORY_HINT)).toBeTruthy();
  });

  it("al llegar al tope pide la página anterior con el nextCursor y la antepone", async () => {
    const { container } = render(<ChatPage />);
    await waitFor(() => expect(screen.getByText("Mensaje 25")).toBeTruthy());

    const list = getList(container);
    list.scrollTop = 0;
    fireEvent.scroll(list);

    await waitFor(() => expect(screen.getByText("Mensaje 06")).toBeTruthy());

    expect(vi.mocked(fetchThreadState)).toHaveBeenLastCalledWith(
      "thread-1",
      "user-1",
      { limit: PAGE_SIZE, before: 10 },
    );
    expect(screen.getByText("Mensaje 15")).toBeTruthy();
    expect(screen.queryByText("Mensaje 05")).toBeNull();
    expect(screen.getByText(HISTORY_HINT)).toBeTruthy();
  });

  it("al agotar el historial oculta el hint superior y muestra el inicio", async () => {
    const { container } = render(<ChatPage />);
    await waitFor(() => expect(screen.getByText("Mensaje 25")).toBeTruthy());

    const list = getList(container);
    list.scrollTop = 0;
    fireEvent.scroll(list);
    await waitFor(() => expect(screen.getByText("Mensaje 06")).toBeTruthy());

    list.scrollTop = 0;
    fireEvent.scroll(list);
    await waitFor(() => expect(screen.getByText("Mensaje 01")).toBeTruthy());

    expect(screen.queryByText(HISTORY_HINT)).toBeNull();
    expect(screen.getByText(START_LABEL)).toBeTruthy();
  });

  it("ancla el scroll al anteponer la página anterior (compensa el delta)", async () => {
    const { container } = render(<ChatPage />);
    await waitFor(() => expect(screen.getByText("Mensaje 25")).toBeTruthy());

    const list = getList(container);
    // Geometría simulada: cada burbuja ocupa 40px de alto.
    Object.defineProperty(list, "scrollHeight", {
      configurable: true,
      get: () => list.querySelectorAll(".bub").length * 40,
    });
    list.scrollTop = 0;

    fireEvent.scroll(list);

    // Los 10 mensajes nuevos (400px) se insertan por encima: el scrollTop se
    // compensa para que el contenido visible no dé el salto.
    await waitFor(() => expect(list.scrollTop).toBe(400));
    expect(screen.getByText("Mensaje 06")).toBeTruthy();
  });

  it("no pierde un mensaje repetido entre páginas: lo antepone igual (#1)", async () => {
    const repeated = "Recordá tomar agua";
    vi.mocked(fetchThreadState).mockImplementation(
      async (_threadId, _userId, options) => {
        if (options?.before == null) {
          return {
            threadId: "thread-1",
            messageCount: 4,
            lastMessage: "¿Cómo dormiste?",
            messages: [
              { role: "bot", text: repeated },
              { role: "bot", text: "¿Cómo dormiste?" },
            ],
            hasMore: true,
            nextCursor: 2,
          };
        }
        return {
          threadId: "thread-1",
          messageCount: 4,
          lastMessage: "¿Cómo dormiste?",
          messages: [
            { role: "user", text: "Buenos días" },
            { role: "bot", text: repeated },
          ],
          hasMore: false,
          nextCursor: null,
        };
      },
    );

    const { container } = render(<ChatPage />);
    await waitFor(() => expect(screen.getByText(repeated)).toBeTruthy());
    expect(screen.getAllByText(repeated)).toHaveLength(1);

    const list = getList(container);
    list.scrollTop = 0;
    fireEvent.scroll(list);

    // El repetido de la página vieja se agrega (2 ocurrencias), no se descarta.
    await waitFor(() => {
      expect(screen.getAllByText(repeated)).toHaveLength(2);
    });
    expect(screen.getByText("Buenos días")).toBeTruthy();
  });

  it("una respuesta degradada (messageCount 0) no desactiva la paginación (#2)", async () => {
    let scrollCalls = 0;
    vi.mocked(fetchThreadState).mockImplementation(
      async (_threadId, _userId, options) => {
        if (options?.before == null) {
          return {
            threadId: "thread-1",
            messageCount: fullHistory.length,
            lastMessage: "Mensaje 25",
            messages: fullHistory.slice(15, 25),
            hasMore: true,
            nextCursor: 10,
          };
        }
        scrollCalls += 1;
        if (scrollCalls === 1) {
          // Backend degradado: 200 con historial vacío tras un fallo del AI service.
          return {
            threadId: "thread-1",
            messageCount: 0,
            lastMessage: null,
            messages: [],
            hasMore: false,
            nextCursor: null,
          };
        }
        return {
          threadId: "thread-1",
          messageCount: fullHistory.length,
          lastMessage: "Mensaje 25",
          messages: fullHistory.slice(5, 15),
          hasMore: false,
          nextCursor: null,
        };
      },
    );

    const { container } = render(<ChatPage />);
    await waitFor(() => expect(screen.getByText("Mensaje 25")).toBeTruthy());

    const list = getList(container);
    list.scrollTop = 0;
    fireEvent.scroll(list);

    // La degradada no apaga `hasMore`: vuelve el hint de scroll (no queda "cargando").
    await waitFor(() => {
      expect(screen.queryByText(LOADING_LABEL)).toBeNull();
      expect(screen.getByText(HISTORY_HINT)).toBeTruthy();
    });
    expect(vi.mocked(fetchThreadState)).toHaveBeenCalledTimes(2);

    // Un scroll posterior con backend sano sí carga y antepone el tramo anterior.
    list.scrollTop = 0;
    fireEvent.scroll(list);

    await waitFor(() => expect(screen.getByText("Mensaje 06")).toBeTruthy());
    expect(screen.getByText("Mensaje 25")).toBeTruthy();
    // El cursor original se conserva (no lo pisó la respuesta degradada).
    expect(vi.mocked(fetchThreadState)).toHaveBeenLastCalledWith(
      "thread-1",
      "user-1",
      { limit: PAGE_SIZE, before: 10 },
    );
  });

  it("con hasMore true y nextCursor null no reintenta el fetch en loop (#7)", async () => {
    vi.mocked(fetchThreadState).mockImplementation(
      async (_threadId, _userId, options) => {
        if (options?.before != null) {
          // Si el guard falla, este fetch se dispara en loop contra la misma página.
          return {
            threadId: "thread-1",
            messageCount: fullHistory.length,
            lastMessage: "Mensaje 25",
            messages: fullHistory.slice(5, 15),
            hasMore: true,
            nextCursor: null,
          };
        }
        return {
          threadId: "thread-1",
          messageCount: fullHistory.length,
          lastMessage: "Mensaje 25",
          messages: fullHistory.slice(15, 25),
          hasMore: true,
          nextCursor: null,
        };
      },
    );

    const { container } = render(<ChatPage />);
    await waitFor(() => expect(screen.getByText("Mensaje 25")).toBeTruthy());
    expect(screen.getByText(HISTORY_HINT)).toBeTruthy();

    const list = getList(container);
    list.scrollTop = 0;
    fireEvent.scroll(list);

    // El guard apaga `hasMore` sin disparar ningún fetch.
    await waitFor(() => expect(screen.queryByText(HISTORY_HINT)).toBeNull());
    expect(vi.mocked(fetchThreadState)).toHaveBeenCalledTimes(1);

    // Un segundo scroll tampoco debe disparar fetch.
    fireEvent.scroll(list);
    expect(vi.mocked(fetchThreadState)).toHaveBeenCalledTimes(1);
  });

  it("descarta una página en vuelo si el hilo cambió antes de resolver (#4)", async () => {
    let resolveOlder: (value: ThreadState | null) => void = () => {};
    const olderPage = new Promise<ThreadState | null>((resolve) => {
      resolveOlder = resolve;
    });
    vi.mocked(fetchThreadState).mockImplementation(
      (_threadId, _userId, options) => {
        if (options?.before == null) return Promise.resolve(pageFor(null));
        return olderPage;
      },
    );

    const { container, rerender } = render(<ChatPage />);
    await waitFor(() => expect(screen.getByText("Mensaje 25")).toBeTruthy());

    const list = getList(container);
    list.scrollTop = 0;
    fireEvent.scroll(list);
    expect(vi.mocked(fetchThreadState)).toHaveBeenCalledTimes(2);

    // Un push cambia el hilo activo mientras la página vieja sigue en vuelo.
    mockState.threadId = "thread-2";
    rerender(<ChatPage />);

    // El hilo nuevo arranca con su propia carga inicial.
    await waitFor(() => {
      expect(
        vi.mocked(fetchThreadState).mock.calls.some(
          ([calledThreadId]) => calledThreadId === "thread-2",
        ),
      ).toBe(true);
    });

    resolveOlder({
      threadId: "thread-1",
      messageCount: fullHistory.length,
      lastMessage: "Mensaje 25",
      messages: [{ role: "bot", text: "Mensaje viejo del hilo 1" }],
      hasMore: false,
      nextCursor: null,
    });
    // Deja correr las microtareas del fetch viejo ya resuelto.
    await act(async () => {
      await Promise.resolve();
    });

    // La página vieja se ignora por completo: no aparece su mensaje y la
    // paginación del hilo nuevo sigue viva.
    expect(screen.queryByText("Mensaje viejo del hilo 1")).toBeNull();
    expect(screen.getByText(HISTORY_HINT)).toBeTruthy();
  });
});
