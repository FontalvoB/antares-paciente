import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "../ProfilePage";
import type { MetricsHistoryDto } from "../../services/program/types";
import type { TeamProfessional } from "../../data/appointments";

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Estado mutable compartido con los mocks (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  lang: "es" as "es" | "en",
  pointsTotal: 4820,
  teamProfessionals: null as unknown,
  snapshot: null as unknown,
  isMockFallback: false,
  metrics: null as unknown,
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    user: {
      nombre: "Marta Ríos",
      cedula: "10247381",
      email: "marta.rios@example.com",
    },
    navigate: vi.fn(),
    openPanic: vi.fn(),
    showToast: vi.fn(),
    pointsTotal: mockState.pointsTotal,
    logout: vi.fn(),
    openTests: vi.fn(),
    teamProfessionals: mockState.teamProfessionals,
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
  useProgram: () => ({
    snapshot: mockState.snapshot,
    isMockFallback: mockState.isMockFallback,
  }),
}));

vi.mock("../../hooks/useMetricsHistory", () => ({
  useMetricsHistory: () => ({
    history: mockState.metrics,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: mockState.lang,
    toggleLang: vi.fn(),
    t: (key: string, params?: Record<string, string>) => {
      let out = key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          out = out.split(`{${k}}`).join(v);
        }
      }
      return out;
    },
  }),
  useT: () => (key: string) => key,
}));

/** Profesional real del catálogo mockeado (nombre viene de este fixture). */
const realProfessionalFixture = {
  id: "prof-1",
  typeId: "medica",
  name: "Dra. Sofía Vargas",
  role: "Physician",
  emoji: "🩺",
  accent: "linear-gradient(90deg,#0C3D2C,var(--teal))",
  color: "var(--teal)",
  colorSoft: "var(--teal-l)",
} as TeamProfessional;

const metricsFixture = {
  heightCm: 168,
  metrics: [
    {
      code: "weight",
      unit: "kg",
      target: null,
      favorableDirection: "down",
      points: [
        { date: "2026-07-01", value: 84 },
        { date: "2026-08-15", value: 81.5 },
      ],
    },
  ],
} as MetricsHistoryDto;

const snapshotFixture = {
  template: { currentWeekNumber: 7, totalWeeks: 24 },
};

/** Cadenas que NUNCA deben aparecer: datos clínicos/staff fabricados. */
const FABRICATED_TEXT = [
  "COPP-2024-00142",
  "Semana 12/24",
  "−3.2 kg",
  "Dr. Carlos Ramírez",
  "Ana Torres",
  "Luis Mora",
  "Marco Reyes",
];

/** Escapa un literal para usarlo dentro de una RegExp. */
function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe("ProfilePage — datos reales (sin contenido fabricado)", () => {
  beforeEach(() => {
    mockState.lang = "es";
    mockState.snapshot = snapshotFixture;
    mockState.isMockFallback = false;
    mockState.metrics = metricsFixture;
    mockState.teamProfessionals = [realProfessionalFixture];
  });

  it("renderiza la semana real del programa en el header", () => {
    renderPage();

    expect(screen.getByText("Semana 7 de 24")).toBeTruthy();
  });

  it("no renderiza ninguna cadena fabricada", () => {
    renderPage();

    for (const text of FABRICATED_TEXT) {
      expect(screen.queryByText(new RegExp(escapeRe(text)))).toBeNull();
    }
  });

  it("renderiza el profesional real del catálogo en Equipo ANTARES", () => {
    renderPage();

    expect(screen.getByText("Equipo ANTARES")).toBeTruthy();
    expect(screen.getByText("Dra. Sofía Vargas")).toBeTruthy();
    expect(screen.getByText("Physician")).toBeTruthy();
  });

  it("con catálogo vacío muestra estado vacío honesto, sin nombres fabricados", () => {
    mockState.teamProfessionals = [];

    renderPage();

    expect(
      screen.getByText("Aún no hay profesionales asignados a tu equipo."),
    ).toBeTruthy();
    for (const name of [
      "Dr. Carlos Ramírez",
      "Ana Torres",
      "Luis Mora",
      "Marco Reyes",
    ]) {
      expect(screen.queryByText(new RegExp(escapeRe(name)))).toBeNull();
    }
  });

  it("sin catálogo disponible oculta la sección de equipo (no inventa)", () => {
    mockState.teamProfessionals = null;

    renderPage();

    expect(screen.queryByText("Equipo ANTARES")).toBeNull();
    expect(screen.queryByText("Dra. Sofía Vargas")).toBeNull();
  });

  it("mantiene el valor real de puntos en el hero", () => {
    renderPage();

    expect(screen.getByText("4820")).toBeTruthy();
    expect(screen.getByText("Puntos")).toBeTruthy();
  });

  it("renderiza el delta real de peso desde metrics-history", () => {
    renderPage();

    expect(screen.getByText("−2,5 kg")).toBeTruthy();
    expect(screen.getByText("Peso")).toBeTruthy();
  });

  it("sin serie de peso real no hay tarjeta de Peso (no se inventa)", () => {
    mockState.metrics = { heightCm: null, metrics: [] };

    renderPage();

    expect(screen.queryByText("Peso")).toBeNull();
    expect(screen.getByText("Puntos")).toBeTruthy();
  });

  it("no pinta la semana como verdad cuando useProgram cae al fallback mock", () => {
    mockState.isMockFallback = true;

    renderPage();

    expect(screen.queryByText(/Semana 7/)).toBeNull();
    expect(screen.queryByText("Semanas")).toBeNull();
  });
});
