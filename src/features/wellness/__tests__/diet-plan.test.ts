import { describe, expect, it } from "vitest";
import { buildDietDay, DIET_TOLERANCE, MACRO_KEYS, nextDish, waterGoalMl } from "../nutrition/diet-plan";
import { FOODS } from "../nutrition/meal-catalog";

const target = { kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500, weightKg: 72 };
const regular = { vegetarian: false, dairyFree: false };

describe("Dieta v5.2", () => {
  it("arma cuatro comidas con gramos y energía consistente con los macros", () => {
    const { meals, total, fiberG } = buildDietDay(target, 1, regular);
    expect(meals.map(({ id }) => id)).toEqual(["breakfast", "lunch", "snack", "dinner"]);
    expect(meals.flatMap(({ ingredients }) => ingredients).every(({ grams }) => grams > 0)).toBe(true);
    const macroEnergy = 4 * total.proteinG + 4 * total.carbsG + 9 * total.fatG;
    expect(Math.abs(macroEnergy / total.kcal - 1)).toBeLessThanOrEqual(0.03);
    expect(fiberG).toBe(25);
  });

  it("cambia el plato de forma determinista dentro de la tolerancia diaria", () => {
    const initial = buildDietDay(target, 1, regular);
    for (const meal of initial.meals) {
      const id = meal.id;
      const option = nextDish(initial, id);
      expect(option).not.toBe(meal.option);
      expect(nextDish(buildDietDay(target, 1, regular), id)).toBe(option);
      const swapped = buildDietDay(target, 1, regular, { [id]: option });
      expect(swapped.meals.find((dish) => dish.id === id)?.ingredients).not.toEqual(meal.ingredients);
      expect(swapped.meals.filter((dish) => dish.id !== id).map((dish) => dish.ingredients))
        .toEqual(initial.meals.filter((dish) => dish.id !== id).map((dish) => dish.ingredients));
      expect(Math.abs(swapped.total.kcal / target.kcal - 1)).toBeLessThanOrEqual(DIET_TOLERANCE);
      for (const key of MACRO_KEYS) {
        expect(Math.abs(swapped.total[key] / initial.total[key] - 1)).toBeLessThanOrEqual(DIET_TOLERANCE);
      }
    }
  });

  it.each([[true, false], [false, true], [true, true]])(
    "respeta vegetariana=%s y sin lácteos=%s en todas las opciones",
    (vegetarian, dairyFree) => {
      const { options } = buildDietDay(target, 1, { vegetarian, dairyFree });
      for (const dish of options.flat()) {
        for (const { id } of dish.ingredients) {
          const group = FOODS[id][6];
          if (vegetarian) expect(["meat", "fish"]).not.toContain(group);
          if (dairyFree) expect(group).not.toBe("dairy");
        }
      }
    },
  );

  it("reduce a dos opciones y conserva cuatro comidas", () => {
    const plan = buildDietDay(target, 1, regular, {}, true);
    expect(plan.meals).toHaveLength(4);
    expect(plan.options.map((options) => options.length)).toEqual([2, 2, 2, 2]);
  });

  it("aplica 35 ml/kg redondeados a 250 ml y respeta snapshots previos", () => {
    expect(waterGoalMl(70)).toBe(2500);
    expect(waterGoalMl(80)).toBe(2750);
    expect(buildDietDay({ ...target, waterMl: 3000 }, 1, regular).waterMl).toBe(2500);
    expect(buildDietDay({ ...target, weightKg: undefined, waterMl: 3000 }, 1, regular).waterMl).toBe(3000);
  });
});

