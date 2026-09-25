import { describe, expect, it, vi, beforeEach } from "vitest";

// Contract test del wire self-service (plan alimentario, Fase 8): ruta GET,
// DTO tolerante y 404 sin plan → null limpio (vacío honesto). Cualquier otro
// error propaga como ApiError — el consumidor muestra error + reintento.
const apiFetchMock = vi.fn();

vi.mock("../../../utils/apiClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../utils/apiClient")>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

import { getMyNutritionPlan } from "../my-nutrition-plan-service";
import type { MyNutritionPlanDto } from "../my-nutrition-plan-service";
import { ApiError } from "../../../utils/apiClient";

const planFixture: MyNutritionPlanDto = {
  name: "Plan Mediterráneo 1800",
  description: "Dieta mediterránea hipocalórica",
  targetCondition: "Sobrepeso",
  dailyCalorieTarget: 1800,
  dailyProteinTarget: 90,
  dailyCarbsTarget: 220,
  dailyFatTarget: 60,
  dailyFiberTarget: 28,
  dailyWaterMl: 2000,
  allergens: "frutos secos",
  mealTiming: "7:00, 12:00, 15:30, 19:00",
  meals: [
    {
      mealType: "Desayuno",
      description: "Avena con frutas",
      foods: "Avena, plátano, nueces",
      calories: 400,
      proteinG: 20,
      notes: "Sin azúcar añadida",
      suggestedTime: "7:00",
      sortOrder: 0,
    },
  ],
};

describe("getMyNutritionPlan — contrato self-service", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("pide GET /api/v1/me/nutrition-plan sin params (paciente por JWT)", async () => {
    apiFetchMock.mockResolvedValue(planFixture);
    const plan = await getMyNutritionPlan();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/me/nutrition-plan", {
      method: "GET",
    });
    expect(plan?.name).toBe("Plan Mediterráneo 1800");
    expect(plan?.dailyCalorieTarget).toBe(1800);
    expect(plan?.meals).toHaveLength(1);
  });

  it("404 sin plan asignado devuelve null limpio (sin excepción)", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({
        message: "Sin plan nutricional asignado",
        status: 404,
        errorType: "business",
      }),
    );
    await expect(getMyNutritionPlan()).resolves.toBeNull();
  });

  it("401 sesión inválida propaga como ApiError", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Unauthorized", status: 401 }),
    );
    await expect(getMyNutritionPlan()).rejects.toMatchObject({ status: 401 });
  });

  it("5xx propaga como ApiError (la UI muestra error + reintento)", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Server error", status: 500 }),
    );
    await expect(getMyNutritionPlan()).rejects.toMatchObject({ status: 500 });
  });
});
