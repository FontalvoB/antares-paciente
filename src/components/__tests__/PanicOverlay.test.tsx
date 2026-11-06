import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanicOverlay } from "../PanicOverlay";
import type { HealthSample, MetricKind } from "../../devices/types";

/**
 * Tests de REQ-SOS-07 (change sos-panic-real):
 * 1) la inactividad (>5 s) NUNCA activa SOS (sin temporizador de auto-disparo);
 * 2) la activación exige doble confirmación deliberada (orbe → confirmar);
 * 3) el flujo es SIEMPRE real: despacha al backend y refleja el ciclo;
 * 4) BUG-01: el copy afirma SOLO lo que el estado real de la alerta respalda
 *    (smsChannelStatus de POST /alerts y GET /active; location).
 */

// La lógica SOS se prueba sin hidratar Shadow DOM ni hojas CSS de Stencil.
// El navegador real verifica aparte el layout de los controles Ionic.
vi.mock("@ionic/react", async () => {
  const React = await import("react");
  const element = (tag: string) => function IonicTestElement(props: Record<string, unknown>) {
    const { children, icon: _icon, expand: _expand, fill: _fill, lines: _lines, ...rest } = props;
    return React.createElement(tag, rest, children as React.ReactNode);
  };
  return { IonActionSheet: () => null, IonButton: element("button"), IonIcon: element("span"), IonBadge: element("span"), IonList: element("div"), IonItem: element("div"), IonLabel: element("div") };
});

// Mock del servicio SOS: captura las llamadas de red.
const sosMock = vi.hoisted(() => ({
  activate: vi.fn(),
  fetchActive: vi.fn(),
  cancel: vi.fn(),
  coords: vi.fn(),
  locate: vi.fn(),
}));

vi.mock("../../services/sos/sos-service", () => ({
  activateSosAlert: sosMock.activate,
  fetchActiveSosAlert: sosMock.fetchActive,
  cancelSosAlert: sosMock.cancel,
  getCoordinatesBestEffort: sosMock.coords,
  getEmergencyLocation: sosMock.locate,
  hasGeolocation: () => false,
  SosServiceError: class SosServiceError extends Error {
    status: number;
    retryAfterSeconds?: number;
    constructor(
      status: number,
      message: string,
      options?: { retryAfterSeconds?: number },
    ) {
      super(message);
      this.name = "SosServiceError";
      this.status = status;
      this.retryAfterSeconds = options?.retryAfterSeconds;
    }
  },
}));

// Marcador nativo: se verifica la intención de llamada sin navegar en jsdom.
const dialMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("../../utils/nativeDialer", () => ({
  openNativeDialer: dialMock,
}));

// El directorio local se verifica en el E2E; este fixture no accede a archivos por HTTP.
vi.mock("../../utils/emergencyCityRouting", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../utils/emergencyCityRouting")>(),
  loadEmergencyCityDirectory: async () => null,
}));

const context = vi.hoisted(() => ({
  panicOpen: true,
  sosActive: false,
  activateSos: vi.fn(),
  closePanic: vi.fn(),
  showToast: vi.fn(),
  user: {
    fam1Nombre: "Contacto de prueba",
    fam1Parentesco: "Familiar",
    fam1Cel: "+573001234567",
  },
}));

const wearableMock = vi.hoisted(() => ({
  phase: "idle",
  sessionStale: false,
  info: {} as { wearing?: boolean },
  samples: {} as Partial<Record<MetricKind, HealthSample>>,
}));
vi.mock("../../context/WearableContext", () => ({ useWearable: () => wearableMock }));
vi.mock("../../context/AppContext", () => ({ useApp: () => context }));
vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string, params?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? name),
}));

// framer-motion mockeado: AnimatePresence/motion en happy-dom genera
// AbortError no manejados al cancelar animaciones WAAPI (ruido que marca el
// run como fallido aunque los tests pasen). El objetivo aquí es la lógica
// SOS/REQ-SOS-07/BUG-01, no la animación.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const strip = (props: Record<string, unknown>) => {
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileTap: _whileTap,
      whileHover: _whileHover,
      variants: _variants,
      ...rest
    } = props;
    return rest;
  };
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        function MotionComponent(props: Record<string, unknown>) {
          return React.createElement(tag, strip(props));
        },
    },
  );
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    MotionConfig: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: motionProxy,
    useReducedMotion: () => false,
  };
});

