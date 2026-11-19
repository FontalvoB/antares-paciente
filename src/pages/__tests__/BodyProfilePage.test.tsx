import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { BodyProfilePage } from "../BodyProfilePage";
import type { MeasurementItemDto } from "../../services/measurements/types";

// El escenario 3D no se renderiza aquí: se verifica la composición de la
// página (mediciones reales, IMC, estados) con un doble ligero.
vi.mock("../../components/avatar/AvatarStage", () => ({
  AvatarStage: () => <div data-testid="avatar-stage-mock" />,
}));

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Estado mutable compartido con los mocks (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  measurements: [] as MeasurementItemDto[],
  measurementsLoading: false,
  measurementsError: null as null | { message: string },
  reloadMeasurements: vi.fn(),
  progressStatus: "ready" as string,
  progressRecords: [
    { date: "2026-01-01", value: 80 },
    { date: "2026-02-01", value: 78 },
  ] as { date: string; value: number }[],
  profileHeightCm: null as number | null,
  seriesWeight: null as number | null,
}));

const configFixture = {
  gender: "male",
  skin: "skin-03",
  version: 1,
  clothing: { shirt: null, pants: null, shoes: null },
  hair: null,
  accessories: { glasses: null, watch: null, bracelet: null },
};

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    navigate: vi.fn(),
    showToast: vi.fn(),
    authLoading: false,
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "es", toggleLang: vi.fn(), t: (key: string) => key }),
  useT: () => (key: string) => key,
}));

vi.mock("../../hooks/useAvatarConfiguration", () => ({
  useAvatarConfiguration: () => ({
    value: configFixture,
    status: "ready",
    dirty: false,
    saving: false,
    saveError: false,
    change: vi.fn(),
    save: vi.fn(),
    retry: vi.fn(),
    owner: "tok",
  }),
}));

