import { describe, expect, it } from "vitest";
import { measurePolicyFor, outcomeForResult } from "../ycbt/session";

// Política de medida puntual: la FC emite ~1 muestra/s (3 muestras bastan) y
// el SpO2 es un barrido largo cuya lectura se fija al final — exigirle 3
// muestras agotaba la ventana y mostraba un error falso.
describe("measurePolicyFor", () => {
  it("la FC cierra con 3 muestras en 30 s y reintenta a los 10 s", () => {
    expect(measurePolicyFor("heart_rate")).toEqual({
      target: 3,
      windowMs: 30_000,
      retryMs: 10_000,
    });
  });

  it("la presión espera 60 s con 3 muestras y reintenta a los 15 s", () => {
    expect(measurePolicyFor("blood_pressure")).toEqual({
      target: 3,
      windowMs: 60_000,
      retryMs: 15_000,
    });
  });

  it("el SpO2 termina con la PRIMERA lectura válida en 60 s (reintento a los 20 s)", () => {
    expect(measurePolicyFor("spo2")).toEqual({
      target: 1,
      windowMs: 60_000,
      retryMs: 20_000,
    });
  });

  it("una métrica sin política propia usa la de por defecto", () => {
    expect(measurePolicyFor("glucose")).toEqual({
      target: 3,
      windowMs: 30_000,
    });
  });
});

describe("outcomeForResult (04 0e)", () => {
  it("resultado 2 = la medida falló (contacto/movimiento)", () => {
    expect(outcomeForResult(2)).toBe("failed");
  });

  it("cualquier otro resultado = cancelada por el anillo", () => {
    expect(outcomeForResult(0)).toBe("cancelled");
    expect(outcomeForResult(1)).toBe("cancelled");
    expect(outcomeForResult(undefined)).toBe("cancelled");
  });
});
