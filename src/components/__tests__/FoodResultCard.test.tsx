import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FoodResultCard } from "../FoodResultCard";
import { I18nProvider } from "../../i18n/I18nContext";
import type { DetectedFood } from "../../utils/foodAiApi";

function food(overrides: Partial<DetectedFood> = {}): DetectedFood {
  return {
    name: "rice",
    confidence: 0.9,
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    segmentation: null,
    portion: {
      portionSize: "medium",
      estimatedGrams: 126,
      minGrams: 110,
      maxGrams: 140,
      confidence: 0.7,
      method: "basic_reference",
    },
    nutrition: {
      calories: 164,
      protein: 3.4,
      carbohydrates: 35.5,
      fat: 0.38,
      fiber: 0.5,
      sugar: 0,
      sodium: 0,
    },
    nutritionRange: null,
    nutritionStatus: "available",
    source: "USDA FoodData Central",
    sourceVersion: null,
    sourceId: null,
    ...overrides,
  };
}

function renderCard(f: DetectedFood) {
  return render(
    <I18nProvider>
      <FoodResultCard food={f} />
    </I18nProvider>,
  );
}

describe("FoodResultCard", () => {
  it("muestra kcal y macros con fibra cuando hay datos", () => {
    const { container } = renderCard(food());
    expect(screen.getByText("164")).toBeTruthy();
    expect(screen.getByText(/Proteínas 3g/)).toBeTruthy();
    expect(screen.getByText(/Fibra 1g/)).toBeTruthy();
    expect(container.querySelector(".nut-missing")).toBeNull();
  });

  it("sin datos muestra estado compacto, no campos vacíos", () => {
    const { container } = renderCard(
      food({ nutrition: null, nutritionStatus: "unavailable" }),
    );
    expect(
      screen.getByText("Información nutricional no disponible"),
    ).toBeTruthy();
    expect(container.querySelector(".nut-missing")).toBeTruthy();
    expect(screen.queryByText(/Proteínas/)).toBeNull();
  });

  it("nombres largos no rompen el layout", () => {
    const { container } = renderCard(
      food({ name: "beans_yellow_mature_seeds_raw" }),
    );
    expect(screen.getByText("frijoles amarillos")).toBeTruthy();
    const nameEl = screen.getByText("frijoles amarillos");
    expect(nameEl.style.overflowWrap).toBe("anywhere");
    expect(container.querySelector(".nut-missing")).toBeNull();
  });
});