vi.mock("../../hooks/useAvatarProgress", () => ({
  useAvatarProgress: () => ({
    status: mockState.progressStatus,
    records: mockState.progressRecords,
    error: undefined,
    resolved: mockState.progressRecords.length > 0,
    owner: "tok",
    historyMs: 5,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../hooks/useMyMetricsHistory", () => ({
  useMyMetricsHistory: () => ({
    history: {
      heightCm: mockState.profileHeightCm,
      metrics:
        mockState.seriesWeight == null
          ? []
          : [
              {
                code: "weight",
                unit: "kg",
                target: null,
                favorableDirection: null,
                points: [
                  { date: "2026-08-01", value: 80 },
                  { date: "2026-08-14", value: mockState.seriesWeight },
                ],
              },
            ],
    },
    isLoading: false,
    isError: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("../../hooks/useMyMeasurements", () => ({
  useMyMeasurements: () => ({
    items: mockState.measurements,
    isLoading: mockState.measurementsLoading,
    isFetchingMore: false,
    error: mockState.measurementsError,
    hasNextPage: false,
    loadMore: vi.fn(),
    reload: (...args: unknown[]) => mockState.reloadMeasurements(...args),
  }),
}));

vi.mock("../../utils/authApi", () => ({
  getAccessToken: () => "tok",
  getMe: vi.fn().mockResolvedValue({ roles: [] }),
  onSessionInvalid: () => () => {},
}));

function measurement(
  id: string,
  metricCode: string,
  metricName: string,
  value: number,
  unitCode: string,
  unitSymbol: string,
  observedAt: string,
  source = "device",
): MeasurementItemDto {
  return {
    id,
    metricCode,
    metricName,
    value,
    unitCode,
    unitSymbol,
    observedAt,
    source,
  };
}

const fullFixture: MeasurementItemDto[] = [
  measurement(
    "m-w",
    "weight",
    "Peso",
    70.5,
    "kg",
    "kg",
    "2026-08-14T10:00:00.000+00:00",
  ),
  measurement(
    "m-h",
    "height",
    "Talla",
    170,
    "cm",
    "cm",
    "2026-08-10T10:00:00.000+00:00",
    "professional",
  ),
  measurement(
    "m-wa",
    "waist",
    "Cintura",
    88,
    "cm",
    "cm",
    "2026-08-14T10:00:00.000+00:00",
  ),
  measurement(
    "m-f",
    "body_fat",
    "Grasa corporal",
    24,
    "percent",
    "%",
    "2026-08-14T10:00:00.000+00:00",
  ),
];

describe("BodyProfilePage — Perfil corporal con mediciones reales", () => {
  beforeEach(() => {
    mockState.measurements = fullFixture;
    mockState.measurementsLoading = false;
    mockState.measurementsError = null;
    mockState.reloadMeasurements.mockClear();
    mockState.progressStatus = "ready";
    mockState.progressRecords = [
      { date: "2026-01-01", value: 80 },
      { date: "2026-02-01", value: 78 },
    ];
    mockState.profileHeightCm = null;
    mockState.seriesWeight = null;
  });

  it("muestra las mediciones reales con valor, unidad y fecha, más el IMC", () => {
    const { container } = render(<BodyProfilePage />);

    expect(screen.getByText("Peso")).toBeTruthy();
    expect(screen.getByText("70,5 kg")).toBeTruthy();
    expect(screen.getAllByText("14/08/2026").length).toBeGreaterThan(0);
    expect(screen.getByText("Cintura")).toBeTruthy();
    expect(screen.getByText("Grasa corporal")).toBeTruthy();
    // IMC estándar 70.5 / 1.7² = 24.39 → número y unidad en nodos propios
    // de la tarjeta héroe (strong + i).
    expect(screen.getByText("IMC")).toBeTruthy();
    expect(screen.getByText("kg/m²")).toBeTruthy();
    expect(screen.getByText("kg/m²").closest("strong")?.textContent).toContain(
      "24,4",
    );
    // Tres vistas del destino unificado (IonLabel no proyecta texto en
    // happy-dom fuera de IonItem: se verifica por estructura y value).
    const buttons = container.querySelectorAll("ion-segment-button");
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.getAttribute("value")).toBe("composition");
    expect(buttons[1]?.getAttribute("value")).toBe("evolution");
    expect(buttons[2]?.getAttribute("value")).toBe("appearance");
  });

  it("sin fila de grasa no muestra ningún porcentaje estimado", () => {
    mockState.measurements = fullFixture.filter(
      (m) => m.metricCode !== "body_fat",
    );

    render(<BodyProfilePage />);

    expect(screen.queryByText("Grasa corporal")).toBeNull();
    expect(screen.getByText("Peso")).toBeTruthy();
    // El IMC sigue disponible con peso + talla (nodos propios).
    expect(screen.getByText("kg/m²")).toBeTruthy();
    expect(screen.getByText("kg/m²").closest("strong")?.textContent).toContain(
      "24,4",
    );
  });

  it("0.13 — convierte pct a % y oculta orígenes técnicos conservando etiquetas conocidas", () => {
    mockState.measurements = fullFixture.map(m => ({ ...m,
      source: m.metricCode === 'weight' ? 'rich-seed' : m.metricCode === 'height' ? 'origen-interno' : m.source,
      reportedBy: m.metricCode === 'waist' || m.metricCode === 'body_fat' ? 'device' : null,
      unitSymbol: m.metricCode === 'body_fat' ? 'pct' : m.unitSymbol,
    }));
    const { container } = render(<BodyProfilePage />);

    expect(screen.getByText('24 %')).toBeTruthy();
    expect(screen.getByText('kg/m²')).toBeTruthy();
    expect(container.textContent).not.toContain('pct');
    expect(container.textContent).not.toContain('rich-seed');
    expect(container.textContent).not.toContain('origen-interno');
    expect(container.querySelectorAll('ion-badge')).toHaveLength(2);
    expect(screen.getAllByText('Dispositivo')).toHaveLength(2);
  });

  it("usa el último peso vigente para la fila y el IMC aunque una fila reemplazada tenga fecha posterior", () => {
    const [weight, ...otherMeasurements] = fullFixture;
    mockState.measurements = [
      { ...weight, reportedBy: "patient", sourceChannel: "vita_voice", status: "confirmed" },
      {
        ...weight,
        id: "m-replaced",
        observedAt: "2026-08-16T10:00:00.000+00:00",
        value: 80,
        status: "superseded",
      },
      ...otherMeasurements,
    ];

    render(<BodyProfilePage />);

    expect(screen.getByText("70,5 kg")).toBeTruthy();
    expect(screen.getByText("Reportado por ti · Voz")).toBeTruthy();
    expect(screen.queryByText("80 kg")).toBeNull();
    expect(screen.getByText("kg/m²").closest("strong")?.textContent).toContain("24,4");
  });

  it("sin mediciones muestra estado vacío honesto", () => {
    mockState.measurements = [];

    render(<BodyProfilePage />);

    expect(
      screen.getByText("Aún no hay mediciones corporales registradas."),
    ).toBeTruthy();
    expect(screen.queryByText("IMC")).toBeNull();
  });

  it("usa la talla del perfil clínico y calcula el IMC sin fila de talla", () => {
    mockState.measurements = fullFixture.filter(
      (m) => m.metricCode !== "height",
    );
    mockState.profileHeightCm = 170;

    render(<BodyProfilePage />);

    expect(screen.getByText("Talla")).toBeTruthy();
    expect(screen.getByText("Perfil clínico")).toBeTruthy();
    expect(screen.getByText("170 cm")).toBeTruthy();
    expect(screen.getByText("kg/m²").closest("strong")?.textContent).toContain(
      "24,4",
    );
  });

  it("sin talla en mediciones ni perfil clínico no calcula IMC ni inventa talla", () => {
    mockState.measurements = fullFixture.filter(
      (m) => m.metricCode !== "height",
    );
    mockState.profileHeightCm = null;

    render(<BodyProfilePage />);

    expect(screen.queryByText("Talla")).toBeNull();
    expect(screen.queryByText("IMC")).toBeNull();
    expect(screen.getByText("Peso")).toBeTruthy();
  });

  it("convierte libras a kg para el IMC (sin alterar el valor mostrado)", () => {
    mockState.measurements = fullFixture.map((m) =>
      m.metricCode === "weight"
        ? { ...m, value: 155.43, unitCode: "lb", unitSymbol: "lb" }
        : m,
    );

    render(<BodyProfilePage />);

    expect(screen.getByText("155,43 lb")).toBeTruthy();
    expect(screen.getByText("kg/m²").closest("strong")?.textContent).toContain(
      "24,4",
    );
  });

  it("usa el último peso de la serie abierta si no hay fila de peso", () => {
    mockState.measurements = fullFixture.filter(
      (m) => m.metricCode !== "weight",
    );
    mockState.profileHeightCm = 170;
    mockState.seriesWeight = 70.5;

    render(<BodyProfilePage />);

    expect(screen.queryByText("70,5 kg")).toBeNull();
    expect(screen.getByText("kg/m²").closest("strong")?.textContent).toContain(
      "24,4",
    );
  });

  it("muestra el estado pendiente de confirmación de una medición", () => {
    mockState.measurements = fullFixture.map((m) =>
      m.metricCode === "weight"
        ? { ...m, status: "pending_confirmation" as const }
        : m,
    );

    render(<BodyProfilePage />);

    expect(
      screen.getByText("Pendiente de confirmación clínica"),
    ).toBeTruthy();
  });

  it("no renderiza BodyMap ni cifras fabricadas", () => {
    render(<BodyProfilePage />);

    for (const text of [
      "Riesgo bajo",
      "Semana 12 de 24",
      "3 índices",
      "05/08/2026",
      "Frente",
      "Espalda",
      "Toca una zona del cuerpo",
    ]) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });
});
