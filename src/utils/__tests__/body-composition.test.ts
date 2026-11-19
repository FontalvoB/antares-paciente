import { describe, it, expect } from "vitest";
import {
  computeBmi,
  heightToMeters,
  latestSeriesValue,
  weightToKg,
  type MeasurementValueLike,
} from "../body-composition";

const measurement = (
  value: number,
  unitCode: string,
  unitSymbol = unitCode,
): MeasurementValueLike => ({ value, unitCode, unitSymbol });

describe("heightToMeters — normalización y bordes", () => {
  it("convierte cm, mm y m al SI", () => {
    expect(heightToMeters(measurement(170, "cm"))).toBeCloseTo(1.7, 6);
    expect(heightToMeters(measurement(1700, "mm"))).toBeCloseTo(1.7, 6);
    expect(heightToMeters(measurement(1.7, "m"))).toBeCloseTo(1.7, 6);
  });

  it("un valor sin unidad fiable > 3 solo puede ser cm", () => {
    expect(heightToMeters(measurement(168, "", ""))).toBeCloseTo(1.68, 6);
  });

  it("rechaza valores no finitos, no positivos o fuera de rango", () => {
    expect(heightToMeters(null)).toBeNull();
    expect(heightToMeters(measurement(0, "cm"))).toBeNull();
    expect(heightToMeters(measurement(-170, "cm"))).toBeNull();
    expect(heightToMeters(measurement(Number.NaN, "cm"))).toBeNull();
    expect(
      heightToMeters(measurement(Number.POSITIVE_INFINITY, "cm")),
    ).toBeNull();
    // 12 cm / 400 cm: fuera del rango humano plausible.
    expect(heightToMeters(measurement(12, "cm"))).toBeNull();
    expect(heightToMeters(measurement(400, "cm"))).toBeNull();
  });

  it("respeta el borde inferior y superior del rango", () => {
    expect(heightToMeters(measurement(30, "cm"))).toBeCloseTo(0.3, 6);
    expect(heightToMeters(measurement(300, "cm"))).toBeCloseTo(3, 6);
    expect(heightToMeters(measurement(29.9, "cm"))).toBeNull();
    expect(heightToMeters(measurement(300.1, "cm"))).toBeNull();
  });
});

describe("weightToKg — normalización y bordes", () => {
  it("acepta kg y convierte g y lb", () => {
    expect(weightToKg(measurement(70.5, "kg"))).toBeCloseTo(70.5, 6);
    expect(weightToKg(measurement(70500, "g"))).toBeCloseTo(70.5, 6);
    expect(weightToKg(measurement(155.43, "lb"))).toBeCloseTo(70.5, 2);
  });

  it("rechaza valores no finitos, no positivos o absurdos", () => {
    expect(weightToKg(null)).toBeNull();
    expect(weightToKg(measurement(0, "kg"))).toBeNull();
    expect(weightToKg(measurement(-70, "kg"))).toBeNull();
    expect(weightToKg(measurement(Number.NaN, "kg"))).toBeNull();
    expect(weightToKg(measurement(1001, "kg"))).toBeNull();
  });
});

describe("computeBmi — cálculo, bordes y datos faltantes", () => {
  it("calcula el IMC estándar con peso y talla válidos", () => {
    // 70.5 / 1.7² = 24.394...
    expect(computeBmi(70.5, 1.7)).toBeCloseTo(24.394, 3);
    expect(computeBmi(81.5, 1.68)).toBeCloseTo(28.876, 3);
  });

  it("el borde de talla válida sigue calculando", () => {
    expect(computeBmi(30, 0.3)).toBeCloseTo(333.333, 3);
    expect(computeBmi(90, 3)).toBeCloseTo(10, 6);
  });

  it("sin peso, sin talla o con valores inválidos → null", () => {
    expect(computeBmi(null, 1.7)).toBeNull();
    expect(computeBmi(70.5, null)).toBeNull();
    expect(computeBmi(undefined, undefined)).toBeNull();
    expect(computeBmi(0, 1.7)).toBeNull();
    expect(computeBmi(70.5, 0)).toBeNull();
    expect(computeBmi(-70.5, 1.7)).toBeNull();
    expect(computeBmi(70.5, 0.1)).toBeNull();
    expect(computeBmi(70.5, 3.1)).toBeNull();
    expect(computeBmi(Number.NaN, 1.7)).toBeNull();
    expect(computeBmi(70.5, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("latestSeriesValue — serie abierta por código", () => {
  const metrics = [
    {
      code: "weight",
      points: [{ value: 84 }, { value: 81.5 }],
    },
  ];

  it("devuelve el último punto de la serie (case-insensitive)", () => {
    expect(latestSeriesValue(metrics, "WEIGHT")).toBe(81.5);
  });

  it("sin serie o sin puntos → null (no inventa)", () => {
    expect(latestSeriesValue(metrics, "height")).toBeNull();
    expect(latestSeriesValue([], "weight")).toBeNull();
    expect(
      latestSeriesValue([{ code: "weight", points: [] }], "weight"),
    ).toBeNull();
  });
});
