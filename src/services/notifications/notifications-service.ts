/**
 * Servicio de notificaciones in-app — centro de avisos de salud (Fase 11, tarea 2.1).
 *
 * El transporte se delega por completo a `apiFetch` (apiClient.ts): este módulo
 * nunca toca tokens, refresh ni `fetch` directo. Toda la comunicación pasa por
 * el gateway (:5080) y el backend resuelve al paciente desde el JWT (sin ids en
 * la URL ni en el cuerpo — anti-IDOR). Los errores no-2xx viajan como
 * `ApiError` y NUNCA se tragan: el hook decide la UX.
 *
 * verbatimModuleSyntax: los tipos se importan con `import type`.
 */

import { apiFetch } from "../../utils/apiClient";

import type { InAppNotification, PaginatedNotificationsResult } from "./types";

export type { InAppNotification, PaginatedNotificationsResult };

const NOTIFICATIONS_PATH = "/api/v1/program/notifications";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

interface RawNotificationsResponse {
  data?: InAppNotification[];
  items?: InAppNotification[];
  total?: number;
  totalCount?: number;
  unreadCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

/**
 * GET /api/v1/program/notifications?page=&pageSize=
 * Página de avisos del paciente autenticado + conteo de no leídos.
 */
export async function fetchNotifications(
  page: number = DEFAULT_PAGE,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<PaginatedNotificationsResult> {
  const safePage = Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
  const safeSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const query = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safeSize),
  }).toString();
  const raw = await apiFetch<RawNotificationsResponse>(
    `${NOTIFICATIONS_PATH}?${query}`,
    { method: "GET" },
  );
  return {
    items: Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.items)
        ? raw.items
        : [],
    totalCount:
      typeof raw.total === "number"
        ? raw.total
        : typeof raw.totalCount === "number"
          ? raw.totalCount
          : 0,
    unreadCount: typeof raw.unreadCount === "number" ? raw.unreadCount : 0,
    page: typeof raw.page === "number" ? raw.page : safePage,
    pageSize: typeof raw.pageSize === "number" ? raw.pageSize : safeSize,
    totalPages: typeof raw.totalPages === "number" ? raw.totalPages : 1,
  };
}

/**
 * POST /api/v1/program/notifications/{id}/read
 * Marca un aviso como leído. Id vacío → validación local sin red.
 */
export async function markNotificationRead(id: string): Promise<void> {
  if (!id || id.trim().length === 0) {
    throw new Error("El id de la notificación no puede estar vacío.");
  }
  await apiFetch<void>(`${NOTIFICATIONS_PATH}/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}
