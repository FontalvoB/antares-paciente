import { describe, expect, it } from "vitest";
import { dailyEffects, EFFECT_COPY, shiftLocalDate } from "../checkin/close-day";
import type { DailyCheckin } from "../checkin/close-day";
import { buildExerciseDay } from "../exercise/exercise-plan";

const today = "2026-11-24";
const yesterday = shiftLocalDate(today, -1);
const earlier = shiftLocalDate(today, -2);
const input: DailyCheckin = {
  adherence: 60, sleepHours: 5.5, energy: 3, pain: 0, symptoms: [],
  exercised: false, weightKg: null, waistCm: null,
};

function effects(patch: Partial<DailyCheckin>) {
  return dailyEffects(today, { [yesterday]: { ...input, ...patch } });
}

describe("efectos diarios v5.2", () => {
  it.each([{ sleepHours: 5.49 }, { energy: 2 }])("suaviza ejercicio con %j", (patch) => {
    expect(effects(patch).exercise.gentle).toBe(true);
    expect(effects(patch).messages).toEqual([EFFECT_COPY.gentleSleep]);
  });

  it("reduce un nivel por fatiga sin acumular con sueño", () => {
    expect(effects({ symptoms: ["fatiga"] }).exercise.gentle).toBe(true);
    expect(effects({ symptoms: ["fatiga"] }).messages).toEqual([EFFECT_COPY.gentleFatigue]);
    expect(effects({ symptoms: ["fatiga"], sleepHours: 5 }).messages).toEqual([EFFECT_COPY.gentleSleep]);
  });

  it("solo permite bajo impacto desde dolor 4", () => {
    expect(effects({ pain: 3 }).messages).toEqual([]);
    const daily = effects({ pain: 4, symptoms: ["fatiga"] });
    expect(daily.messages).toEqual([EFFECT_COPY.lowImpact, EFFECT_COPY.gentleFatigue]);
    expect(buildExerciseDay({ goal: "def", day: 127, dailyEffects: daily }).exercises.every(({ lowImpact }) => lowImpact)).toBe(true);
  });

  it("mantiene la pausa por dolor durante los dos días siguientes", () => {
    const history = { [yesterday]: { ...input, pain: 7, energy: 1 } };
    expect(dailyEffects(today, history).messages).toEqual([EFFECT_COPY.pausePain]);
    expect(dailyEffects(today, history).exercise.pauseDays).toBe(2);
    const next = dailyEffects(shiftLocalDate(today, 1), history);
    expect(next.messages).toEqual([EFFECT_COPY.continuingPause]);
    expect(buildExerciseDay({ goal: "bajar", day: 8, dailyEffects: next }).exercises).toEqual([]);
    expect(dailyEffects(shiftLocalDate(today, 2), history).messages).toEqual([]);
  });

  it("pausa el ejercicio por mareo, protege porciones y sugiere consulta si se repite", () => {
    const daily = effects({ symptoms: ["mareo", "hambre"] });
    expect(daily.exercise.pauseDays).toBe(1);
    expect(daily.nutrition.blockCuts).toBe(true);
    expect(daily.messages).toEqual([EFFECT_COPY.dizziness]);
    expect(daily.messages[0]).toMatch(/Si vuelve a pasar, consulta/);
  });

  it("protege porciones por hambre y sugiere adelantar y aligerar la cena por insomnio", () => {
    const daily = effects({ symptoms: ["hambre", "insomnio", "nauseas"] });
    expect(daily.nutrition).toEqual({ blockCuts: true, earlierDinner: true, simpleMenu: false });
    expect(daily.messages).toEqual([EFFECT_COPY.hunger, EFFECT_COPY.dinner]);
    expect(effects({ symptoms: ["nauseas"] }).messages).toEqual([]);
  });

  it("simplifica el menú con dos días consecutivos por debajo de 60", () => {
    expect(effects({ adherence: 59 }).messages).toEqual([]);
    const history = { [yesterday]: { ...input, adherence: 59 }, [earlier]: { ...input, adherence: 59 } };
    expect(dailyEffects(today, history).nutrition.simpleMenu).toBe(true);
    expect(dailyEffects(today, history).messages).toEqual([EFFECT_COPY.simpleMenu]);
    expect(dailyEffects(today, { ...history, [earlier]: input }).messages).toEqual([]);
  });

  it.each([[6, 0, []], [7, 1, [EFFECT_COPY.progressOne]], [14, 2, [EFFECT_COPY.progressTwo]]] as const)(
    "aplica la progresión para una racha de %i días", (length, weeks, messages) => {
      const history = Object.fromEntries(Array.from({ length }, (_, index) => [shiftLocalDate(today, -index - 1), input]));
      const daily = dailyEffects(today, history);
      expect(daily.exercise.progressionWeeks).toBe(weeks);
      expect(daily.messages).toEqual(messages);
      expect(buildExerciseDay({ goal: "bajar", day: 50, dailyEffects: daily }).phaseIndex).toBe(weeks ? 1 : 0);
    },
  );

  it("baja la carga al romper una racha después del día 14", () => {
    const history = { [yesterday]: { ...input, adherence: 50 }, [earlier]: input };
    expect(dailyEffects(today, history, 14).messages).toEqual([]);
    expect(dailyEffects(today, history, 15).messages).toEqual([EFFECT_COPY.brokenStreak]);
  });
});
