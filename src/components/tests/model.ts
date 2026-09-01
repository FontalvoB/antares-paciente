import { TESTS, type DemoQuestion } from "../../data/tests";
import type { MeQuestion } from "../../utils/healthTestsApi";

export type TestMood =
  | "clinic"
  | "mind"
  | "food"
  | "move"
  | "night"
  | "bond"
  | "heart"
  | "storm"
  | "cosmos";

export interface TestTheme {
  emoji: string;
  accent: string;
  accentSoft: string;
  hero: "hero-cosmos" | "hero-navy" | "hero-teal" | "hero-pur" | "hero-indigo";
  mood: TestMood;
  sub: string;
  kicker: string;
  minutes: number;
}

export type LikertVariant = "likert" | "cards" | "yesno";

export type WizardStep =
  | {
      kind: "intro";
      key: string;
      title: string;
      sub: string;
      emoji: string;
      minutes: number;
      count: number;
    }
  | {
      kind: "scale";
      key: string;
      index: number;
      text: string;
      section?: string;
      hint?: string;
      emoji: string;
      scale: string[];
      leftLabel: string;
      rightLabel: string;
      variant: LikertVariant;
      optionLabels?: string[];
    }
  | {
      kind: "num";
      key: string;
      index: number;
      text: string;
      section?: string;
      hint?: string;
      emoji: string;
      unit: string;
      min: number;
      max: number;
      def: number;
    }
  | {
      kind: "multi";
      key: string;
      title: string;
      hint: string;
      emoji: string;
      items: { ico: string; label: string }[];
      store: "backend";
      backendIndex?: number;
      layout?: "clinic" | "flags";
    }
  | {
      kind: "open";
      key: string;
      index: number;
      question: string;
      placeholder: string;
      hint?: string;
      emoji: string;
    };

export const THEMES_BY_ID: Record<number, TestTheme> = {
  1: {
    emoji: "🩺",
    accent: "var(--blue)",
    accentSoft: "var(--blue-l)",
    hero: "hero-navy",
    mood: "clinic",
    sub: "Antecedentes, medicamentos y cómo te sientes físicamente.",
    kicker: "Historia clínica",
    minutes: 3,
  },
  2: {
    emoji: "🧠",
    accent: "var(--pur)",
    accentSoft: "var(--pur-l)",
    hero: "hero-pur",
    mood: "mind",
    sub: "Tu personalidad determina cómo te acompañamos en el programa.",
    kicker: "Temperamento",
    minutes: 3,
  },
  3: {
    emoji: "🥗",
    accent: "var(--teal)",
    accentSoft: "var(--teal-l)",
    hero: "hero-teal",
    mood: "food",
    sub: "Tus hábitos alimentarios y tu relación con la comida.",
    kicker: "Nutrición",
    minutes: 3,
  },
  4: {
    emoji: "🏃",
    accent: "var(--org)",
    accentSoft: "var(--org-l)",
    hero: "hero-navy",
    mood: "move",
    sub: "Tu capacidad física actual determina el circuito que te asignamos.",
    kicker: "Movimiento · AMAF",
    minutes: 2,
  },
  5: {
    emoji: "🌙",
    accent: "var(--pur)",
    accentSoft: "var(--pur-l)",
    hero: "hero-pur",
    mood: "night",
    sub: "El sueño impacta directamente tu glucosa, tu peso y tu adherencia.",
    kicker: "Sueño",
    minutes: 2,
  },
  6: {
    emoji: "🤝",
    accent: "var(--cyan)",
    accentSoft: "var(--ice-l)",
    hero: "hero-navy",
    mood: "bond",
    sub: "Tu motivación real determina cómo te acompañamos.",
    kicker: "Adherencia · IAC",
    minutes: 2,
  },
  7: {
    emoji: "❤️",
    accent: "var(--red)",
    accentSoft: "var(--red-l)",
    hero: "hero-cosmos",
    mood: "heart",
    sub: "Información clínica confidencial — solo la ve tu equipo médico.",
    kicker: "Riesgo cardiometabólico ORP",
    minutes: 2,
  },
  8: {
    emoji: "⚡",
    accent: "var(--org)",
    accentSoft: "var(--org-l)",
    hero: "hero-indigo",
    mood: "storm",
    sub: "El estrés en casa o en el trabajo es la barrera #1 de la adherencia.",
    kicker: "Estrés relacional · ERS",
    minutes: 2,
  },
  9: {
    emoji: "🧬",
    accent: "var(--cyan)",
    accentSoft: "var(--ice-l)",
    hero: "hero-cosmos",
    mood: "cosmos",
    sub: "Las respuestas más importantes del programa. Sé completamente honesto/a.",
    kicker: "Propósito · ANTARES",
    minutes: 2,
  },
};

