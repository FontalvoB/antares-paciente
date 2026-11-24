/**
 * Compuerta del plan (KAN-136).
 *
 * El plan solo se genera con `GateResult.ok === true`. Reglas, en el orden de
 * prioridad que devuelve el contrato `/v1`:
 *
 * 1. `terms`      — falta aceptar términos/aviso.
 * 2. `unanswered` — falta cualquier respuesta o dato del objetivo.
 * 3. `age`        — menor de 18 años.
 * 4. `bmi`        — IMC < 18.5 con objetivo bajar o definir.
 * 5. `doctor`     — hay un "Sí" en PAR-Q/NQS sin confirmar consulta profesional.
 *
 * Se devuelven también todos los problemas (`issues`) para que la UI muestre
 * el motivo y el camino de salida, no solo el primer bloqueo.
 */

import { NQS_LENGTH, PARQ_LENGTH } from "./questions";
import type {
  GateIssue,
  GateResult,
  ObjectiveDraft,
  WellnessActivity,
  WellnessGoal,
  WellnessSex,
} from "./types";

/** Índice de cada paso del formulario de objetivo de 8 pasos. */
export const OBJECTIVE_STEP = {
  goal: 0,
  data: 1,
  activity: 2,
  preferences: 3,
  parq: 4,
  nqs: 5,
  terms: 6,
  generate: 7,
} as const;

const GOALS: readonly WellnessGoal[] = ["bajar", "masa", "def"];
const SEXES: readonly WellnessSex[] = ["F", "M"];
const ACTIVITIES: readonly WellnessActivity[] = [1, 2, 3, 4];

/** IMC con dos decimales; `null` si faltan estatura o peso. */
export function bmiOf(
  draft: Pick<ObjectiveDraft, "heightCm" | "weightKg">,
): number | null {
  if (!draft.heightCm || !draft.weightKg || draft.heightCm <= 0) return null;
  return draft.weightKg / (draft.heightCm / 100) ** 2;
}

/** Edad mínima admitida por la versión v1. */
export const MIN_AGE = 18;

/** IMC mínimo para objetivos de déficit. */
export const MIN_BMI_FOR_DEFICIT = 18.5;

const isAnswered = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== "";

/**
 * Evalúa la compuerta completa. No lanza: es una función pura y determinista.
 */
export function evaluateGate(draft: ObjectiveDraft): GateResult {
  const issues: GateIssue[] = [];

  // 1. Términos y aviso versionado.
  if (!draft.terms || !draft.terms.version || !draft.terms.acceptedAt) {
    issues.push({
      code: "terms",
      step: OBJECTIVE_STEP.terms,
      messageKey: "Falta aceptar los términos y el aviso de bienestar.",
      field: "terms",
    });
  }

  // 2. Datos y respuestas obligatorias.
  if (!draft.goal || !GOALS.includes(draft.goal)) {
    issues.push({
      code: "unanswered",
      step: OBJECTIVE_STEP.goal,
      messageKey: "Selecciona tu objetivo.",
      field: "goal",
    });
  }
  if (!draft.sex || !SEXES.includes(draft.sex)) {
    issues.push({
      code: "unanswered",
      step: OBJECTIVE_STEP.data,
      messageKey: "Indica tu sexo para calcular el gasto energético.",
      field: "sex",
    });
  }
  if (!isAnswered(draft.age)) {
    issues.push({
      code: "unanswered",
      step: OBJECTIVE_STEP.data,
      messageKey: "Indica tu edad.",
      field: "age",
    });
  }
  for (const [field, messageKey] of [
    ["heightCm", "Indica tu estatura."],
    ["weightKg", "Indica tu peso actual."],
    ["waistCm", "Indica tu cintura."],
    ["targetWeightKg", "Indica tu peso meta."],
  ] as const) {
    if (!isAnswered(draft[field])) {
      issues.push({
        code: "unanswered",
        step: OBJECTIVE_STEP.data,
        messageKey,
        field,
      });
    }
  }
  if (!draft.activity || !ACTIVITIES.includes(draft.activity)) {
    issues.push({
      code: "unanswered",
      step: OBJECTIVE_STEP.activity,
      messageKey: "Selecciona tu nivel de actividad.",
      field: "activity",
    });
  }
  if (draft.parq.length !== PARQ_LENGTH) {
    issues.push({
      code: "unanswered",
      step: OBJECTIVE_STEP.parq,
      messageKey: "Responde las 7 preguntas de seguridad del ejercicio.",
      field: "parq",
    });
  } else {
    draft.parq.forEach((answer, index) => {
      if (answer === null) {
        issues.push({
          code: "unanswered",
          step: OBJECTIVE_STEP.parq,
          messageKey:
            "Responde todas las preguntas de seguridad del ejercicio.",
          field: `parq.${index}`,
        });
      }
    });
  }
  if (draft.nqs.length !== NQS_LENGTH) {
    issues.push({
      code: "unanswered",
      step: OBJECTIVE_STEP.nqs,
      messageKey: "Responde las 6 preguntas de seguridad de la nutrición.",
      field: "nqs",
    });
  } else {
    draft.nqs.forEach((answer, index) => {
      if (answer === null) {
        issues.push({
          code: "unanswered",
          step: OBJECTIVE_STEP.nqs,
          messageKey:
            "Responde todas las preguntas de seguridad de la nutrición.",
          field: `nqs.${index}`,
        });
      }
    });
  }

  // 3. Edad mínima.
  if (isAnswered(draft.age) && draft.age! < MIN_AGE) {
    issues.push({
      code: "age",
      step: OBJECTIVE_STEP.data,
      messageKey: "Esta versión es para mayores de 18 años.",
      field: "age",
    });
  }

  // 4. IMC bajo con objetivo de déficit.
  const bmi = bmiOf(draft);
  if (bmi !== null && bmi < MIN_BMI_FOR_DEFICIT && draft.goal !== "masa") {
    issues.push({
      code: "bmi",
      step: OBJECTIVE_STEP.goal,
      messageKey:
        "Con tu IMC actual no se recomienda un objetivo de bajar o definir. Elige subir masa muscular o consulta a un profesional.",
      field: "goal",
    });
  }

  // 5. "Sí" sin confirmación de consulta profesional.
  const parqPositive = draft.parq.some((answer) => answer === 1);
  const nqsPositive = draft.nqs.some((answer) => answer === 1);
  if (parqPositive && !draft.doctorConfirmed) {
    issues.push({
      code: "doctor",
      step: OBJECTIVE_STEP.parq,
      messageKey:
        "Marcaste una respuesta de seguridad del ejercicio. Consulta primero a tu médico y confírmalo para continuar.",
      field: "doctorConfirmed",
    });
  }
  if (nqsPositive && !draft.nutritionistConfirmed) {
    issues.push({
      code: "doctor",
      step: OBJECTIVE_STEP.nqs,
      messageKey:
        "Marcaste una respuesta de seguridad de la nutrición. Consulta primero a un profesional y confírmalo para continuar.",
      field: "nutritionistConfirmed",
    });
  }

  const priority: GateResult["code"][] = [
    "terms",
    "unanswered",
    "age",
    "bmi",
    "doctor",
  ];
  const code = priority.find((candidate) =>
    issues.some((issue) => issue.code === candidate),
  );

  return { ok: issues.length === 0, ...(code ? { code } : {}), issues };
}

/** `true` si el objetivo exige un IMC mínimo (bajar o definir). */
export function requiresMinimumBmi(goal: WellnessGoal | null): boolean {
  return goal === "bajar" || goal === "def";
}
