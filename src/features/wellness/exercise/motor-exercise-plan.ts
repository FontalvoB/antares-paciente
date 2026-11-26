import type { MotorExerciseSession } from "../calendar/motor-plan-api";
import { adaptationFor, type ExerciseCheckin, type ExerciseDayPlan } from "./exercise-plan";

export function motorExercisePlan(day: number, session: MotorExerciseSession, checkin: ExerciseCheckin): ExerciseDayPlan {
  const local = adaptationFor(checkin);
  const needsLowImpact = local.mode === "low-impact";
  // Un chequeo local puede detener la sesión, pero no desbloquear ni sustituir
  // ejercicios del servidor. No se inicia un subconjunto como si fuera el plan.
  const rest = local.mode === "rest" || (needsLowImpact && session.items.some(item => !item.lowImpact));
  const gentle = local.mode === "gentle";
  let minutesToRemove = gentle ? Math.min(3, session.minutes - 15) : 0;

  return {
    day,
    week: session.week,
    phaseIndex: session.phase.level,
    phaseName: session.phase.name,
    deload: session.deload,
    minutes: rest ? 0 : session.minutes - minutesToRemove,
    typeCode: session.type,
    typeName: session.name,
    nextUnlocks: session.nextUnlocks,
    adaptation: rest ? "rest" : local.mode,
    adaptationNote: local.note,
    exercises: rest ? [] : session.items.map(({ id, minutes, description, guide, strength, lowImpact }) => {
      const savedMinutes = Math.min(minutesToRemove, minutes - 2);
      minutesToRemove -= savedMinutes;
      const allottedMinutes = minutes - savedMinutes;
      const { es, en } = guide;
      const esMistakes = es.m.split(";").filter(Boolean);
      const enMistakes = en.m.split(";").filter(Boolean);
      return {
        id, description, allottedMinutes, lowImpact,
        name: { es: es.n, en: en.n },
        guide: {
          steps: es.s.map((step, i) => ({ es: step, en: en.s[i] ?? step })),
          breathing: { es: es.b, en: en.b },
          mistakes: esMistakes.map((mistake, i) => ({ es: mistake, en: enMistakes[i] ?? mistake })),
          easier: { es: es.e, en: en.e },
          harder: { es: es.h, en: en.h },
        },
        dose: strength ? {
          sets: Math.max(1, strength.sets - (gentle ? 1 : 0)),
          reps: Math.max(6, strength.reps - (gentle ? 2 : 0)),
          restSec: strength.restSeconds,
          holdSec: strength.holdSeconds,
          rir: strength.repsInReserve,
        } : { minutes: allottedMinutes },
      };
    }),
  };
}
