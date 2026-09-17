import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAccessToken,
  getTokenExpiry,
  isAccessTokenExpired,
  restoreSession,
} from "../authApi";

/** JWT de prueba: header.payload.sig con payload base64url. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.firma`;
}

function stubFetch(response: unknown): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

describe("authApi — expiración del access token", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("getTokenExpiry devuelve el exp del JWT en milisegundos", () => {
    const expSec = Math.floor(Date.now() / 1000) + 600;
    expect(getTokenExpiry(fakeJwt({ exp: expSec }))).toBe(expSec * 1000);
  });

  it("getTokenExpiry es null para tokens que no son JWT (demo) o payload inválido", () => {
    expect(getTokenExpiry("demo-access-token")).toBeNull();
    expect(getTokenExpiry(null)).toBeNull();
    expect(getTokenExpiry("a.b")).toBeNull();
    expect(getTokenExpiry("a.%%%.c")).toBeNull();
  });

  it("isAccessTokenExpired: true si venció, false si sigue vigente o es demo", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    sessionStorage.setItem("copp_access_token", fakeJwt({ exp: nowSec - 60 }));
    expect(isAccessTokenExpired()).toBe(true);

    sessionStorage.setItem("copp_access_token", fakeJwt({ exp: nowSec + 600 }));
    expect(isAccessTokenExpired()).toBe(false);

    sessionStorage.setItem("copp_access_token", "demo-access-token");
    expect(isAccessTokenExpired()).toBe(false);
  });
});

describe("authApi — restoreSession ante refresh definitivo vs red caída", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("401 en el refresh: limpia el token y cierra la sesión (null)", async () => {
    const expired = fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    sessionStorage.setItem("copp_access_token", expired);
    localStorage.setItem("copp_access_token", expired);
    stubFetch({
      ok: false,
      status: 401,
      json: async () => ({ message: "Sesión expirada" }),
    });

    const result = await restoreSession();

    expect(result).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("fallo de red con token local previo: conserva la sesión (modo offline)", async () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 600 });
    sessionStorage.setItem("copp_access_token", token);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await restoreSession();

    expect(result?.accessToken).toBe(token);
    expect(getAccessToken()).toBe(token);
  });

  it("refresh exitoso: persiste el token nuevo del body", async () => {
    const fresh = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 900 });
    sessionStorage.setItem("copp_access_token", "viejo-token");
    stubFetch({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: fresh, tokenType: "Bearer", expiresIn: 900 }),
    });

    const result = await restoreSession();

    expect(result?.accessToken).toBe(fresh);
    expect(getAccessToken()).toBe(fresh);
  });
});
