import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { HistoryPage } from "../HistoryPage";
import type { MeasurementItemDto } from "../../services/measurements/types";
import type {
  MetricsHistoryDto,
  ScoresHistoryDto,
} from "../../services/program/types";

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Estado mutable compartido con los mocks (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  lang: "es" as "es" | "en",
  metrics: null as unknown,
  scores: null as unknown,
  metricsLoading: false,
  scoresLoading: false,
  snapshot: null as unknown,
  measurements: [] as unknown[],
  measurementsLoading: false,
  measurementsFetchingMore: false,
  measurementsError: null as null | { message: string },
  measurementsHasMore: false,
  loadMoreMeasurements: vi.fn(),
  reloadMeasurements: vi.fn(),
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    user: {
      nombre: "Ana Torres",
      cedula: "99887766",
      email: "ana.torres@example.com",
    },
  }),
}));

vi.mock("../../hooks/useProgram", () => ({
  useProgram: () => ({
    snapshot: mockState.snapshot,
    isMockFallback: false,
  }),
}));

vi.mock("../../hooks/useMetricsHistory", () => ({
  useMetricsHistory: () => ({
    history: mockState.metrics,
    isLoading: mockState.metricsLoading,
    isError: false,
  }),
}));

vi.mock("../../hooks/useScoresHistory", () => ({
  useScoresHistory: () => ({
    history: mockState.scores,
    isLoading: mockState.scoresLoading,
    isError: false,
  }),
}));

