import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logoutUser, restoreSession, sharedRefresh } from "../authApi";

/**
 * Cookie de refresh por aplicación: la app del paciente debe indicar
 * `application` en refresh y logout para que el Auth Service lea su cookie
 * (copp_refresh_token_app) y no la de otra aplicación que comparta el host
 * (p. ej. el ERP en localhost durante el desarrollo).
 */

interface FetchCall {
  url: string;
  init: RequestInit;
}

function stubFetch(
  response: Partial<Response> | Error,
): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response as Response;
  });
  vi.stubGlobal("fetch", fn);
  return { calls };
}

function jsonBody(call: FetchCall): unknown {
  return JSON.parse(String(call.init.body));
}

describe("authApi — application en refresh y logout", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sharedRefresh envía application: 'app' como JSON y con credenciales", async () => {
    const { calls } = stubFetch({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "a", tokenType: "Bearer", expiresIn: 900 }),
    });

    await sharedRefresh();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/auth\/refresh$/);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect(new Headers(calls[0].init.headers).get("Content-Type")).toBe("application/json");
    expect(jsonBody(calls[0])).toEqual({ application: "app" });
  });

  it("sharedRefresh respeta VITE_APPLICATION_CODE", async () => {
    vi.stubEnv("VITE_APPLICATION_CODE", "erp");
    const { calls } = stubFetch({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await sharedRefresh();

    expect(jsonBody(calls[0])).toEqual({ application: "erp" });
  });

  it("restoreSession (arranque) refresca con application, sin usar otra vía", async () => {
    const { calls } = stubFetch({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await restoreSession();

    const refreshCalls = calls.filter((c) => /\/api\/auth\/refresh$/.test(c.url));
    expect(refreshCalls).toHaveLength(1);
    expect(jsonBody(refreshCalls[0])).toEqual({ application: "app" });
  });

  it("logoutUser envía application: 'app'", async () => {
    const { calls } = stubFetch({
      ok: true,
      status: 200,
      json: async () => ({ message: "Sesión cerrada correctamente" }),
    });

    await logoutUser();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/auth\/logout$/);
    expect(calls[0].init.credentials).toBe("include");
    expect(jsonBody(calls[0])).toEqual({ application: "app" });
  });

  it("logoutUser sigue siendo idempotente si el servicio falla", async () => {
    stubFetch(new Error("offline"));

    await expect(logoutUser()).resolves.toBeUndefined();
  });
});