export const THEMES_BY_CODE: Record<string, TestTheme> = {
  "historia-clinica": THEMES_BY_ID[1],
  temperamento: THEMES_BY_ID[2],
  nutricional: THEMES_BY_ID[3],
  movimiento: THEMES_BY_ID[4],
  sueno: THEMES_BY_ID[5],
  "iac-adresd": THEMES_BY_ID[6],
  orp: THEMES_BY_ID[7],
  ers: THEMES_BY_ID[8],
  "bateria-antares": THEMES_BY_ID[9],
};

export const FALLBACK_THEME: TestTheme = {
  emoji: "📋",
  accent: "var(--blue)",
  accentSoft: "var(--blue-l)",
  hero: "hero-cosmos",
  mood: "clinic",
  sub: "",
  kicker: "Evaluación",
  minutes: 3,
};

export function themeFor(
  code: string | null | undefined,
  demoId?: number | null,
): TestTheme {
  if (code && THEMES_BY_CODE[code]) return THEMES_BY_CODE[code];
  if (demoId && THEMES_BY_ID[demoId]) return THEMES_BY_ID[demoId];
  return FALLBACK_THEME;
}

// Escala Likert del HTML: siempre 1..5, opciones con score 0..4.
const LIKERT_SCALE = ["1", "2", "3", "4", "5"];

// Emoji por código de pregunta (los ids del HTML/seed). El fallback por
// sección/tipo garantiza que cualquier pregunta del backend tenga icono.
const QUESTION_EMOJIS: Record<string, string> = {
  dx: "🩺",
  med: "💊",
  sexo: "⚧️",
  edad: "🎂",
  peso: "⚖️",
  talla: "📏",
  cintura: "🧵",
  cadera: "📐",
  muneca: "⌚",
  gluc_ayunas: "🩸",
  gluc_sintomas: "🍬",
  sintomas: "🤒",
  antfam: "👨‍👩‍👧‍👦",
  temp_social: "🫂",
  temp_metas: "🎯",
  temp_analisis: "🔍",
  temp_rutina: "🗓️",
  temp_emociones: "🌊",
  temp_abandono: "🚧",
  nut_comidas: "🍽️",
  nut_emocional: "🍫",
  nut_control: "🍴",
  nut_procesados: "🍟",
  nut_agua: "💧",
  nut_motivacion: "🌱",
  mov_actual: "🏃",
  mov_fatiga: "🫁",
  mov_dolor: "🤕",
  mov_tiempo: "⏰",
  sue_horas: "😴",
  sue_calidad: "🌙",
  sue_ronquidos: "😮‍💨",
  sue_somnolencia: "😪",
  adh_compromiso: "🤝",
  adh_constancia: "🧗",
  adh_barreras: "🧱",
  adh_proposito: "💡",
  card_hba1c: "🧪",
  card_pa: "❤️‍🩹",
  card_tabaco: "🚭",
  card_colesterol: "🥑",
  ers_familia: "🏠",
  ers_trabajo: "💼",
  ers_apoyo: "🤲",
  ers_tiempo: "🌿",
  prop_urgencia: "⏳",
  prop_creencia: "💭",
  prop_plazo: "📅",
  prop_meta: "🏆",
  prop_nota: "✍️",
};

