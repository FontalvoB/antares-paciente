// Helpers puros del check-in de signos vitales (tarjetas de Programa).

/** Número de un valor de vitales: acepta "118/76" (toma la sistólica) y coma decimal. */
export function vitalNumber(raw: string): number {
  if (!raw.trim()) return NaN;
  if (raw.includes("/")) return parseFloat(raw.split("/")[0]);
  return parseFloat(raw.replace(",", "."));
}

export interface VitalStatus {
  label: string;
  cls: "" | "ok";
}

type Translate = (source: string, params?: Record<string, string>) => string;

/**
 * Presentación del registro, sin interpretar su significado clínico. Solo una
 * meta de actividad explícita permite mostrar progreso de adherencia.
 */
export function vitalStatus(
  n: number,
  t: Translate,
  goal?: number,
): VitalStatus {
  if (!Number.isFinite(n)) return { label: "—", cls: "" };
  if (goal !== undefined) {
    return n >= goal
      ? { label: t("Meta alcanzada"), cls: "ok" }
      : { label: t("En progreso"), cls: "" };
  }
  return { label: t("Valor ingresado"), cls: "" };
}

/** Geometría de la barra de una tarjeta (porcentajes 0–100 del dominio visible). */
export interface VitalBar {
  /** Posición del valor dentro del dominio visible. */
  pct: number;
  /** Inicio del relleno de progreso de una meta explícita. */
  bandLeft: number;
  /** Relleno hasta el valor (meta); cero para mediciones sin meta. */
  bandWidth: number;
}

/**
 * Posición dentro de un dominio visual explícito. Los límites locales lo/hi
 * no producen bandas clínicas. Solo una meta de actividad tiene relleno.
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
    const goal = field.goal;
    const pct = !Number.isFinite(n) || !goal || !Number.isFinite(goal) || goal < 0 ? 0 : clamp(at(n, 0, goal));
    return { pct, bandLeft: 0, bandWidth: pct };
  }

  const { min, max } = field;
  const pct = !Number.isFinite(n) || min === undefined || max === undefined || max <= min
    ? 0 : clamp(at(n, min, max));
  return { pct, bandLeft: 0, bandWidth: 0 };
}

/** Minutos → horas con 2 decimales (414 → 6.9). El canónico sigue siendo minutos. */
export function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Horas → minutos enteros, sin deriva (6.9 → 414; 7.08 → 425). */
export function minutesFromHours(hours: number): number {
  return Math.round(hours * 60);
}
