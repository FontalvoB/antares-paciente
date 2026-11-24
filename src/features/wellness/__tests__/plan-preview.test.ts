import { describe, expect, it } from "vitest";
import { EMPTY_OBJECTIVE_DRAFT } from "../domain/draft";
import {
  basalMetabolicRate,
  buildPlanPreview,
  macrosFor,
} from "../domain/plan-preview";
import type { ObjectiveDraft } from "../domain/types";

const base: ObjectiveDraft = {
  ...EMPTY_OBJECTIVE_DRAFT,
  goal: "bajar",
  sex: "F",
  age: 34,
  heightCm: 165,
  weightKg: 72,
  waistCm: 82,
  targetWeightKg: 65,
  activity: 2,
  pace: "m",
};

describe("plan preview (motor v5.2)", () => {
  it("calcula BMR Mifflin-St Jeor", () => {
    // 10*72 + 6.25*165 - 5*34 - 161 = 1420.25
    expect(basalMetabolicRate(base)).toBeCloseTo(1420.25, 2);
  });

  it("aplica el déficit del ritmo y redondea a 10", () => {
    const plan = buildPlanPreview(base)!;
    expect(plan.kcal % 10).toBe(0);
    expect(plan.kcal).toBeLessThan(1420.25 * 1.375);
  });

  it("nunca baja del piso femenino de 1200 kcal", () => {
    const plan = buildPlanPreview({
      ...base,
      weightKg: 45,
      heightCm: 150,
      age: 60,
      activity: 1,
      pace: "max",
    })!;
    expect(plan.kcal).toBe(1200);
  });

  it("nunca baja del piso masculino de 1500 kcal", () => {
    const plan = buildPlanPreview({
      ...base,
      sex: "M",
      weightKg: 50,
      heightCm: 155,
      age: 70,
      activity: 1,
      pace: "max",
    })!;
    expect(plan.kcal).toBe(1500);
  });

  it("los macros suman la kcal objetivo dentro del 3 %", () => {
    for (const goal of ["bajar", "masa", "def"] as const) {
      const plan = buildPlanPreview({ ...base, goal })!;
      const macroKcal = plan.proteinG * 4 + plan.carbsG * 4 + plan.fatG * 9;
      expect(Math.abs(macroKcal - plan.kcal) / plan.kcal).toBeLessThan(0.03);
    }
  });

  it("respeta el mínimo de 80 g de carbohidrato", () => {
    const macros = macrosFor(1200, 90, "def");
    expect(macros.carbsG).toBeGreaterThanOrEqual(80);
  });

  it("redondea el agua a 250 ml", () => {
    const plan = buildPlanPreview(base)!;
    expect(plan.waterMl % 250).toBe(0);
    expect(plan.waterMl).toBe(2500);
  });

  it("devuelve la vista de 365 días con IMC y semana 1", () => {
    const plan = buildPlanPreview(base)!;
    expect(plan.day).toBe(1);
    expect(plan.totalDays).toBe(365);
    expect(plan.bmi).toBeCloseTo(26.4, 1);
    expect(plan.estimatedWeeks).toBeGreaterThan(0);
  });

  it("devuelve null si faltan datos mínimos", () => {
    expect(buildPlanPreview({ ...base, goal: null })).toBeNull();
    expect(buildPlanPreview({ ...base, activity: null })).toBeNull();
  });
});
