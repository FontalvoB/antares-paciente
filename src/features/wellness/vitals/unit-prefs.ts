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
const CM_PER_IN = 2.54;
const GLUCOSE_MG_PER_MMOL = 18.01559;
type BodyMetric = "weight" | "waist";

function storageKey(owner: string) {
  return "wellness.vitals.units.v1." + encodeURIComponent(owner);
}

export function loadUnitPrefs(owner: string): UnitPrefs {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(owner)) ?? "{}");
    // La preferencia de la cuenta prevalece sobre el formato general anterior.
    const legacyWeight = window.localStorage.getItem("antares_units") === "us" ? "lb" : DEFAULT_UNITS.weight;
    return {
      weight: stored?.weight === "lb" || stored?.weight === "kg" ? stored.weight : legacyWeight,
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

export function displayUnit(metric: VitalMetric | "waist", prefs: UnitPrefs): string {
  if (metric === "waist") return prefs.weight === "lb" ? "in" : "cm";
  return hasUnitPrefs(metric) ? prefs[metric] : VITAL_METRICS[metric].unit;
}

export function toDisplayValue(metric: VitalMetric | "waist", value: number, prefs: UnitPrefs): number {
  if (metric === "weight" && prefs.weight === "lb") return value / KG_PER_LB;
  if (metric === "waist" && prefs.weight === "lb") return value / CM_PER_IN;
  if (metric === "temperature" && prefs.temperature === "°F") return value * (9 / 5) + 32;
  if (metric === "glucose" && prefs.glucose === "mmol/L") return value / GLUCOSE_MG_PER_MMOL;
  return value;
}

export function bodyMeasurementFormatter(metric: BodyMetric, prefs: UnitPrefs, locale: string, delta = false) {
  const unit = displayUnit(metric, prefs);
  const number = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: unit === "lb" ? "pound" : unit === "kg" ? "kilogram" : unit === "in" ? "inch" : "centimeter",
    unitDisplay: "short",
    maximumFractionDigits: 1,
    signDisplay: delta ? "exceptZero" : "auto",
  });
  return (value: number) => number.format(toDisplayValue(metric, value, prefs));
}

