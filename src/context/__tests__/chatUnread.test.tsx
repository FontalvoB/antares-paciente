import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider, useApp } from "../AppContext";
import { I18nProvider } from "../../i18n/I18nContext";
import { fetchThreadState } from "../../utils/threadApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn(),
  sendChatMessage: vi.fn(),
  streamChatMessage: vi.fn(),
}));

// Sesión restaurada sin red: el provider pasa a flow="app" y resuelve el
// usuario demo (id = 10247381, la clave que usan los tests para el baseline).
vi.mock("../../utils/authApi", () => ({
  restoreSession: vi.fn().mockResolvedValue({ accessToken: "demo-access-token" }),
  getMe: vi.fn().mockResolvedValue({
    id: "10247381",
    email: "maria.gonzalez@email.com",
    firstName: "María",
    lastName: "González",
  }),
  getAccessToken: vi.fn(() => "demo-access-token"),
  isAccessTokenExpired: vi.fn(() => false),
  logoutUser: vi.fn(),
  onSessionInvalid: vi.fn(() => () => {}),
}));

vi.mock("../../utils/appointmentsApi", () => ({
  hasRealSession: () => true,
  fetchMyAppointments: vi.fn().mockResolvedValue([]),
  fetchMyRequests: vi.fn().mockResolvedValue([]),
  fetchMyContext: vi.fn().mockResolvedValue(null),
  fetchOrganizationsTree: vi.fn().mockResolvedValue([]),
  fetchProfessionalsCatalog: vi.fn().mockResolvedValue([]),
  cancelAppointment: vi.fn(),
  createRequest: vi.fn(),
}));

function Harness() {
  const { chatUnread, markChatRead } = useApp();
  return (
    <div>
      <button type="button" onClick={markChatRead}>
        mark-read
      </button>
      <span data-testid="unread">{chatUnread ? "true" : "false"}</span>
    </div>
  );
}

function renderApp(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider>
      <AppProvider>
        <Harness />
      </AppProvider>
    </I18nProvider>
    </QueryClientProvider>,
  );
}

const threadState = {
  threadId: "proactive-10247381",
  messageCount: 5,
  lastMessage: "Hola 👋",
};

describe("AppContext — unread chat indicator", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Sesión demo: restoreSession() restaura flow="app" y realMode=true.
    localStorage.setItem("copp_access_token", "demo-access-token");
    vi.mocked(fetchThreadState).mockResolvedValue(threadState);
  });

  it("sets the unread state when the remote count exceeds the seen count", async () => {
    localStorage.setItem("antares:chat-last-seen:10247381", "2");
    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("unread").textContent).toBe("true");
    });
  });

  it("starts in read state and persists the count as baseline", async () => {
    renderApp();

    await waitFor(() => {
      expect(vi.mocked(fetchThreadState)).toHaveBeenCalled();
    });
    // El chequeo de no leídos solo pide el conteo (página de 1): no descarga
    // el historial completo al entrar a la app.
    expect(vi.mocked(fetchThreadState)).toHaveBeenCalledWith(
      "proactive-10247381",
      "10247381",
      { limit: 1 },
    );
    expect(screen.getByTestId("unread").textContent).toBe("false");
    expect(localStorage.getItem("antares:chat-last-seen:10247381")).toBe("5");
  });

  it("keeps the state read when the remote count matches the seen count", async () => {
    localStorage.setItem("antares:chat-last-seen:10247381", "5");
    renderApp();

    await waitFor(() => {
      expect(vi.mocked(fetchThreadState)).toHaveBeenCalled();
    });
    expect(screen.getByTestId("unread").textContent).toBe("false");
  });

  it("clears the unread state when explicitly marked as read", async () => {
    localStorage.setItem("antares:chat-last-seen:10247381", "2");
    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("unread").textContent).toBe("true");
    });

    fireEvent.click(screen.getByText("mark-read"));

    await waitFor(() => {
      expect(screen.getByTestId("unread").textContent).toBe("false");
      expect(localStorage.getItem("antares:chat-last-seen:10247381")).toBe("5");
    });
  });

  it("keeps the state read when fetching the thread state fails", async () => {
    vi.mocked(fetchThreadState).mockResolvedValue(null);
    renderApp();

    await waitFor(() => {
      expect(vi.mocked(fetchThreadState)).toHaveBeenCalled();
    });
    expect(screen.getByTestId("unread").textContent).toBe("false");
  });
});