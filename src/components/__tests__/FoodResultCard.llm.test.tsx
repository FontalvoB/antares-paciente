import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FoodResultCard } from "../FoodResultCard";
import { I18nProvider, useI18n } from "../../i18n/I18nContext";
import type { DetectedFood } from "../../utils/foodAiApi";

const food: DetectedFood = {
  name: "Sushi de salmón", nameEn: "Salmon sushi", confidence: 0.86,
  boundingBox: { x: 0, y: 0, width: 0, height: 0 }, segmentation: null,
  portion: null, nutrition: null, nutritionRange: null, nutritionStatus: "unavailable",
  source: null, sourceVersion: null, sourceId: null,
};

function LanguageSwitch() {
  const { toggleLang } = useI18n();
  return <button onClick={toggleLang}>Idioma</button>;
}

afterEach(() => { cleanup(); localStorage.clear(); });

describe("FoodResultCard bilingüe", () => {
  it("alterna el nombre y los copys sin cambiar los datos", () => {
    render(<I18nProvider><LanguageSwitch /><FoodResultCard food={food} /></I18nProvider>);
    expect(screen.getByText("Sushi de salmón")).toBeTruthy();
    expect(screen.getByText("Confianza alta")).toBeTruthy();
    fireEvent.click(screen.getByText("Idioma"));
    expect(screen.getByText("Salmon sushi")).toBeTruthy();
    expect(screen.getByText("High confidence")).toBeTruthy();
    expect(food.name).toBe("Sushi de salmón");
    fireEvent.click(screen.getByText("Idioma"));
    expect(screen.getByText("Sushi de salmón")).toBeTruthy();
  });

  it("conserva el nombre si una respuesta legacy no trae nameEn", () => {
    localStorage.setItem("antares_lang", "en");
    render(<I18nProvider><FoodResultCard food={{ ...food, nameEn: undefined }} /></I18nProvider>);
    expect(screen.getByText("Sushi de salmón")).toBeTruthy();
  });

  it.each([
    [0.8, "Confianza alta"], [0.799, "Confianza media"], [0.5, "Confianza media"], [0.499, "Confianza baja"],
  ])("clasifica el umbral %s como %s", (confidence, label) => {
    render(<I18nProvider><FoodResultCard food={{ ...food, confidence }} /></I18nProvider>);
    expect(screen.getByText(label)).toBeTruthy();
    expect(Boolean(screen.queryByText("Revisa este alimento o intenta con otra foto."))).toBe(confidence < 0.5);
  });

  it.each(["es", "en"])("muestra valores y fuente estimada en %s", (lang) => {
    localStorage.setItem("antares_lang", lang);
    render(<I18nProvider><FoodResultCard food={{ ...food,
      nutritionStatus: "available", nutritionSource: "llm_estimate", source: "llm_estimate",
      nutrition: { calories: 300, protein: 20, carbohydrates: 40, fat: 6, fiber: 2, sugar: null, sodium: null },
    }} /></I18nProvider>);
    expect(screen.getByText("≈ 300")).toBeTruthy();
    expect(screen.getByText(lang === "es"
      ? "≈ Valores estimados por IA — ajústalos si puedes"
      : "≈ AI estimated values — adjust them if you can")).toBeTruthy();
    expect(screen.queryByText("Información nutricional no disponible")).toBeNull();
    expect(screen.queryByText("llm_estimate")).toBeNull();
    expect(screen.getByText(lang === "es" ? "≈ Estimación de IA" : "≈ AI estimate")).toBeTruthy();
  });

  it("no marca la nutrición USDA como estimada", () => {
    render(<I18nProvider><FoodResultCard food={{ ...food,
      nutritionStatus: "available", nutritionSource: "usda",
      nutrition: { calories: 300, protein: 20, carbohydrates: 40, fat: 6, fiber: 2, sugar: 3, sodium: 100 },
    }} /></I18nProvider>);
    expect(screen.getByText("300")).toBeTruthy();
    expect(screen.queryByText(/Valores estimados por IA/)).toBeNull();
    expect(screen.getByText("Datos verificados · USDA")).toBeTruthy();
  });
});
