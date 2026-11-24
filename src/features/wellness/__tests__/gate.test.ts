import { describe, expect, it } from "vitest";
import { EMPTY_OBJECTIVE_DRAFT, WELLNESS_TERMS_VERSION } from "../domain/draft";
import { evaluateGate, OBJECTIVE_STEP } from "../domain/gate";
import type { ObjectiveDraft } from "../domain/types";

/** Borrador completo y válido; cada test rompe solo la regla que estudia. */
export function completeDraft(
  overrides: Partial<ObjectiveDraft> = {},
): ObjectiveDraft {
  return {
    ...EMPTY_OBJECTIVE_DRAFT,
    email: "ana@example.com",
    name: "Ana",
    goal: "bajar",
    sex: "F",
    age: 34,
    heightCm: 165,
    weightKg: 72,
    waistCm: 82,
    targetWeightKg: 65,
    activity: 2,
    pace: "m",
    parq: [0, 0, 0, 0, 0, 0, 0],
    nqs: [0, 0, 0, 0, 0, 0],
    terms: {
      version: WELLNESS_TERMS_VERSION,
      acceptedAt: "2026-11-24T15:00:00.000Z",
    },
    ...overrides,
  };
}

describe("evaluateGate", () => {
  it("aprueba un borrador completo", () => {
    expect(evaluateGate(completeDraft())).toEqual({ ok: true, issues: [] });
  });

  it("bloquea sin términos y apunta al paso 6", () => {
    const result = evaluateGate(completeDraft({ terms: null }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("terms");
    expect(result.issues[0].step).toBe(OBJECTIVE_STEP.terms);
  });

  it("bloquea si falta cualquier respuesta PAR-Q", () => {
    const parq = [0, 0, null, 0, 0, 0, 0] as ObjectiveDraft["parq"];
    const result = evaluateGate(completeDraft({ parq }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("unanswered");
    expect(result.issues.some((issue) => issue.field === "parq.2")).toBe(true);
  });

  it("bloquea si falta cualquier respuesta NQS", () => {
    const nqs = [0, 0, 0, 0, 0, null] as ObjectiveDraft["nqs"];
    const result = evaluateGate(completeDraft({ nqs }));
    expect(result.code).toBe("unanswered");
    expect(result.issues.some((issue) => issue.field === "nqs.5")).toBe(true);
  });

  it("bloquea a menores de 18", () => {
    const result = evaluateGate(completeDraft({ age: 17 }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("age");
  });

  it("bloquea IMC bajo con objetivo bajar", () => {
    const result = evaluateGate(
      completeDraft({
        weightKg: 45,
        heightCm: 170,
        targetWeightKg: 42,
        goal: "bajar",
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("bmi");
  });

  it("bloquea IMC bajo con objetivo definir", () => {
    const result = evaluateGate(
      completeDraft({
        weightKg: 45,
        heightCm: 170,
        targetWeightKg: 50,
        goal: "def",
      }),
    );
    expect(result.code).toBe("bmi");
  });

  it("permite IMC bajo cuando el objetivo es masa", () => {
    const result = evaluateGate(
      completeDraft({
        weightKg: 45,
        heightCm: 170,
        targetWeightKg: 52,
        goal: "masa",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("exige confirmación de consulta si hay un Sí en PAR-Q", () => {
    const parq = [1, 0, 0, 0, 0, 0, 0] as ObjectiveDraft["parq"];
    const blocked = evaluateGate(completeDraft({ parq }));
    expect(blocked.code).toBe("doctor");
    expect(blocked.issues[0].messageKey).toContain("médico");

    const confirmed = evaluateGate(
      completeDraft({ parq, doctorConfirmed: true }),
    );
    expect(confirmed.ok).toBe(true);
  });

  it("exige confirmación de consulta si hay un Sí en NQS", () => {
    const nqs = [0, 0, 1, 0, 0, 0] as ObjectiveDraft["nqs"];
    const blocked = evaluateGate(completeDraft({ nqs }));
    expect(blocked.code).toBe("doctor");

    const confirmed = evaluateGate(
      completeDraft({ nqs, nutritionistConfirmed: true }),
    );
    expect(confirmed.ok).toBe(true);
  });

  it("prioriza terms sobre unanswered y doctor", () => {
    const result = evaluateGate(
      completeDraft({
        terms: null,
        age: null,
        parq: [1, 0, 0, 0, 0, 0, 0] as ObjectiveDraft["parq"],
      }),
    );
    expect(result.code).toBe("terms");
  });

  it("devuelve todos los problemas para mostrar el camino de salida", () => {
    const result = evaluateGate(
      completeDraft({ age: 16, goal: "bajar", weightKg: 42, heightCm: 170 }),
    );
    expect(result.issues.filter((issue) => issue.code === "age")).toHaveLength(
      1,
    );
    expect(result.issues.some((issue) => issue.code === "bmi")).toBe(true);
  });
});
