import type {
  FavorableDirection,
  MetricPointDto,
  MetricSeriesDto,
  MetricTargetDto,
} from "../services/program/types";

/**
 * Tarjetas de métricas del Home. Este archivo ya NO contiene datos clínicos
 * fabricados (verdad 100 % del backend vía metrics-history / scores-history /
 * snapshot): solo metadatos de presentación + resolvers puros.
 */

export type MetricId = "imc" | "hba1c" | "fat" | "adh" | "pts";

/** Metadatos de presentación de cada tarjeta (sin datos clínicos). */
export const HOME_METRIC_CARDS: ReadonlyArray<{
  id: MetricId;
  label: string;
  color: string;
  decimals: number;
}> = [
  { id: "imc", label: "IMC", color: "var(--teal)", decimals: 1 },
  { id: "hba1c", label: "HbA1c", color: "var(--blue)", decimals: 1 },
  { id: "fat", label: "% de grasa", color: "var(--teal)", decimals: 1 },
  { id: "adh", label: "Adherencia", color: "var(--cyan)", decimals: 0 },
  { id: "pts", label: "Puntos", color: "var(--org)", decimals: 0 },
];

/** Unidad local cuando el wire no la trae (adh/pts no salen de metrics-history). */
const FALLBACK_UNIT: Record<MetricId, string> = {
  imc: "kg/m²",
  hba1c: "%",
  fat: "%",
  adh: "%",
  pts: "XP",
};

/** Nota honesta del estado requires-data (clave t()) por tarjeta: cada una
 *  explica QUÉ completará el dato — jamás un genérico que suene a error.
 *  pts nunca cae en requires-data: el balance real siempre existe. */
const REQUIRES_DATA_NOTE: Record<MetricId, string> = {
  imc: "Se completa con tu primera medición",
  hba1c: "Aparece cuando tu equipo registra tu primer análisis/bioimpedancia",
  fat: "Aparece cuando tu equipo registra tu primer análisis/bioimpedancia",
  adh: "Se completa con tu primera semana de adherencia",
  pts: "Sin datos",
};

/**
 * Estado resuelto de una tarjeta del Home: `requires-data` (sin verdad del
 * backend) o `value` (valor REAL + serie + barra hacia el target del backend).
 * Nada se fabrica: sin filas → requires-data, nunca un número inventado.
 */
export type HomeMetricCard =
  | {
      id: MetricId;
      label: string;
      color: string;
      decimals: number;
      unit: string;
      kind: "requires-data";
      note: string;
    }
  | {
      id: MetricId;
      label: string;
      color: string;
      decimals: number;
      unit: string;
      kind: "value";
      current: number;
      /** Progreso 0..1 hacia el borde del target; null = sin barra (sin target real). */
      progress: number | null;
      /** Rango de referencia REAL del endpoint (null = sin rango activo). */
      target: MetricTargetDto | null;
      /** Serie REAL (fechas ASC). Vacía solo si no hay historial real (ej. pts). */
      points: MetricPointDto[];
      first: number | null;
      last: number | null;
    };

/** Inputs reales del resolver: DTO de metrics-history + adherencia por semana + balance XP. */
export interface HomeMetricsInput {
  heightCm: number | null;
  metrics: MetricSeriesDto[];
  /** Puntos de adherencia (dimensions.adherence del scores-history), ASC. */
  adherence: MetricPointDto[];
  xpBalance: number;
}

/**
 * Avance de la métrica desde su primer registro hacia el borde del rango de
 * referencia REAL ({lo,hi} del endpoint), en 0..1. Sin target o sin dirección
 * favorable conocida → null (la UI no dibuja barra — honesto). La dirección
 * favorable decide el borde: 'down' → hi (menor es mejor), 'up' → lo.
 */
export function metricProgress(opts: {
  series: number[];
  target: MetricTargetDto;
  favorableDirection: FavorableDirection | null;
}): number | null {
  const { series, target, favorableDirection } = opts;
  if (series.length < 1) return null;
  if (!favorableDirection) return null;
  const first = series[0];
  const current = series[series.length - 1];
  const edge = favorableDirection === "down" ? target.hi : target.lo;
  if (edge == null || !Number.isFinite(edge)) return null;
  // Ya dentro/mejor que el borde → objetivo alcanzado.
  if (favorableDirection === "down" ? current <= edge : current >= edge)
    return 1;
  const span = favorableDirection === "down" ? first - edge : edge - first;
  if (span <= 0) return 1;
  const advance =
    favorableDirection === "down" ? first - current : current - first;
  return Math.min(1, Math.max(0, advance / span));
}

/**
 * Formatea un valor con la cantidad de decimales de la tarjeta. Locale
 * opcional (S3): 'es-ES' por defecto; los componentes pasan el locale activo
 * (lang === 'en' ? 'en-US' : 'es-ES').
 */
export function formatMetricValue(
  value: number,
  decimals: number,
  locale = "es-ES",
): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formatea un rango de referencia {lo,hi} para la UI de la tarjeta/modal.
 * Usa los DECIMALES de la tarjeta (CRITICAL): un target de HbA1c {hi: 5.7}
 * con decimals 1 rinde "≤ 5,7 %" — jamás "≤ 6 %" (misrepresenta el cutoff
 * ADA). Locale opcional, igual que formatMetricValue.
 */
