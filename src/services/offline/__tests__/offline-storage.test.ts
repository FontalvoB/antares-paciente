/**
 * Tests de la persistencia de la cola offline (Fase 12, tarea 2.5).
 *
 * `localStorage` real de happy-dom (el módulo lo usa directo): se limpia
 * entre tests. Cobertura: roundtrip, TTL 72 h (borde incluido), formas
 * inválidas/corruptas, conteo y vaciado.
 */
import { describe, it, expect, beforeEach } from "vitest";

import {
  OFFLINE_QUEUE_STORAGE_KEY,
  OFFLINE_QUEUE_TTL_MS,
  clearQueue,
  loadQueue,
  pendingCount,
  purgeExpired,
  saveQueue,
} from "../offline-storage";

import type { QueuedMutation } from "../types";

function entry(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: "q-1",
    type: "hydration",
    endpoint: "/api/v1/program/nutrition/log",
    method: "POST",
    payload: { mealCode: "agua" },
    idempotencyKey: "key-1",
    createdAt: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

describe("offline-storage — persistencia localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("roundtrip: guarda y carga la cola intacta", () => {
    expect(
      saveQueue([entry(), entry({ id: "q-2", type: "task_completion" })]),
    ).toBe(true);
    const loaded = loadQueue();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].idempotencyKey).toBe("key-1");
    expect(loaded[1].type).toBe("task_completion");
  });

  it("cola vacía sin clave almacenada", () => {
    expect(loadQueue()).toEqual([]);
    expect(pendingCount()).toBe(0);
  });

  it("purga entradas con más de 72 h y conserva las frescas", () => {
    const now = Date.now();
    saveQueue([
      entry({ id: "vieja", createdAt: now - OFFLINE_QUEUE_TTL_MS - 1000 }),
      entry({ id: "fresca", createdAt: now - OFFLINE_QUEUE_TTL_MS + 1000 }),
    ]);
    expect(purgeExpired(now)).toBe(1);
    expect(loadQueue(now).map((e) => e.id)).toEqual(["fresca"]);
    // La purga persiste: recargar no trae de vuelta la vencida.
    expect(loadQueue(now)).toHaveLength(1);
  });

  it("el borde exacto de 72 h NO expira (solo estrictamente mayor)", () => {
    const now = Date.now();
    saveQueue([entry({ createdAt: now - OFFLINE_QUEUE_TTL_MS })]);
    expect(purgeExpired(now)).toBe(0);
    expect(loadQueue(now)).toHaveLength(1);
  });

  it("loadQueue filtra vencidas aunque no se haya purgado", () => {
    const now = Date.now();
    saveQueue([
      entry({ id: "vieja", createdAt: now - OFFLINE_QUEUE_TTL_MS - 1 }),
      entry({ id: "fresca", createdAt: now }),
    ]);
    expect(loadQueue(now).map((e) => e.id)).toEqual(["fresca"]);
  });

  it("JSON corrupto → cola vacía sin romper", () => {
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, "{no-json");
    expect(loadQueue()).toEqual([]);
  });

  it("formas inválidas se filtran (no-array, sin campos requeridos)", () => {
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify({ a: 1 }));
    expect(loadQueue()).toEqual([]);
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify([
        entry(),
        { id: "", endpoint: "/x" },
        { id: "sin-endpoint", type: "hydration" },
        null,
        "texto",
      ]),
    );
    expect(loadQueue().map((e) => e.id)).toEqual(["q-1"]);
  });

  it("pendingCount cuenta solo vigentes", () => {
    const now = Date.now();
    saveQueue([
      entry({ id: "a", createdAt: now }),
      entry({ id: "b", createdAt: now - OFFLINE_QUEUE_TTL_MS - 1 }),
    ]);
    expect(pendingCount(now)).toBe(1);
  });

  it("clearQueue vacía por completo", () => {
    saveQueue([entry()]);
    clearQueue();
    expect(loadQueue()).toEqual([]);
  });
});
