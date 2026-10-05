import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SosServiceError,
  activateSosAlert,
  cancelSosAlert,
  fetchActiveSosAlert,
  getCoordinatesBestEffort,
  hasGeolocation,
} from "../sos-service";

/**
 * REQ-SOS-01/02/05 — cliente SOS de la app: Idempotency-Key obligatoria,
 * GPS best-effort con validación de rango, manejo 404/409/422/429 con
 * Retry-After, cancelación del dueño. La identidad SIEMPRE viaja por JWT.
 * Flujo exclusivamente real: sin flag ni simulación local; los fallos se
 * propagan tal cual (nunca se fabrica un éxito simulado).
 */

/**
 * Node 26 expone `localStorage`/`sessionStorage` pero, sin
 * `--localstorage-file`, devuelven `undefined` y happy-dom no logra
 * instalarlos. Polyfill en memoria (solo si faltan) para que
 * `getAccessToken()` pueda aportar el Bearer en estos tests.
 */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  if (!(globalThis as Record<string, unknown>)[name]) {
    Object.defineProperty(globalThis, name, {
      value: memoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}

const originalFetch = globalThis.fetch;

function mockFetch(
  handler: (url: string, options?: RequestInit) => Response,
): void {
  globalThis.fetch = vi
    .fn()
    .mockImplementation(async (url, options) => handler(String(url), options));
}

function jsonRes(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Response {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(headers),
  } as Response;
  return res;
}

describe("getCoordinatesBestEffort — GPS best-effort (REQ-SOS-01/D6)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin geolocalización (web sin permiso/happy-dom) devuelve null", async () => {
    const coords = await getCoordinatesBestEffort();
    expect(coords).toBeNull();
  });

  it("descarta coordenadas fuera de rango", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: (p: { coords: unknown }) => void) =>
          success({ coords: { latitude: 120.5, longitude: -80 } }),
      },
    } as unknown as Navigator);
    expect(await getCoordinatesBestEffort()).toBeNull();
  });

  it("devuelve coordenadas válidas dentro del rango", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: (p: { coords: unknown }) => void) =>
          success({ coords: { latitude: -90, longitude: 180 } }),
      },
    } as unknown as Navigator);
    expect(await getCoordinatesBestEffort()).toEqual({
      latitude: -90,
      longitude: 180,
    });
  });
});

describe("activateSosAlert — POST /api/v1/sos/alerts", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("copp_access_token", "token-demo");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("genera Idempotency-Key UUIDv4 y envía Bearer + coordenadas", async () => {
    let capturedUrl = "";
    let capturedIdempotency = "";
    let capturedAuth = "";
    let capturedBody = "";
    mockFetch((url, options) => {
      capturedUrl = url;
      const headers = options?.headers as Record<string, string>;
      capturedIdempotency = headers["Idempotency-Key"];
      capturedAuth = headers.Authorization ?? "";
      capturedBody = String(options?.body);
      return jsonRes(201, { id: "a-1", status: "Activa", createdAt: "" });
    });

    const alert = await activateSosAlert({ latitude: 4.6, longitude: -74.1 });

    expect(capturedUrl).toContain("/api/v1/sos/alerts");
    expect(capturedAuth).toBe("Bearer token-demo");
    expect(capturedIdempotency).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(JSON.parse(capturedBody)).toEqual({
      latitude: 4.6,
      longitude: -74.1,
    });
    expect(alert.status).toBe("Activa");
  });

  it("sin GPS el body no lleva coordenadas", async () => {
    let capturedBody = "";
    mockFetch((_url, options) => {
      capturedBody = String(options?.body);
      return jsonRes(201, { id: "a-1", status: "Activa", createdAt: "" });
    });

    await activateSosAlert(null);
    expect(JSON.parse(capturedBody)).toEqual({});
  });

  it("incluye los signos vitales cuando se envían", async () => {
    let capturedBody = "";
    mockFetch((_url, options) => {
      capturedBody = String(options?.body);
      return jsonRes(201, { id: "a-2", status: "Activa", createdAt: "" });
    });

    await activateSosAlert(
      { latitude: 4.6, longitude: -74.1 },
      { heartRate: 140, spo2: 94, bloodPressure: "160/110" },
    );
    expect(JSON.parse(capturedBody)).toEqual({
      latitude: 4.6,
      longitude: -74.1,
      vitals: { heartRate: 140, spo2: 94, bloodPressure: "160/110" },
    });
  });

  it("429 expone Retry-After en SosServiceError", async () => {
    mockFetch(() =>
      jsonRes(429, { detail: "cooldown" }, { "Retry-After": "40" }),
    );

    const err = await activateSosAlert().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SosServiceError);
    const sosErr = err as SosServiceError;
    expect(sosErr.status).toBe(429);
    expect(sosErr.retryAfterSeconds).toBe(40);
  });

  it("422 (contacto sin teléfono E.164) propaga el detail del backend", async () => {
    mockFetch(() =>
      jsonRes(422, {
        detail: "Configura un contacto de emergencia válido.",
      }),
    );

    const err = await activateSosAlert().catch((e: unknown) => e);
    expect((err as SosServiceError).status).toBe(422);
    expect((err as SosServiceError).message).toBe(
      "Configura un contacto de emergencia válido.",
    );
  });

  it("fallo de red se propaga tal cual (sin éxito simulado)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const err = await activateSosAlert().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect((err as Error).message).toBe("Failed to fetch");
  });
});

describe("fetchActiveSosAlert / cancelSosAlert — ciclo de vida", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("copp_access_token", "token-demo");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("404 = sin alerta activa (null, no excepción)", async () => {
    mockFetch(() => jsonRes(404, { message: "no activa" }));
    expect(await fetchActiveSosAlert()).toBeNull();
  });

  it("retorna la alerta activa del paciente", async () => {
    mockFetch(() =>
      jsonRes(200, { id: "a-9", status: "Activa", createdAt: "" }),
    );
    const alert = await fetchActiveSosAlert();
    expect(alert?.id).toBe("a-9");
  });

  it("cancel hace POST /{id}/cancel con Bearer", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    mockFetch((url, options) => {
      capturedUrl = url;
      capturedMethod = String(options?.method);
      return jsonRes(200, { id: "a-9", status: "Cancelada", createdAt: "" });
    });

    const alert = await cancelSosAlert("a-9");
    expect(capturedUrl).toContain("/api/v1/sos/alerts/a-9/cancel");
    expect(capturedMethod).toBe("POST");
    expect(alert.status).toBe("Cancelada");
  });

  it("409 en cancelación se propaga como SosServiceError", async () => {
    mockFetch(() => jsonRes(409, { detail: "terminal" }));
    const err = await cancelSosAlert("a-9").catch((e: unknown) => e);
    expect((err as SosServiceError).status).toBe(409);
  });

  it("hasGeolocation refleja la presencia de la API", async () => {
    // happy-dom incluye geolocation: true por defecto.
    expect(hasGeolocation()).toBe(true);
    // Sin geolocation (WebView antiguo): false.
    vi.stubGlobal("navigator", {} as unknown as Navigator);
    expect(hasGeolocation()).toBe(false);
  });
});
