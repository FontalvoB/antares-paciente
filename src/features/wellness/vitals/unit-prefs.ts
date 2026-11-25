import { VITAL_METRICS } from "./vitals-store";
import type { VitalMetric } from "./vitals-store";

export interface UnitPrefs {
  weight: "kg" | "lb";
  temperature: "°C" | "°F";
  glucose: "mg/dL" | "mmol/L";
}

export const DEFAULT_UNITS: UnitPrefs = { weight: "kg", temperature: "°C", glucose: "mg/dL" };
export const UNIT_OPTIONS = {
  weight: ["kg", "lb"],
  temperature: ["°C", "°F"],
  glucose: ["mg/dL", "mmol/L"],
} as const;

const KG_PER_LB = 0.45359237;
const GLUCOSE_MG_PER_MMOL = 18.01559;

function storageKey(owner: string) {
  return "wellness.vitals.units.v1." + encodeURIComponent(owner);
}

export function loadUnitPrefs(owner: string): UnitPrefs {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(owner)) ?? "{}");
    return {
      weight: stored?.weight === "lb" ? "lb" : DEFAULT_UNITS.weight,
      temperature: stored?.temperature === "°F" ? "°F" : DEFAULT_UNITS.temperature,
      glucose: stored?.glucose === "mmol/L" ? "mmol/L" : DEFAULT_UNITS.glucose,
    };
  } catch {
    return { ...DEFAULT_UNITS };
  }
}

export function saveUnitPrefs(owner: string, prefs: UnitPrefs): void {
  window.localStorage.setItem(storageKey(owner), JSON.stringify(prefs));
}

export function hasUnitPrefs(metric: VitalMetric): metric is keyof UnitPrefs {
  return Object.hasOwn(UNIT_OPTIONS, metric);
}

export function displayUnit(metric: VitalMetric, prefs: UnitPrefs): string {
  return hasUnitPrefs(metric) ? prefs[metric] : VITAL_METRICS[metric].unit;
}

export function toDisplayValue(metric: VitalMetric, value: number, prefs: UnitPrefs): number {
  if (metric === "weight" && prefs.weight === "lb") return value / KG_PER_LB;
  if (metric === "temperature" && prefs.temperature === "°F") return value * (9 / 5) + 32;
  if (metric === "glucose" && prefs.glucose === "mmol/L") return value / GLUCOSE_MG_PER_MMOL;
  return value;
}

