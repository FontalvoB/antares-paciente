/**
 * Plan de ejercicio de un día (KAN-139).
 *
 * Reglas del kit v5.2:
 * - Patrón semanal por objetivo (C/F/M/P/L/J/R/K/H).
 * - 4 ejercicios al día, desbloqueados por semana.
 * - Fases de 52 semanas con descarga cada 4.ª semana.
 * - Dosis de fuerza por nivel de fase: series/reps/descanso/RIR.
 * - Adaptación por dolor, fatiga o mareo, en lenguaje no médico.
 *
 * Es una función pura: la UI y los tests comparten exactamente el mismo plan.
 */

import {
  DAY_NAMES,
  DAY_TYPES,
  EXERCISE_GUIDE,
  HIGH_IMPACT,
  PATTERN,
  PHASES,
  POOL,
  UNLOCK_WEEK,
} from "./exercise-catalog";
import type { WellnessGoal } from "../domain/types";

export type AdaptationMode = "normal" | "gentle" | "low-impact" | "rest";

export interface ExerciseCheckin {
  pain: number;
  fatigue: boolean;
  dizziness: boolean;
}

export interface ExerciseDose {
  sets?: number;
  reps?: number;
  restSec?: number;
  rir?: string;
  minutes?: number;
}

export interface PlannedExercise {
  id: string;
  focus: string;
  name: { es: string; en: string };
  guide: {
    steps: { es: string; en: string }[];
    breathing: { es: string; en: string };
    mistakes: { es: string; en: string }[];
    easier: { es: string; en: string };
    harder: { es: string; en: string };
  };
  dose: ExerciseDose;
  lowImpact: boolean;
}

export interface NextUnlock {
  id: string;
  name: { es: string; en: string };
  week: number;
}

export interface ExerciseDayPlan {
  day: number;
  week: number;
  phaseIndex: number;
  phaseName: { es: string; en: string };
  deload: boolean;
  minutes: number;
  typeCode: string;
  typeName: { es: string; en: string };
  exercises: PlannedExercise[];
  nextUnlocks: NextUnlock[];
  adaptation: AdaptationMode;
  /** Clave de copy para explicar la adaptación (la UI la traduce). */
  adaptationNote: string;
}

const STRENGTH_SLOTS = new Set(["push", "pull", "legs", "core"]);
const SETS = [2, 2, 3, 3];
const REPS = [8, 10, 12, 15];
const REST = [45, 45, 60, 60];
export const TOTAL_WEEKS = 52;

export function weekForDay(day: number): number {
  return Math.min(TOTAL_WEEKS, Math.max(1, Math.ceil(Math.max(1, day) / 7)));
}

export function phaseForWeek(week: number) {
  return (
    PHASES.find((phase) => week >= phase.from && week <= phase.to) ?? PHASES[3]
  );
}

export function typeForDay(goal: WellnessGoal, day: number): string {
  const pattern = PATTERN[goal] ?? PATTERN.bajar;
  return pattern[(Math.max(1, day) - 1) % pattern.length];
}

/** Descarga cada 4.ª semana (el motor la usa para bajar 2 minutos). */
export function isDeloadWeek(week: number): boolean {
  return week % 4 === 0;
}

export function minutesForDay(
  week: number,
  deload: boolean,
  gentle: boolean,
): number {
  const base = 15 + Math.min(7, Math.floor(week / 4));
  const withDeload = deload ? base - 2 : base;
  const withGentle = gentle ? withDeload - 3 : withDeload;
  return Math.max(8, Math.min(22, withGentle));
}

function doseFor(
  slot: string,
  phaseLevel: number,
  goal: WellnessGoal,
  minutes: number,
  gentle: boolean,
): ExerciseDose {
  if (STRENGTH_SLOTS.has(slot)) {
    return {
      sets: Math.max(1, SETS[phaseLevel] - (gentle ? 1 : 0)),
      reps: Math.max(6, REPS[phaseLevel] - (gentle ? 2 : 0)),
      restSec: REST[phaseLevel],
      rir: goal === "masa" || goal === "def" ? "1-2" : "2-3",
    };
  }
  return { minutes };
}

function guideFor(id: string): PlannedExercise["guide"] {
  const entry = EXERCISE_GUIDE[id] ?? EXERCISE_GUIDE.walk;
  return {
    steps: entry.es.steps.map((step, index) => ({
      es: step,
      en: entry.en.steps[index] ?? step,
    })),
    breathing: { es: entry.es.breathing, en: entry.en.breathing },
    mistakes: entry.es.mistakes.map((mistake, index) => ({
      es: mistake,
      en: entry.en.mistakes[index] ?? mistake,
    })),
    easier: { es: entry.es.easier, en: entry.en.easier },
    harder: { es: entry.es.harder, en: entry.en.harder },
  };
}

