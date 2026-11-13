import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NutritionPlanTab } from "../NutritionPlanTab";
import type { MyNutritionPlanDto } from "../../../services/nutrition/my-nutrition-plan-service";
import { ApiError } from "../../../utils/apiClient";

vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "es", t: (key: string, params?: Record<string, string>) => key.replace(/\{([^}]+)\}/g, (match, name) => params?.[name] ?? match) }),
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
  it('un error del plan sigue visible aunque el snapshot tenga metas de referencia', () => {
    const onRetry = vi.fn();
    render(<NutritionPlanTab {...baseProps} error={new ApiError({ message: 'No se pudo consultar el plan', status: 503 })} fallbackRows={[{ emoji: '🔥', label: 'Calorías diarias', value: '1800 kcal' }]} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo consultar el plan');
    expect(screen.queryByText('1800 kcal')).toBeNull();
    fireEvent.click(screen.getByText('Reintentar'));
    expect(onRetry).toHaveBeenCalledOnce();
  });
  it('un estado pendiente o vencido oculta el menú aprobado que quedó en cache', () => {
    const view = render(<NutritionPlanTab {...baseProps} plan={planFixture} status={{ status: 'pending_review', durationDays: 30 }} />);
    expect(screen.queryByText('Avena, plátano')).toBeNull();
    expect(screen.getByText('En revisión por nutrición')).toBeTruthy();
    view.rerender(<NutritionPlanTab {...baseProps} plan={planFixture} status={{ status: 'expired', durationDays: 30 }} />);
    expect(screen.queryByText('Avena, plátano')).toBeNull();
    expect(screen.getByText('Preparando tu próximo ciclo')).toBeTruthy();
  });

  it('espera la revisión aprobada actual en lugar de mostrar una versión anterior de cache', () => {
    render(<NutritionPlanTab {...baseProps} plan={{ ...planFixture, id: 'plan-A', revision: 1 }} status={{ status: 'active', planId: 'plan-A', revision: 2, durationDays: 30 }} />);
    expect(screen.queryByText('Avena, plátano')).toBeNull();
    expect(screen.getByText('Actualizando tu plan')).toBeTruthy();
  });
  it("incluye merienda sin inventar alimentos si no está prescrita", () => {
    render(<NutritionPlanTab {...baseProps} plan={planFixture} />);
    expect(screen.getAllByText('Merienda / snack')).toHaveLength(1);
    expect(screen.getAllByText('Tu nutricionista aún no ha indicado esta comida para este día.')).toHaveLength(1);
    expect(screen.getByText('Tu nutricionista aún no ha indicado una merienda o snack para este día.')).toBeTruthy();
  });

  it("muestra el día del ciclo y el menú que corresponde tras repetir la semana", () => {
    const plan = { ...planFixture, meals: undefined, durationDays: 30, currentDay: 10, startDate: '2026-11-01', endDate: '2026-11-30', days: Array.from({ length: 7 }, (_, i) => ({ dayNumber: i + 1, meals: [{ mealType: 'Snack', foods: `Merienda del menú ${i + 1}` }] })) };
    const view = render(<NutritionPlanTab {...baseProps} plan={plan} />);
    expect(screen.getByText('Merienda del menú 3')).toBeTruthy();
    expect(screen.queryByText('Merienda del menú 1')).toBeNull();
    expect(screen.getByText('Día 10 de 30')).toBeTruthy();
    expect(screen.getAllByText('Merienda / snack')).toHaveLength(1);
    view.rerender(<NutritionPlanTab {...baseProps} plan={plan} status={{ status: 'active', durationDays: 30, currentDay: 11 }} />);
    expect(screen.getByText('Día 11 de 30')).toBeTruthy();
    expect(screen.getByText('Merienda del menú 4')).toBeTruthy();
  });

  it("un plan en revisión muestra su estado sin comidas ni metas de fallback", () => {
    render(<NutritionPlanTab {...baseProps} status={{ status: 'pending_review', durationDays: 30 }} fallbackRows={[{ emoji: '🔥', label: 'Calorías diarias', value: '1800 kcal' }]} />);
    expect(screen.getByText('En revisión por nutrición')).toBeTruthy();
    expect(screen.queryByText('1800 kcal')).toBeNull();
  });

  it("conserva cada snack y su orden prescrito sin copiar el horario general", () => {
    const { container } = render(<NutritionPlanTab {...baseProps} plan={{ ...planFixture,
      mealTiming: '07:00, 12:00, 15:30, 19:00',
      meals: [
        { mealType: 'Snack', foods: 'Fruta de la tarde', suggestedTime: '15:30', sortOrder: 3 },
        { mealType: 'Desayuno', foods: 'Desayuno prescrito', sortOrder: 1 },
        { mealType: 'Snack', foods: 'Snack legacy adicional', suggestedTime: '10:00', sortOrder: 2 },
      ],
    }} />);
    const prescribed = [...container.querySelectorAll('.nutrition-plan-meal:not(.nutrition-plan-unconfigured)')];
    expect(prescribed.map(meal => meal.querySelector('.nutrition-plan-foods p')?.textContent)).toEqual(['Desayuno prescrito', 'Snack legacy adicional', 'Fruta de la tarde']);
    expect(prescribed[0].querySelector('.nutrition-plan-meal-head p')).toBeNull();
    expect(screen.getAllByText('07:00, 12:00, 15:30, 19:00')).toHaveLength(1);
    expect(screen.getByLabelText('Meriendas y snacks: 2 comidas')?.textContent).toContain('2 comidas');
  });

  it("usa el agua del día vigente y no inventa una merienda al estar ausente", () => {
    render(<NutritionPlanTab {...baseProps} plan={{ ...planFixture, meals: undefined, currentDay: 2,
      days: [{ dayNumber: 1, dailyWaterMl: 1800, meals: [{ mealType: 'Snack', foods: 'Snack solo del día uno' }] },
        { dayNumber: 2, dailyWaterMl: 2300, meals: [{ mealType: 'Almuerzo', foods: 'Menú del día dos' }] }],
    }} />);
    expect(screen.getByText('2300 ml')).toBeTruthy();
    expect(screen.queryByText('2000 ml')).toBeNull();
    expect(screen.queryByText('Snack solo del día uno')).toBeNull();
    expect(screen.getByText('Tu nutricionista aún no ha indicado una merienda o snack para este día.')).toBeTruthy();
  });

  it("mantiene visibles las restricciones prescritas y las porciones del snack", () => {
    render(<NutritionPlanTab {...baseProps} plan={{ ...planFixture, allergens: 'Evitar maní',
      meals: [{ mealType: 'Snack', foods: 'Yogur natural: 150 g', notes: 'Sin azúcar añadida', waterMl: 250 }],
    }} />);
    expect(screen.getByText('Evitar maní')).toBeTruthy();
    expect(screen.getByText('Yogur natural: 150 g')).toBeTruthy();
    expect(screen.getByText('Agua con esta comida: 250 ml')).toBeTruthy();
    expect(screen.getByText('Sin azúcar añadida')).toBeTruthy();
  });
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
    expect(screen.getAllByText(/7:00/)[0]).toBeTruthy();
    expect(screen.getByText("400")).toBeTruthy();
    expect(screen.getByText("20 g")).toBeTruthy();
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
