import { beforeEach, describe, expect, it } from "vitest";
import {
  adherencePct,
  clearWellnessState,
  getWellnessHomeData,
  levelForPoints,
  localISODate,
  planDay,
  pointsForDay,
  saveBatteriesCompleted,
  savePlanSnapshot,
  saveProtocolHistory,
  streakDays,
  toggleProtocolStep,
  type ProtocolStepId,
  type WellnessPlanSnapshot,
} from "../state/wellness-home-store";

const TODAY = new Date(2026, 10, 24, 12, 0, 0);

function isoDaysAgo(days: number): string {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - days);
  return localISODate(date);
}

const snapshot: WellnessPlanSnapshot = {
  name: "Ana",
  goal: "bajar",
  startDate: isoDaysAgo(9),
  kcal: 1660,
  proteinG: 115,
  carbsG: 201,
  fatG: 44,
  waterMl: 2500,
  totalDays: 365,
  createdAt: "2026-11-15T12:00:00.000Z",
};

const ALL: ProtocolStepId[] = [
  "exercise",
  "diet",
  "vitals",
  "emotional",
  "chest",
];

describe("wellness home store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("calcula el día del plan y lo acota a 1..365", () => {
    expect(planDay(isoDaysAgo(0), TODAY)).toBe(1);
    expect(planDay(isoDaysAgo(9), TODAY)).toBe(10);
    expect(planDay(isoDaysAgo(400), TODAY)).toBe(365);
    expect(planDay("fecha-invalida", TODAY)).toBe(1);
    expect(planDay(isoDaysAgo(-5), TODAY)).toBe(1);
  });

  it("usa un plan de ejemplo cuando no hay onboarding", () => {
    const data = getWellnessHomeData("Ana", TODAY, {});
    expect(data.isDemo).toBe(true);
    expect(data.day).toBe(1);
    expect(data.plan.name).toBe("Ana");
  });

  it("lee el plan guardado y calcula el día", () => {
    savePlanSnapshot(snapshot);
    const data = getWellnessHomeData("", TODAY, {});
    expect(data.isDemo).toBe(false);
    expect(data.day).toBe(10);
    expect(data.plan.kcal).toBe(1660);
  });

  it("mide adherencia sobre 7 días y racha de días completos", () => {
    const history = {
      [isoDaysAgo(1)]: ALL,
      [isoDaysAgo(2)]: ALL,
      [isoDaysAgo(3)]: ALL,
    };
    expect(adherencePct(history, TODAY)).toBe(Math.round((15 / 35) * 100));
    // Hoy aún no cierra: la racha se mide desde ayer.
    expect(streakDays(history, TODAY)).toBe(3);

    const withToday = { ...history, [isoDaysAgo(0)]: ALL };
    expect(streakDays(withToday, TODAY)).toBe(4);
  });

  it("calcula puntos y nivel", () => {
    expect(pointsForDay(0)).toBe(0);
    expect(pointsForDay(2)).toBe(20);
    expect(pointsForDay(5)).toBe(70);
    expect(levelForPoints(0)).toBe(1);
    expect(levelForPoints(500)).toBe(2);
    expect(levelForPoints(5000)).toBe(5);
  });

  it("marca y desmarca pasos del día", () => {
    toggleProtocolStep("exercise", true, TODAY);
    toggleProtocolStep("diet", true, TODAY);
    let data = getWellnessHomeData("", TODAY);
    expect(data.protocolDone).toBe(2);
    expect(data.protocol.find((step) => step.id === "exercise")?.done).toBe(
      true,
    );

    toggleProtocolStep("diet", false, TODAY);
    data = getWellnessHomeData("", TODAY);
    expect(data.protocolDone).toBe(1);
  });

  it("acota las baterías entre 0 y 7", () => {
    saveBatteriesCompleted(9);
    expect(getWellnessHomeData("", TODAY, {}).batteriesCompleted).toBe(7);
    saveBatteriesCompleted(-2);
    expect(getWellnessHomeData("", TODAY, {}).batteriesCompleted).toBe(0);
  });

  it("oculta el estado al limpiar", () => {
    savePlanSnapshot(snapshot);
    saveProtocolHistory({ [isoDaysAgo(0)]: ALL });
    clearWellnessState();
    const data = getWellnessHomeData("", TODAY, {});
    expect(data.isDemo).toBe(true);
    expect(data.protocolDone).toBe(0);
  });
});