vi.mock("../../hooks/useMyMeasurements", () => ({
  useMyMeasurements: () => ({
    items: mockState.measurements as MeasurementItemDto[],
    isLoading: mockState.measurementsLoading,
    isFetchingMore: mockState.measurementsFetchingMore,
    error: mockState.measurementsError,
    hasNextPage: mockState.measurementsHasMore,
    loadMore: (...args: unknown[]) => mockState.loadMoreMeasurements(...args),
    reload: (...args: unknown[]) => mockState.reloadMeasurements(...args),
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: mockState.lang,
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

const metricsFixture = {
  heightCm: 168,
  metrics: [
    {
      code: "bmi",
      unit: "kg/m²",
      target: { lo: 18.5, hi: 24.9 },
      favorableDirection: "down",
      points: [
        { date: "2026-07-28", value: 26.4 },
        { date: "2026-08-15", value: 24.6 },
      ],
    },
    {
      code: "hba1c",
      unit: "%",
      target: { lo: null, hi: 5.7 },
      favorableDirection: "down",
      points: [{ date: "2026-08-15", value: 5.4 }],
    },
    {
      code: "body_fat",
      unit: "%",
      target: null,
      favorableDirection: null,
      points: [{ date: "2026-08-15", value: 31.2 }],
    },
  ],
} as MetricsHistoryDto;

const scoresFixture = {
  points: [
    {
      weekNumber: 11,
      periodStart: "2026-08-03",
      periodEnd: "2026-08-09",
      healthScore: 75,
      healthPrevious: 70,
      transformationScore: 60,
    },
    {
      weekNumber: 12,
      periodStart: "2026-08-10",
      periodEnd: "2026-08-16",
      healthScore: 77,
      healthPrevious: 75,
      transformationScore: 64,
    },
  ],
} as ScoresHistoryDto;

const snapshotFixture = {
  template: { currentWeekNumber: 12, totalWeeks: 24 },
};

const measurementsFixture: MeasurementItemDto[] = [
  {
    id: "m-1",
    metricCode: "weight",
    metricName: "Peso",
    value: 70.5,
    unitCode: "kg",
    unitSymbol: "kg",
    observedAt: "2026-08-14T10:00:00.000+00:00",
    source: "device",
  },
  {
    id: "m-2",
    metricCode: "glucose_fasting",
    metricName: "Glucosa en ayunas",
    value: 95,
    unitCode: "mg_dl",
    unitSymbol: "mg/dL",
    observedAt: "2026-08-15T08:00:00.000+00:00",
    source: "lab",
  },
];

/** Escapa un literal para usarlo dentro de una RegExp. */
function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("HistoryPage — datos reales (sin contenido clínico fabricado)", () => {
  beforeEach(() => {
    mockState.lang = "es";
    mockState.metrics = metricsFixture;
    mockState.scores = scoresFixture;
    mockState.metricsLoading = false;
    mockState.scoresLoading = false;
    mockState.snapshot = snapshotFixture;
    mockState.measurements = [];
    mockState.measurementsLoading = false;
    mockState.measurementsFetchingMore = false;
    mockState.measurementsError = null;
    mockState.measurementsHasMore = false;
    mockState.loadMoreMeasurements.mockClear();
    mockState.reloadMeasurements.mockClear();
  });

  it("renderiza nombre, documento y email reales del AppContext", () => {
    render(<HistoryPage />);

    // El nombre y el documento aparecen en la tarjeta de paciente y en la
    // sección de identificación: se valida su presencia real, no unicidad.
    expect(screen.getAllByText("Ana Torres").length).toBeGreaterThan(0);
    expect(screen.getAllByText("99887766").length).toBeGreaterThan(0);
    expect(screen.getByText("ana.torres@example.com")).toBeTruthy();
  });

  it("renderiza los valores reales de metrics-history y scores-history", () => {
    render(<HistoryPage />);

    // IMC: última medición real de la serie (24.6 → es-ES "24,6").
    expect(screen.getByText("24,6 kg/m² · 15/08/2026")).toBeTruthy();
    expect(screen.getByText("5,4 % · 15/08/2026")).toBeTruthy();
    // Health/Transformation Score de la semana persistida 12.
    expect(
      screen.getByText("Salud 77 · Transformación 64 · 16/08/2026"),
    ).toBeTruthy();
    // "Actualizada" con la fecha real del punto más reciente de la serie.
    expect(screen.getByText("Actualizada 15/08/2026")).toBeTruthy();
  });

  it("no renderiza ninguna cadena clínica fabricada", () => {
    render(<HistoryPage />);

    const fabricated = [
      "Metformina",
      "Penicilina",
      "BlueCross",
      "COPP-2024-00142",
      "05/08/2026",
      "Dr. Carlos Ramírez",
      "E66.01",
    ];

    for (const text of fabricated) {
      expect(screen.queryByText(new RegExp(escapeRe(text)))).toBeNull();
    }
  });

  it("maneja la serie vacía con un estado vacío honesto, sin crash", () => {
    mockState.metrics = { heightCm: null, metrics: [] };
    mockState.scores = { points: [] };

    render(<HistoryPage />);

    expect(
      screen.getByText("Aún no hay resultados de laboratorio registrados"),
    ).toBeTruthy();
    // Sin datos de scores no se renderiza la sección (no placeholders vacíos).
    expect(screen.queryByText("Seguimiento del programa")).toBeNull();
    // La identidad real sigue visible.
    expect(screen.getAllByText("Ana Torres").length).toBeGreaterThan(0);
  });

  it("muestra carga honesta (skeleton) mientras la serie no tiene cache", () => {
    mockState.metrics = undefined;
    mockState.scores = undefined;
    mockState.metricsLoading = true;

    const { container } = render(<HistoryPage />);

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(
      screen.queryByText("Aún no hay resultados de laboratorio registrados"),
    ).toBeNull();
  });
});

describe("HistoryPage — historial de mediciones persistidas (sin inscripción)", () => {
  beforeEach(() => {
    mockState.lang = "es";
    mockState.metrics = metricsFixture;
    mockState.scores = scoresFixture;
    mockState.metricsLoading = false;
    mockState.scoresLoading = false;
    mockState.snapshot = snapshotFixture;
    mockState.measurements = [];
    mockState.measurementsLoading = false;
    mockState.measurementsFetchingMore = false;
    mockState.measurementsError = null;
    mockState.measurementsHasMore = false;
    mockState.loadMoreMeasurements.mockClear();
    mockState.reloadMeasurements.mockClear();
  });

  it("renderiza nombre, valor+unidad, fecha y origen de cada medición", () => {
    mockState.measurements = measurementsFixture;

    render(<HistoryPage />);

    expect(screen.getByText("Peso")).toBeTruthy();
    // Valor y fecha en nodos propios (jerarquía tarjeta: strong + fecha).
    expect(screen.getByText("70,5 kg")).toBeTruthy();
    expect(screen.getAllByText("14/08/2026").length).toBeGreaterThan(0);
    expect(screen.getByText("Dispositivo")).toBeTruthy();
    expect(screen.getByText("Glucosa en ayunas")).toBeTruthy();
    expect(screen.getByText("95 mg/dL")).toBeTruthy();
    expect(screen.getAllByText("15/08/2026").length).toBeGreaterThan(0);
    expect(screen.getByText("Laboratorio")).toBeTruthy();
  });

  it("muestra estado vacío amigable sin mediciones", () => {
    render(<HistoryPage />);

    expect(
      screen.getByText(
        "Aún no hay mediciones registradas en tu historial clínico",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Cargar mediciones anteriores")).toBeNull();
  });

  it("muestra skeleton inicial mientras cargan las mediciones", () => {
    mockState.measurementsLoading = true;

    const { container } = render(<HistoryPage />);

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(
      screen.queryByText(
        "Aún no hay mediciones registradas en tu historial clínico",
      ),
    ).toBeNull();
  });

  it("muestra error con reintento que llama a reload", () => {
    mockState.measurementsError = { message: "boom" };

    render(<HistoryPage />);

    expect(
      screen.getByText("No se pudieron cargar las mediciones"),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockState.reloadMeasurements).toHaveBeenCalledTimes(1);
  });

  it("ofrece cargar anteriores con hasNextPage y llama a loadMore", () => {
    mockState.measurements = measurementsFixture;
    mockState.measurementsHasMore = true;

    render(<HistoryPage />);

    fireEvent.click(screen.getByText("Cargar mediciones anteriores"));
    expect(mockState.loadMoreMeasurements).toHaveBeenCalledTimes(1);
  });

  it("no oculta las mediciones sin inscripción activa al programa", () => {
    // Sin enrollment: el programa 404 (series indefinidas) pero el historial
    // clínico propio se sigue mostrando.
    mockState.metrics = undefined;
    mockState.scores = undefined;
    mockState.snapshot = null;
    mockState.measurements = measurementsFixture;

    render(<HistoryPage />);

    expect(screen.getByText("Peso")).toBeTruthy();
    // Valor y fecha en nodos propios (jerarquía tarjeta: strong + fecha).
    expect(screen.getByText("95 mg/dL")).toBeTruthy();
    expect(screen.getAllByText("15/08/2026").length).toBeGreaterThan(0);
    expect(screen.queryByText("Seguimiento del programa")).toBeNull();
  });
});
