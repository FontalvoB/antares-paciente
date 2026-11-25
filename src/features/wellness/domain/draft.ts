/**
 * Valores iniciales y utilidades del borrador de objetivo (KAN-136).
 */

import { NQS_LENGTH, PARQ_LENGTH } from "./questions";
import type { ObjectiveDraft, YesNo } from "./types";

/** Versión de los términos que se acepta en este flujo. */
export const WELLNESS_TERMS_VERSION = "wellness-v1-2026-11";

/** Borrador vacío con las preguntas sin responder (`null`). */
export const EMPTY_OBJECTIVE_DRAFT: ObjectiveDraft = {
  email: "",
  name: "",
  goal: null,
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  waistCm: null,
  targetWeightKg: null,
  activity: null,
  pace: "m",
  vegetarian: false,
  dairyFree: false,
  parq: Array<YesNo>(PARQ_LENGTH).fill(null),
  nqs: Array<YesNo>(NQS_LENGTH).fill(null),
  doctorConfirmed: false,
  nutritionistConfirmed: false,
  terms: null,
};

/** Convierte un valor de input numérico a `number | null` sin aceptar NaN. */
export function parseNumberInput(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Rangos aceptados por el formulario (mensajes de validación en la UI). */
export const RANGES = {
  age: { min: 13, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 350 },
  waistCm: { min: 40, max: 250 },
  targetWeightKg: { min: 30, max: 350 },
} as const;
