export type MetricUnit = "kilogram" | "centimeter" | "celsius";

const US_UNITS = {
  kilogram: "pound",
  centimeter: "inch",
  celsius: "fahrenheit",
} as const;

export function usesUSUnits(locale: string): boolean {
  return new Intl.Locale(locale).maximize().region === "US";
}

export function toDisplayUnit(value: number, unit: MetricUnit, useUS: boolean): number {
  if (!useUS) return value;
  switch (unit) {
    case "kilogram": return value / 0.45359237;
    case "centimeter": return value / 2.54;
    case "celsius": return value * 1.8 + 32;
  }
}

export function toMetricUnit(value: number, unit: MetricUnit, useUS: boolean): number {
  if (!useUS) return value;
  switch (unit) {
    case "kilogram": return value * 0.45359237;
    case "centimeter": return value * 2.54;
    case "celsius": return (value - 32) / 1.8;
  }
}

export interface MeasurementFormatOptions {
  withUnit?: boolean;
  rounding?: "ceil" | "floor";
  useUS?: boolean;
}

export function formatMeasurement(
  value: number,
  unit: MetricUnit,
  locale: string,
  options: MeasurementFormatOptions = {},
): string {
  const { withUnit = true, rounding, useUS = usesUSUnits(locale) } = options;
  const display = toDisplayUnit(value, unit, useUS);
  // Los límites de entrada se redondean hacia dentro del rango métrico.
  const formattedValue = rounding ? Math[rounding](display * 100) / 100 : display;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    useGrouping: withUnit,
    ...(withUnit && {
      style: "unit",
      unit: useUS ? US_UNITS[unit] : unit,
      unitDisplay: "short",
    }),
  }).format(formattedValue);
}
