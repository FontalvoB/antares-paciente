import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider, useApp } from "../AppContext";
import { I18nProvider } from "../../i18n/I18nContext";

vi.mock("../../utils/threadApi", () => ({
  fetchThreadState: vi.fn().mockResolvedValue(null),
  sendChatMessage: vi.fn(),
  streamChatMessage: vi.fn(),
}));

vi.mock("../../utils/authApi", () => ({
  restoreSession: vi.fn().mockResolvedValue(null),
  getMe: vi.fn().mockResolvedValue(null),
  getAccessToken: vi.fn(() => null),
  isAccessTokenExpired: vi.fn(() => false),
  logoutUser: vi.fn(),
  onSessionInvalid: vi.fn(() => () => {}),
}));

vi.mock("../../utils/appointmentsApi", () => ({
  hasRealSession: () => false,
  fetchMyAppointments: vi.fn().mockResolvedValue([]),
  fetchMyRequests: vi.fn().mockResolvedValue([]),
  fetchMyContext: vi.fn().mockResolvedValue(null),
  fetchProfessionalsCatalog: vi.fn().mockResolvedValue([]),
  cancelAppointment: vi.fn(),
  createRequest: vi.fn(),
}));

function Harness() {
  const { screen: current, navigate } = useApp();
  return (
    <div>
      <span data-testid="screen">{current}</span>
      <button type="button" onClick={() => navigate("avatar")}>
        go-avatar
      </button>
    </div>
  );
}

describe("AppContext — avatar redirige a body", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("mapea navigate('avatar') al destino unificado 'body'", async () => {
    render(
      <I18nProvider>
        <AppProvider>
          <Harness />
        </AppProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("screen")).toBeTruthy());
    fireEvent.click(screen.getByText("go-avatar"));
    await waitFor(() =>
      expect(screen.getByTestId("screen").textContent).toBe("body"),
    );
  });
});
