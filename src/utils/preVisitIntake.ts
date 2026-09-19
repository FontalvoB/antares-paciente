import type {
  AppointmentStatus,
  PreVisitIntakeDto,
  PreVisitIntakeInput,
} from "./appointmentsApi";

/**
 * Pre-consulta del paciente (F4) — lógica pura del formulario: límites del
 * contrato, validación, normalización DTO ↔ formulario y reglas de ciclo de
 * vida (editable solo mientras la cita está Confirmed; lectura durante y
 * después de la consulta). Fuera del componente para poder probarla con vitest.
 */

/** Límites del backend (design F4): motivo 500, síntomas 4000, textos 2000. */
export const PRE_VISIT_INTAKE_LIMITS = {
  reason: 500,
  symptoms: 4000,
  allergies: 2000,
  medications: 2000,
} as const;

export interface PreVisitIntakeForm {
  reason: string;
  symptoms: string;
  allergies: string;
  medications: string;
}

export type PreVisitIntakeField = keyof PreVisitIntakeForm;
export type PreVisitIntakeFieldError = "required" | "tooLong";
export type PreVisitIntakeErrors = Partial<
  Record<PreVisitIntakeField, PreVisitIntakeFieldError>
>;

/** Formulario vacío (cita sin pre-consulta o DTO aún no cargado). */
export function emptyPreVisitIntakeForm(): PreVisitIntakeForm {
  return { reason: "", symptoms: "", allergies: "", medications: "" };
}

/** DTO del backend → estado del formulario (null/undefined → ""). */
export function intakeFormFromDto(
  dto: PreVisitIntakeDto | null | undefined,
): PreVisitIntakeForm {
  return {
    reason: dto?.reason ?? "",
    symptoms: dto?.symptoms ?? "",
    allergies: dto?.allergies ?? "",
    medications: dto?.medications ?? "",
  };
}

/** Validación cliente alineada con el contrato: motivo obligatorio y límites. */
export function validatePreVisitIntake(
  form: PreVisitIntakeForm,
): PreVisitIntakeErrors {
  const errors: PreVisitIntakeErrors = {};
  const reason = form.reason.trim();
  if (!reason) errors.reason = "required";
  else if (reason.length > PRE_VISIT_INTAKE_LIMITS.reason)
    errors.reason = "tooLong";

  for (const field of ["symptoms", "allergies", "medications"] as const) {
    if (form[field].trim().length > PRE_VISIT_INTAKE_LIMITS[field])
      errors[field] = "tooLong";
  }
  return errors;
}

/**
 * Formulario → body del PUT: recorta y manda null en los textos opcionales
 * vacíos (el motivo siempre viaja como string).
 */
export function intakeInputFromForm(
  form: PreVisitIntakeForm,
): PreVisitIntakeInput {
  const optional = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  return {
    reason: form.reason.trim(),
    symptoms: optional(form.symptoms),
    allergies: optional(form.allergies),
    medications: optional(form.medications),
  };
}

/** ¿Hay algún dato guardado que mostrar en modo lectura? */
export function hasPreVisitIntakeContent(form: PreVisitIntakeForm): boolean {
  return (
    form.reason.trim().length > 0 ||
    form.symptoms.trim().length > 0 ||
    form.allergies.trim().length > 0 ||
    form.medications.trim().length > 0
  );
}

/** Editable mientras la cita está Confirmed y la sesión no inició. */
export function isPreVisitIntakeEditable(
  status: AppointmentStatus | null | undefined,
): boolean {
  return status === "Confirmed";
}

/**
 * El CTA se ofrece en citas vigentes (Confirmed, editable) y en curso
 * (InProgress, solo lectura); terminales y solicitudes no lo muestran.
 */
export function preVisitIntakeVisible(
  status: AppointmentStatus | null | undefined,
): boolean {
  return status === "Confirmed" || status === "InProgress";
}
