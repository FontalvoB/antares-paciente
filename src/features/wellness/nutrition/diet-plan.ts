import { FOODS, MEAL_CATALOG, MEAL_IDS } from "./meal-catalog";
import type { FoodId, MealId, TemplateItem } from "./meal-catalog";

export interface DietMacros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DietTargets extends DietMacros {
  weightKg?: number;
  waterMl: number;
}

export interface DietPreferences {
  vegetarian: boolean;
  dairyFree: boolean;
}

interface Ingredient {
  id: FoodId;
  grams: number;
}

interface Dish extends DietMacros {
  ingredients: Ingredient[];
  option: number;
}

export interface DietMeal extends Dish {
  id: MealId;
  label: string;
  canSwap: boolean;
}

export type MealChoices = Partial<Record<MealId, number>>;

export const DIET_TOLERANCE = 0.08;
export const WATER_SERVING_ML = 250;
export const MACRO_KEYS = ["kcal", "proteinG", "carbsG", "fatG"] as const;

export function waterGoalMl(weightKg: number) {
  return Math.round(weightKg * 35 / WATER_SERVING_ML) * WATER_SERVING_ML;
}

// Mismo filtro de dietas que okFood en el motor v5.2.
export function okFood(id: FoodId, prefs: DietPreferences) {
  const group = FOODS[id][6];
  return !(prefs.vegetarian && (group === "meat" || group === "fish"))
    && !(prefs.dairyFree && group === "dairy");
}

export function sumMacros(items: readonly DietMacros[]): DietMacros {
  return items.reduce((sum, item) => ({
    kcal: sum.kcal + item.kcal,
    proteinG: sum.proteinG + item.proteinG,
    carbsG: sum.carbsG + item.carbsG,
    fatG: sum.fatG + item.fatG,
  }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
}

function foodMacros(id: FoodId, grams: number): DietMacros {
  const [, , kcal, protein, carbs, fat] = FOODS[id];
  return {
    kcal: kcal * grams / 100,
    proteinG: protein * grams / 100,
    carbsG: carbs * grams / 100,
    fatG: fat * grams / 100,
  };
}

const ROLE_INDEX = { P: 3, C: 4, F: 5 } as const;
const ROLE_KEY = { P: "proteinG", C: "carbsG", F: "fatG" } as const;
const ROLE_MAX = { P: 320, C: 420, F: 30 } as const;
const ROLE_MIN = { P: 30, C: 20, F: 3 } as const;
const ROLES = ["P", "C", "F"] as const;

// buildMeal v5.2: despeja las porciones P/C/F contando los aportes de todos
// los ingredientes. Trabajamos en gramos para afinar el ajuste de energía.
function buildDish(
  template: readonly TemplateItem[],
  targets: DietMacros,
  share: number,
  prefs: DietPreferences,
  option: number,
): Dish {
  const items = template.map(([role, ids, fixed]) => {
    const id = ids.find((candidate) => okFood(candidate, prefs));
    if (!id) throw new Error("Incompatible v5.2 meal template");
    return { role, id, grams: fixed ?? (role === "F" ? 8 : 120) };
  });
  const totals = () => sumMacros(items.map(({ id, grams }) => foodMacros(id, grams)));

  for (let iteration = 0; iteration < 6; iteration++) {
    for (const role of ROLES) {
      const item = items.find((ingredient) => ingredient.role === role)!;
      const perGram = FOODS[item.id][ROLE_INDEX[role]] / 100;
      const key = ROLE_KEY[role];
      const other = totals()[key] - foodMacros(item.id, item.grams)[key];
      const grams = (targets[key] * share - other) / perGram;
      item.grams = Math.min(FOODS[item.id][8] ?? ROLE_MAX[role], Math.max(ROLE_MIN[role], grams));
    }
  }

  // Corrige las kcal sin cambiar las proporciones de los macros estimados.
  const scale = targets.kcal * share / totals().kcal;
  const ingredients = items.map(({ id, grams }) => ({
    id, grams: Math.max(1, Math.round(grams * scale)),
  }));
  return { option, ingredients, ...sumMacros(ingredients.map(({ id, grams }) => foodMacros(id, grams))) };
}

export function buildDietDay(
  targets: DietTargets,
  day: number,
  prefs: DietPreferences,
  choices: MealChoices = {},
  simplified = false,
) {
  const options = MEAL_CATALOG.map(({ options: templates, share }, index) => {
    const dishes = templates.map((template, option) => buildDish(template, targets, share, prefs, option));
    const offset = simplified ? 0 : (Math.max(1, day) + index * 2) % dishes.length;
    const rotated = [...dishes.slice(offset), ...dishes.slice(0, offset)];
    if (!simplified) return rotated;
    const selected = rotated.find(({ option }) => option === choices[MEAL_IDS[index]]);
    return [rotated[0], selected && selected !== rotated[0] ? selected : rotated[1]];
  });
  const meals: DietMeal[] = MEAL_IDS.map((id, index) => {
    const dishes = options[index];
    const dish = dishes.find(({ option }) => option === choices[id]) ?? dishes[0];
    return { ...dish, id, label: MEAL_CATALOG[index].label, canSwap: dishes.length > 1 };
  });
  const total = sumMacros(meals);
  const baseline = sumMacros(options.map(([first]) => first));
  const weightKg = targets.weightKg;
  const plan = {
    meals,
    total,
    baseline,
    options,
    fiberG: Math.max(25, Math.round(14 * targets.kcal / 1000)),
    waterMl: weightKg && Number.isFinite(weightKg) && weightKg > 0
      ? waterGoalMl(weightKg)
      : targets.waterMl,
  };
  return {
    ...plan,
    meals: meals.map((meal) => ({ ...meal, canSwap: nextDish(plan, meal.id) !== meal.option })),
  };
}

export function nextDish(
  plan: {
    meals: readonly DietMeal[];
    options: readonly Dish[][];
    total: DietMacros;
    baseline: DietMacros;
  },
  id: MealId,
) {
  const index = MEAL_IDS.indexOf(id);
  const meal = plan.meals[index];
  const options = plan.options[index];
  const current = options.findIndex(({ option }) => option === meal.option);
  const remaining = options.slice(current + 1).concat(options.slice(0, current));
  const alternative = remaining.find((dish) => MACRO_KEYS.every((key) => {
    const currentTotal = plan.total[key];
    const afterSwap = currentTotal - meal[key] + dish[key];
    const baseline = plan.baseline[key];
    return Math.abs(afterSwap - currentTotal) <= Math.min(currentTotal, afterSwap) * DIET_TOLERANCE
      && Math.abs(afterSwap - baseline) <= baseline * DIET_TOLERANCE;
  }));
  return alternative?.option ?? meal.option;
}

