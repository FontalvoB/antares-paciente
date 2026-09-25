/**
 * Tests del servicio de notificaciones in-app (Fase 11, tarea 2.5).
 *
 * Se mockea `apiFetch` (frontera tipada hacia el Gateway): el servicio solo
 * construye path + query y delega auth/timeout/refresh/ProblemDetails al
 * cliente compartido. Cobertura: paginación por defecto y explícita,
 * marcado como leída (path con id), validación local sin red y propagación
 * de ApiError.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

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
  fetchNotifications,
  markNotificationRead,
} from "../notifications-service";

const pageFixture = {
  items: [
    {
      id: "n-1",
      type: "appointment_reminder",
      title: "Cita hoy",
      message: "Telemedicina 3:00 PM",
      priority: "high",
      channel: "inapp",
      sentAt: "2026-09-24T10:00:00.000Z",
      readAt: null,
    },
  ],
  unreadCount: 1,
  page: 1,
  pageSize: 20,
  totalCount: 1,
  totalPages: 1,
};

describe("fetchNotifications — GET /api/v1/program/notifications", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("pide la primera página con pageSize 20 por defecto", async () => {
    apiFetchMock.mockResolvedValue(pageFixture);
    const result = await fetchNotifications();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/program/notifications?page=1&pageSize=20",
      { method: "GET" },
    );
    expect(result.unreadCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("propaga page + pageSize explícitos", async () => {
    apiFetchMock.mockResolvedValue({ ...pageFixture, page: 2, pageSize: 5 });
    await fetchNotifications(2, 5);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/program/notifications?page=2&pageSize=5",
      { method: "GET" },
    );
  });

  it("normaliza valores inválidos a los defaults sin romper la llamada", async () => {
    apiFetchMock.mockResolvedValue(pageFixture);
    await fetchNotifications(0, -3);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/program/notifications?page=1&pageSize=20",
      { method: "GET" },
    );
  });

  it("401 sesión inválida se propaga sin enmascarar", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Unauthorized", status: 401 }),
    );
    await expect(fetchNotifications()).rejects.toMatchObject({ status: 401 });
  });
});

describe("markNotificationRead — POST /api/v1/program/notifications/{id}/read", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("publica al path del aviso con el id codificado", async () => {
    apiFetchMock.mockResolvedValue(undefined);
    await markNotificationRead("n-1");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/program/notifications/n-1/read",
      { method: "POST" },
    );
  });

  it("codifica ids con caracteres especiales", async () => {
    apiFetchMock.mockResolvedValue(undefined);
    await markNotificationRead("n/1?a=b");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/program/notifications/n%2F1%3Fa%3Db/read",
      { method: "POST" },
    );
  });

  it("rechaza id vacío sin llamar a la red", async () => {
    await expect(markNotificationRead("   ")).rejects.toThrow(
      "El id de la notificación no puede estar vacío.",
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("404 del aviso se propaga (el hook decide la UX)", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError({ message: "Not Found", status: 404 }),
    );
    await expect(markNotificationRead("no-existe")).rejects.toMatchObject({
      status: 404,
    });
  });
});