function nameFor(id: string): { es: string; en: string } {
  const entry = EXERCISE_GUIDE[id] ?? EXERCISE_GUIDE.walk;
  return { es: entry.es.name, en: entry.en.name };
}

/** Elige un ejercicio desbloqueado para el slot; nunca devuelve uno bloqueado. */
function pickForSlot(
  slot: string,
  week: number,
  day: number,
  lowImpact: boolean,
): string {
  const candidates = (POOL[slot] ?? POOL.card).filter(
    (id) =>
      (UNLOCK_WEEK[id] ?? 1) <= week && (!lowImpact || !HIGH_IMPACT.has(id)),
  );
  if (candidates.length === 0) {
    return lowImpact ? "walk" : ((POOL[slot] ?? POOL.card)[0] ?? "walk");
  }
  return candidates[day % candidates.length];
}

/** Próximos desbloqueos a partir de la semana actual. */
export function nextUnlocks(week: number, limit = 3): NextUnlock[] {
  return Object.entries(UNLOCK_WEEK)
    .filter(([, unlock]) => unlock > week)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, unlock]) => ({ id, week: unlock, name: nameFor(id) }));
}

/** Adaptación por síntomas, con la regla del motor v5.2. */
export function adaptationFor(checkin: ExerciseCheckin): {
  mode: AdaptationMode;
  note: string;
} {
  if (checkin.dizziness) {
    return {
      mode: "rest",
      note: "Hoy no hagas ejercicio y no recortes comidas. Si el mareo se repite, consulta a un profesional.",
    };
  }
  if (checkin.pain >= 7) {
    return {
      mode: "rest",
      note: "Descansa dos días de ejercicio. Si el dolor sigue o es fuerte, consulta a un profesional.",
    };
  }
  if (checkin.pain >= 4) {
    return {
      mode: "low-impact",
      note: "Hoy solo movimientos de bajo impacto. Si el dolor aumenta, detente.",
    };
  }
  if (checkin.fatigue) {
    return {
      mode: "gentle",
      note: "Bajamos un poco la carga para que el cuerpo asimile el día.",
    };
  }
  return { mode: "normal", note: "" };
}

export function buildExerciseDay(input: {
  goal: WellnessGoal;
  day: number;
  checkin?: ExerciseCheckin;
}): ExerciseDayPlan {
  const day = Math.min(365, Math.max(1, Math.round(input.day)));
  const week = weekForDay(day);
  const phase = phaseForWeek(week);
  const deload = isDeloadWeek(week);
  const checkin = input.checkin ?? {
    pain: 0,
    fatigue: false,
    dizziness: false,
  };
  const { mode, note } = adaptationFor(checkin);
  const gentle = mode === "gentle";
  const lowImpact = mode === "low-impact";
  const minutes = minutesForDay(week, deload, gentle);
  const typeCode = typeForDay(input.goal, day);
  const typeName = {
    es: DAY_NAMES[typeCode]?.[0] ?? typeCode,
    en: DAY_NAMES[typeCode]?.[1] ?? typeCode,
  };

  if (mode === "rest") {
    return {
      day,
      week,
      phaseIndex: phase.level,
      phaseName: { es: phase.name[0], en: phase.name[1] },
      deload,
      minutes: 0,
      typeCode,
      typeName,
      exercises: [],
      nextUnlocks: nextUnlocks(week),
      adaptation: mode,
      adaptationNote: note,
    };
  }

  const slots = DAY_TYPES[typeCode] ?? DAY_TYPES.C;
  const exercises = slots.map((slot) => {
    const id = pickForSlot(slot, week, day, lowImpact);
    return {
      id,
      focus: slot,
      name: nameFor(id),
      guide: guideFor(id),
      dose: doseFor(
        slot,
        phase.level,
        input.goal,
        Math.round(minutes / 4),
        gentle,
      ),
      lowImpact: !HIGH_IMPACT.has(id),
    };
  });

  return {
    day,
    week,
    phaseIndex: phase.level,
    phaseName: { es: phase.name[0], en: phase.name[1] },
    deload,
    minutes,
    typeCode,
    typeName,
    exercises,
    nextUnlocks: nextUnlocks(week),
    adaptation: mode,
    adaptationNote: note,
  };
}