const SECTION_EMOJIS: [RegExp, string][] = [
  [/diagnósticos|diagnosticos/, "🩺"],
  [/medicamentos/, "💊"],
  [/datos personales/, "🧑"],
  [/biometr/, "📏"],
  [/glucosa/, "🩸"],
  [/síntomas|sintomas/, "🤒"],
  [/antecedentes/, "👨‍👩‍👧‍👦"],
  [/temperamento/, "🧠"],
  [/hidratación|hidratacion/, "💧"],
  [/motivación|motivacion/, "🌱"],
  [/actividad/, "🏃"],
  [/capacidad/, "🫁"],
  [/limitaciones/, "🤕"],
  [/disponibilidad/, "⏰"],
  [/sueño|sueno/, "😴"],
  [/red flags/, "⚠️"],
  [/compromiso/, "🤝"],
  [/barreras/, "🧱"],
  [/propósito|proposito/, "💡"],
  [/laboratorios/, "🧪"],
  [/tensión|tension/, "❤️‍🩹"],
  [/hábitos|habitos|conducta/, "🍽️"],
  [/tabaquismo/, "🚭"],
  [/familia/, "🏠"],
  [/trabajo/, "💼"],
  [/apoyo/, "🤲"],
  [/gestión|gestion/, "🌿"],
  [/urgencia/, "⏳"],
  [/mentalidad/, "💭"],
  [/expectativas/, "📅"],
  [/^meta|meta ·/, "🏆"],
  [/nota personal/, "✍️"],
];

const TYPE_EMOJIS: Record<string, string> = {
  scale: "🔢",
  single: "✅",
  multi: "☑️",
  num: "🔢",
  open: "✍️",
};

/** Emoji de una pregunta: código → sección → tipo. */
function questionEmoji(
  code: string | undefined,
  section: string | undefined,
  type: string,
): string {
  if (code && QUESTION_EMOJIS[code]) return QUESTION_EMOJIS[code];
  if (section) {
    const hit = SECTION_EMOJIS.find(([re]) => re.test(section.toLowerCase()));
    if (hit) return hit[1];
  }
  return TYPE_EMOJIS[type] ?? "📋";
}

function withIntro(
  theme: TestTheme,
  title: string,
  steps: WizardStep[],
): WizardStep[] {
  return [
    {
      kind: "intro",
      key: "intro",
      title,
      sub: theme.sub,
      emoji: theme.emoji,
      minutes: theme.minutes,
      count: steps.length,
    },
    ...steps,
  ];
}

function demoStep(q: DemoQuestion, qi: number): WizardStep {
  const base = {
    key: q.id,
    index: qi,
    text: q.text,
    section: q.section ?? undefined,
    hint: q.hint,
    emoji: questionEmoji(q.id, q.section ?? undefined, q.type),
  };
  if (q.type === "num") {
    return {
      kind: "num",
      ...base,
      unit: q.unit ?? "",
      min: q.min ?? 0,
      max: q.max ?? 999,
      def: q.def ?? 0,
    };
  }
  if (q.type === "multi") {
    return {
      kind: "multi",
      key: q.id,
      title: q.section ?? q.text,
      hint: q.hint ?? "Marca todo lo que aplique",
      emoji: base.emoji,
      items: (q.options ?? []).map((o) => ({ ico: "•", label: o.text })),
      store: "backend",
      backendIndex: qi,
      layout: "flags",
    };
  }
  if (q.type === "open") {
    return {
      kind: "open",
      key: q.id,
      index: qi,
      question: q.text,
      placeholder: q.hint ?? "Escribe aquí…",
      hint: q.hint,
      emoji: base.emoji,
    };
  }
  const labels = (q.options ?? []).map((o) => o.text);
  if (q.type === "single") {
    // Selección única: tarjetas con las opciones como etiquetas.
    return {
      kind: "scale",
      ...base,
      scale: labels.map((_, i) => String(i + 1)),
      leftLabel: labels[0] ?? "No",
      rightLabel: labels[labels.length - 1] ?? "Sí",
      variant: "cards",
      optionLabels: labels,
    };
  }
  return {
    kind: "scale",
    ...base,
    scale: LIKERT_SCALE,
    leftLabel: q.minLabel ?? "Nunca",
    rightLabel: q.maxLabel ?? "Siempre",
    variant: "likert",
  };
}

