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
import { queueNotificationRead } from "../services/offline/offline-queue-service";
import { notificationsKeys } from "./queryKeys";

import type { PaginatedNotificationsResult } from "../services/notifications/types";

const LIST_PAGE = 1;
const LIST_PAGE_SIZE = 50;
const STALE_MS = 60 * 1000;

/** Fallo de transporte: la entrada se conserva en la cola offline (Fase 12). */
function isTransportError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  if (err.errorType === "network" || err.errorType === "TIMEOUT") return true;
  return err.errorType === "server" && err.status >= 500;
}

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
      // Optimismo primero: el tap en el modal se refleja al instante.
      let wasUnread = false;
      queryClient.setQueryData<PaginatedNotificationsResult>(key, (prev) => {
        if (!prev) return prev;
        let touched = false;
        const items = prev.items.map((item) => {
          if (item.id !== id || item.readAt !== null) return item;
          touched = true;
          return { ...item, readAt: new Date().toISOString() };
        });
        wasUnread = wasUnread || touched;
        return {
          ...prev,
          items,
          unreadCount: touched
            ? Math.max(0, prev.unreadCount - 1)
            : prev.unreadCount,
        };
      });
      try {
        await markNotificationRead(id);
      } catch (err) {
        if (isTransportError(err)) {
          // Fase 12: sin red o 5xx/timeout → cola persistente con
          // idempotencyKey; el optimismo se conserva y el dispatcher
          // reconcilia al recuperar conexión. No se propaga.
          queueNotificationRead(id);
          return;
        }
        // Negocio (4xx): rollback del optimismo y se propaga.
        if (wasUnread) {
          queryClient.setQueryData<PaginatedNotificationsResult>(
            key,
            (prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                items: prev.items.map((item) =>
                  item.id === id ? { ...item, readAt: null } : item,
                ),
                unreadCount: prev.unreadCount + 1,
              };
            },
          );
        }
        throw err;
      }
    },
    [key, queryClient],
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    const current = queryClient.getQueryData<PaginatedNotificationsResult>(key);
    const unreadIds = (current?.items ?? [])
      .filter((item) => item.readAt === null)
      .map((item) => item.id);
    if (unreadIds.length === 0) return;
    // Optimismo primero: todo lo no leído se marca al instante.
    const now = new Date().toISOString();
    queryClient.setQueryData<PaginatedNotificationsResult>(key, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.readAt === null ? { ...item, readAt: now } : item,
        ),
        unreadCount: 0,
      };
    });
    const results = await Promise.allSettled(
      unreadIds.map((id) => markNotificationRead(id)),
    );
    const reasonOf = (i: number): unknown =>
      (results[i] as PromiseRejectedResult).reason;
    const businessFailed = unreadIds.filter(
      (_, i) =>
        results[i].status === "rejected" && !isTransportError(reasonOf(i)),
    );
    unreadIds.forEach((id, i) => {
      if (results[i].status === "rejected" && isTransportError(reasonOf(i))) {
        queueNotificationRead(id);
      }
    });
    if (businessFailed.length === 0) return;
    // Rollback solo de los rechazados por negocio; los encolados conservan
    // el optimismo hasta el despacho.
    const failedSet = new Set(businessFailed);
    queryClient.setQueryData<PaginatedNotificationsResult>(key, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          failedSet.has(item.id) ? { ...item, readAt: null } : item,
        ),
        unreadCount: prev.unreadCount + businessFailed.length,
      };
    });
    throw reasonOf(unreadIds.indexOf(businessFailed[0]));
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
