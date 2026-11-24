import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_OBJECTIVE_DRAFT, WELLNESS_TERMS_VERSION } from "../domain/draft";
import { buildPlanPreview } from "../domain/plan-preview";
import { evaluateGate } from "../domain/gate";
import type { ObjectiveDraft, PlanPreview } from "../domain/types";
import {
  changePlanObjective,
  diffPlans,
  draftFromSnapshot,
} from "../state/goal-change";
import {
  getWellnessHomeData,
  loadBatteriesCompleted,
  loadPlanSnapshot,
  loadPlanVersions,
  loadProtocolHistory,
  localISODate,
  planDay,
  saveBatteriesCompleted,
  savePlanSnapshot,
  saveProtocolHistory,
  totalPoints,
} from "../state/wellness-home-store";

const TODAY = new Date(2026, 10, 24, 10, 0, 0);

function isoDaysAgo(days: number): string {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - days);
  return localISODate(date);
}

const BASE_DRAFT: ObjectiveDraft = {
  ...EMPTY_OBJECTIVE_DRAFT,
  name: "Ana Torres",
  goal: "bajar",
  sex: "F",
  age: 34,
  heightCm: 165,
  weightKg: 72,
  waistCm: 84,
  targetWeightKg: 64,
  activity: 2,
  pace: "m",
  parq: Array(7).fill(0),
  nqs: Array(6).fill(0),
  terms: { version: WELLNESS_TERMS_VERSION, acceptedAt: TODAY.toISOString() },
};

function previewOf(draft: ObjectiveDraft): PlanPreview {
  const preview = buildPlanPreview(draft);
  if (!preview) throw new Error("vista previa vacía");
  return preview;
}

