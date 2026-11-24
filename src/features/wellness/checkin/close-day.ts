import { localISODate, parseLocalDate } from "../state/wellness-home-store";

export const SYMPTOMS = {
  mareo: "Mareo",
  fatiga: "Fatiga",
  hambre: "Hambre",
  insomnio: "Insomnio",
  nauseas: "Náuseas",
} as const;

export interface DailyCheckin {
  adherence: number;
  sleepHours: number;
  energy: number;
  pain: number;
  symptoms: (keyof typeof SYMPTOMS)[];
  weightKg: number | null;
  waistCm: number | null;
  exercised: boolean;
}

export const EFFECT_COPY = {
  gentleSleep: "Por el sueño o la energía que registraste, el ejercicio será más suave.",
  gentleFatigue: "Por la fatiga que registraste, el ejercicio bajará un nivel.",
  lowImpact: "Por el dolor que registraste, solo habrá ejercicios de bajo impacto.",
  pausePain: "Por el dolor que registraste, el ejercicio queda en pausa dos días.",
  continuingPause: "Continúa la pausa de ejercicio por el dolor registrado.",
  dizziness: "Por el mareo, el ejercicio queda en pausa y se mantienen tus porciones. Si vuelve a pasar, consulta a un profesional.",
  hunger: "Por el hambre que registraste, se mantienen tus porciones.",
  dinner: "Si te costó dormir, elige una cena más temprana y ligera.",
  simpleMenu: "Tras dos días con menos del 60 % del plan completado, verás un menú más simple.",
  progressOne: "Por tu racha, la progresión de ejercicio se adelanta una semana.",
  progressTwo: "Por tu racha, la progresión de ejercicio se adelanta dos semanas.",
  brokenStreak: "Al retomar después de tu racha, la carga de ejercicio será un poco menor.",
} as const;

export type CheckinHistory = Readonly<Record<string, DailyCheckin | undefined>>;

export function shiftLocalDate(date: string, days: number): string {
  const parsed = parseLocalDate(date);
  if (!parsed) throw new RangeError("Invalid local date");
  parsed.setDate(parsed.getDate() + days);
  return localISODate(parsed);
}

/** Reglas del kit v5.2 §3.5 para la fecha del plan que se va a mostrar. */
export function dailyEffects(date: string, history: CheckinHistory, planDay = 1) {
  const yesterday = shiftLocalDate(date, -1);
  const previous = history[yesterday];
  const earlier = history[shiftLocalDate(date, -2)];
  const dizziness = previous?.symptoms.includes("mareo") ?? false;
  const hunger = previous?.symptoms.includes("hambre") ?? false;
  const earlierDinner = previous?.symptoms.includes("insomnio") ?? false;
  const pain = previous?.pain ?? 0;
  const pauseDays = pain >= 7 ? 2 : dizziness || (earlier?.pain ?? 0) >= 7 ? 1 : 0;
  const lowImpact = !pauseDays && pain >= 4;
  const poorRest = previous !== undefined && (previous.sleepHours < 5.5 || previous.energy <= 2);
  const fatigue = previous?.symptoms.includes("fatiga") ?? false;
  const gentle = !pauseDays && (poorRest || fatigue);
  const simpleMenu = (previous?.adherence ?? 100) < 60 && (earlier?.adherence ?? 100) < 60;
  let streak = 0;
  for (let day = yesterday; (history[day]?.adherence ?? -1) >= 60; day = shiftLocalDate(day, -1)) {
    streak += 1;
  }
  const brokenStreak = planDay > 14 && (previous?.adherence ?? 100) < 60 &&
    (earlier?.adherence ?? -1) >= 60;
  const progressionWeeks = streak >= 14 ? 2 : streak >= 7 ? 1 : brokenStreak ? -1 : 0;

  const copy: (keyof typeof EFFECT_COPY)[] = [];
  if (pain >= 7) copy.push("pausePain");
  else if ((earlier?.pain ?? 0) >= 7) copy.push("continuingPause");
  if (dizziness) copy.push("dizziness");
  if (lowImpact) copy.push("lowImpact");
  if (gentle) copy.push(poorRest ? "gentleSleep" : "gentleFatigue");
  if (hunger && !dizziness) copy.push("hunger");
  if (earlierDinner) copy.push("dinner");
  if (simpleMenu) copy.push("simpleMenu");
  if (!pauseDays && progressionWeeks) {
    copy.push(progressionWeeks === 2 ? "progressTwo" : progressionWeeks === 1 ? "progressOne" : "brokenStreak");
  }

  return {
    exercise: { pauseDays, gentle, lowImpact, progressionWeeks },
    nutrition: { blockCuts: dizziness || hunger, earlierDinner, simpleMenu },
    messages: copy.map((key) => EFFECT_COPY[key]),
  };
}

export type DailyEffects = ReturnType<typeof dailyEffects>;
