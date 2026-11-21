import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthProvider, useHealth } from "../HealthContext";
import { HealthError } from "../../services/health/health-service";
import { toLocalISODate } from "../../utils/dates";

const state = vi.hoisted(() => ({
  status: vi.fn(), read: vi.fn(), request: vi.fn(), persist: vi.fn(),
  listener: vi.fn(), remove: vi.fn(), platform: "health-connect", token: "account-1",
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: state.listener } }));
vi.mock("../AppContext", () => ({
  useApp: () => ({ user: { id: state.token }, flow: "app", screen: "health-accessory" }),
}));
vi.mock("../../utils/features", () => ({ HEALTH_ENABLED: true }));
vi.mock("../../utils/authApi", () => ({
  getAccessToken: () => state.token,
  onSessionInvalid: () => () => {},
}));
vi.mock("../../utils/sessionIdentity", () => ({ sessionUserId: (token: string) => token }));
vi.mock("../../services/health/health-service", async original => ({
  ...await original<typeof import("../../services/health/health-service")>(),
  healthSource: () => state.platform,
  getHealthPermission: (status: { granted?: string[] }, requested: boolean) =>
    !requested ? "not-requested" : state.platform === "apple-health" ? "unknown"
      : status.granted?.length ? "granted" : "denied",
  isHealthAvailable: state.status,
  requestHealthPermissions: state.request,
  readHealthData: state.read,
  persistHealthDay: state.persist,
}));

function setup() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const hook = renderHook(useHealth, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}><HealthProvider>{children}</HealthProvider></QueryClientProvider>
    ),
  });
  return { ...hook, invalidate };
}

beforeEach(() => {
  localStorage.clear();
  state.platform = "health-connect";
  state.token = "account-1";
  state.status.mockResolvedValue({ availability: "available", granted: ["steps"] });
  state.request.mockResolvedValue(undefined);
  state.listener.mockResolvedValue({ remove: state.remove });
  state.read.mockRejectedValue(new HealthError("no-data"));
  state.persist.mockImplementation(async ({ recordedAt }) => ({ date: toLocalISODate(new Date(recordedAt)) }));
});

describe("Sincronización en primer plano", () => {
  it("espera autorización explícita y conserva permiso desconocido con lectura vacía de iOS", async () => {
    state.platform = "apple-health";
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current?.availability).toBe("available"));
    expect(state.read).not.toHaveBeenCalled();
    expect(result.current?.permission).toBe("not-requested");
    await act(async () => { await result.current?.sync("request"); });
    expect(result.current?.permission).toBe("unknown");
    expect(result.current?.error).toBe("no-data");
    unmount();
    await waitFor(() => expect(state.remove).toHaveBeenCalledOnce());
  });

  it("detecta denegación de Android sin leer ni enviar datos", async () => {
    state.status.mockResolvedValue({ availability: "available", granted: [] });
    const { result } = setup();
    await waitFor(() => expect(result.current?.availability).toBe("available"));
    await act(async () => { await result.current?.sync("request"); });
    expect(result.current?.permission).toBe("denied");
    expect(result.current?.error).toBe("permission-denied");
    await act(async () => { await result.current?.sync("request"); });
    expect(result.current?.permissionRequests).toBe(2);
    expect(localStorage.getItem("copp.health-read-v1.health-connect.account-1")).toBe("2");
    expect(state.read).not.toHaveBeenCalled();
    expect(state.persist).not.toHaveBeenCalled();
  });

  it("consolida operaciones simultáneas y evita reenviar el mismo total diario", async () => {
    localStorage.setItem("copp.health-read-v1.health-connect.account-1", "1");
    state.read.mockImplementation(async (from: Date) => {
      const end = new Date(from);
      end.setDate(from.getDate() + 1);
      return [{ metric: "steps", value: 44, start: +from, end: +end }];
    });
    const { result, invalidate } = setup();
    await waitFor(() => expect(result.current?.lastSync).not.toBeNull());
    expect(state.persist).toHaveBeenCalledOnce();
    await act(async () => {
      await Promise.all([result.current?.sync(), result.current?.sync(), result.current?.sync("resume")]);
    });
    expect(state.read).toHaveBeenCalledTimes(2);
    expect(state.persist).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["program"] });
    expect(result.current?.summary[0].values).toEqual({ steps: 44 });
  });

  it("muestra un fallo del servidor y permite guardar al reintentar", async () => {
    localStorage.setItem("copp.health-read-v1.health-connect.account-1", "1");
    state.read.mockImplementation(async (from: Date) => {
      const end = new Date(from);
      end.setDate(from.getDate() + 1);
      return [{ metric: "steps", value: 99, start: +from, end: +end }];
    });
    state.persist.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current?.error).toBe("save-failed"));
    expect(result.current?.summary).toHaveLength(1);
    await act(async () => { await result.current?.sync("retry"); });
    expect(result.current?.error).toBeNull();
    expect(state.persist).toHaveBeenCalledTimes(2);
  });

  it("sigue con otros días y omite los 403/404 al reintentar", async () => {
    localStorage.setItem("copp.health-read-v1.health-connect.account-1", "1");
    state.read.mockImplementation(async (from: Date) => [1, 2, 3].map(day => {
      const start = new Date(from);
      start.setDate(from.getDate() + day - 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      return { metric: "steps", value: day * 100, start: +start, end: +end };
    }));
    state.persist.mockRejectedValueOnce(new HealthError("save-unavailable"));
    state.persist.mockRejectedValueOnce(new HealthError("save-failed"));
    const { result, invalidate } = setup();
    await waitFor(() => expect(result.current?.error).toBe("save-failed"));
    expect(state.persist.mock.calls.map(([input]) => input.steps)).toEqual([100, 200, 300]);
    await act(async () => { await result.current?.sync("retry"); });
    expect(state.persist.mock.calls.map(([input]) => input.steps)).toEqual([100, 200, 300, 200]);
    expect(result.current?.error).toBe("save-unavailable");
    expect(result.current?.summary).toHaveLength(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["program"] });
  });
});
