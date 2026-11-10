import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as renderView, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { NutritionPage } from "../NutritionPage";
import type { MyNutritionPlanDto } from "../../services/nutrition/my-nutrition-plan-service";
import type { ProgramSnapshotDto } from "../../services/program/types";
import { ApiError } from "../../utils/apiClient";

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
  return {
    ...actual,
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
  useT: () => (key: string) => key,
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
  useMetricsHistory: () => ({ history: null, isLoading: false }),
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
