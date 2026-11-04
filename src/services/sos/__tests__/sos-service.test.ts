import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SosServiceError,
  activateSosAlert,
  cancelSosAlert,
  fetchActiveSosAlert,
  getCoordinatesBestEffort,
  getEmergencyLocation,
  hasGeolocation,
} from "../sos-service";

const nativeLocation = vi.hoisted(() => ({
  native: false,
  check: vi.fn(),
  request: vi.fn(),
  position: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: {
  isNativePlatform: () => nativeLocation.native,
  getPlatform: () => nativeLocation.native ? "android" : "web",
} }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: {
  checkPermissions: nativeLocation.check,
  requestPermissions: nativeLocation.request,
  getCurrentPosition: nativeLocation.position,
} }));

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
    nativeLocation.native = false;
  });

  it("sin geolocalización (web sin permiso/happy-dom) devuelve null", async () => {
    const coords = await getCoordinatesBestEffort();
    expect(coords).toBeNull();
  });

  it("descarta coordenadas fuera de rango", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: (p: { coords: unknown; timestamp?: number }) => void) =>
          success({ coords: { latitude: 120.5, longitude: -80 } }),
      },
    } as unknown as Navigator);
    expect(await getCoordinatesBestEffort()).toBeNull();
  });

  it("devuelve coordenadas válidas dentro del rango", async () => {
    const timestamp = Date.now();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: (p: { coords: unknown; timestamp?: number }) => void) =>
          success({ coords: { latitude: -90, longitude: 180 }, timestamp }),
      },
    } as unknown as Navigator);
    expect(await getCoordinatesBestEffort()).toEqual({
      latitude: -90,
      longitude: 180,
      locationCapturedAt: new Date(timestamp).toISOString(),
    });
  });

  it("descarta un fix antiguo o coordenadas NaN", async () => {
    for (const coords of [{ latitude: 4.7, longitude: -74 }, { latitude: NaN, longitude: -74 }]) {
      vi.stubGlobal("navigator", { geolocation: {
        getCurrentPosition: (success: (value: unknown) => void) => success({ coords, timestamp: Date.now() - 60_000 }),
      } });
      expect(await getCoordinatesBestEffort()).toBeNull();
    }
  });

  it("en Android usa permisos y GPS nativos, conservando precisión y fecha", async () => {
    nativeLocation.native = true;
    const timestamp = Date.now();
    nativeLocation.check.mockResolvedValue({ location: "prompt", coarseLocation: "prompt" });
    nativeLocation.request.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    nativeLocation.position.mockResolvedValue({ timestamp, coords: { latitude: 4.711, longitude: -74.072, accuracy: 25 } });
    expect(await getEmergencyLocation()).toEqual({
      status: "located", country: "CO", coordinates: {
        latitude: 4.711, longitude: -74.072, accuracyMeters: 25,
        locationCapturedAt: new Date(timestamp).toISOString(),
      },
    });
    expect(nativeLocation.request).toHaveBeenCalledWith({ permissions: ["location"] });
  });

  it("un fix fuera de CO/US queda disponible para el contacto, sin inventar país", async () => {
    nativeLocation.native = true;
    nativeLocation.check.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    nativeLocation.position.mockResolvedValue({ timestamp: Date.now(), coords: { latitude: 43.6532, longitude: -79.3832, accuracy: 10 } });
    const result = await getEmergencyLocation();
    expect(result.country).toBeNull();
    expect(result.status).toBe("unsupported");
    expect(result.coordinates?.latitude).toBe(43.6532);
  });

  it("permiso denegado no inventa coordenadas ni país", async () => {
    nativeLocation.native = true;
    nativeLocation.check.mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    nativeLocation.request.mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    expect(await getEmergencyLocation()).toEqual({ country: null, coordinates: null, status: "unavailable" });
  });

  it("la ubicación aproximada autorizada en Android también sirve para el país", async () => {
    nativeLocation.native = true;
    nativeLocation.check.mockResolvedValue({ location: "denied", coarseLocation: "granted" });
    nativeLocation.request.mockClear();
    nativeLocation.position.mockResolvedValue({ timestamp: Date.now(), coords: { latitude: 4.711, longitude: -74.072, accuracy: 2000 } });
    expect((await getEmergencyLocation()).country).toBe("CO");
    expect(nativeLocation.request).not.toHaveBeenCalled();
  });

  it("una precisión fuera del contrato del backend no impide el SOS con un payload inválido", async () => {
    nativeLocation.native = true;
    nativeLocation.check.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    nativeLocation.position.mockResolvedValue({ timestamp: Date.now(), coords: { latitude: 4.711, longitude: -74.072, accuracy: 100_001 } });
    expect(await getCoordinatesBestEffort()).toBeNull();
  });

  it("las lecturas paralelas comparten GPS y la activación no espera más de 2,5 s", async () => {
    vi.useFakeTimers();
    const read = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read } });
    try {
      const activation = getCoordinatesBestEffort();
      const country = getEmergencyLocation();
      expect(read).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(2500);
      expect(await activation).toBeNull();
      await vi.advanceTimersByTimeAsync(6000);
      expect(await country).toEqual({ country: null, coordinates: null, status: "unavailable" });
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("un permiso resuelto después del plazo no inicia una captura tardía", async () => {
    vi.useFakeTimers();
    nativeLocation.native = true;
    let grant!: (value: { location: string; coarseLocation: string }) => void;
    nativeLocation.check.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
    nativeLocation.position.mockClear();
    try {
      const pending = getEmergencyLocation();
      await vi.advanceTimersByTimeAsync(8500);
      expect((await pending).status).toBe("unavailable");
      grant({ location: "granted", coarseLocation: "granted" });
      await Promise.resolve();
      expect(nativeLocation.position).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
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

  it("conserva precisión/fecha y normaliza la ubicación plana del backend", async () => {
    const locationCapturedAt = new Date().toISOString();
    let body: Record<string, unknown> = {};
    mockFetch((_url, options) => {
      body = JSON.parse(String(options?.body));
      return jsonRes(201, { id: "a-geo", status: "Activa", createdAt: "", latitude: 4.6, longitude: -74.1, emailChannelStatus: "Pendiente" });
    });
    const alert = await activateSosAlert({ latitude: 4.6, longitude: -74.1, accuracyMeters: 18, locationCapturedAt });
    expect(body).toEqual({ latitude: 4.6, longitude: -74.1, accuracyMeters: 18, locationCapturedAt });
    expect(alert.location).toEqual({ latitude: 4.6, longitude: -74.1 });
    expect(alert.emailChannelStatus).toBe("Pendiente");
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

  it("204 = sin alerta activa, sin intentar leer un cuerpo JSON vacío", async () => {
    const readJson = vi.fn().mockRejectedValue(new Error("empty body"));
    globalThis.fetch = vi.fn().mockResolvedValue({ ...jsonRes(204, null), json: readJson });
    expect(await fetchActiveSosAlert()).toBeNull();
    expect(readJson).not.toHaveBeenCalled();
  });

  it("GET normaliza coordenadas planas y rechaza ubicaciones incompletas", async () => {
    mockFetch(() => jsonRes(200, { id: "a-flat", status: "Activa", createdAt: "", latitude: 4.7, longitude: -74.1 }));
    expect((await fetchActiveSosAlert())?.location).toEqual({ latitude: 4.7, longitude: -74.1 });
    mockFetch(() => jsonRes(200, { id: "a-bad", status: "Activa", createdAt: "", latitude: 4.7, longitude: null }));
    expect((await fetchActiveSosAlert())?.location).toBeNull();
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
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: vi.fn() } });
    expect(hasGeolocation()).toBe(true);
    // Sin geolocation (WebView antiguo): false.
    vi.stubGlobal("navigator", {} as unknown as Navigator);
    expect(hasGeolocation()).toBe(false);
  });
});
