import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "../ProfilePage";

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const navigateMock = vi.fn();

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    user: {
      nombre: "Marta Ríos",
      cedula: "10247381",
      email: "marta.rios@example.com",
    },
    navigate: navigateMock,
    openPanic: vi.fn(),
    showToast: vi.fn(),
    pointsTotal: 0,
    logout: vi.fn(),
    openTests: vi.fn(),
    teamProfessionals: null,
    upcomingAppointments: null,
  }),
}));

vi.mock("../../hooks/useLeague", () => ({
  useLeague: () => ({
    league: null,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/useProgram", () => ({
  useProgram: () => ({ snapshot: null, isMockFallback: true }),
}));

vi.mock("../../hooks/useMetricsHistory", () => ({
  useMetricsHistory: () => ({
    history: null,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "es", toggleLang: vi.fn(), t: (key: string) => key }),
  useT: () => (key: string) => key,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe("ProfilePage — Mi Avatar abre Perfil corporal", () => {
  it("navega a 'body' al pulsar Mi Avatar", () => {
    navigateMock.mockClear();
    render(
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Mi Avatar"));
    expect(navigateMock).toHaveBeenCalledWith("body");
    expect(navigateMock).not.toHaveBeenCalledWith("avatar");
  });
});
