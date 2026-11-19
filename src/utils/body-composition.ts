/**
 * Composición corporal — cálculos puros y validados (KAN-94).
 *
 * El Perfil corporal calcula el IMC SOLO con datos persistidos (peso y talla).
 * Estas funciones normalizan unidades y rechazan valores no finitos o fuera de
 * rango plausible; nunca estiman ni rellenan con valores por defecto.
 */

/** Forma mínima de una medición (DTO de `GET /api/v1/me/measurements`). */
export interface MeasurementValueLike {
  value: number;
  unitCode: string;
  unitSymbol: string;
}

/** Rango plausible de talla en metros (30 cm – 3 m, alineado con el backend). */
const MIN_HEIGHT_M = 0.3;
const MAX_HEIGHT_M = 3;

/** Rango plausible de peso en kg (protege contra unidades corruptas). */
const MAX_WEIGHT_KG = 1000;

/** Libras → kilogramos (factor exacto internacional). */
const KG_PER_LB = 0.45359237;

function isFinitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Talla de una medición → metros. El backend persiste `cm`; se aceptan `mm`,
 * `cm` y `m`, y un valor sin unidad fiable > 3 solo puede ser cm. Devuelve
 * null si el resultado no cae en un rango humano plausible.
 */
export function heightToMeters(
  item: MeasurementValueLike | null | undefined,
): number | null {
  if (!item || !isFinitePositive(item.value)) return null;
  const unit = `${item.unitCode} ${item.unitSymbol}`.toLowerCase();
  const meters = unit.includes("mm")
    ? item.value / 1000
    : unit.includes("cm") || (!unit.includes("m") && item.value > 3)
      ? item.value / 100
      : item.value;
  if (!Number.isFinite(meters)) return null;
  return meters >= MIN_HEIGHT_M && meters <= MAX_HEIGHT_M ? meters : null;
}

/**
 * Peso de una medición → kilogramos. `kg` es la unidad por defecto del
 * catálogo; `g` y `lb` se convierten. Cualquier otro valor no positivo, no
 * finito o absurdo → null (la UI no inventa el peso).
 */
export function weightToKg(
  item: MeasurementValueLike | null | undefined,
): number | null {
  if (!item || !isFinitePositive(item.value)) return null;
  const unit = `${item.unitCode} ${item.unitSymbol}`.toLowerCase();
  const kg = unit.includes("kg")
    ? item.value
    : unit.includes("lb")
      ? item.value * KG_PER_LB
      : unit.includes("g")
        ? item.value / 1000
        : item.value;
  if (!Number.isFinite(kg) || kg <= 0 || kg > MAX_WEIGHT_KG) return null;
  return kg;
}

/**
 * IMC estándar = peso (kg) / talla (m)². Sin ambos valores válidos → null:
 * el consumidor muestra "sin datos", nunca una cifra estimada.
 */
export function computeBmi(
  weightKg: number | null | undefined,
  heightMeters: number | null | undefined,
): number | null {
  if (!isFinitePositive(weightKg) || !isFinitePositive(heightMeters)) {
    return null;
  }
  if (heightMeters < MIN_HEIGHT_M || heightMeters > MAX_HEIGHT_M) return null;
  const bmi = weightKg / (heightMeters * heightMeters);
  return Number.isFinite(bmi) ? bmi : null;
}

/**
 * Último valor de una serie de metrics-history por código (case-insensitive).
 * La serie llega ASC; el último punto es el vigente. Sin serie → null.
 */
export function latestSeriesValue(
  metrics: readonly {
    code: string;
    points: readonly { value: number }[];
  }[],
  code: string,
): number | null {
  const target = code.trim().toLowerCase();
  const series = metrics.find(
    (metric) => metric.code.trim().toLowerCase() === target,
  );
  const value = series?.points[series.points.length - 1]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
