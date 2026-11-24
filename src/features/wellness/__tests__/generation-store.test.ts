import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGenerationState,
  recordGenerationFailure,
  requestGeneration,
  retryGeneration,
  setNextFailure,
} from "../generation/generation-store";

const snapshot = {
  startDate: "2026-11-24",
  goal: "bajar",
  createdAt: "2026-11-24T15:00:00.000Z",
} as const;
const now = Date.parse(snapshot.createdAt);
const storageKey = "wellness.generation.v1";

beforeEach(() => window.localStorage.clear());

describe("generación de bienestar", () => {
  it("registra el snapshot una sola vez y crea otro job para otra clave", () => {
    expect(getGenerationState(now)).toBeNull();
    const job = requestGeneration(snapshot, now);
    expect(job.key).toBe("2026-11-24|bajar|2026-11-24T15:00:00.000Z");
    const saved = window.localStorage.getItem(storageKey);
    expect(requestGeneration({ ...snapshot }, now + 50)).toEqual(job);
    expect(window.localStorage.getItem(storageKey)).toBe(saved);

    const ready = getGenerationState(now + 1300);
    expect(requestGeneration(snapshot, now + 2000)).toEqual(ready);
    expect(requestGeneration({ ...snapshot, goal: "masa" }, now + 2000)).toMatchObject({
      startedAt: now + 2000,
      attempts: 1,
      artifacts: { exercise: { status: "running", progress: 0 } },
    });
  });

  it("avanza de forma independiente y materializa los mensajes cuando corresponden", () => {
    expect(requestGeneration(snapshot, now).inbox).toEqual([]);
    expect(getGenerationState(now + 350)).toMatchObject({
      artifacts: {
        exercise: { status: "running", progress: 38 },
        nutrition: { status: "running", progress: 26 },
        inbox: { status: "running", progress: 50 },
      },
      inbox: [],
    });
    expect(getGenerationState(now + 700)?.inbox.map(({ id }) => id)).toEqual([
      "welcome", "questionnaires",
    ]);
    expect(getGenerationState(now + 900)?.inbox.map(({ id }) => id)).toEqual([
      "welcome", "exercise", "questionnaires",
    ]);
    const ready = getGenerationState(now + 1300);
    expect(Object.values(ready!.artifacts)).toEqual(
      Array(3).fill({ status: "ready", progress: 100, startedAt: now }),
    );
    expect(ready?.inbox.map(({ id }) => id)).toEqual([
      "welcome", "exercise", "nutrition", "questionnaires",
    ]);
    expect(ready?.inbox.find(({ id }) => id === "nutrition")?.createdAt)
      .toBe(new Date(now + 1300).toISOString());
  });

  it("reintenta solo el fallo y conserva los resultados listos", () => {
    setNextFailure("exercise");
    requestGeneration(snapshot, now);
    expect(retryGeneration(now + 900)?.attempts).toBe(1);
    const failed = getGenerationState(now + 1300);
    expect(failed?.artifacts.exercise.status).toBe("failed");
    expect(failed?.inbox.map(({ id }) => id)).toEqual(["welcome", "nutrition", "questionnaires"]);

    const retried = retryGeneration(now + 1500);
    expect(retried?.attempts).toBe(2);
    expect(retried?.artifacts.exercise).toEqual({
      status: "running", progress: 0, startedAt: now + 1500,
    });
    expect(retried?.artifacts.nutrition).toEqual(failed?.artifacts.nutrition);
    expect(retried?.artifacts.inbox).toEqual(failed?.artifacts.inbox);
    expect(retryGeneration(now + 1500)).toEqual(retried);
    const recovered = getGenerationState(now + 2400);
    expect(recovered?.artifacts.exercise.status).toBe("ready");
    expect(retryGeneration(now + 2400)).toEqual(recovered);
  });

  it("recupera el avance y el fallo programado al volver a cargar el módulo", async () => {
    setNextFailure("inbox");
    requestGeneration(snapshot, now);
    const running = getGenerationState(now + 400);
    expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toEqual(running);
    vi.resetModules();
    const reloaded = await import("../generation/generation-store");
    const restored = reloaded.getGenerationState(now + 1300);
    expect(restored?.startedAt).toBe(now);
    expect(restored?.artifacts.inbox.status).toBe("failed");
    expect(restored?.inbox).toEqual([]);
    reloaded.retryGeneration(now + 1300);
    expect(reloaded.getGenerationState(now + 2000)?.inbox).toHaveLength(4);
  });

  it("permite recuperar un arranque que no se pudo persistir", () => {
    const write = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    try {
      expect(() => requestGeneration(snapshot, now)).toThrow();
      recordGenerationFailure(snapshot, now);
      expect(Object.values(getGenerationState(now)!.artifacts).map(({ status }) => status))
        .toEqual(["failed", "failed", "failed"]);
    } finally {
      write.mockRestore();
    }
    expect(retryGeneration(now)?.attempts).toBe(2);
    expect(getGenerationState(now + 1300)?.inbox).toHaveLength(4);
  });
});
