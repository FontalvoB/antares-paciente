import { describe, it, expect } from "vitest";
import { compareFoodToMeal } from "../foodPlanComparison";
import type { FoodAnalysisResult } from "../foodAiApi";
const result = {
  foods: [{ nutritionStatus: "available" }],
  summary: { calories: 520, protein: 28, carbohydrates: 62, fat: 16, fiber: 5 },
  intake: null,
} as FoodAnalysisResult;
describe("food plan comparison", () => {
  it("compares actual meal targets without treating all below-target values as healthy", () => {
    const rows = compareFoodToMeal(result, {
      calories: 500,
      proteinG: 30,
      carbsG: 60,
      fatG: 16,
    });
    expect(rows.map((r) => r.delta)).toEqual([20, -2, 2, 0]);
    expect(rows).toHaveLength(4);
  });
  it("refuses partial analyses and missing, negative or nonfinite targets", () => {
    expect(
      compareFoodToMeal(
        {
          ...result,
          foods: [
            { nutritionStatus: "unavailable" },
          ] as FoodAnalysisResult["foods"],
        },
        { calories: 500 },
      ),
    ).toEqual([]);
    expect(compareFoodToMeal(result, { proteinG: NaN, calories: -5 })).toEqual(
      [],
    );
    expect(
      compareFoodToMeal({ ...result, summary: null }, { calories: 500 }),
    ).toEqual([]);
  });
  it("preserves an explicit zero target without dividing by zero", () => {
    expect(compareFoodToMeal(result, { fatG: 0 })[0]).toMatchObject({
      delta: 16,
      percent: null,
    });
  });
});