// Útil tras cada click: Ionic resuelve en microtareas.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  context.panicOpen = true;
  context.sosActive = false;
  context.activateSos.mockClear();
  context.closePanic.mockClear();
  context.showToast.mockClear();
  dialMock.mockClear();
  dialMock.mockReturnValue(true);
  sosMock.locate.mockReset().mockResolvedValue({ country: "CO", coordinates: { latitude: 4.6, longitude: -74.1 }, status: "located" });
  wearableMock.phase = "idle";
  wearableMock.sessionStale = false;
  wearableMock.info = {};
  wearableMock.samples = {};
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SOS — REQ-SOS-07: sin auto-activación y doble confirmación", () => {
  beforeEach(() => {
    sosMock.activate.mockReset().mockResolvedValue({
      id: "a-1",
      status: "Activa",
      createdAt: "",
    });
    sosMock.fetchActive.mockReset();
    sosMock.cancel.mockReset();
    sosMock.coords.mockReset().mockResolvedValue(null);
  });

  it("inactividad de más de 5 segundos NO activa SOS ni llama a la red", () => {
    vi.useFakeTimers();
    render(<PanicOverlay />);
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(context.activateSos).not.toHaveBeenCalled();
    expect(sosMock.activate).not.toHaveBeenCalled();
  });

  it("primer paso: tocar el orbe abre la confirmación, sin activar todavía", async () => {
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    expect(
      await screen.findByText("¿Activar tu alerta SOS real?"),
    ).toBeTruthy();
    expect(context.activateSos).not.toHaveBeenCalled();
  });

  it("segundo paso afirmativo activa SOS real una sola vez", async () => {
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    // Flujo exclusivamente real: siempre despacha al backend.
    expect(sosMock.activate).toHaveBeenCalledTimes(1);
    expect(context.activateSos).toHaveBeenCalledTimes(1);
  });

  it('"No, volver" regresa al protocolo sin activar nada', async () => {
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("No, volver"));
    await flush();
    expect(context.activateSos).not.toHaveBeenCalled();
    await screen.findByText("Estamos para ayudarte");
  });

  it("cada servicio en Colombia abre el 123 sin activar el SOS al contacto", async () => {
    render(<PanicOverlay />);
    for (const service of ["Ambulancia", "Policía", "Bomberos"]) {
      fireEvent.click(await screen.findByLabelText(`Llamar: ${service} · 123`));
    }
    expect(dialMock.mock.calls).toEqual([["123"], ["123"], ["123"]]);
    expect(context.activateSos).not.toHaveBeenCalled();
    expect(sosMock.activate).not.toHaveBeenCalled();
  });

  it("la ubicación de EE. UU. usa 911 aunque el teléfono conserve zona de Colombia", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ timeZone: "America/Bogota" } as Intl.ResolvedDateTimeFormatOptions);
    sosMock.locate.mockResolvedValue({ country: "US", coordinates: { latitude: 25.76, longitude: -80.19 }, status: "located" });
    render(<PanicOverlay />);
    for (const service of ["Ambulancia", "Policía", "Bomberos"]) {
      fireEvent.click(await screen.findByLabelText(`Llamar: ${service} · 911`));
    }
    expect(dialMock.mock.calls).toEqual([["911"], ["911"], ["911"]]);
    expect(context.activateSos).not.toHaveBeenCalled();
  });

  it("sin GPS exige confirmar país y conserva cada servicio visible", async () => {
    sosMock.locate.mockResolvedValue({ country: null, coordinates: null, status: "unavailable" });
    render(<PanicOverlay />);
    await screen.findByText("No pudimos obtener tu ubicación. Confirma el país para llamar.");
    for (const service of ["Ambulancia", "Policía", "Bomberos"]) {
      const button = screen.getByLabelText(`Confirma el país para llamar: ${service}`);
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect(dialMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Estados Unidos"));
    fireEvent.click(screen.getByLabelText("Llamar: Policía · 911"));
    expect(dialMock).toHaveBeenCalledExactlyOnceWith("911");
    expect(screen.getByText("País confirmado por ti: Estados Unidos")).toBeTruthy();
  });

  it("una ubicación tardía no cambia el país que confirmó el usuario", async () => {
    let finish!: (result: { country: string; coordinates: null; status: string }) => void;
    sosMock.locate.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<PanicOverlay />);
    fireEvent.click(screen.getByText("Estados Unidos"));
    await act(async () => { finish({ country: "CO", coordinates: null, status: "located" }); });
    fireEvent.click(screen.getByLabelText("Llamar: Bomberos · 911"));
    expect(dialMock).toHaveBeenCalledExactlyOnceWith("911");
    expect(screen.getByText("País confirmado por ti: Estados Unidos")).toBeTruthy();
  });

  it("renueva el país GPS mientras la pantalla sigue abierta", async () => {
    vi.useFakeTimers();
    render(<PanicOverlay />);
    await flush();
    expect(screen.getByLabelText("Llamar: Ambulancia · 123")).toBeTruthy();
    sosMock.locate.mockResolvedValue({ country: "US", coordinates: { latitude: 25.76, longitude: -80.19 }, status: "located" });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByLabelText("Llamar: Ambulancia · 911")).toBeTruthy();
    expect(sosMock.locate).toHaveBeenCalledTimes(2);
  });

  it("la confirmación manual sigue disponible sin esperar otra consulta GPS", async () => {
    vi.useFakeTimers();
    render(<PanicOverlay />);
    await flush();
    fireEvent.click(screen.getByText("Estados Unidos"));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByLabelText("Llamar: Ambulancia · 911")).toBeTruthy();
    expect(sosMock.locate).toHaveBeenCalledTimes(1);
  });

  it("una ubicación fuera de los países admitidos no inventa un destino 911", async () => {
    sosMock.locate.mockResolvedValue({ country: null, coordinates: { latitude: 19.4, longitude: -99.1 }, status: "unsupported" });
    render(<PanicOverlay />);
    await screen.findByText("Ubicación fuera de cobertura o cerca de una frontera. Confirma el país.");
    expect(screen.queryByLabelText("Llamar: Ambulancia · 911")).toBeNull();
    expect(screen.queryByLabelText("Llamar: Ambulancia · 123")).toBeNull();
    expect(dialMock).not.toHaveBeenCalled();
  });

  it("la llamada al familiar abre el marcador nativo sin activar SOS", () => {
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Llamar familiar"));
    expect(dialMock).toHaveBeenCalledWith("+573001234567");
    expect(context.activateSos).not.toHaveBeenCalled();
  });

  it("sin teléfono del contacto avisa y no abre el marcador", () => {
    dialMock.mockReturnValueOnce(false);
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Llamar familiar"));
    expect(context.showToast).toHaveBeenCalledWith(
      "No hay un contacto de emergencia con teléfono configurado.",
      "err",
    );
  });
});