/** Steps demo (sin backend): contenido exacto del HTML (tests.ts). */
export function buildDemoSteps(openId: number, title: string): WizardStep[] {
  const theme = THEMES_BY_ID[openId] ?? FALLBACK_THEME;
  const test = TESTS.find((t) => t.id === openId);
  const steps = (test?.questions ?? []).map(demoStep);
  return withIntro(theme, title, steps);
}

/** Steps del backend: preguntas reales de /me/tests/{id} (tipos del catálogo). */
export function buildBackendSteps(
  questions: MeQuestion[],
  title: string,
  theme: TestTheme,
): WizardStep[] {
  const steps: WizardStep[] = questions.map((q, qi) => {
    const base = {
      key: q.id,
      index: qi,
      text: q.text,
      section: q.section ?? undefined,
      hint: q.hint ?? undefined,
      emoji: questionEmoji(q.code, q.section ?? undefined, q.type),
    };
    if (q.type === "num") {
      return {
        kind: "num",
        ...base,
        unit: q.unit ?? "",
        min: q.minValue ?? 0,
        max: q.maxValue ?? 999,
        def: q.defaultValue ?? 0,
      };
    }
    if (q.type === "multi") {
      return {
        kind: "multi",
        key: q.id,
        title: q.section ?? q.text,
        hint: q.hint ?? (q.section ? q.text : "Marca todo lo que aplique"),
        emoji: base.emoji,
        items: q.options.map((o) => ({ ico: "•", label: o.text })),
        store: "backend",
        backendIndex: qi,
        layout: theme.mood === "clinic" ? "clinic" : "flags",
      };
    }
    if (q.type === "open") {
      return {
        kind: "open",
        key: q.id,
        index: qi,
        question: q.text,
        placeholder: q.hint ?? q.text,
        hint: q.hint ?? undefined,
        emoji: base.emoji,
      };
    }
    const labels = q.options.map((o) => o.text);
    if (q.type === "single") {
      return {
        kind: "scale",
        ...base,
        scale: labels.map((_, i) => String(i + 1)),
        leftLabel: labels[0] ?? "No",
        rightLabel: labels[labels.length - 1] ?? "Sí",
        variant: "cards",
        optionLabels: labels,
      };
    }
    return {
      kind: "scale",
      ...base,
      scale: LIKERT_SCALE,
      leftLabel: q.minLabel ?? "Nunca",
      rightLabel: q.maxLabel ?? "Siempre",
      variant: "likert",
    };
  });
  return withIntro(theme, title, steps);
}

export function isNoneLabel(label: string): boolean {
  return /ninguno/i.test(label);
}

export function itemTint(label: string): { bg: string; fg: string } {
  const s = label.toLowerCase();
  if (isNoneLabel(s)) return { bg: "var(--g1)", fg: "var(--mu)" };
  if (/diabetes|prediabetes/.test(s))
    return { bg: "var(--red-l)", fg: "var(--red)" };
  if (/hipertens|hta/.test(s))
    return { bg: "var(--blue-l)", fg: "var(--blue)" };
  if (/cardio|coronaria|acv/.test(s))
    return { bg: "var(--red-l)", fg: "var(--red)" };
  if (/colesterol|triglic/.test(s))
    return { bg: "var(--org-l)", fg: "var(--org)" };
  if (/obes/.test(s)) return { bg: "var(--org-l)", fg: "#b45309" };
  return { bg: "var(--blue-l)", fg: "var(--blue)" };
}

export function sectionTone(section?: string): string {
  if (!section) return "";
  const s = section.toLowerCase();
  if (s.includes("sanguíneo") || s.includes("sanguineo")) return "sang";
  if (s.includes("colérico") || s.includes("colerico")) return "col";
  if (s.includes("melancólico") || s.includes("melancolico")) return "mel";
  if (s.includes("flemático") || s.includes("flematico")) return "fle";
  if (s.includes("riesgo") || s.includes("alerta")) return "risk";
  if (s.includes("motiv") || s.includes("propósito") || s.includes("proposito"))
    return "goal";
  return "";
}
