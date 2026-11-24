import { beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_OBJECTIVE_DRAFT,
  WELLNESS_TERMS_VERSION,
  normalizeDraft,
} from "../domain/draft";
import { NQS_QUESTIONS, PARQ_QUESTIONS } from "../domain/questions";
import {
  MOCK_ACCOUNT,
  MockWellnessOnboardingService,
} from "../services/wellness-onboarding-service";
import type { ObjectiveDraft } from "../domain/types";

const complete: ObjectiveDraft = {
  ...EMPTY_OBJECTIVE_DRAFT,
  email: "ana@example.com",
  goal: "masa",
  sex: "M",
  age: 29,
  heightCm: 178,
  weightKg: 70,
  waistCm: 78,
  targetWeightKg: 76,
  activity: 3,
  parq: [0, 0, 0, 0, 0, 0, 0],
  nqs: [0, 0, 0, 0, 0, 0],
  terms: {
    version: WELLNESS_TERMS_VERSION,
    acceptedAt: "2026-11-24T15:00:00.000Z",
  },
};

describe("preguntas de seguridad", () => {
  it("mantiene 7 PAR-Q y 6 NQS con ES y EN completos", () => {
    expect(PARQ_QUESTIONS).toHaveLength(7);
    expect(NQS_QUESTIONS).toHaveLength(6);
    for (const question of [...PARQ_QUESTIONS, ...NQS_QUESTIONS]) {
      expect(question.es.trim().length).toBeGreaterThan(10);
      expect(question.en.trim().length).toBeGreaterThan(10);
      expect(question.es).not.toBe(question.en);
    }
  });

  it("no repite identificadores", () => {
    const ids = [...PARQ_QUESTIONS, ...NQS_QUESTIONS].map(
      (question) => question.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("MockWellnessOnboardingService", () => {
  let service: MockWellnessOnboardingService;

  beforeEach(() => {
    window.localStorage.clear();
    service = new MockWellnessOnboardingService();
  });

  it("reconoce la cuenta demo y no inventa cuentas", async () => {
    await expect(service.checkEmail(MOCK_ACCOUNT.email)).resolves.toEqual({
      exists: true,
    });
    await expect(service.checkEmail("nadie@example.com")).resolves.toEqual({
      exists: false,
    });
  });

  it("crea cuenta y permite entrar con la contraseña correcta", async () => {
    await service.createAccount("nueva@example.com", "Segura123!");
    await expect(service.checkEmail("NUEVA@example.com")).resolves.toEqual({
      exists: true,
    });
    await expect(
      service.signIn("nueva@example.com", "Segura123!"),
    ).resolves.toBeUndefined();
    await expect(
      service.signIn("nueva@example.com", "incorrecta"),
    ).rejects.toThrow();
  });

  it("rechaza contraseñas cortas al crear cuenta", async () => {
    await expect(
      service.createAccount("x@example.com", "corta"),
    ).rejects.toThrow();
  });

  it("guarda y recupera el borrador normalizado", () => {
    service.saveDraft({ ...complete, parq: [1] as ObjectiveDraft["parq"] });
    const loaded = service.loadDraft()!;
    expect(loaded.email).toBe("ana@example.com");
    expect(loaded.parq).toHaveLength(7);
    expect(loaded.parq[0]).toBe(1);
    expect(loaded.parq[6]).toBeNull();
    expect(loaded.nqs).toHaveLength(6);
  });

  it("limpia el borrador", () => {
    service.saveDraft(complete);
    service.clearDraft();
    expect(service.loadDraft()).toBeNull();
  });

  it("no genera plan si la compuerta falla", async () => {
    const result = await service.generatePlan({ ...complete, terms: null });
    expect(result.status.ok).toBe(false);
    expect(result.plan).toBeUndefined();
  });

  it("genera la vista previa cuando la compuerta aprueba", async () => {
    const result = await service.generatePlan(complete);
    expect(result.status.ok).toBe(true);
    expect(result.plan?.totalDays).toBe(365);
    expect(result.plan?.kcal).toBeGreaterThan(0);
  });

  it("ignora un borrador corrupto en almacenamiento", () => {
    window.localStorage.setItem("wellness.onboarding.draft.v1", "{no-json");
    expect(service.loadDraft()).toBeNull();
  });
});

describe("normalizeDraft", () => {
  it("completa longitudes y tipos sin aceptar basura", () => {
    const draft = normalizeDraft({
      parq: [1, 0],
      nqs: undefined,
      pace: undefined,
    });
    expect(draft.parq).toEqual([1, 0, null, null, null, null, null]);
    expect(draft.nqs).toEqual([null, null, null, null, null, null]);
    expect(draft.pace).toBe("m");
  });
});
