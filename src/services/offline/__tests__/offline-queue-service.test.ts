/**
 * Tests del servicio de cola offline (Fase 12, tarea 2.5).
 *
 * Se mockea `apiFetch` (frontera tipada al Gateway) y se usa el
 * `localStorage` real de happy-dom. Cobertura: encolado + idempotencyKey
 * UUID v4, constructores tipados, backoff, despacho FIFO (2xx/4xx/5xx),
 * orden, tope de intentos, purga TTL previa y eventos de ventana.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const apiFetchMock = vi.fn();

vi.mock("../../../utils/apiClient", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly errorType: "TIMEOUT" | "network" | "server" | "business";
    constructor(opts: {
      message: string;
      status?: number;
      code?: string;
      errorType?: "TIMEOUT" | "network" | "server" | "business";
    }) {
      super(opts.message);
      this.name = "ApiError";
      this.status = opts.status ?? 0;
      this.code = opts.code;
      this.errorType = opts.errorType ?? "server";
    }
  },
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { ApiError } from "../../../utils/apiClient";
import {
  OFFLINE_SYNCED_EVENT,
  OFFLINE_SYNC_STATE_EVENT,
  computeBackoffMs,
  dispatchQueue,
  enqueueOfflineMutation,
  isDispatching,
  isTransportError,
  newIdempotencyKey,
  queueHydration,
  queueNotificationRead,
  queueTaskCompletion,
} from "../offline-queue-service";
import {
  clearQueue,
  loadQueue,
  OFFLINE_QUEUE_MAX_ENTRIES,
} from "../offline-storage";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const noopDelay = async (): Promise<void> => {};

describe("newIdempotencyKey / isTransportError / computeBackoffMs", () => {
  it("genera UUID v4", () => {
    expect(newIdempotencyKey()).toMatch(UUID_V4);
  });

  it("clasifica errores de transporte vs negocio", () => {
    expect(
      isTransportError(new ApiError({ message: "x", errorType: "network" })),
    ).toBe(true);
    expect(
      isTransportError(new ApiError({ message: "x", errorType: "TIMEOUT" })),
    ).toBe(true);
    expect(
      isTransportError(
        new ApiError({ message: "x", status: 503, errorType: "server" }),
      ),
    ).toBe(true);
    expect(
      isTransportError(
        new ApiError({ message: "x", status: 404, errorType: "business" }),
      ),
    ).toBe(false);
    expect(
      isTransportError(
        new ApiError({ message: "x", status: 422, errorType: "business" }),
      ),
    ).toBe(false);
    // Desconocido: se conserva (nunca descarte silencioso de salud).
    expect(isTransportError(new Error("raro"))).toBe(true);
  });

  it("backoff exponencial con techo 30 s (+jitter ≤250 ms)", () => {
    const b0 = computeBackoffMs(0);
    expect(b0).toBeGreaterThanOrEqual(1000);
    expect(b0).toBeLessThanOrEqual(1250);
    const b2 = computeBackoffMs(2);
    expect(b2).toBeGreaterThanOrEqual(4000);
    expect(b2).toBeLessThanOrEqual(4250);
    expect(computeBackoffMs(10)).toBeLessThanOrEqual(30250);
    expect(computeBackoffMs(10)).toBeGreaterThanOrEqual(30000);
  });
});

describe("enqueueOfflineMutation y constructores", () => {
  beforeEach(() => {
    localStorage.clear();
    apiFetchMock.mockReset();
  });

  it("encola con id + idempotencyKey UUID v4 y persiste", () => {
    const events: string[] = [];
    const onChange = (): void => {
      events.push("changed");
    };
    window.addEventListener("offline:queue-changed", onChange);
    try {
      const queued = enqueueOfflineMutation({
        type: "meal_log",
        endpoint: "/api/v1/program/nutrition/log",
        payload: { mealCode: "des" },
      });
      expect(queued.id).toMatch(UUID_V4);
      expect(queued.idempotencyKey).toMatch(UUID_V4);
      expect(queued.id).not.toBe(queued.idempotencyKey);
      expect(queued.method).toBe("POST");
      expect(queued.retryCount).toBe(0);
      expect(loadQueue()).toHaveLength(1);
      expect(events).toEqual(["changed"]);
    } finally {
      window.removeEventListener("offline:queue-changed", onChange);
    }
  });

  it("rechaza endpoint vacío sin tocar la cola", () => {
    expect(() =>
      enqueueOfflineMutation({ type: "hydration", endpoint: "  " }),
    ).toThrow("endpoint válido");
    expect(loadQueue()).toHaveLength(0);
  });

  it("queueHydration arma el shape wire agua + valida", () => {
    const queued = queueHydration({ waterMl: 500 });
    expect(queued.type).toBe("hydration");
    expect(queued.endpoint).toBe("/api/v1/program/nutrition/log");
    expect(queued.payload).toEqual({
      mealCode: "agua",
      intake: { waterMl: 500, source: "manual" },
    });
    expect(() => queueHydration({ waterMl: 0 })).toThrow("waterMl positivo");
  });

  it("queueTaskCompletion valida snapshot-derived requeridos", () => {
    const queued = queueTaskCompletion({
      enrollmentId: "enr-1",
      localDate: "2026-09-25",
      taskCode: "nut",
      clientRequestId: "req-1",
    });
    expect(queued.type).toBe("task_completion");
    expect(queued.endpoint).toBe("/api/v1/program/tasks/complete");
    expect(() =>
      queueTaskCompletion({
        enrollmentId: "",
        localDate: "2026-09-25",
        taskCode: "nut",
        clientRequestId: "req-1",
      }),
    ).toThrow("enrollmentId");
  });

  it("queueNotificationRead codifica el id y valida", () => {
    const queued = queueNotificationRead("n/1?a=b");
    expect(queued.type).toBe("notification_read");
    expect(queued.endpoint).toBe(
      "/api/v1/program/notifications/n%2F1%3Fa%3Db/read",
    );
    expect(queued.payload).toBeNull();
    expect(() => queueNotificationRead("  ")).toThrow("id válido");
  });

  it("al tope desaloja la más vieja (FIFO) con aviso", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (let i = 0; i < OFFLINE_QUEUE_MAX_ENTRIES + 1; i += 1) {
        enqueueOfflineMutation({
          type: "hydration",
          endpoint: `/api/v1/program/nutrition/log#${i}`,
        });
      }
      const entries = loadQueue();
      expect(entries).toHaveLength(OFFLINE_QUEUE_MAX_ENTRIES);
      expect(entries[0].endpoint).toBe("/api/v1/program/nutrition/log#1");
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("dispatchQueue — FIFO secuencial", () => {
  beforeEach(() => {
    localStorage.clear();
    apiFetchMock.mockReset();
  });

  it("2xx remueve, envía X-Idempotency-Key y emite synced", async () => {
    const queued = enqueueOfflineMutation({
      type: "notification_read",
      endpoint: "/api/v1/program/notifications/n-1/read",
      payload: null,
    });
    apiFetchMock.mockResolvedValue(undefined);
    const states: boolean[] = [];
    const summaries: unknown[] = [];
    const onState = (e: Event): void => {
      states.push((e as CustomEvent<{ isSyncing: boolean }>).detail.isSyncing);
    };
    const onSynced = (e: Event): void => {
      summaries.push((e as CustomEvent).detail);
    };
    window.addEventListener(OFFLINE_SYNC_STATE_EVENT, onState);
    window.addEventListener(OFFLINE_SYNCED_EVENT, onSynced);
    try {
      const summary = await dispatchQueue({ delay: noopDelay });
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/v1/program/notifications/n-1/read",
        {
          method: "POST",
          body: undefined,
          headers: { "X-Idempotency-Key": queued.idempotencyKey },
        },
      );
      expect(summary).toMatchObject({
        succeeded: 1,
        dropped: 0,
        remaining: 0,
        types: ["notification_read"],
      });
      expect(loadQueue()).toHaveLength(0);
      expect(states).toEqual([true, false]);
      expect(summaries).toHaveLength(1);
      expect(isDispatching()).toBe(false);
    } finally {
      window.removeEventListener(OFFLINE_SYNC_STATE_EVENT, onState);
      window.removeEventListener(OFFLINE_SYNCED_EVENT, onSynced);
    }
  });

  it("respeta orden FIFO entre varias entradas", async () => {
    const order: string[] = [];
    apiFetchMock.mockImplementation((endpoint: unknown) => {
      order.push(String(endpoint));
      return Promise.resolve(undefined);
    });
    enqueueOfflineMutation({
      type: "hydration",
      endpoint: "/api/v1/program/nutrition/log",
      payload: { mealCode: "agua" },
    });
    enqueueOfflineMutation({
      type: "task_completion",
      endpoint: "/api/v1/program/tasks/complete",
      payload: { taskCode: "nut" },
    });
    const summary = await dispatchQueue({ delay: noopDelay });
    expect(order).toEqual([
      "/api/v1/program/nutrition/log",
      "/api/v1/program/tasks/complete",
    ]);
    expect(summary.succeeded).toBe(2);
    expect(summary.types).toEqual(["hydration", "task_completion"]);
  });

  it("4xx descarta con aviso y continúa con la siguiente", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      enqueueOfflineMutation({
        type: "hydration",
        endpoint: "/primera",
        payload: {},
      });
      enqueueOfflineMutation({
        type: "hydration",
        endpoint: "/segunda",
        payload: {},
      });
      apiFetchMock
        .mockRejectedValueOnce(
          new ApiError({ message: "Bad", status: 422, errorType: "business" }),
        )
        .mockResolvedValueOnce(undefined);
      const summary = await dispatchQueue({ delay: noopDelay });
      expect(summary).toMatchObject({
        succeeded: 1,
        dropped: 1,
        remaining: 0,
      });
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalled();
      expect(loadQueue()).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });

  it("5xx conserva con retryCount++ y detiene la ráfaga tras 5 intentos", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Down", status: 503, errorType: "server" }),
    );
    enqueueOfflineMutation({
      type: "hydration",
      endpoint: "/api/v1/program/nutrition/log",
      payload: {},
    });
    const summary = await dispatchQueue({ delay: noopDelay });
    expect(apiFetchMock).toHaveBeenCalledTimes(5);
    expect(summary).toMatchObject({ succeeded: 0, dropped: 0, remaining: 1 });
    const [kept] = loadQueue();
    expect(kept.retryCount).toBe(5);
    expect(kept.lastAttemptAt).toBeGreaterThan(0);
  });

  it("purga vencidas antes de despachar (no tocan la red)", async () => {
    apiFetchMock.mockResolvedValue(undefined);
    const { saveQueue } = await import("../offline-storage");
    const { OFFLINE_QUEUE_TTL_MS } = await import("../offline-storage");
    saveQueue([
      {
        id: "vieja",
        type: "hydration",
        endpoint: "/vencida",
        method: "POST",
        payload: {},
        idempotencyKey: "k",
        createdAt: Date.now() - OFFLINE_QUEUE_TTL_MS - 1000,
        retryCount: 0,
      },
    ]);
    const summary = await dispatchQueue({ delay: noopDelay });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ succeeded: 0, remaining: 0 });
    expect(loadQueue()).toHaveLength(0);
  });

  it("despachos concurrentes comparten el mismo ciclo", async () => {
    apiFetchMock.mockResolvedValue(undefined);
    enqueueOfflineMutation({
      type: "hydration",
      endpoint: "/api/v1/program/nutrition/log",
      payload: {},
    });
    const [a, b] = await Promise.all([
      dispatchQueue({ delay: noopDelay }),
      dispatchQueue({ delay: noopDelay }),
    ]);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(a.succeeded).toBe(1);
    expect(b.succeeded).toBe(1);
  });

  it("cola vacía resuelve resumen en ceros", async () => {
    clearQueue();
    const summary = await dispatchQueue({ delay: noopDelay });
    expect(summary).toMatchObject({ succeeded: 0, dropped: 0, remaining: 0 });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
