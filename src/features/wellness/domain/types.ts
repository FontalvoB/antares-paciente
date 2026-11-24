/**
 * Dominio del onboarding de Agentic Wellness IA (KAN-136).
 *
 * Estos tipos son el contrato entre la UI, el mock de servicio y la compuerta
 * PAR-Q/NQS. Cuando Diomedes publique el contrato `/v1` (KAN-130) solo cambia
 * la implementación de `WellnessOnboardingService`; la UI no se toca.
 */

/** Objetivo elegido por la persona. */
export type WellnessGoal = "bajar" | "masa" | "def";

/** Sexo usado solo por la fórmula de gasto energético (Mifflin-St Jeor). */
export type WellnessSex = "F" | "M";

/** Nivel de actividad 1 (sedentario) a 4 (alto). */
export type WellnessActivity = 1 | 2 | 3 | 4;

/** Ritmo del plan. `max` existe en el motor pero la UI v1 no lo ofrece. */
export type WellnessPace = "s" | "m" | "max";

/** Respuesta Sí/No. `null` = sin responder y bloquea el plan. */
export type YesNo = 0 | 1 | null;

/** Contacto de emergencia del onboarding (obligatorio el principal). */
export interface WellnessEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

/** Estado completo del formulario de objetivo de 8 pasos. */
export interface ObjectiveDraft {
  email: string;
  name: string;
  goal: WellnessGoal | null;
  sex: WellnessSex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  waistCm: number | null;
  targetWeightKg: number | null;
  activity: WellnessActivity | null;
  pace: WellnessPace;
  vegetarian: boolean;
  dairyFree: boolean;
  /** 7 respuestas PAR-Q en orden. */
  parq: YesNo[];
  /** 6 respuestas NQS en orden. */
  nqs: YesNo[];
  /** Confirma que consultó a un profesional por un "Sí" en PAR-Q. */
  doctorConfirmed: boolean;
  /** Confirma que consultó a un profesional por un "Sí" en NQS. */
  nutritionistConfirmed: boolean;
  terms: WellnessTermsAcceptance | null;
}

/** Aceptación versionada de términos y aviso de bienestar. */
export interface WellnessTermsAcceptance {
  version: string;
  acceptedAt: string;
}

/** Códigos de bloqueo de la compuerta, alineados con `/v1` (`Status.code`). */
export type GateCode = "terms" | "unanswered" | "age" | "bmi" | "doctor";

/** Un problema concreto de la compuerta, con el paso que lo resuelve. */
export interface GateIssue {
  code: GateCode;
  /** Paso del wizard (0-7) que resuelve el problema. */
  step: number;
  /** Clave i18n en español; la UI la pasa por `t()`. */
  messageKey: string;
  /** Campo o pregunta concreta, para enfocar el control. */
  field?: string;
}

/** Resultado de la compuerta. `ok` es la única condición para generar plan. */
export interface GateResult {
  ok: boolean;
  /** Primer código de bloqueo, igual que el `status.code` del backend. */
  code?: GateCode;
  issues: GateIssue[];
}

/** Resumen del plan que se muestra en la pantalla final de KAN-136. */
export interface PlanPreview {
  day: number;
  totalDays: number;
  goal: WellnessGoal;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  bmi: number;
  estimatedWeeks: number;
}

/** Resultado de generar el plan (mock hasta KAN-130). */
export interface GeneratePlanResult {
  status: GateResult;
  plan?: PlanPreview;
}

/** Cuenta existente detectada por correo en el paso 1. */
export interface EmailLookup {
  exists: boolean;
}

/** Paso del onboarding de 5 pasos. */
export type OnboardingStage =
  "email" | "emergency" | "terms" | "password" | "objective";
