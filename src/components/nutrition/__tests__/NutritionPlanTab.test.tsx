import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NutritionPlanTab } from "../NutritionPlanTab";
import type { MyNutritionPlanDto } from "../../../services/nutrition/my-nutrition-plan-service";
import { ApiError } from "../../../utils/apiClient";

vi.mock("../../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
}));

const planFixture: MyNutritionPlanDto = {
  name: "Plan Mediterráneo 1800",
  targetCondition: "Sobrepeso",
  dailyCalorieTarget: 1800,
  dailyProteinTarget: 90,
  dailyCarbsTarget: 220,
  dailyFatTarget: 60,
  dailyFiberTarget: 28,
  dailyWaterMl: 2000,
  meals: [
    {
      mealType: "Desayuno",
      description: "Avena con frutas",
      foods: "Avena, plátano",
      calories: 400,
      proteinG: 20,
      notes: "Sin azúcar añadida",
      suggestedTime: "7:00",
      sortOrder: 0,
    },
    {
      mealType: "Almuerzo",
      foods: "Pollo, arroz integral",
      calories: 600,
      sortOrder: 1,
    },
  ],
};

const baseProps = {
  plan: null as MyNutritionPlanDto | null,
  isLoading: false,
  error: null as ApiError | null,
  fallbackRows: [] as { emoji: string; label: string; value: string }[],
  locale: "es-ES",
  onRetry: vi.fn(),
};

describe("NutritionPlanTab — pestaña Indicaciones (Fase 8)", () => {
  beforeEach(() => {
    baseProps.onRetry = vi.fn();
  });

  it("muestra nombre, condición, metas y comidas del plan", () => {
    render(<NutritionPlanTab {...baseProps} plan={planFixture} />);

    expect(screen.getByText("Plan Mediterráneo 1800")).toBeTruthy();
    expect(screen.getByText(/Sobrepeso/)).toBeTruthy();
    // Metas con formato es-ES del ICU de Node (sin separador de miles).
    expect(screen.getByText("1800 kcal")).toBeTruthy();
    expect(screen.getByText("90g")).toBeTruthy();
    expect(screen.getByText("2000 ml")).toBeTruthy();
    // Comidas: alimentos, notas y horario del nutricionista.
    expect(screen.getByText("Avena, plátano")).toBeTruthy();
    expect(screen.getByText(/Sin azúcar añadida/)).toBeTruthy();
    expect(screen.getByText(/7:00/)).toBeTruthy();
    expect(screen.getByText("400 kcal")).toBeTruthy();
    expect(screen.getByText("20g P")).toBeTruthy();
  });

  it("sin plan muestra el vacío honesto", () => {
    render(<NutritionPlanTab {...baseProps} />);

    expect(
      screen.getByText(
        "Tu nutricionista aún no ha asignado un plan alimentario personalizado.",
      ),
    ).toBeTruthy();
  });

  it("en carga sin verdad previa muestra skeleton", () => {
    const { container } = render(<NutritionPlanTab {...baseProps} isLoading />);

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelector("ion-skeleton-text")).toBeTruthy();
  });

  it("con error muestra alerta y el reintento llama a onRetry", () => {
    const onRetry = vi.fn();
    render(
      <NutritionPlanTab
        {...baseProps}
        error={new ApiError({ message: "Fallo de red", status: 500 })}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Fallo de red")).toBeTruthy();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("sin plan pero con filas del snapshot conserva las filas previas", () => {
    render(
      <NutritionPlanTab
        {...baseProps}
        fallbackRows={[
          { emoji: "🔥", label: "Calorías diarias", value: "1500 kcal" },
        ]}
      />,
    );

    expect(screen.getByText("1500 kcal")).toBeTruthy();
    expect(
      screen.queryByText(
        "Tu nutricionista aún no ha asignado un plan alimentario personalizado.",
      ),
    ).toBeNull();
  });
});
