/**
 * useNotifications — estado reactivo del centro de avisos in-app (Fase 11, tarea 2.2).
 *
 * Consulta `fetchNotifications` al montar (página 1, 50 avisos: el modal agrupa
 * en cliente "Hoy" / "Esta semana"). Expone la lista, el conteo de no leídas y
 * las acciones de lectura con actualización optimista de la cache de TanStack.
 *
 * Contrato de errores (patrón useMetricsHistory/useLeague): NUNCA toast en un
 * query; los errores elegibles conservan el cache previo y sin cache el query
 * queda en isError — la UI muestra estados honestos. Sin mock fallback: sin
 * verdad del servidor no se pinta nada fabricado.
 *
 * verbatimModuleSyntax: los tipos se importan con `import type`.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../utils/apiClient";
import {
  fetchNotifications,
  markNotificationRead,
} from "../services/notifications/notifications-service";
import { notificationsKeys } from "./queryKeys";

import type { PaginatedNotificationsResult } from "../services/notifications/types";

const LIST_PAGE = 1;
const LIST_PAGE_SIZE = 50;
const STALE_MS = 60 * 1000;

export interface UseNotificationsResult {
  /** Avisos de la primera página (los más recientes primero). Vacío mientras carga o en error sin cache. */
  notifications: PaginatedNotificationsResult["items"];
  /** No leídas según el servidor (se ajusta en optimista al marcar). */
  unreadCount: number;
  /** Carga inicial sin datos. */
  isLoading: boolean;
  /** Error sin cache: la UI muestra estado honesto con reintento. */
  isError: boolean;
  /** Error subyacente, si lo hay. */
  error: ApiError | null;
  /** Marca un aviso como leído (red + actualización optimista de la cache). */
  markAsRead: (id: string) => Promise<void>;
  /** Marca todas las no leídas (best-effort por aviso, una sola actualización). */
  markAllAsRead: () => Promise<void>;
  /** Refetch manual (CTA "Reintentar" del modal). */
  refresh: () => void;
}

export function useNotifications(): UseNotificationsResult {
  const queryClient = useQueryClient();
  const key = notificationsKeys.list(LIST_PAGE, LIST_PAGE_SIZE);

  const query = useQuery<PaginatedNotificationsResult, ApiError>({
    queryKey: key,
    queryFn: () => fetchNotifications(LIST_PAGE, LIST_PAGE_SIZE),
    staleTime: STALE_MS,
    // R5.1: reintenta solo fallos de transporte/servidor, nunca negocio (4xx).
    retry: (failureCount, err) => {
      if (!(err instanceof ApiError)) return failureCount < 2;
      if (err.errorType === "network" || err.errorType === "TIMEOUT")
        return failureCount < 2;
      if (err.errorType === "server" && err.status >= 500)
        return failureCount < 2;
      return false;
    },
    networkMode: "online",
  });

  const { data, isLoading, isError, error, refetch } = query;

  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      await markNotificationRead(id);
      queryClient.setQueryData<PaginatedNotificationsResult>(key, (prev) => {
        if (!prev) return prev;
        let decremented = false;
        const items = prev.items.map((item) => {
          if (item.id !== id || item.readAt !== null) return item;
          decremented = true;
          return { ...item, readAt: new Date().toISOString() };
        });
        return {
          ...prev,
          items,
          unreadCount: decremented
            ? Math.max(0, prev.unreadCount - 1)
            : prev.unreadCount,
        };
      });
    },
    [key, queryClient],
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    const current = queryClient.getQueryData<PaginatedNotificationsResult>(key);
    const unreadIds = (current?.items ?? [])
      .filter((item) => item.readAt === null)
      .map((item) => item.id);
    if (unreadIds.length === 0) return;
    const results = await Promise.allSettled(
      unreadIds.map((id) => markNotificationRead(id)),
    );
    const readOk = new Set(
      unreadIds.filter((_, i) => results[i].status === "fulfilled"),
    );
    if (readOk.size === 0) return;
    const now = new Date().toISOString();
    queryClient.setQueryData<PaginatedNotificationsResult>(key, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          readOk.has(item.id) && item.readAt === null
            ? { ...item, readAt: now }
            : item,
        ),
        unreadCount: Math.max(0, prev.unreadCount - readOk.size),
      };
    });
  }, [key, queryClient]);

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    notifications: data?.items ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    isError,
    error: error ?? null,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
