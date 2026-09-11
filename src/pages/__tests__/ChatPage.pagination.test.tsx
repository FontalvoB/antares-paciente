import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPage } from "../ChatPage";
import { fetchThreadState } from "../../utils/threadApi";

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  uploadLabExam: vi.fn(),
}));

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Estado mutable compartido con el mock de AppContext (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  lang: "es" as "es" | "en",
  threadId: "thread-1",
  chat: [] as Array<{
    id: string;
    role: "bot" | "user" | "alert";
    text: string;
    time: string;
  }>,
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    chat: mockState.chat,
    sendChat: vi.fn(),
    openPanic: vi.fn(),
    openVoice: vi.fn(),
    threadId: mockState.threadId,
    user: { id: "user-1", nombre: "María" },
    hydrateChat: vi.fn(),
    openBookingWizard: vi.fn(),
    appendChatMessages: vi.fn(),
    showToast: vi.fn(),
    navigate: vi.fn(),
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ t: (key: string) => key, lang: mockState.lang }),
}));

const HISTORY_HINT = "Desliza hacia arriba para ver mensajes anteriores";
const START_LABEL = "Inicio de la conversación";

/** Mensajes distinguibles: "Mensaje 01" … "Mensaje NN". */
function buildChat(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i + 1}`,
    role: (i % 2 === 0 ? "bot" : "user") as "bot" | "user",
    text: `Mensaje ${String(i + 1).padStart(2, "0")}`,
    time: "10:00 AM",
  }));
}

function getList(container: HTMLElement): HTMLElement {
  const list = container.querySelector(".screen-scroll");
  if (!list) throw new Error("chat scroll container not found");
  return list as HTMLElement;
}

describe("ChatPage — renderizado progresivo del historial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchThreadState).mockResolvedValue(null);
    mockState.lang = "es";
    mockState.threadId = "thread-1";
    mockState.chat = [];
  });

  it("renderiza solo los últimos 10 mensajes al abrir el chat", () => {
    mockState.chat = buildChat(25);

    render(<ChatPage />);

    expect(screen.getByText("Mensaje 16")).toBeTruthy();
    expect(screen.getByText("Mensaje 25")).toBeTruthy();
    expect(screen.queryByText("Mensaje 15")).toBeNull();
    expect(screen.queryByText("Mensaje 01")).toBeNull();
    expect(screen.getByText(HISTORY_HINT)).toBeTruthy();
  });

  it("revela exactamente 10 más al llegar al tope del scroll", () => {
    mockState.chat = buildChat(25);
    const { container } = render(<ChatPage />);
    const list = getList(container);

    list.scrollTop = 0;
    fireEvent.scroll(list);

    expect(screen.getByText("Mensaje 06")).toBeTruthy();
    expect(screen.queryByText("Mensaje 05")).toBeNull();
    expect(screen.queryByText("Mensaje 01")).toBeNull();
  });

  it("revela todo el historial con scrolls sucesivos y oculta el hint", () => {
    mockState.chat = buildChat(25);
    const { container } = render(<ChatPage />);
    const list = getList(container);

    list.scrollTop = 0;
    fireEvent.scroll(list);
    fireEvent.scroll(list);

    expect(screen.getByText("Mensaje 01")).toBeTruthy();
    expect(screen.queryByText(HISTORY_HINT)).toBeNull();
    expect(screen.getByText(START_LABEL)).toBeTruthy();
  });

  it("con menos de 10 mensajes muestrea todos y sin indicador superior", () => {
    mockState.chat = buildChat(5);

    render(<ChatPage />);

    expect(screen.getByText("Mensaje 01")).toBeTruthy();
    expect(screen.getByText("Mensaje 05")).toBeTruthy();
    expect(screen.queryByText(HISTORY_HINT)).toBeNull();
    expect(screen.queryByText(START_LABEL)).toBeNull();
  });

  it("resetea la ventana a los últimos 10 al cambiar de hilo", () => {
    mockState.chat = buildChat(25);
    const { container, rerender } = render(<ChatPage />);
    const list = getList(container);

    list.scrollTop = 0;
    fireEvent.scroll(list);
    fireEvent.scroll(list);
    expect(screen.getByText("Mensaje 01")).toBeTruthy();

    mockState.threadId = "thread-2";
    rerender(<ChatPage />);

    expect(screen.queryByText("Mensaje 15")).toBeNull();
    expect(screen.getByText("Mensaje 16")).toBeTruthy();
    expect(screen.getByText("Mensaje 25")).toBeTruthy();
  });

  it("ancla el scroll al revelar anteriores (compensa el delta de altura)", () => {
    mockState.chat = buildChat(25);
    const { container } = render(<ChatPage />);
    const list = getList(container);

    // Geometría simulada: cada burbuja ocupa 40px de alto.
    Object.defineProperty(list, "scrollHeight", {
      configurable: true,
      get: () => list.querySelectorAll(".bub").length * 40,
    });
    list.scrollTop = 0;

    fireEvent.scroll(list);

    // Las 10 burbujas nuevas (400px) se insertan por encima del contenido
    // visible: el scrollTop se compensa para no dar el salto visual.
    expect(list.scrollTop).toBe(400);
  });
});