export function formatMetricTarget(
  target: MetricTargetDto | null,
  unit: string,
  decimals: number,
  locale = "es-ES",
): string | null {
  if (!target) return null;
  const lo = target.lo;
  const hi = target.hi;
  if (lo != null && hi != null) {
    return `${formatMetricValue(lo, decimals, locale)}–${formatMetricValue(hi, decimals, locale)}${unit ? ` ${unit}` : ""}`;
  }
  if (hi != null)
    return `≤ ${formatMetricValue(hi, decimals, locale)}${unit ? ` ${unit}` : ""}`;
  if (lo != null)
    return `≥ ${formatMetricValue(lo, decimals, locale)}${unit ? ` ${unit}` : ""}`;
  return null;
}

/**
 * Resuelve las 5 tarjetas del Home a partir de la verdad del backend.
 * - imc: serie `bmi` del endpoint; sin bmi pero con peso + talla del perfil →
 *   cómputo cliente peso/(talla/100)²; ni uno → requires-data.
 * - hba1c / fat: serie del endpoint; sin filas → requires-data.
 * - adh: serie de dimensions.adherence (scores-history); sin puntos → requires-data.
 * - pts: balance XP real; SIN historial falso (series vacías, sin sparkline).
 */
export function resolveHomeCards(
  input: HomeMetricsInput,
): Record<MetricId, HomeMetricCard> {
  const byCode = new Map(input.metrics.map((m) => [m.code.toLowerCase(), m]));
  const seriesOf = (code: string): MetricSeriesDto | undefined =>
    byCode.get(code.toLowerCase());

  const imc = resolveImcSeries(
    input.heightCm,
    seriesOf("bmi"),
    seriesOf("weight"),
  );
  const hba1c = seriesOf("hba1c");
  const fat = seriesOf("body_fat");

  return {
    imc: toCard(
      "imc",
      imc?.unit ?? null,
      imc?.target ?? null,
      imc?.favorableDirection ?? null,
      imc?.points ?? [],
    ),
    hba1c: toCard(
      "hba1c",
      hba1c?.unit ?? null,
      hba1c?.target ?? null,
      hba1c?.favorableDirection ?? null,
      hba1c?.points ?? [],
    ),
    fat: toCard(
      "fat",
      fat?.unit ?? null,
      fat?.target ?? null,
      fat?.favorableDirection ?? null,
      fat?.points ?? [],
    ),
    adh: toCard("adh", null, null, null, input.adherence),
    pts: {
      id: "pts",
      label: "Puntos",
      color: "var(--org)",
      decimals: 0,
      unit: "XP",
      kind: "value",
      current: input.xpBalance,
      progress: null,
      target: null,
      points: [],
      first: null,
      last: null,
    },
  };
}

function toCard(
  id: MetricId,
  unit: string | null,
  target: MetricTargetDto | null,
  favorableDirection: FavorableDirection | null,
  points: MetricPointDto[],
): HomeMetricCard {
  const meta = HOME_METRIC_CARDS.find((c) => c.id === id)!;
  if (points.length === 0) {
    return {
      id,
      label: meta.label,
      color: meta.color,
      decimals: meta.decimals,
      unit: unit ?? FALLBACK_UNIT[id],
      kind: "requires-data",
      note: REQUIRES_DATA_NOTE[id],
    };
  }
  const current = points[points.length - 1].value;
  const progress =
    target != null
      ? metricProgress({
          series: points.map((p) => p.value),
          target,
          favorableDirection,
        })
      : null;
  return {
    id,
    label: meta.label,
    color: meta.color,
    decimals: meta.decimals,
    unit: unit ?? FALLBACK_UNIT[id],
    kind: "value",
    current,
    progress,
    target,
    points,
    first: points[0].value,
    last: current,
  };
}

/**
 * Serie de IMC: la `bmi` del endpoint manda. Sin filas de bmi pero con serie
 * de peso + talla del perfil → cómputo cliente por fecha (peso/(talla/100)²,
 * 2 decimales). El backend ya computa este fallback server-side; aquí es la
 * capa defensiva del cliente (el endpoint devuelve `weight` como código
 * solicitado). Ni uno → undefined → la tarjeta degrada a requires-data.
 */
function resolveImcSeries(
  heightCm: number | null,
  bmi: MetricSeriesDto | undefined,
  weight: MetricSeriesDto | undefined,
): MetricSeriesDto | undefined {
  if (bmi && bmi.points.length > 0) return bmi;
  if (
    !weight ||
    weight.points.length === 0 ||
    heightCm == null ||
    heightCm <= 0
  ) {
    return undefined;
  }
  const heightM = heightCm / 100;
  const points = weight.points
    .filter((p) => p.value > 0)
    .map((p) => ({
      date: p.date,
      value: Math.round((p.value / (heightM * heightM)) * 100) / 100,
    }));
  if (points.length === 0) return undefined;
  return {
    code: "bmi",
    unit: bmi?.unit ?? "kg/m²",
    target: null,
    favorableDirection: null,
    points,
  };
}
