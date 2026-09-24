import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { NutritionPage } from "../NutritionPage";
import type { MyNutritionPlanDto } from "../../services/nutrition/my-nutrition-plan-service";
import type { ProgramSnapshotDto } from "../../services/program/types";

vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Estado mutable compartido con los mocks (vi.mock se hoistea).
const mockState = vi.hoisted(() => ({
  plan: null as MyNutritionPlanDto | null,
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
    snapshot: snapshotFixture,
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

describe("NutritionPage — pestaña Hoy con metas del plan (Fase 8)", () => {
  beforeEach(() => {
    mockState.plan = planFixture;
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
});