describe("SOS real — despacho y ciclo de vida", () => {
  beforeEach(() => {
    sosMock.activate.mockReset();
    sosMock.fetchActive.mockReset();
    sosMock.cancel.mockReset();
    sosMock.coords
      .mockReset()
      .mockResolvedValue({ latitude: 4.6, longitude: -74.1 });
  });

  it("despacha POST /api/v1/sos/alerts con GPS best-effort y activa el estado local", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-1",
      status: "Activa",
      createdAt: "",
    });
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    expect(sosMock.activate).toHaveBeenCalledWith(
      {
        latitude: 4.6,
        longitude: -74.1,
      },
      null,
    );
    expect(context.activateSos).toHaveBeenCalledTimes(1);
  });

  it("GPS best-effort: sin coordenadas la alerta se envía igual", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-1",
      status: "Activa",
      createdAt: "",
    });
    sosMock.coords.mockResolvedValue(null);
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    expect(sosMock.activate).toHaveBeenCalledWith(null, null);
    expect(context.activateSos).toHaveBeenCalledTimes(1);
  });

  it("comparte solo los signos vitales reales y recientes del wearable conectado", async () => {
    sosMock.activate.mockResolvedValue({ id: "real-vitals", status: "Activa", createdAt: "" });
    wearableMock.phase = "connected";
    const sample = (metric: MetricKind, value: number, extra: Partial<HealthSample> = {}): HealthSample => ({ metric, value, ts: Date.now(), unit: "", deviceId: "ring-1", source: "live", ...extra });
    wearableMock.samples = {
      heart_rate: sample("heart_rate", 72),
      spo2: sample("spo2", 98),
      blood_pressure: sample("blood_pressure", 118, { value2: 76 }),
    };
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    expect(sosMock.activate).toHaveBeenCalledWith(
      { latitude: 4.6, longitude: -74.1 },
      { heartRate: 72, spo2: 98, bloodPressure: "118/76" },
    );
  });

  it.each([
    ["pulso menor de 20", "heart_rate", 19, "heartRate"],
    ["pulso mayor de 300", "heart_rate", 301, "heartRate"],
    ["saturación menor de 50", "spo2", 49, "spo2"],
    ["saturación mayor de 100", "spo2", 101, "spo2"],
    ["presión demasiado larga", "blood_pressure", 1e20, "bloodPressure"],
  ] as const)("omite %s sin bloquear la alerta ni las demás lecturas válidas", async (_description, metric, value, omitted) => {
    sosMock.activate.mockResolvedValue({ id: "valid-vitals", status: "Activa", createdAt: "" });
    wearableMock.phase = "connected";
    const sample = (metric: MetricKind, value: number, extra: Partial<HealthSample> = {}): HealthSample => ({ metric, value, ts: Date.now(), unit: "", deviceId: "ring-1", source: "live", ...extra });
    wearableMock.samples = {
      heart_rate: sample("heart_rate", 72),
      spo2: sample("spo2", 98),
      blood_pressure: sample("blood_pressure", 118, { value2: 76 }),
    };
    wearableMock.samples[metric] = sample(metric, value, { value2: 76 });
    const expected: Record<string, number | string> = { heartRate: 72, spo2: 98, bloodPressure: "118/76" };
    delete expected[omitted];
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    expect(sosMock.activate).toHaveBeenCalledWith({ latitude: 4.6, longitude: -74.1 }, expected);
    expect(context.activateSos).toHaveBeenCalledTimes(1);
  });

  it("no envía como actuales lecturas viejas, históricas ni de diagnóstico", async () => {
    sosMock.activate.mockResolvedValue({ id: "no-vitals", status: "Activa", createdAt: "" });
    wearableMock.phase = "connected";
    const sample = (metric: MetricKind, value: number, extra: Partial<HealthSample> = {}): HealthSample => ({ metric, value, ts: Date.now(), unit: "", deviceId: "ring-1", source: "live", ...extra });
    wearableMock.samples = {
      heart_rate: sample("heart_rate", 72, { ts: Date.now() - 6 * 60_000 }),
      spo2: sample("spo2", 98, { source: "history" }),
      blood_pressure: sample("blood_pressure", 118, { value2: 76, deviceId: "debug" }),
    };
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    expect(sosMock.activate).toHaveBeenCalledWith({ latitude: 4.6, longitude: -74.1 }, null);
  });

  it("un wearable sin contacto confirmado no aporta signos vitales al SOS", async () => {
    sosMock.activate.mockResolvedValue({ id: "not-worn", status: "Activa", createdAt: "" });
    wearableMock.phase = "connected";
    wearableMock.info = { wearing: false };
    wearableMock.samples = { heart_rate: { metric: "heart_rate", value: 72, ts: Date.now(), unit: "bpm", deviceId: "ring-1" } };
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    expect(sosMock.activate).toHaveBeenCalledWith({ latitude: 4.6, longitude: -74.1 }, null);
  });

  it("429 con Retry-After: no activa y bloquea el orbe con cuenta regresiva", async () => {
    const { SosServiceError } = await import("../../services/sos/sos-service");
    sosMock.activate.mockRejectedValue(
      new SosServiceError(
        429,
        "Demasiadas alertas en poco tiempo. Espera unos segundos.",
        { retryAfterSeconds: 45 },
      ),
    );
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    expect(context.activateSos).not.toHaveBeenCalled();
    // El orbe queda bloqueado con la cuenta regresiva del Retry-After.
    expect(
      screen.getByLabelText("Espera 45 segundos para activar"),
    ).toBeTruthy();
  });

  it("sondeo 15 s: una alerta ya no activa saca al paciente de la vista", async () => {
    vi.useFakeTimers();
    sosMock.fetchActive.mockResolvedValue(null);
    context.sosActive = true;
    render(<PanicOverlay />);
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    await flush();
    expect(sosMock.fetchActive).toHaveBeenCalled();
    expect(context.closePanic).toHaveBeenCalled();
    expect(context.showToast).toHaveBeenCalledWith(
      "Tu alerta SOS ya fue atendida.",
      "ok",
    );
  });

  it('"Estoy bien" cancela la alerta real del paciente', async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-1",
      status: "Activa",
      createdAt: "",
    });
    const { rerender } = render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    expect(sosMock.activate).toHaveBeenCalled();
    context.sosActive = true;
    rerender(<PanicOverlay />);
    // El label "Estoy bien" vive en el botón del header y en el dock:
    // ambos invocan imOk (cancelar + cerrar).
    fireEvent.click(screen.getAllByLabelText("Estoy bien")[0]!);
    await flush();
    expect(sosMock.cancel).toHaveBeenCalledWith("a-1");
    expect(context.closePanic).toHaveBeenCalled();
  });
});

