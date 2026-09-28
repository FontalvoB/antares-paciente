/**
 * Tests de useNetworkStatus (Fase 12, tarea 2.5).
 *
 * Se mockea el servicio de cola (misma ruta que importa el hook) y se usa
 * el storage real para el conteo: el hook solo cablea eventos de ventana +
 * invalidaciones de TanStack. Cobertura: estado inicial, online/offline,
 * conteo reactivo, sync-state, synced (invalida dominios) y syncNow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const dispatchQueueMock = vi.fn();
const ensureAutoSyncMock = vi.fn();

vi.mock("../../services/offline/offline-queue-service", () => ({
  dispatchQueue: (...args: unknown[]) => dispatchQueueMock(...args),
  ensureAutoSync: (...args: unknown[]) => ensureAutoSyncMock(...args),
  isDispatching: () => false,
  isOnline: () =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true,
  OFFLINE_QUEUE_CHANGED_EVENT: "offline:queue-changed",
  OFFLINE_SYNC_STATE_EVENT: "offline:sync-state",
  OFFLINE_SYNCED_EVENT: "offline:synced",
}));

import { useNetworkStatus } from "../useNetworkStatus";
import {
  OFFLINE_QUEUE_CHANGED_EVENT,
  OFFLINE_SYNC_STATE_EVENT,
  OFFLINE_SYNCED_EVENT,
} from "../../services/offline/offline-queue-service";
import { saveQueue } from "../../services/offline/offline-storage";
import { notificationsKeys, programKeys } from "../queryKeys";

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function setOnLine(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

describe("useNetworkStatus — conectividad y cola", () => {
  beforeEach(() => {
    localStorage.clear();
    dispatchQueueMock.mockReset();
    ensureAutoSyncMock.mockReset();
    dispatchQueueMock.mockResolvedValue({
      succeeded: 0,
      dropped: 0,
      remaining: 0,
      types: [],
    });
    setOnLine(true);
  });

  it("estado inicial: online, sin sincronizar, conteo real", () => {
    saveQueue([
      {
        id: "q-1",
        type: "hydration",
        endpoint: "/api/v1/program/nutrition/log",
        method: "POST",
        payload: {},
        idempotencyKey: "k-1",
        createdAt: Date.now(),
        retryCount: 0,
      },
    ]);
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: makeWrapper(newClient()),
    });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.pendingCount).toBe(1);
    expect(ensureAutoSyncMock).toHaveBeenCalled();
  });

  it("eventos offline/online actualizan isOnline", () => {
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: makeWrapper(newClient()),
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it("queue-changed refresca el conteo pendiente", () => {
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: makeWrapper(newClient()),
    });
    expect(result.current.pendingCount).toBe(0);
    saveQueue([
      {
        id: "q-1",
        type: "hydration",
        endpoint: "/e",
        method: "POST",
        payload: {},
        idempotencyKey: "k",
        createdAt: Date.now(),
        retryCount: 0,
      },
    ]);
    act(() => {
      window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
    });
    expect(result.current.pendingCount).toBe(1);
  });

  it("sync-state alterna isSyncing", () => {
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: makeWrapper(newClient()),
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_SYNC_STATE_EVENT, {
          detail: { isSyncing: true },
        }),
      );
    });
    expect(result.current.isSyncing).toBe(true);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_SYNC_STATE_EVENT, {
          detail: { isSyncing: false },
        }),
      );
    });
    expect(result.current.isSyncing).toBe(false);
  });

  it("synced con adherencia invalida programa + avisos", async () => {
    const client = newClient();
    client.setQueryData(programKeys.snapshot, { marker: true });
    client.setQueryData(notificationsKeys.list(1, 50), { marker: true });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useNetworkStatus(), {
      wrapper: makeWrapper(client),
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_SYNCED_EVENT, {
          detail: {
            succeeded: 2,
            dropped: 0,
            remaining: 0,
            types: ["hydration", "notification_read"],
          },
        }),
      );
    });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const keys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: readonly unknown[] }).queryKey,
    );
    expect(keys).toContainEqual(programKeys.snapshot);
    expect(keys).toContainEqual(notificationsKeys.list(1, 50));
    invalidateSpy.mockRestore();
  });

  it("synced sin éxitos no invalida nada", async () => {
    const client = newClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useNetworkStatus(), {
      wrapper: makeWrapper(client),
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_SYNCED_EVENT, {
          detail: { succeeded: 0, dropped: 0, remaining: 1, types: [] },
        }),
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(invalidateSpy).not.toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });

  it("syncNow despacha la cola", async () => {
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: makeWrapper(newClient()),
    });
    await act(async () => {
      await result.current.syncNow();
    });
    expect(dispatchQueueMock).toHaveBeenCalledTimes(1);
  });
});
