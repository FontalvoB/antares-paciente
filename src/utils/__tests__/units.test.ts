import { describe, expect, it } from "vitest";
import { formatMeasurement, toDisplayUnit, toMetricUnit, usesUSUnits } from "../units";

describe("unidades de Wellness", () => {
  it.each([
    [72.543, "kilogram", 159.9299389],
    [172.45, "centimeter", 67.8937008],
    [37.25, "celsius", 99.05],
    [-40, "celsius", -40],
  ] as const)("convierte %s %s y recupera el valor métrico", (metric, unit, expected) => {
    const display = toDisplayUnit(metric, unit, true);
    expect(display).toBeCloseTo(expected, 5);
    expect(toMetricUnit(display, unit, true)).toBeCloseTo(metric, 12);
    expect(toDisplayUnit(metric, unit, false)).toBe(metric);
    expect(toMetricUnit(metric, unit, false)).toBe(metric);
  });

  it("usa unidades y separadores del locale", () => {
    expect(usesUSUnits("en")).toBe(true);
    expect(usesUSUnits("en-GB")).toBe(false);
    expect(formatMeasurement(72.543, "kilogram", "en-US")).toBe("159.93 lb");
    expect(formatMeasurement(172.45, "centimeter", "en-US")).toBe("67.89 in");
    expect(formatMeasurement(37.25, "celsius", "en-US")).toBe("99.05°F");
    expect(formatMeasurement(72.543, "kilogram", "es-CO", { withUnit: false })).toBe("72,54");
  });

  it("muestra límites que se pueden ingresar sin salir del rango", () => {
    const options = { withUnit: false } as const;
    const min = formatMeasurement(30, "kilogram", "en-US", { ...options, rounding: "ceil" });
    const max = formatMeasurement(350, "kilogram", "en-US", { ...options, rounding: "floor" });
    expect(toMetricUnit(Number(min), "kilogram", true)).toBeGreaterThanOrEqual(30);
    expect(toMetricUnit(Number(max), "kilogram", true)).toBeLessThanOrEqual(350);
  });
});
