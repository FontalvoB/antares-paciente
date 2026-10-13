import type { MyNutritionPlanMealDto } from "../services/nutrition/my-nutrition-plan-service";
import type { FoodAnalysisResult } from "./foodAiApi";

export const FOOD_PLAN_METRICS = [
  "calories",
  "proteinG",
  "carbsG",
  "fatG",
  "fiberG",
] as const;
export type FoodPlanMetric = (typeof FOOD_PLAN_METRICS)[number];
const summaryKeys = {
  calories: "calories",
  proteinG: "protein",
  carbsG: "carbohydrates",
  fatG: "fat",
  fiberG: "fiber",
} as const;
const valid = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Comparación aritmética, sin bandas clínicas inventadas ni calorías repartidas por comida. */
export function compareFoodToMeal(
  result: FoodAnalysisResult,
  meal: MyNutritionPlanMealDto,
) {
  // Una suma parcial no puede etiquetarse como adherencia de todo el plato.
  const incomplete = result.foods.length === 0 || result.foods.some(
    (food) => food.nutritionStatus !== "available",
  );
  return FOOD_PLAN_METRICS.flatMap((key) => {
    const target = meal[key];
    const estimated =
      result.summary?.[summaryKeys[key]] ?? result.intake?.[key];
    if (!valid(target) || !valid(estimated) || incomplete) return [];
    const delta = Math.round((estimated - target) * 10) / 10;
    return [
      {
        key,
        target,
        estimated,
        delta,
        percent: target > 0 ? (estimated / target) * 100 : null,
      },
    ];
  });
}