describe("BUG-01 — copy honesto según el estado real de la alerta", () => {
  beforeEach(() => {
    sosMock.activate.mockReset();
    sosMock.fetchActive.mockReset();
    sosMock.cancel.mockReset();
    sosMock.coords
      .mockReset()
      .mockResolvedValue({ latitude: 4.6, longitude: -74.1 });
  });

  const activate = async () => {
    const { rerender } = render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    // El copy activo depende de sosActive (estado local del overlay).
    context.sosActive = true;
    rerender(<PanicOverlay />);
    await flush();
  };

  it("canal NoConfigurado + location null: degradación clara, sin afirmar entrega ni GPS", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-1",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "NoConfigurado",
      location: null,
    });
    // El sondeo devuelve la misma alerta (estado vivo del canal).
    sosMock.fetchActive.mockResolvedValue({
      id: "a-1",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "NoConfigurado",
      location: null,
    });

    await activate();

    // Mensaje principal honesto de degradación (SMS y voz sin confirmar).
    expect(
      screen.getByText(
        "Alerta registrada para tu equipo clínico. Canal de contacto no disponible en este momento. Sin ubicación en esta alerta.",
      ),
    ).toBeTruthy();
    const copy = document.querySelector(".sos-copy p");
    expect(copy?.textContent).not.toContain("GPS");
    expect(copy?.textContent).not.toContain("signos vitales");
    expect(copy?.textContent).not.toContain("Ambulancia");
    // Fila familiar: canal degradado, sin afirmar entrega por llamada ni SMS.
    expect(
      screen.getByText("Canal de contacto no disponible en este momento"),
    ).toBeTruthy();
    expect(screen.queryByText("Alerta enviada · +573001234567")).toBeNull();
    expect(screen.queryByText("SMS enviado · +573001234567")).toBeNull();
    expect(screen.queryByText("Llamada realizada · +573001234567")).toBeNull();
  });

  it("canal Enviado + location: sí afirma SMS al contacto y ubicación compartida", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-2",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      location: { latitude: 4.6, longitude: -74.1 },
    });
    sosMock.fetchActive.mockResolvedValue({
      id: "a-2",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      location: { latitude: 4.6, longitude: -74.1 },
    });

    await activate();

    // El <p> compone copia de canal + copia de ubicación (mismo elemento).
    const copy = document.querySelector(".sos-copy p");
    expect(copy?.textContent).toBe(
      "SMS enviado a tu contacto de emergencia. Tu ubicación fue compartida con tu equipo.",
    );
    expect(screen.getByText("SMS enviado · +573001234567")).toBeTruthy();
    expect(
      screen.getByText("Tu ubicación fue compartida con tu equipo."),
    ).toBeTruthy();
  });

  it("tarjeta de entrega: confirma llamada y SMS enviados", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-4",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      pushChannelStatus: "NoConfigurado",
      location: null,
    });
    sosMock.fetchActive.mockResolvedValue({
      id: "a-4",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      pushChannelStatus: "NoConfigurado",
      location: null,
    });

    await activate();

    // Estado de entrega por canal: la UI refleja lo que el backend reporta.
    expect(screen.getByText("ESTADO DE LA ENTREGA")).toBeTruthy();
    expect(screen.getByText("Llamada al contacto")).toBeTruthy();
    expect(screen.getByText("SMS al contacto")).toBeTruthy();
    expect(screen.getByText("Realizada")).toBeTruthy();
    expect(screen.getByText("Enviado")).toBeTruthy();
    expect(screen.getByText("No disponible")).toBeTruthy();
  });

  it("tarjeta de entrega: correo Enviado muestra la fila de correo", async () => {
    const outcome = {
      id: "a-4b",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      emailChannelStatus: "Enviado",
      pushChannelStatus: "NoConfigurado",
      location: null,
    };
    sosMock.activate.mockResolvedValue(outcome);
    sosMock.fetchActive.mockResolvedValue(outcome);

    await activate();

    const emailRow = screen.getByText("Correo al contacto").closest("li");
    expect(emailRow?.textContent).toContain("Enviado");
    expect(emailRow?.className).toContain("ok");
  });

  it("tarjeta de entrega: sin correo registrado el canal queda neutro, sin envío", async () => {
    const outcome = {
      id: "a-4c",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      emailChannelStatus: "SinDestino",
      pushChannelStatus: "NoConfigurado",
      location: null,
    };
    sosMock.activate.mockResolvedValue(outcome);
    sosMock.fetchActive.mockResolvedValue(outcome);

    await activate();

    // Sin correo el backend no envía nada y la fila NO se pinta como fallo.
    const emailRow = screen.getByText("Correo al contacto").closest("li");
    expect(emailRow?.textContent).toContain("Sin correo registrado");
    expect(emailRow?.className).toContain("pending");
    expect(emailRow?.className).not.toContain("bad");
  });

  it("tarjeta de entrega: backend sin campo de correo muestra Sin datos, no Pendiente", async () => {
    const outcome = {
      id: "a-4d",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      pushChannelStatus: "NoConfigurado",
      location: null,
    };
    sosMock.activate.mockResolvedValue(outcome);
    sosMock.fetchActive.mockResolvedValue(outcome);

    await activate();

    // DTO viejo (sin emailChannelStatus): la app no puede afirmar "Pendiente".
    const emailRow = screen.getByText("Correo al contacto").closest("li");
    expect(emailRow?.textContent).toContain("Sin datos");
    expect(emailRow?.className).toContain("pending");
    expect(emailRow?.className).not.toContain("bad");
  });

  it("tarjeta de entrega: muestra llamada contestada y SMS entregado", async () => {
    const outcome = {
      id: "a-5",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      smsDeliveryStatus: "delivered",
      voiceCallStatus: "completed",
      voiceAnsweredBy: "human",
      voiceDurationSeconds: 12,
      pushChannelStatus: "NoConfigurado",
      location: null,
    };
    sosMock.activate.mockResolvedValue(outcome);
    sosMock.fetchActive.mockResolvedValue(outcome);

    await activate();

    // Phase 2: el callback de Twilio reporta el resultado real del canal.
    expect(screen.getByText("Contestada · 0:12")).toBeTruthy();
    expect(screen.getByText("Entregado")).toBeTruthy();
  });

  it("tarjeta de entrega: muestra buzón de voz cuando contestó una máquina", async () => {
    const outcome = {
      id: "a-6",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      smsDeliveryStatus: "delivered",
      voiceCallStatus: "completed",
      voiceAnsweredBy: "machine_start",
      voiceDurationSeconds: 20,
      pushChannelStatus: "NoConfigurado",
      location: null,
    };
    sosMock.activate.mockResolvedValue(outcome);
    sosMock.fetchActive.mockResolvedValue(outcome);

    await activate();

    expect(screen.getByText("Buzón de voz")).toBeTruthy();
    expect(screen.getByText("Entregado")).toBeTruthy();
  });

  it("tarjeta de entrega: sin resultado final muestra realizada (sin espera)", async () => {
    const outcome = {
      id: "a-7",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      voiceCallStatus: "in-progress",
      pushChannelStatus: "NoConfigurado",
      location: null,
    };
    sosMock.activate.mockResolvedValue(outcome);
    sosMock.fetchActive.mockResolvedValue(outcome);

    await activate();

    expect(screen.getByText("Realizada")).toBeTruthy();
  });

  it("409 alerta activa: adopta la alerta existente en vez de fallar", async () => {
    const { SosServiceError } = await import("../../services/sos/sos-service");
    sosMock.activate.mockRejectedValue(
      new SosServiceError(409, "Ya tienes una alerta SOS activa."),
    );
    const active = {
      id: "a-8",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      voiceCallStatus: "in-progress",
      pushChannelStatus: "NoConfigurado",
      location: null,
    };
    sosMock.fetchActive.mockResolvedValue(active);

    const { rerender } = render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    // Adopta la alerta existente: el overlay queda activo con sus estados.
    context.sosActive = true;
    rerender(<PanicOverlay />);
    await flush();

    expect(context.activateSos).toHaveBeenCalledTimes(1);
    expect(context.showToast).toHaveBeenCalledWith(
      "Ya tenías una alerta SOS activa. Mostrándola; pulsa Estoy bien para cancelarla.",
      "ok",
    );
    expect(screen.getByText("Realizada")).toBeTruthy();
  });

  it("409 alerta activa: adopta la alerta existente en vez de fallar", async () => {
    const { SosServiceError } = await import("../../services/sos/sos-service");
    sosMock.activate.mockRejectedValue(
      new SosServiceError(409, "Ya tienes una alerta SOS activa."),
    );
    sosMock.fetchActive.mockResolvedValue({
      id: "a-9",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      smsDeliveryStatus: "delivered",
      voiceCallStatus: "completed",
      voiceAnsweredBy: "human",
      voiceDurationSeconds: 12,
      pushChannelStatus: "NoConfigurado",
      location: null,
    });

    const { rerender } = render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    await flush();
    await flush();

    // Adopta la alerta existente: activa el estado local y avisa sin error.
    expect(context.activateSos).toHaveBeenCalledTimes(1);
    expect(context.showToast).toHaveBeenCalledWith(
      "Ya tenías una alerta SOS activa. Mostrándola; pulsa Estoy bien para cancelarla.",
      "ok",
    );
    context.sosActive = true;
    rerender(<PanicOverlay />);
    await flush();
    expect(screen.getByText("Contestada · 0:12")).toBeTruthy();
  });

  it("canal Fallido: mensaje de degradación idéntico al NoConfigurado", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-3",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Fallido",
      location: null,
    });
    sosMock.fetchActive.mockResolvedValue({
      id: "a-3",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Fallido",
      location: null,
    });

    await activate();

    expect(
      screen.getByText(
        "Alerta registrada para tu equipo clínico. Canal de contacto no disponible en este momento. Sin ubicación en esta alerta.",
      ),
    ).toBeTruthy();
  });

  it("voz Enviado + SMS Enviado: afirma llamada y SMS al contacto", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-4",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      location: null,
    });
    sosMock.fetchActive.mockResolvedValue({
      id: "a-4",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Enviado",
      voiceChannelStatus: "Enviado",
      location: null,
    });

    await activate();

    const copy = document.querySelector(".sos-copy p");
    expect(copy?.textContent).toBe(
      "Llamada y SMS enviados a tu contacto de emergencia. Sin ubicación en esta alerta.",
    );
    expect(screen.getByText("Llamada y SMS enviados · +573001234567")).toBeTruthy();
  });

  it("solo voz Enviado (SMS degradado): afirma la llamada sin afirmar SMS", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-5",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "NoConfigurado",
      voiceChannelStatus: "Enviado",
      location: null,
    });
    sosMock.fetchActive.mockResolvedValue({
      id: "a-5",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "NoConfigurado",
      voiceChannelStatus: "Enviado",
      location: null,
    });

    await activate();

    const copy = document.querySelector(".sos-copy p");
    expect(copy?.textContent).toBe(
      "Llamada realizada a tu contacto de emergencia. Sin ubicación en esta alerta.",
    );
    expect(screen.getByText("Llamada realizada · +573001234567")).toBeTruthy();
    expect(screen.queryByText("SMS enviado · +573001234567")).toBeNull();
  });

  it("voz Fallida sin SMS enviado: degradación sin afirmar llamada", async () => {
    sosMock.activate.mockResolvedValue({
      id: "a-6",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Pendiente",
      voiceChannelStatus: "Fallido",
      location: null,
    });
    sosMock.fetchActive.mockResolvedValue({
      id: "a-6",
      status: "Activa",
      createdAt: "",
      smsChannelStatus: "Pendiente",
      voiceChannelStatus: "Fallido",
      location: null,
    });

    await activate();

    expect(
      screen.getByText(
        "Alerta registrada para tu equipo clínico. Canal de contacto no disponible en este momento. Sin ubicación en esta alerta.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Llamada realizada · +573001234567")).toBeNull();
  });
});
