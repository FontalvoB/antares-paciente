/**
 * Tests de useNotifications (Fase 11, tarea 2.5; Fase 12, tarea 2.5).
 *
 * Se mockean la capa de servicio y la cola offline (mismas rutas que
 * importa el hook). Cobertura: carga inicial, lista + unreadCount,
 * markAsRead (decrementa), markAllAsRead (vacía el conteo), refresh y
 * resiliencia Fase 12 (transporte → encola sin lanzar; 4xx → revierte).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../../utils/apiClient";
import { notificationsKeys } from "../queryKeys";
import type { PaginatedNotificationsResult } from "../../services/notifications/types";

const fetchNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();
const queueNotificationReadMock = vi.fn();

vi.mock("../../services/notifications/notifications-service", () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  markNotificationRead: (...args: unknown[]) =>
    markNotificationReadMock(...args),
}));

vi.mock("../../services/offline/offline-queue-service", () => ({
  queueNotificationRead: (...args: unknown[]) =>
    queueNotificationReadMock(...args),
}));

import { useNotifications } from "../useNotifications";

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

function fixturePage(
  overrides: Partial<PaginatedNotificationsResult> = {},
): PaginatedNotificationsResult {
  return {
    items: [
      {
        id: "n-1",
        type: "appointment_reminder",
        title: "Cita hoy",
        message: "Telemedicina 3:00 PM",
        priority: "high",
        channel: "inapp",
        sentAt: new Date().toISOString(),
        readAt: null,
      },
      {
        id: "n-2",
        type: "hydration_nudge",
        title: "Hidratación",
        message: "Llevas 5 de 8 vasos",
        priority: "normal",
        channel: "inapp",
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: "2026-09-20T10:00:00.000Z",
      },
    ],
    unreadCount: 1,
    page: 1,
    pageSize: 50,
    totalCount: 2,
    totalPages: 1,
    ...overrides,
  };
}

describe("useNotifications — centro de avisos in-app", () => {
  beforeEach(() => {
    fetchNotificationsMock.mockReset();
    markNotificationReadMock.mockReset();
  });

  it("carga inicial: isLoading con lista vacía y conteo 0", () => {
    fetchNotificationsMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("data: expone lista + unreadCount y cachea la página", async () => {
    fetchNotificationsMock.mockResolvedValue(fixturePage());
    const client = newClient();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
    expect(client.getQueryData(notificationsKeys.list(1, 50))).toMatchObject({
      unreadCount: 1,
    });
  });

  it("error sin cache: isError honesto sin lista fabricada", async () => {
    fetchNotificationsMock.mockRejectedValue(
      new ApiError({
        message: "Unauthorized",
        status: 401,
        errorType: "business",
      }),
    );
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(typeof result.current.refresh).toBe("function");
  });

  it("markAsRead: publica y marca el aviso + decrementa el conteo", async () => {
    fetchNotificationsMock.mockResolvedValue(fixturePage());
    markNotificationReadMock.mockResolvedValue(undefined);
    const client = newClient();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAsRead("n-1");
    });

    expect(markNotificationReadMock).toHaveBeenCalledWith("n-1");
    // El re-render tras setQueryData aterriza fuera del act: se observa.
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(
      result.current.notifications.find((n) => n.id === "n-1")?.readAt,
    ).not.toBeNull();
  });

  it("markAsRead sobre un aviso ya leído no decrementa dos veces", async () => {
    fetchNotificationsMock.mockResolvedValue(fixturePage());
    markNotificationReadMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAsRead("n-2");
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("markAllAsRead: publica cada no leída y vacía el conteo", async () => {
    fetchNotificationsMock.mockResolvedValue(
      fixturePage({
        items: [
          { ...fixturePage().items[0], id: "n-1", readAt: null },
          { ...fixturePage().items[0], id: "n-3", readAt: null },
        ],
        unreadCount: 2,
        totalCount: 2,
      }),
    );
    markNotificationReadMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(markNotificationReadMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(result.current.notifications.every((n) => n.readAt !== null)).toBe(
      true,
    );
  });

  it("markAllAsRead sin no leídas no llama a la red", async () => {
    fetchNotificationsMock.mockResolvedValue(
      fixturePage({
        items: fixturePage().items.map((n) => ({
          ...n,
          readAt: "2026-09-24T10:00:00.000Z",
        })),
        unreadCount: 0,
      }),
    );
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAllAsRead();
    });
    expect(markNotificationReadMock).not.toHaveBeenCalled();
  });

  it("markAsRead con fallo de transporte encola y conserva el optimismo sin lanzar", async () => {
    fetchNotificationsMock.mockResolvedValue(fixturePage());
    markNotificationReadMock.mockRejectedValue(
      new ApiError({ message: "Sin red", status: 0, errorType: "network" }),
    );
    queueNotificationReadMock.mockReset();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAsRead("n-1");
    });

    expect(queueNotificationReadMock).toHaveBeenCalledWith("n-1");
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(
      result.current.notifications.find((n) => n.id === "n-1")?.readAt,
    ).not.toBeNull();
  });

  it("markAsRead con 4xx revierte el optimismo y propaga", async () => {
    fetchNotificationsMock.mockResolvedValue(fixturePage());
    markNotificationReadMock.mockRejectedValue(
      new ApiError({
        message: "No existe",
        status: 404,
        errorType: "business",
      }),
    );
    queueNotificationReadMock.mockReset();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.markAsRead("n-1")).rejects.toMatchObject({
        status: 404,
      });
    });

    expect(queueNotificationReadMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(
      result.current.notifications.find((n) => n.id === "n-1")?.readAt,
    ).toBeNull();
  });

  it("markAllAsRead mixto: encola transporte, revierte negocio y lanza", async () => {
    fetchNotificationsMock.mockResolvedValue(
      fixturePage({
        items: [
          { ...fixturePage().items[0], id: "n-1", readAt: null },
          { ...fixturePage().items[0], id: "n-3", readAt: null },
        ],
        unreadCount: 2,
        totalCount: 2,
      }),
    );
    markNotificationReadMock
      .mockRejectedValueOnce(
        new ApiError({ message: "Sin red", status: 0, errorType: "network" }),
      )
      .mockRejectedValueOnce(
        new ApiError({
          message: "No existe",
          status: 404,
          errorType: "business",
        }),
      );
    queueNotificationReadMock.mockReset();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.markAllAsRead()).rejects.toMatchObject({
        status: 404,
      });
    });

    // n-1 (transporte) encolado con optimismo; n-3 (404) revertido.
    expect(queueNotificationReadMock).toHaveBeenCalledWith("n-1");
    expect(queueNotificationReadMock).not.toHaveBeenCalledWith("n-3");
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(
      result.current.notifications.find((n) => n.id === "n-1")?.readAt,
    ).not.toBeNull();
    expect(
      result.current.notifications.find((n) => n.id === "n-3")?.readAt,
    ).toBeNull();
  });
});
