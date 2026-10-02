import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanicOverlay } from "../PanicOverlay";

/**
 * Tests de REQ-SOS-07 (change sos-panic-real):
 * 1) la inactividad (>5 s) NUNCA activa SOS (sin temporizador de auto-disparo);
 * 2) la activación exige doble confirmación deliberada (orbe → confirmar);
 * 3) la rama real (VITE_SOS_ENABLED) despacha al backend y refleja el ciclo;
 * 4) BUG-01: el copy afirma SOLO lo que el estado real de la alerta respalda
 *    (smsChannelStatus de POST /alerts y GET /active; location).
 */

// Mock del servicio SOS: controla el flag y captura las llamadas de red.
const sosMock = vi.hoisted(() => ({
  enabled: false,
  activate: vi.fn(),
  fetchActive: vi.fn(),
  cancel: vi.fn(),
  coords: vi.fn(),
}));

vi.mock("../../services/sos/sos-service", () => ({
  isSosRealEnabled: () => sosMock.enabled,
  activateSosAlert: sosMock.activate,
  fetchActiveSosAlert: sosMock.fetchActive,
  cancelSosAlert: sosMock.cancel,
  getCoordinatesBestEffort: sosMock.coords,
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

const context = vi.hoisted(() => ({
  panicOpen: true,
  sosActive: false,
  activateSos: vi.fn(),
  closePanic: vi.fn(),
  showToast: vi.fn(),
  user: {
    fam1Nombre: "Contacto de prueba",
    fam1Parentesco: "Familiar",
    fam1Cel: "000",
  },
}));

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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SOS — REQ-SOS-07: sin auto-activación y doble confirmación", () => {
  beforeEach(() => {
    sosMock.enabled = false;
    sosMock.activate.mockReset();
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

  it("segundo paso afirmativo activa SOS una sola vez (modo local)", async () => {
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Activar SOS ahora"));
    await screen.findByText("¿Activar tu alerta SOS real?");
    fireEvent.click(screen.getByLabelText("Sí, activar mi SOS"));
    await flush();
    expect(context.activateSos).toHaveBeenCalledTimes(1);
    // Modo local (flag off): no hay llamada al backend.
    expect(sosMock.activate).not.toHaveBeenCalled();
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

  it("las llamadas 911/familiar ya no activan SOS implícitamente", () => {
    render(<PanicOverlay />);
    fireEvent.click(screen.getByLabelText("Llamar 911"));
    expect(context.activateSos).not.toHaveBeenCalled();
  });
});

describe("SOS real (flag VITE_SOS_ENABLED) — despacho y ciclo de vida", () => {
  beforeEach(() => {
    sosMock.enabled = true;
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
      { heartRate: 140, spo2: 94, bloodPressure: "160/110" },
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
    expect(sosMock.activate).toHaveBeenCalledWith(null, {
      heartRate: 140,
      spo2: 94,
      bloodPressure: "160/110",
    });
    expect(context.activateSos).toHaveBeenCalledTimes(1);
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
    sosMock.enabled = true;
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
    expect(screen.queryByText("Alerta enviada · 000")).toBeNull();
    expect(screen.queryByText("SMS enviado · 000")).toBeNull();
    expect(screen.queryByText("Llamada realizada · 000")).toBeNull();
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
    expect(screen.getByText("SMS enviado · 000")).toBeTruthy();
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
    expect(screen.getByText("Llamada y SMS enviados · 000")).toBeTruthy();
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
    expect(screen.getByText("Llamada realizada · 000")).toBeTruthy();
    expect(screen.queryByText("SMS enviado · 000")).toBeNull();
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
    expect(screen.queryByText("Llamada realizada · 000")).toBeNull();
  });
});
