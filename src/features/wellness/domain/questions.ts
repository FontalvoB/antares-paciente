/**
 * Preguntas de seguridad del onboarding (KAN-136).
 *
 * PAR-Q: instrumento canónico de 7 preguntas (decisión 2026-11-24). El
 * prototipo HTML solo traía 5; se completan las dos que faltaban para cumplir
 * la guía v5.2 y el criterio de aceptación del issue.
 *
 * NQS: las 6 preguntas del prototipo, sin cambios de texto.
 *
 * El texto vive en ES y EN en el mismo fichero para que la UI nunca invente
 * traducciones y el test pueda verificar paridad.
 */

export interface WellnessQuestion {
  id: string;
  es: string;
  en: string;
}

/** 7 preguntas PAR-Q en el orden en que se responden. */
export const PARQ_QUESTIONS: readonly WellnessQuestion[] = [
  {
    id: "parq-heart",
    es: "¿Alguna vez un médico te ha dicho que tienes un problema del corazón y que solo debes hacer actividad física recomendada por un médico?",
    en: "Has a doctor ever told you that you have a heart condition and that you should only do physical activity recommended by a doctor?",
  },
  {
    id: "parq-chest-activity",
    es: "¿Sientes dolor en el pecho cuando haces actividad física?",
    en: "Do you feel pain in your chest when you do physical activity?",
  },
  {
    id: "parq-chest-rest",
    es: "¿En el último mes has tenido dolor en el pecho cuando NO estabas haciendo actividad física?",
    en: "In the past month, have you had chest pain when you were not doing physical activity?",
  },
  {
    id: "parq-balance",
    es: "¿Pierdes el equilibrio por mareos o has perdido el conocimiento en el último año?",
    en: "Do you lose your balance because of dizziness, or have you lost consciousness in the past year?",
  },
  {
    id: "parq-bones",
    es: "¿Tienes algún problema de huesos o articulaciones que pueda empeorar si cambias tu actividad física?",
    en: "Do you have a bone or joint problem that could be made worse by a change in your physical activity?",
  },
  {
    id: "parq-medication",
    es: "¿Tomas actualmente medicamentos para la presión arterial o para el corazón?",
    en: "Are you currently taking medication for blood pressure or a heart condition?",
  },
  {
    id: "parq-other",
    es: "¿Conoces alguna otra razón por la que no deberías hacer actividad física?",
    en: "Do you know of any other reason why you should not do physical activity?",
  },
] as const;

/** 6 preguntas NQS (seguridad nutricional). */
export const NQS_QUESTIONS: readonly WellnessQuestion[] = [
  {
    id: "nqs-pregnancy",
    es: "¿Estás embarazada o en periodo de lactancia?",
    en: "Are you pregnant or breastfeeding?",
  },
  {
    id: "nqs-eating",
    es: "¿Un profesional te ha confirmado un trastorno de la conducta alimentaria, o la comida te genera mucha ansiedad o culpa?",
    en: "Has a professional confirmed an eating disorder for you, or does food cause you strong anxiety or guilt?",
  },
  {
    id: "nqs-allergy",
    es: "¿Tienes una alergia o intolerancia alimentaria confirmada por un profesional?",
    en: "Do you have a food allergy or intolerance confirmed by a professional?",
  },
  {
    id: "nqs-sugar",
    es: "¿Necesitas controlar tu azúcar en sangre o tomas medicinas que dependen de lo que comes?",
    en: "Do you need to control blood sugar or take medicines that depend on what you eat?",
  },
  {
    id: "nqs-organ",
    es: "¿Tienes enfermedad renal o hepática, o una dieta indicada por un médico?",
    en: "Do you have kidney or liver disease, or a diet recommended by a doctor?",
  },
  {
    id: "nqs-surgery",
    es: "¿Te han hecho una cirugía bariátrica o sigues indicaciones de un profesional por otra condición que afecte tu alimentación?",
    en: "Have you had bariatric surgery or are you following a professional's guidance for a condition that affects your eating?",
  },
] as const;

/** Número de preguntas que la compuerta exige responder. */
export const PARQ_LENGTH = PARQ_QUESTIONS.length;
export const NQS_LENGTH = NQS_QUESTIONS.length;
