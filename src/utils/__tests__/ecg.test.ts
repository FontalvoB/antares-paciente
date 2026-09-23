import { describe, expect, it } from "vitest";
import { ecgColumn, ecgSample } from "../ecg";

// Muestreo fino del ciclo para razonar sobre la morfología.
const SAMPLES = Array.from({ length: 1000 }, (_, index) =>
  ecgSample(index / 1000),
);

describe("ecgSample — morfología PQRST", () => {
  it("el pico R es el máximo del ciclo y ronda 1", () => {
    const max = Math.max(...SAMPLES);
    expect(max).toBeGreaterThan(0.95);
    expect(max).toBeLessThanOrEqual(1.01);
    // El máximo cae en la zona del QRS (≈0.215), no en P ni T.
    const peakIndex = SAMPLES.indexOf(max);
    expect(peakIndex / 1000).toBeGreaterThan(0.2);
    expect(peakIndex / 1000).toBeLessThan(0.26);
  });

  it("P y T son positivas y menores que R", () => {
    const p = ecgSample(0.12);
    const t = ecgSample(0.36);
    const r = ecgSample(0.215);
    expect(p).toBeGreaterThan(0);
    expect(t).toBeGreaterThan(0);
    expect(p).toBeLessThan(r / 2);
    expect(t).toBeLessThan(r / 2);
  });

  it("Q y S son negativas", () => {
    expect(ecgSample(0.19)).toBeLessThan(0);
    expect(ecgSample(0.24)).toBeLessThan(0);
  });

  it("la línea base entre latidos queda cerca de cero", () => {
    expect(Math.abs(ecgSample(0.6))).toBeLessThan(0.02);
    expect(Math.abs(ecgSample(0.95))).toBeLessThan(0.02);
  });

  it("es periódica y nunca produce NaN", () => {
    expect(ecgSample(0.31)).toBeCloseTo(ecgSample(1.31), 10);
    expect(SAMPLES.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe("ecgColumn", () => {
  it("conserva el pico R aunque la columna sea más ancha que el pico", () => {
    // Columna que cubre justo el QRS: el extremo debe ser el pico positivo.
    const value = ecgColumn(0.2, 0.04);
    expect(value).toBeGreaterThan(0.9);
  });

  it("sin avance de fase devuelve el valor puntual", () => {
    expect(ecgColumn(0.12, 0)).toBeCloseTo(ecgSample(0.12), 10);
  });
});
