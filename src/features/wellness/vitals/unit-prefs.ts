import { formatMeasurement, toDisplayUnit, toMetricUnit, usesUSUnits } from "../../../utils/units";
import type { MeasurementFormatOptions, MetricUnit } from "../../../utils/units";
import { requestLanguage } from "../../../utils/requestLanguage";
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

const GLUCOSE_MG_PER_MMOL = 18.01559;
type BodyMetric = "weight" | "waist";

function storageKey(owner: string) {
  return "wellness.vitals.units.v1." + encodeURIComponent(owner);
}

export function loadUnitPrefs(owner: string, locale: string = requestLanguage()): UnitPrefs {
  const defaults: UnitPrefs = usesUSUnits(locale)
    ? { ...DEFAULT_UNITS, weight: "lb", temperature: "°F" }
    : DEFAULT_UNITS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(owner)) ?? "{}");
    // La preferencia de la cuenta prevalece sobre el formato general anterior.
    const legacyWeight = window.localStorage.getItem("antares_units") === "us" ? "lb" : defaults.weight;
    return {
      weight: stored?.weight === "lb" || stored?.weight === "kg" ? stored.weight : legacyWeight,
      temperature:
        stored?.temperature === "°F" || stored?.temperature === "°C"
          ? stored.temperature
          : defaults.temperature,
      glucose: stored?.glucose === "mmol/L" ? "mmol/L" : defaults.glucose,
    };
  } catch {
    return { ...defaults };
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
  if (metric === "weight") return toDisplayUnit(value, "kilogram", prefs.weight === "lb");
  if (metric === "waist") return toDisplayUnit(value, "centimeter", prefs.weight === "lb");
  if (metric === "temperature") return toDisplayUnit(value, "celsius", prefs.temperature === "°F");
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

export function usesUSMeasurement(unit: MetricUnit, prefs: UnitPrefs): boolean {
  // Las longitudes siguen el sistema de medidas de peso de la persona.
  return unit === "celsius" ? prefs.temperature === "°F" : prefs.weight === "lb";
}

export function formatWellnessMeasurement(
  value: number,
  unit: MetricUnit,
  locale: string,
  prefs: UnitPrefs,
  options: Omit<MeasurementFormatOptions, "useUS"> = {},
): string {
  return formatMeasurement(value, unit, locale, { ...options, useUS: usesUSMeasurement(unit, prefs) });
}

export function parseWellnessMeasurement(value: number, unit: MetricUnit, prefs: UnitPrefs): number {
  return toMetricUnit(value, unit, usesUSMeasurement(unit, prefs));
}
