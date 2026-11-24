import { describe, expect, it } from "vitest";
import type { WellnessGoal } from "../domain/types";
import { UNLOCK_WEEK } from "../exercise/exercise-catalog";
import {
  buildExerciseDay,
  nextUnlocks,
  type ExerciseCheckin,
} from "../exercise/exercise-plan";

const patterns: Record<WellnessGoal, string> = {
  bajar: "CFCFCMC",
  masa: "PLJRFKR",
  def: "PLJHFKR",
};

const normal: ExerciseCheckin = { pain: 0, dizziness: false, fatigue: false };

describe("Plan de ejercicio", () => {
  it.each(Object.entries(patterns) as [WellnessGoal, string][])(
    "respeta el patrón semanal de %s",
    (goal, pattern) => {
      const codes = Array.from({ length: 14 }, (_, index) =>
        buildExerciseDay({ goal, day: index + 1 }).typeCode,
      );
      expect(codes.join("")).toBe(pattern.repeat(2));
    },
  );

  it.each([
    [1, 1, 0],
    [7, 1, 0],
    [8, 2, 0],
    [56, 8, 0],
    [57, 9, 1],
    [140, 20, 1],
    [141, 21, 2],
    [252, 36, 2],
    [253, 37, 3],
    [365, 52, 3],
  ])("ubica el día %i en la semana %i y fase %i", (day, week, phaseIndex) => {
    expect(buildExerciseDay({ goal: "bajar", day })).toMatchObject({
      day,
      week,
      phaseIndex,
    });
  });

  it.each(Object.keys(patterns) as WellnessGoal[])(
    "ofrece cuatro ejercicios desbloqueados cada día de %s",
    (goal) => {
      for (let day = 1; day <= 365; day += 1) {
        const plan = buildExerciseDay({ goal, day });
        expect(plan.exercises, `día ${day}`).toHaveLength(4);
        for (const exercise of plan.exercises) {
          expect(UNLOCK_WEEK[exercise.id]).toBeLessThanOrEqual(plan.week);
        }
      }
    },
  );

  it.each([
    [1, 2, 8, 45],
    [57, 2, 10, 45],
    [141, 3, 12, 60],
    [253, 3, 15, 60],
  ])("aplica la dosis de fuerza del día %i de masa", (day, sets, reps, restSec) => {
    const plan = buildExerciseDay({ goal: "masa", day });
    expect(plan.exercises[0]).toMatchObject({
      focus: "push",
      dose: { sets, reps, restSec, rir: "1-2" },
    });
  });

  it("reduce los minutos en la cuarta semana", () => {
    const before = buildExerciseDay({ goal: "bajar", day: 15 });
    const deload = buildExerciseDay({ goal: "bajar", day: 22 });
    expect(before.deload).toBe(false);
    expect(deload).toMatchObject({ week: 4, deload: true, minutes: 14 });
    expect(deload.minutes).toBeLessThan(before.minutes);
  });

  it.each([{ pain: 7 }, { pain: 10 }, { dizziness: true }])(
    "indica descanso con %o",
    (patch) => {
      const plan = buildExerciseDay({
        goal: "bajar",
        day: 1,
        checkin: { ...normal, ...patch },
      });
      expect(plan).toMatchObject({ adaptation: "rest", minutes: 0, exercises: [] });
    },
  );

  it.each([[95, "int"], [116, "hill"]])(
    "retira %s del plan de impacto alto con dolor moderado",
    (day, highImpact) => {
      const original = buildExerciseDay({ goal: "def", day });
      expect(original.exercises.map(({ id }) => id)).toContain(highImpact);

      const plan = buildExerciseDay({
        goal: "def",
        day,
        checkin: { ...normal, pain: 4 },
      });
      expect(plan.adaptation).toBe("low-impact");
      expect(plan.exercises).toHaveLength(4);
      expect(plan.exercises.map(({ id }) => id)).not.toContain("int");
      expect(plan.exercises.map(({ id }) => id)).not.toContain("hill");
      expect(plan.exercises.every(({ lowImpact }) => lowImpact)).toBe(true);
    },
  );

  it("reduce minutos, series y repeticiones con fatiga", () => {
    const original = buildExerciseDay({ goal: "masa", day: 141 });
    const plan = buildExerciseDay({
      goal: "masa",
      day: 141,
      checkin: { ...normal, fatigue: true },
    });
    expect(plan.adaptation).toBe("gentle");
    expect(plan.minutes).toBe(original.minutes - 3);
    const dose = original.exercises[0].dose;
    expect(plan.exercises[0].dose).toMatchObject({
      sets: dose.sets! - 1,
      reps: dose.reps! - 2,
    });
  });

  it("ordena los próximos desbloqueos por semana y después por id", () => {
    const expected = [
      { id: "curl", week: 2 },
      { id: "tri", week: 2 },
      { id: "calf", week: 3 },
    ];
    expect(buildExerciseDay({ goal: "bajar", day: 1 }).nextUnlocks).toMatchObject(expected);
    expect(nextUnlocks(2, 2)).toMatchObject([
      { id: "calf", week: 3 },
      { id: "ellip", week: 3 },
    ]);
    expect(nextUnlocks(26)).toEqual([]);
  });
});