/** Simula el guardado del onboarding hace 9 días (día 10 hoy). */
function seedOnboardingPlan() {
  const preview = previewOf(BASE_DRAFT);
  savePlanSnapshot({
    name: "Ana Torres",
    goal: preview.goal,
    startDate: isoDaysAgo(9),
    kcal: preview.kcal,
    proteinG: preview.proteinG,
    carbsG: preview.carbsG,
    fatG: preview.fatG,
    waterMl: preview.waterMl,
    totalDays: preview.totalDays,
    createdAt: "2026-11-15T12:00:00.000Z",
    sex: BASE_DRAFT.sex,
    age: BASE_DRAFT.age,
    heightCm: BASE_DRAFT.heightCm,
    weightKg: BASE_DRAFT.weightKg,
    waistCm: BASE_DRAFT.waistCm,
    targetWeightKg: BASE_DRAFT.targetWeightKg,
    activity: BASE_DRAFT.activity,
    pace: BASE_DRAFT.pace,
    vegetarian: false,
    dairyFree: true,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("cambio de objetivo (KAN-144)", () => {
  it("el onboarding guarda la versión 1 con los datos del objetivo", () => {
    seedOnboardingPlan();
    const plan = loadPlanSnapshot();
    expect(plan?.version).toBe(1);
    expect(plan).toMatchObject({
      sex: "F",
      age: 34,
      weightKg: 72,
      dairyFree: true,
    });
    expect(loadPlanVersions()).toEqual([]);
  });

  it("crea una nueva versión que conserva startDate y el día del plan", () => {
    seedOnboardingPlan();
    const before = loadPlanSnapshot()!;
    expect(planDay(before.startDate, TODAY)).toBe(10);

    const draft = { ...draftFromSnapshot(before), goal: "masa" as const };
    const result = changePlanObjective(
      {
        ...draft,
        parq: BASE_DRAFT.parq,
        nqs: BASE_DRAFT.nqs,
        terms: BASE_DRAFT.terms,
      },
      previewOf({ ...BASE_DRAFT, goal: "masa" }),
      TODAY,
    );

    expect(result.next.version).toBe(2);
    expect(result.next.goal).toBe("masa");
    expect(result.next.startDate).toBe(before.startDate);
    expect(planDay(result.next.startDate, TODAY)).toBe(10);
    expect(getWellnessHomeData("", TODAY).day).toBe(10);
  });

  it("archiva la versión anterior con fecha de cambio", () => {
    seedOnboardingPlan();
    const before = loadPlanSnapshot()!;
    changePlanObjective(
      BASE_DRAFT,
      previewOf({ ...BASE_DRAFT, goal: "def" }),
      TODAY,
    );

    const versions = loadPlanVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      version: 1,
      changedAt: TODAY.toISOString(),
      snapshot: { goal: "bajar", kcal: before.kcal },
    });

    changePlanObjective(
      BASE_DRAFT,
      previewOf({ ...BASE_DRAFT, goal: "masa" }),
      TODAY,
    );
    expect(loadPlanVersions().map((entry) => entry.version)).toEqual([1, 2]);
    expect(loadPlanSnapshot()?.version).toBe(3);
  });

  it("no borra protocolo, puntos, racha ni baterías", () => {
    seedOnboardingPlan();
    const history = {
      [isoDaysAgo(1)]: [
        "exercise",
        "diet",
        "vitals",
        "emotional",
        "chest",
      ] as const,
      [isoDaysAgo(0)]: ["exercise", "diet"] as const,
    };
    saveProtocolHistory({
      [isoDaysAgo(1)]: [...history[isoDaysAgo(1)]],
      [isoDaysAgo(0)]: [...history[isoDaysAgo(0)]],
    });
    saveBatteriesCompleted(3);
    const homeBefore = getWellnessHomeData("", TODAY);

    changePlanObjective(
      BASE_DRAFT,
      previewOf({ ...BASE_DRAFT, goal: "masa" }),
      TODAY,
    );

    const homeAfter = getWellnessHomeData("", TODAY);
    expect(loadProtocolHistory()).toEqual({
      [isoDaysAgo(1)]: ["exercise", "diet", "vitals", "emotional", "chest"],
      [isoDaysAgo(0)]: ["exercise", "diet"],
    });
    expect(totalPoints(loadProtocolHistory())).toBe(homeBefore.points);
    expect(homeAfter.points).toBe(homeBefore.points);
    expect(homeAfter.streakDays).toBe(homeBefore.streakDays);
    expect(loadBatteriesCompleted()).toBe(3);
  });

  it("normaliza un snapshot previo a KAN-144 sin romper el Home", () => {
    window.localStorage.setItem(
      "wellness.plan.v1",
      JSON.stringify({
        name: "Ana",
        goal: "def",
        startDate: isoDaysAgo(4),
        kcal: 1700,
        proteinG: 120,
        carbsG: 180,
        fatG: 45,
        waterMl: 2250,
        totalDays: 365,
        createdAt: "2026-11-20T08:00:00.000Z",
      }),
    );
    const plan = loadPlanSnapshot();
    expect(plan).toMatchObject({
      version: 1,
      sex: null,
      age: null,
      weightKg: null,
      activity: null,
      pace: "m",
      vegetarian: false,
      dairyFree: false,
    });
    expect(getWellnessHomeData("", TODAY).day).toBe(5);

    const draft = draftFromSnapshot(plan, "Ana");
    expect(draft.goal).toBe("def");
    expect(draft.weightKg).toBeNull();
    expect(evaluateGate(draft).ok).toBe(false);
  });

  it("la vista previa cambia las kcal según el objetivo", () => {
    const bajar = previewOf({ ...BASE_DRAFT, goal: "bajar" });
    const masa = previewOf({ ...BASE_DRAFT, goal: "masa" });
    const def = previewOf({ ...BASE_DRAFT, goal: "def" });
    expect(masa.kcal).toBeGreaterThan(def.kcal);
    expect(def.kcal).toBeGreaterThan(bajar.kcal);
  });

  it("el draft precargado deja seguridad y términos sin responder", () => {
    seedOnboardingPlan();
    const draft = draftFromSnapshot(loadPlanSnapshot());
    expect(draft).toMatchObject({
      name: "Ana Torres",
      goal: "bajar",
      sex: "F",
      age: 34,
      heightCm: 165,
      weightKg: 72,
      waistCm: 84,
      targetWeightKg: 64,
      activity: 2,
      dairyFree: true,
      terms: null,
    });
    expect(draft.parq.every((answer) => answer === null)).toBe(true);
    expect(draft.nqs.every((answer) => answer === null)).toBe(true);
  });

  it("diffPlans marca solo lo que cambió", () => {
    seedOnboardingPlan();
    const previous = loadPlanSnapshot()!;
    const diff = diffPlans(previous, {
      ...previous,
      goal: "masa",
      kcal: previous.kcal + 300,
    });
    expect(diff.filter((row) => row.changed).map((row) => row.field)).toEqual([
      "goal",
      "kcal",
    ]);
    expect(
      diffPlans(null, previous).every(
        (row) => row.before === null && row.changed,
      ),
    ).toBe(true);
  });
});
