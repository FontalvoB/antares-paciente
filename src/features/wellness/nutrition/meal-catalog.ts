/**
 * Generado de engine/engine.js del kit v5.2 (FD, MAXG, MEALN, SHARE y TPL).
 * Porciones verificadas contra buildMeal y okFood para las cuatro combinaciones de preferencias.
 * Valores nutricionales por 100 g.
 */
type Food = readonly [
  label: string, english: string, kcal: number, protein: number,
  carbs: number, fat: number, group: string, unitG: number, maxG: number | null,
];

export const FOODS = {
  egg: ["Huevo", "Egg", 143, 12.6, 0.7, 9.5, "egg", 50, 250],
  tofu: ["Tofu firme", "Firm tofu", 120, 13, 3, 7, "", 0, 300],
  arepa: ["Arepa de maíz", "Corn arepa", 170, 3.6, 35, 1.4, "", 80, 240],
  bread: ["Pan integral", "Whole-wheat bread", 250, 10, 45, 3.5, "", 35, 140],
  avo: ["Aguacate", "Avocado", 160, 2, 9, 15, "", 0, 140],
  papaya: ["Papaya", "Papaya", 43, 0.5, 11, 0.3, "", 0, null],
  oil: ["Aceite de oliva", "Olive oil", 884, 0, 0, 100, "", 0, 20],
  orange: ["Naranja", "Orange", 47, 0.9, 12, 0.1, "", 130, null],
  oats: ["Avena en hojuelas", "Rolled oats", 389, 16.9, 66, 6.9, "", 0, 120],
  pb: ["Mantequilla de maní", "Peanut butter", 588, 25, 20, 50, "", 0, 40],
  alm: ["Almendras", "Almonds", 579, 21, 22, 50, "", 0, 50],
  ban: ["Banano", "Banana", 89, 1.1, 23, 0.3, "", 120, null],
  chicken: ["Pechuga de pollo", "Chicken breast", 165, 31, 0, 3.6, "meat", 0, null],
  lent: ["Lentejas cocidas", "Cooked lentils", 116, 9, 20, 0.4, "", 0, null],
  rice: ["Arroz cocido", "Cooked rice", 130, 2.7, 28, 0.3, "", 0, null],
  quin: ["Quinoa cocida", "Cooked quinoa", 120, 4.4, 21, 1.9, "", 0, null],
  veg: ["Ensalada y verduras", "Salad & vegetables", 25, 1.5, 5, 0.2, "", 0, null],
  fish: ["Pescado blanco (tilapia)", "White fish (tilapia)", 128, 26, 0, 2.7, "fish", 0, null],
  chick: ["Garbanzos cocidos", "Cooked chickpeas", 164, 8.9, 27, 2.6, "", 0, null],
  yuca: ["Yuca cocida", "Boiled cassava", 160, 1.4, 38, 0.3, "", 0, null],
  turkey: ["Pechuga de pavo", "Turkey breast", 135, 30, 0, 1, "meat", 0, null],
  pasta: ["Pasta cocida", "Cooked pasta", 158, 5.8, 31, 0.9, "", 0, null],
  brocc: ["Brócoli / vegetales cocidos", "Broccoli / cooked veg", 34, 2.8, 7, 0.4, "", 0, null],
  queso: ["Queso fresco bajo en grasa", "Low-fat fresh cheese", 180, 20, 3, 10, "dairy", 0, 120],
  tuna: ["Atún en agua", "Tuna in water", 116, 26, 0, 0.8, "fish", 0, null],
  platano: ["Plátano maduro", "Ripe plantain", 122, 1.3, 32, 0.4, "", 0, null],
  apple: ["Manzana", "Apple", 52, 0.3, 14, 0.2, "", 150, null],
  salmon: ["Salmón", "Salmon", 208, 20, 0, 13, "fish", 0, null],
  bean: ["Fríjoles cocidos", "Cooked beans", 132, 8.9, 23.7, 0.5, "", 0, null],
  potato: ["Papa cocida", "Boiled potato", 77, 2, 17, 0.1, "", 0, null],
} satisfies Record<string, Food>;

export type FoodId = keyof typeof FOODS;
export type TemplateItem = readonly [
  role: "P" | "C" | "F" | "X", foods: readonly FoodId[], grams?: number,
];

export const MEAL_IDS = ["breakfast", "lunch", "snack", "dinner"] as const;
export type MealId = (typeof MEAL_IDS)[number];

export const MEAL_CATALOG = [
  {
    label: "Desayuno",
    share: 0.25,
    options: [
      [["P", ["egg", "tofu"]], ["C", ["arepa", "bread"]], ["F", ["avo"]], ["X", ["papaya"], 120]],
      [["P", ["egg", "tofu"]], ["C", ["bread"]], ["F", ["avo", "oil"]], ["X", ["orange"], 130]],
      [["P", ["egg", "tofu"]], ["C", ["oats"]], ["F", ["pb", "alm"]], ["X", ["ban"], 100]],
    ],
  },
  {
    label: "Almuerzo",
    share: 0.35,
    options: [
      [["P", ["chicken", "tofu", "lent"]], ["C", ["rice", "quin"]], ["F", ["oil"]], ["X", ["veg"], 200]],
      [["P", ["fish", "tofu", "chick"]], ["C", ["rice", "yuca"]], ["F", ["avo", "oil"]], ["X", ["veg"], 200]],
      [["P", ["turkey", "lent", "tofu"]], ["C", ["pasta"]], ["F", ["oil"]], ["X", ["brocc"], 150]],
    ],
  },
  {
    label: "Merienda",
    share: 0.15,
    options: [
      [["P", ["queso", "egg", "tofu"]], ["C", ["arepa", "bread"]], ["F", ["avo", "oil"]]],
      [["P", ["tuna", "egg", "tofu"]], ["C", ["bread"]], ["F", ["oil"]]],
      [["P", ["egg", "tofu"]], ["C", ["platano", "apple"]], ["F", ["alm"]]],
    ],
  },
  {
    label: "Cena",
    share: 0.25,
    options: [
      [["P", ["egg", "tofu"]], ["C", ["arepa", "bread"]], ["F", ["avo", "oil"]], ["X", ["veg"], 150]],
      [["P", ["fish", "tofu"]], ["C", ["rice", "quin"]], ["F", ["avo", "oil"]], ["X", ["veg"], 200]],
      [["P", ["salmon", "tofu", "bean"]], ["C", ["potato", "rice"]], ["F", ["oil"]], ["X", ["veg"], 200]],
    ],
  },
] satisfies readonly { label: string; share: number; options: readonly (readonly TemplateItem[])[] }[];
