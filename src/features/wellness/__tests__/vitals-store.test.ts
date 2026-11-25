import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysToISO, toLocalISODate } from "../../../utils/dates";
import { DEFAULT_UNITS, loadUnitPrefs, saveUnitPrefs, toDisplayValue } from "../vitals/unit-prefs";
import { loadVitals, saveVital, VITAL_METRIC_IDS } from "../vitals/vitals-store";
import type { VitalMetric, VitalValue } from "../vitals/vitals-store";
import { vitalHistory } from "../vitals/vitals-trend";

const owner = "patient";
const today = new Date(2026, 10, 25, 23, 55);
const examples: Record<VitalMetric, VitalValue> = {
  heartRate: 72, bloodPressure: { systolic: 120, diastolic: 80 },
  oxygen: 97, steps: 0, sleep: 7.5, weight: 72.5, temperature: 37, glucose: 108,
};

function dayAgo(days: number): Date {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
}

beforeEach(() => localStorage.clear());

describe("vitals-store", () => {
  it("guarda las ocho métricas por fecha local y por paciente con el origen y el instante", async () => {
    await Promise.all(VITAL_METRIC_IDS.map((metric) =>
      saveVital(owner, metric, examples[metric], "manual", today),
    ));
    const vitals = loadVitals(owner);
    expect(Object.keys(vitals)).toHaveLength(8);
    for (const metric of VITAL_METRIC_IDS) {
      expect(vitals[metric]).toEqual({
        [toLocalISODate(today)]: {
          date: toLocalISODate(today), value: examples[metric], source: "manual",
          measuredAt: today.toISOString(), timezoneOffset: today.getTimezoneOffset(), previous: [],
        },
      });
    }
    expect(loadVitals("other")).toEqual({});
  });

  it("mantiene la lectura más reciente y conserva las demás sin duplicar reintentos", async () => {
    const morning = new Date(2026, 10, 25, 8);
    await saveVital(owner, "heartRate", 70, "apple", today);
    await saveVital(owner, "heartRate", 69, "manual", morning);
    await saveVital(owner, "heartRate", 71, "watch", today);
    await saveVital(owner, "heartRate", 71, "watch", today);
    await saveVital(owner, "heartRate", 68, "manual", dayAgo(1));
    const history = vitalHistory(loadVitals(owner), "heartRate", 7, today);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      value: 71, source: "watch",
      previous: [
        { value: 70, source: "apple", measuredAt: today.toISOString() },
        { value: 69, source: "manual", measuredAt: morning.toISOString() },
      ],
    });
  });

  it("aplica kg/lb, °C/°F y mg/dL/mmol/L solo a la presentación", async () => {
    const metrics = ["weight", "temperature", "glucose"] as const;
    for (const metric of metrics) await saveVital(owner, metric, examples[metric], "manual", today);
    const saved = loadVitals(owner);
    expect(loadUnitPrefs(owner)).toEqual(DEFAULT_UNITS);
    saveUnitPrefs(owner, { weight: "lb", temperature: "°F", glucose: "mmol/L" });
    const prefs = loadUnitPrefs(owner);
    expect(toDisplayValue("weight", 72.5, prefs)).toBeCloseTo(159.835, 2);
    expect(toDisplayValue("temperature", 37, prefs)).toBeCloseTo(98.6);
    expect(toDisplayValue("glucose", 108, prefs)).toBeCloseTo(5.995, 2);
    expect(loadVitals(owner)).toEqual(saved);
    expect(loadUnitPrefs("other")).toEqual(DEFAULT_UNITS);
  });

  it("incluye hoy y los límites locales de 7, 30 y 90 días, excluyendo fechas futuras", async () => {
    for (const days of [-1, 0, 6, 7, 29, 30, 89, 90]) {
      await saveVital(owner, "steps", days + 1, "watch", dayAgo(days));
    }
    const vitals = loadVitals(owner);
    const dates = (days: number[]) => days.map((day) => addDaysToISO(toLocalISODate(today), -day));
    expect(vitalHistory(vitals, "steps", 7, today).map((day) => day.date)).toEqual(dates([6, 0]));
    expect(vitalHistory(vitals, "steps", 30, today).map((day) => day.date)).toEqual(dates([29, 7, 6, 0]));
    expect(vitalHistory(vitals, "steps", 90, today).map((day) => day.date)).toEqual(dates([89, 30, 29, 7, 6, 0]));
  });

  it("conserva el historial si falla la escritura y valida el par de presión", async () => {
    await expect(saveVital(owner, "bloodPressure", { systolic: 80, diastolic: 120 }, "manual")).rejects.toThrow(RangeError);
    await saveVital(owner, "weight", 70, "manual", today);
    const before = loadVitals(owner);
    const fail = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    try {
      await expect(saveVital(owner, "weight", 71, "manual", today)).rejects.toThrow("quota");
    } finally {
      fail.mockRestore();
    }
    expect(loadVitals(owner)).toEqual(before);
  });
});
