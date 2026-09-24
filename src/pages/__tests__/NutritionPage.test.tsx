import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { NutritionPage } from "../NutritionPage";
import type { MyNutritionPlanDto } from "../../services/nutrition/my-nutrition-plan-service";
import type { ProgramSnapshotDto } from "../../services/program/types";

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
  useApp: () => ({ showToast: vi.fn() }),
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
  useNutritionLog: () => ({ mutate: vi.fn(), isPending: false }),
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
    isMockFallback: false,
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
  });

  it("sin plan conserva la tarjeta de hidratación estándar", () => {
    mockState.plan = null;
    render(<NutritionPage />);

    expect(
      screen.getByText("💧 Hidratación · 0 vasos · meta 8 vasos (2L)"),
    ).toBeTruthy();
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
    const fotoBtns = screen.getAllByText(
      (_, el) => el?.tagName === "BUTTON" && el.textContent === "📸 Foto IA",
    );
    expect(fotoBtns.length).toBe(4);
    // El doble de IonModal monta el contenido al abrir (isOpen).
    fireEvent.click(registrarBtns[0]!);
    expect(screen.getByText("Registrar comida")).toBeTruthy();
  });

  it("registrado muestra check verde, hora del log y kcal", () => {
    mockState.snapshot = snapshotWithLog;
    render(<NutritionPage />);

    expect(screen.getByText("✓ Registrado manualmente")).toBeTruthy();
    expect(screen.getByText("400 kcal")).toBeTruthy();
    // Hora real del log (formato HH:mm del locale, sin fecha inventada).
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeTruthy();
  });
});
