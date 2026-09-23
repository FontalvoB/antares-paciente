// Helpers puros del check-in de signos vitales (tarjetas de Programa).

/** Número de un valor de vitales: acepta "118/76" (toma la sistólica) y coma decimal. */
export function vitalNumber(raw: string): number {
  if (!raw.trim()) return NaN;
  if (raw.includes("/")) return parseFloat(raw.split("/")[0]);
  return parseFloat(raw.replace(",", "."));
}

export interface VitalStatus {
  label: string;
  cls: "" | "ok" | "warn";
}

type Translate = (source: string, params?: Record<string, string>) => string;

/**
 * Estado de una tarjeta a partir del valor CANÓNICO (NaN = sin valor). Sin
 * `goal` es un rango (Bajo / Alto / En rango); con `goal` es una meta acumulada
 * (pasos): "Meta alcanzada" al llegar, "En progreso" mientras tanto.
 */
export function vitalStatus(
  n: number,
  lo: number,
  hi: number,
  t: Translate,
  goal?: number,
): VitalStatus {
  if (Number.isNaN(n)) return { label: "—", cls: "" };
  if (goal !== undefined) {
    return n >= goal
      ? { label: t("Meta alcanzada"), cls: "ok" }
      : { label: t("En progreso"), cls: "" };
  }
  if (n < lo) return { label: t("Bajo"), cls: "warn" };
  if (n > hi) return { label: t("Alto"), cls: "warn" };
  return { label: t("En rango"), cls: "ok" };
}

/** Geometría de la barra de una tarjeta (porcentajes 0–100 del dominio visible). */
export interface VitalBar {
  /** Posición del valor dentro del dominio visible. */
  pct: number;
  /** Inicio de la banda saludable (rango) o del relleno de progreso (meta). */
  bandLeft: number;
  /** Ancho de la banda saludable (rango) o del relleno hasta el valor (meta). */
  bandWidth: number;
}

/**
 * Barra "real" de una tarjeta: el valor se ubica en el DOMINIO VISIBLE
 * (`min`/`max` de la métrica; por defecto el rango saludable), no en `lo..hi`
 * — así un valor apenas fuera del rango no queda pegado al borde. La banda
 * marca el rango saludable; en métricas con meta (pasos) es el relleno de
 * progreso 0 → valor.
 */
export function vitalBar(
  n: number,
  field: {
    min?: number;
    max?: number;
    lo: number;
    hi: number;
    kind?: "range" | "goal";
    goal?: number;
  },
): VitalBar {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const at = (v: number, min: number, max: number) =>
    max === min ? 0 : ((v - min) / (max - min)) * 100;

  if (field.kind === "goal") {
    const goal = field.goal ?? field.hi;
    const pct = Number.isNaN(n) || goal === 0 ? 0 : clamp(at(n, 0, goal));
    return { pct, bandLeft: 0, bandWidth: pct };
  }

  const min = field.min ?? field.lo;
  const max = field.max ?? field.hi;
  const pct = Number.isNaN(n) ? 0 : clamp(at(n, min, max));
  const bandLeft = clamp(at(field.lo, min, max));
  const bandWidth = Math.max(0, clamp(at(field.hi, min, max)) - bandLeft);
  return { pct, bandLeft, bandWidth };
}

/** Minutos → horas con 2 decimales (414 → 6.9). El canónico sigue siendo minutos. */
export function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Horas → minutos enteros, sin deriva (6.9 → 414; 7.08 → 425). */
export function minutesFromHours(hours: number): number {
  return Math.round(hours * 60);
}
