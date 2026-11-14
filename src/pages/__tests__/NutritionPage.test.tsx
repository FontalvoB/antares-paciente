import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as renderView, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { NutritionPageContent as NutritionPage } from "../NutritionPage";
import type { MyNutritionPlanDto } from "../../services/nutrition/my-nutrition-plan-service";
import type { MetricsHistoryDto, ProgramSnapshotDto } from "../../services/program/types";
import { ApiError } from "../../utils/apiClient";
import { nutritionRecommendationFixture, previousNutritionRecommendationFixture, nutritionRecommendationsResponseFixture, nutritionRecommendationsPublicationOrderFixture } from "../../components/nutrition/__tests__/fixtures/nutrition-recommendation";

function render(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderView(children, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

vi.mock("../../hooks/useNutritionPlanStatus", () => ({
  useNutritionPlanStatus: () => ({ status: null, isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// El overlay Stencil no presenta hijos en happy-dom: el doble monta el
// contenido cuando isOpen, verificando el cableado click → modal + form.
vi.mock("@ionic/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ionic/react")>();
  const Wrap = ({ children, ...props }: HTMLAttributes<HTMLElement>) => <div {...props}>{children}</div>;
  return {
    ...actual,
    IonButton: ({ children, onClick, disabled, 'aria-label': label, 'aria-expanded': expanded, 'aria-pressed': pressed }: ButtonHTMLAttributes<HTMLButtonElement>) => <button disabled={disabled} onClick={onClick} aria-label={label} aria-expanded={expanded} aria-pressed={pressed}>{children}</button>,
    IonIcon: () => null, IonNote: Wrap, IonProgressBar: () => null,
    IonSegment: ({ children, value, onIonChange }: { children: ReactNode; value: string; onIonChange: (event: { detail: { value: string } }) => void }) => <select aria-label="Pestaña de nutrición" value={value} onChange={event => onIonChange({ detail: { value: event.target.value } })}>{children}</select>,
    IonSegmentButton: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
    IonAccordionGroup: Wrap, IonAccordion: Wrap, IonItem: Wrap, IonLabel: Wrap, IonBadge: Wrap,
    IonCard: ({ children, ...props }: { children: ReactNode; role?: string; 'aria-labelledby'?: string }) => <section {...props}>{children}</section>,
    IonCardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    IonCardTitle: ({ children, ...props }: { children: ReactNode; id?: string; role?: string; 'aria-level'?: number }) => <div {...props}>{children}</div>,
    IonCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    IonImg: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
    IonActionSheet: ({ isOpen, header, buttons, onDidDismiss }: { isOpen: boolean; header: string; buttons: { text: string; handler?: () => void }[]; onDidDismiss?: () => void }) => isOpen ? <div role="dialog" aria-label={header}>{buttons.map(button => <button key={button.text} onClick={() => { button.handler?.(); onDidDismiss?.(); }}>{button.text}</button>)}</div> : null,
    IonModal: ({
      children,
      isOpen,
    }: {
      children: ReactNode;
      isOpen?: boolean;
    }) => (isOpen ? <div data-testid="test-ion-modal">{children}</div> : null),
  };
});

// Estado mutable compartido con los mocks (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  plan: null as MyNutritionPlanDto | null,
  snapshot: null as unknown as ProgramSnapshotDto,
  isMockFallback: false,
  online: true,
  mutate: vi.fn(),
  queueHydration: vi.fn(),
  showToast: vi.fn(),
  metricsHistory: null as MetricsHistoryDto | null,
}));

const snapshotFixture = {
  enrollmentId: "enr-1",
  template: {},
  todayLocalDate: "2026-09-24",
  todayTasks: [],
  todayPoints: 0,
  todayBonusAvailable: false,
  todayPointsMax: 0,
  xp: { balance: 0, level: "", nextLevelAt: 0 },
  streak: {},
  nextMilestoneDays: 0,
  calendar: [],
} as unknown as ProgramSnapshotDto;

const planFixture: MyNutritionPlanDto = {
  name: "Plan Mediterráneo 1800",
  targetCondition: "Sobrepeso",
  dailyCalorieTarget: 1800,
  dailyProteinTarget: 90,
  dailyWaterMl: 2000,
};

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({ showToast: mockState.showToast }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "es",
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
  useT: () => (key: string, params?: Record<string, string>) => key.replace(/\{([^}]+)\}/g, (match, name) => params?.[name] ?? match),
}));

