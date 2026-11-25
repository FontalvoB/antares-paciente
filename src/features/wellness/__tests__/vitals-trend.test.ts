import { describe, expect, it } from "vitest";
import { VARIATION_THRESHOLD, vitalTrend } from "../vitals/vitals-trend";
import type { VitalDay, VitalValue } from "../vitals/vitals-store";

function days(values: VitalValue[]): VitalDay[] {
  return values.map((value, index) => {
    const date = "2026-11-" + String(index + 1).padStart(2, "0");
    return { date, value, source: "manual", measuredAt: date + "T12:00:00.000Z",
      timezoneOffset: 0, previous: [] };
  });
}

describe("vitals-trend", () => {
  it("requiere tres días distintos aunque haya cambios en el mismo día", () => {
    const [first, second] = days([70, 72]);
    expect(vitalTrend("heartRate", [])).toBeNull();
    expect(vitalTrend("heartRate", [first, second, { ...second, value: 73 }])).toBeNull();
  });

  it.each([
    [[70, 80, 81], "improving"],
    [[70, 71, 80], "worsening"],
    [[70, 72, 75], "steady"],
    [[80, 70, 69], "improving"],
    [[80, 79, 70], "worsening"],
  ] as const)("clasifica la estabilidad de %j como %s", (values, trend) => {
    expect(vitalTrend("heartRate", days([...values]).reverse())).toBe(trend);
  });

  it("aplica el umbral en unidades canónicas con el límite incluido", () => {
    const limit = VARIATION_THRESHOLD.heartRate;
    expect(vitalTrend("heartRate", days([70, 70, 70 + limit - 0.01]))).toBe("steady");
    expect(vitalTrend("heartRate", days([70, 70, 70 + limit]))).toBe("worsening");
    expect(vitalTrend("heartRate", days([70, 70 + limit, 70 + limit]))).toBe("improving");
  });

  it("incluye ambos componentes de presión y corrige los intervalos con fechas faltantes", () => {
    const history = days([
      { systolic: 120, diastolic: 80 },
      { systolic: 120, diastolic: 81 },
      { systolic: 120, diastolic: 89 },
    ]);
    expect(vitalTrend("bloodPressure", history)).toBe("worsening");
    expect(vitalTrend("bloodPressure", [
      ...history.slice(0, 2), { ...history[2], date: "2026-11-10" },
    ])).toBe("steady");
  });
});
