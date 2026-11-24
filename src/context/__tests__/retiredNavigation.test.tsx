import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider, useApp } from "../AppContext";
import type { NavigationTarget } from "../../types";
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

const retiredRoutes = [
  "chat", "hc", "book", "edu", "infinito", "program-podcast", "room",
  "avatar", "body", "medical-sources", "nut", "bt", "health-accessory",
  "medications", "com", "prog", "program-nut", "program-vitals",
  "program-ejercicio", "program-nutraceutico", "program-emocional",
  "program-racha", "marketplace",
] as const;

function Harness() {
  const { screen: current, navigate, openBookingWizard } = useApp();
  return (
    <div>
      <span data-testid="screen">{current}</span>
      <button type="button" onClick={() => navigate("prof")}>Perfil</button>
      <button type="button" onClick={openBookingWizard}>Citas desde CTA</button>
      {retiredRoutes.map((target) => (
        <button key={target} type="button" onClick={() => navigate(target as NavigationTarget)}>
          {target}
        </button>
      ))}
    </div>
  );
}

describe("AppContext - rutas retiradas del mapa v5.1", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("redirige los destinos retirados y desconocidos a Inicio", async () => {
    render(
      <I18nProvider>
        <AppProvider>
          <Harness />
        </AppProvider>
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("screen")).toBeTruthy());
    for (const target of [...retiredRoutes, "Citas desde CTA"]) {
      fireEvent.click(screen.getByRole("button", { name: "Perfil" }));
      expect(screen.getByTestId("screen").textContent).toBe("prof");
      fireEvent.click(screen.getByRole("button", { name: target }));
      expect(screen.getByTestId("screen").textContent).toBe("home");
    }
  });
});