vi.mock("../../hooks/useNutritionLog", () => ({
  useNutritionLog: () => ({ mutate: mockState.mutate, isPending: false }),
}));

vi.mock("../../services/offline/offline-queue-service", () => ({
  isOnline: () => mockState.online,
  queueHydration: mockState.queueHydration,
  queueTaskCompletion: vi.fn(),
}));

vi.mock("../../hooks/useMyNutritionPlan", () => ({
  useMyNutritionPlan: () => ({
    plan: mockState.plan,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/useProgram", () => ({
  useProgram: () => ({
    snapshot: mockState.snapshot,
    isLoading: false,
    isMockFallback: mockState.isMockFallback,
    productMessage: null,
  }),
}));

vi.mock("../../hooks/useProgramScores", () => ({
  useProgramScores: () => ({ scores: null, isLoading: false }),
}));

vi.mock("../../hooks/useMetricsHistory", () => ({
  useMetricsHistory: () => ({ history: mockState.metricsHistory, isLoading: false }),
}));

vi.mock("../../context/WearableContext", () => ({
  useWearable: () => ({ today: { activityKcal: null } }),
}));

const snapshotWithLog = {
  ...snapshotFixture,
  todayTasks: [
    {
      taskCode: "nut",
      title: "Nutrición",
      short: "",
      points: 0,
      status: "pending",
      completedAt: null,
      content: {
        nutritionPlanName: "Plan X",
        nutritionMeals: [{ mealType: "Desayuno", calories: 400, sortOrder: 0 }],
        nutritionIntakeLogs: [
          {
            mealCode: "des",
            localDate: "2026-09-24",
            source: "manual",
            createdAt: "2026-09-24T08:30:00.000Z",
          },
        ],
      },
    },
  ],
} as unknown as ProgramSnapshotDto;

describe("NutritionPage — pestaña Hoy con metas del plan (Fase 8)", () => {
  beforeEach(() => {
    mockState.plan = planFixture;
    mockState.snapshot = snapshotFixture;
    mockState.isMockFallback = false;
    mockState.online = true;
    mockState.mutate.mockReset();
    mockState.queueHydration.mockReset();
    mockState.showToast.mockReset();
    mockState.metricsHistory = null;
  });

  it.each(['publicadas', 'sin recomendaciones', 'IA caída'])('3.18: Plan funciona con %s desde el envoltorio D0014', scenario => {
    render(<NutritionPage
      recommendations={scenario === 'sin recomendaciones' ? { current: null, previous: [] } : nutritionRecommendationsResponseFixture}
      recommendationsUnavailable={scenario === 'IA caída'} />);
    expect(screen.queryByRole('region', { name: 'Recomendaciones de tu nutricionista' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Pestaña de nutrición' }), { target: { value: 'indicaciones' } });
    expect(screen.getAllByText('Plan Mediterráneo 1800').length).toBeGreaterThan(0);
    if (scenario === 'publicadas') {
      expect(screen.getByRole('region', { name: 'Recomendaciones de tu nutricionista' })).toBeTruthy();
      expect(screen.getByText(nutritionRecommendationFixture.professionalName)).toBeTruthy();
    } else if (scenario === 'sin recomendaciones') expect(screen.getByText('Aún no tienes recomendaciones')).toBeTruthy();
    else expect(screen.getByRole('alert').textContent).toContain('Tu plan y tus registros siguen disponibles.');
    expect(mockState.mutate).not.toHaveBeenCalled();
  });

  it.each(['con historial', 'historial vacío', 'IA caída'])('3.19-prep: Plan conserva su contenido con %s', scenario => {
    const { container } = render(<NutritionPage
      recommendations={{ current: nutritionRecommendationFixture, previous: scenario === 'historial vacío' ? [] : [previousNutritionRecommendationFixture] }}
      recommendationsUnavailable={scenario === 'IA caída'} />);
    expect(screen.queryByRole('region', { name: 'Ciclos anteriores' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Pestaña de nutrición' }), { target: { value: 'indicaciones' } });
    expect(screen.getAllByText('Plan Mediterráneo 1800').length).toBeGreaterThan(0);
    if (scenario !== 'IA caída') fireEvent.click(screen.getByText('Ver ciclos anteriores'));
    if (scenario === 'con historial') {
      expect(screen.getByRole('region', { name: 'Ciclos anteriores' })).toBeTruthy();
      expect(screen.getByText('Ciclo 1')).toBeTruthy();
      expect(container.textContent).toContain(previousNutritionRecommendationFixture.patientMessage);
    } else if (scenario === 'historial vacío') {
      expect(screen.getByText('Todavía no hay ciclos anteriores')).toBeTruthy();
    } else expect(screen.queryByRole('region', { name: 'Ciclos anteriores' })).toBeNull();
    expect(mockState.mutate).not.toHaveBeenCalled();
  });

  it('3.18: separa el día del plan del ciclo revisado y conserva los accesos', () => {
    mockState.plan = { ...planFixture, currentDay: 4, durationDays: 30, meals: [{ mealType: 'Breakfast', description: 'Avena con fruta y huevo' }] };
    render(<NutritionPage recommendations={nutritionRecommendationsResponseFixture} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Pestaña de nutrición' }), { target: { value: 'indicaciones' } });
    expect(screen.getByText('Día 4')).toBeTruthy();
    expect(screen.getByText('Cierre del ciclo 2 · publicado el 07/12/2026')).toBeTruthy();
    expect(screen.queryByText(/Ciclo \d+ · día 4/)).toBeNull();
    expect(screen.getByText('Tu nutricionista revisó tu mes')).toBeTruthy();
    fireEvent.click(screen.getByText('Ver plan completo'));
    expect(screen.getByText('Tu menú de hoy')).toBeTruthy();
    fireEvent.click(screen.getByText('Volver al resumen del plan'));
    fireEvent.click(screen.getByText('Ver ciclos anteriores'));
    expect(screen.queryByText('Tu plan de este ciclo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Plan' }));
    expect(screen.getByText('Tu plan de este ciclo')).toBeTruthy();
  });

  it('D0014 final: muestra la última publicación de un ciclo ya cerrado y conserva previous por publishedAt', () => {
    mockState.plan = { ...planFixture, currentDay: 4, durationDays: 30, startDate: '2027-01-06', endDate: '2027-02-04' };
    mockState.snapshot = { ...snapshotFixture, todayLocalDate: '2027-01-09' };
    render(<NutritionPage recommendations={nutritionRecommendationsPublicationOrderFixture}/>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Pestaña de nutrición' }), { target: { value: 'indicaciones' } });
    expect(screen.getByText('Cierre del ciclo 1 · publicado el 08/01/2027')).toBeTruthy();
    expect(screen.getByText('Día 4')).toBeTruthy();
    expect(screen.queryByText('Ciclo 1 · día 4')).toBeNull();
    fireEvent.click(screen.getByText('Ver ciclos anteriores'));
    expect(screen.getAllByText(/^Ciclo \d$/).map(item => item.textContent)).toEqual(['Ciclo 2', 'Ciclo 3']);
    expect(screen.getByText('Publicado el 07/01/2027')).toBeTruthy();
    expect(screen.getByText('Publicado el 06/01/2027')).toBeTruthy();
    expect(screen.queryByText('Ciclo 1')).toBeNull();
  });

  it('3.19: un fallo en el historial conserva su retorno a Plan y el reintento', () => {
    const retry = vi.fn();
    const view = render(<NutritionPage recommendations={nutritionRecommendationsResponseFixture} onRetryRecommendations={retry}/>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Pestaña de nutrición' }), { target: { value: 'indicaciones' } });
    fireEvent.click(screen.getByText('Ver ciclos anteriores'));
    view.rerender(<NutritionPage recommendations={nutritionRecommendationsResponseFixture} recommendationsUnavailable onRetryRecommendations={retry}/>);
    expect(screen.getByRole('alert').textContent).toContain('Puedes volver a Plan');
    fireEvent.click(screen.getByText('Reintentar'));
    expect(retry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Plan' }));
    expect(screen.getByText('Tu plan de este ciclo')).toBeTruthy();
  });

  it("0.13 — muestra kg/m² y % en indicadores e historial sin modificar las unidades del contrato", () => {
    const series = (code: string, unit: string, value: number) => ({
      code, unit, target: null, favorableDirection: null,
      points: [{ date: '2026-09-24', value }],
    });
    mockState.metricsHistory = { heightCm: 170, metrics: [
      series('weight', 'kg', 70.5), series('bmi', 'kg_m2', 24.4),
      series('hba1c', 'pct', 5.6), series('body_fat', 'pct', 24),
    ] };
    const { container } = render(<NutritionPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Más secciones de nutrición' }));
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));

    const metrics = container.querySelector('.ntr-metrics')!;
    expect(metrics.textContent).toContain('24,4kg/m²');
    expect(metrics.textContent).toContain('5,6%');
    expect(metrics.textContent).toContain('24,0%');
    expect(screen.getByText(/HbA1c 5,6 %/)).toBeTruthy();
    expect(container.textContent).not.toContain('kg_m2');
    expect(container.textContent).not.toContain('pct');
    expect(mockState.metricsHistory.metrics[1].unit).toBe('kg_m2');
    expect(mockState.metricsHistory.metrics[2].unit).toBe('pct');
  });

  it("usa la meta de calorías del plan como referencia del anillo", () => {
    const { container } = render(<NutritionPage />);

    // Denominador del anillo con la meta del plan (1800, no inventado).
    // Nota: sin separador de miles en el ICU de Node.
    expect(container.textContent).toContain("1800");
    // Meta de agua estándar del plan (2000 ml → texto histórico intacto).
    expect(
      screen.getByText("💧 Hidratación · 0 vasos · meta 8 vasos (2L)"),
    ).toBeTruthy();
  });

  it("usa la meta de agua del plan cuando difiere del estándar", () => {
    mockState.plan = { ...planFixture, dailyWaterMl: 1500 };
    render(<NutritionPage />);

    expect(
      screen.getByText("💧 Hidratación · 0 vasos · meta 6 vasos (1,5 L)"),
    ).toBeTruthy();
    expect(screen.getAllByLabelText(/^Vaso \d+ de 6$/)).toHaveLength(6);
    expect(screen.queryByLabelText("Vaso 7 de 6")).toBeNull();

    fireEvent.click(screen.getByLabelText("Vaso 6 de 6"));
    expect(mockState.mutate.mock.calls[0][0]).toEqual({
      mealCode: "agua",
      intake: { waterMl: 1500, source: "manual" },
    });
  });

  it("sin plan conserva la tarjeta de hidratación estándar", () => {
    mockState.plan = null;
    render(<NutritionPage />);

    expect(
      screen.getByText("💧 Hidratación · 0 vasos · meta 8 vasos (2L)"),
    ).toBeTruthy();
    expect(screen.getAllByLabelText(/^Vaso \d+ de 8$/)).toHaveLength(8);
    fireEvent.click(screen.getByLabelText("Vaso 8 de 8"));
    expect(mockState.mutate.mock.calls[0][0]).toEqual({
      mealCode: "agua",
      intake: { waterMl: 2000, source: "manual" },
    });
  });

  it("ofrece y registra los 11 vasos prescritos sin limitar el total a 2 L", () => {
    mockState.plan = { ...planFixture, dailyWaterMl: 2750 };
    render(<NutritionPage />);

    expect(screen.getAllByLabelText(/^Vaso \d+ de 11$/)).toHaveLength(11);
    expect(screen.getByText("💧 Hidratación · 0 vasos · meta 11 vasos (2,75 L)")).toBeTruthy();
    expect(screen.getByText("0 / 2750 ml")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Vaso 8 de 11"));
    fireEvent.click(screen.getByLabelText("Vaso 9 de 11"));
    fireEvent.click(screen.getByLabelText("Vaso 11 de 11"));

    expect(mockState.mutate.mock.calls.map(([variables]) => variables)).toEqual([
      { mealCode: "agua", intake: { waterMl: 2000, source: "manual" } },
      { mealCode: "agua", intake: { waterMl: 2250, source: "manual" } },
      { mealCode: "agua", intake: { waterMl: 2750, source: "manual" } },
    ]);
    expect(screen.getByText("2750 / 2750 ml")).toBeTruthy();
    expect(screen.getByLabelText("Vaso 11 de 11").getAttribute("aria-pressed")).toBe("true");

    // Los taps iguales o menores conservan el total acumulado sin otro write.
    fireEvent.click(screen.getByLabelText("Vaso 11 de 11"));
    fireEvent.click(screen.getByLabelText("Vaso 9 de 11"));
    expect(mockState.mutate).toHaveBeenCalledTimes(3);
  });

  it("usa el agua del día asignado cuando no hay meta global del plan", () => {
    mockState.plan = {
      ...planFixture,
      dailyWaterMl: null,
      days: [{ dayNumber: 1, dailyWaterMl: 2750 }],
    };
    render(<NutritionPage />);

    expect(screen.getAllByLabelText(/^Vaso \d+ de 11$/)).toHaveLength(11);
    expect(screen.getByText("0 / 2750 ml")).toBeTruthy();
  });

  it("encola el objetivo completo de 2750 ml sin red y conserva el optimismo", () => {
    mockState.plan = { ...planFixture, dailyWaterMl: 2750 };
    mockState.online = false;
    render(<NutritionPage />);

    fireEvent.click(screen.getByLabelText("Vaso 11 de 11"));
    fireEvent.click(screen.getByLabelText("Vaso 10 de 11"));

    expect(mockState.queueHydration).toHaveBeenCalledExactlyOnceWith({ waterMl: 2750, source: "manual" });
    expect(mockState.mutate).not.toHaveBeenCalled();
    expect(screen.getByText("2750 / 2750 ml")).toBeTruthy();
  });

  it("reconcilia 2750 ml desde el snapshot y no vuelve a registrar el mismo total", () => {
    mockState.plan = { ...planFixture, dailyWaterMl: 2750 };
    const { rerender } = render(<NutritionPage />);
    fireEvent.click(screen.getByLabelText("Vaso 11 de 11"));
    mockState.snapshot = {
      ...snapshotWithLog,
      todayTasks: [{
        ...snapshotWithLog.todayTasks[0],
        content: {
          nutritionIntakeLogs: [{
            mealCode: "agua",
            localDate: "2026-09-24",
            waterMl: 2750,
          }],
        },
      }],
    } as ProgramSnapshotDto;
    rerender(<NutritionPage />);

    expect(screen.getByText("2750 / 2750 ml")).toBeTruthy();
    expect(screen.getAllByLabelText(/^Vaso \d+ de 11$/).every(
      glass => glass.getAttribute("aria-pressed") === "true",
    )).toBe(true);
    fireEvent.click(screen.getByLabelText("Vaso 11 de 11"));
    expect(mockState.mutate).toHaveBeenCalledTimes(1);
  });

  it.each([400, 409])("revierte el optimismo tras error %s y mantiene el 409 silencioso", (status) => {
    mockState.plan = { ...planFixture, dailyWaterMl: 2750 };
    render(<NutritionPage />);
    fireEvent.click(screen.getByLabelText("Vaso 11 de 11"));
    const callbacks = mockState.mutate.mock.calls[0][1];

    act(() => callbacks.onError(new ApiError({
      message: "Registro rechazado",
      status,
      errorType: "business",
    })));

    expect(screen.getByText("0 / 2750 ml")).toBeTruthy();
    expect(screen.getByLabelText("Vaso 11 de 11").getAttribute("aria-pressed")).toBe("false");
    expect(mockState.showToast).toHaveBeenCalledTimes(status === 409 ? 0 : 1);
  });

  it("el fallback sin verdad del servidor bloquea los 11 vasos", () => {
    mockState.plan = { ...planFixture, dailyWaterMl: 2750 };
    mockState.isMockFallback = true;
    render(<NutritionPage />);

    const lastGlass = screen.getByLabelText("Vaso 11 de 11");
    expect((lastGlass as HTMLIonButtonElement).disabled).toBe(true);
    fireEvent.click(lastGlass);
    expect(mockState.mutate).not.toHaveBeenCalled();
    expect(mockState.queueHydration).not.toHaveBeenCalled();
  });

  it("hero muestra el porcentaje del objetivo y ml acumulados", () => {
    const { container } = render(<NutritionPage />);

    expect(container.textContent).toContain("0 %");
    expect(screen.getByText("0 / 2000 ml")).toBeTruthy();
    expect(screen.getByLabelText("Vaso 1 de 8")).toBeTruthy();
  });

  it("pendiente muestra Registrar y Foto IA; Registrar abre el modal", () => {
    render(<NutritionPage />);

    // Una pareja de botones por comida pendiente (4 tarjetas estructurales).
    const registrarBtns = screen.getAllByText("Registrar");
    expect(registrarBtns.length).toBe(4);
    const fotoBtns = screen.getAllByText("Foto IA");
    expect(fotoBtns.length).toBe(4);
    // El doble de IonModal monta el contenido al abrir (isOpen).
    fireEvent.click(registrarBtns[0]!);
    expect(screen.getByText("Registrar comida")).toBeTruthy();
  });

  it("registrado muestra check verde, hora del log y kcal", () => {
    mockState.snapshot = snapshotWithLog;
    render(<NutritionPage />);

    expect(screen.getByText("Registrado manualmente")).toBeTruthy();
    expect(screen.getByText("400 kcal")).toBeTruthy();
    // Hora real del log (formato HH:mm del locale, sin fecha inventada).
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeTruthy();
  });
});
