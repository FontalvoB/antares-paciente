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
 * 3) la rama real (VITE_SOS_ENABLED) despacha al backend y refleja el ciclo.
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
// SOS/REQ-SOS-07, no la animación.
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

// Útil tras cada click: Ionic/Framer resuelven en microtareas/rAF reales.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("SOS — REQ-SOS-07: sin auto-activación y doble confirmación", () => {
  beforeEach(() => {
    context.panicOpen = true;
    context.sosActive = false;
    context.activateSos.mockClear();
    context.closePanic.mockClear();
    context.showToast.mockClear();
    sosMock.enabled = false;
    sosMock.activate.mockReset();
    sosMock.fetchActive.mockReset();
    sosMock.cancel.mockReset();
    sosMock.coords.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
    context.panicOpen = true;
    context.sosActive = false;
    context.activateSos.mockClear();
    context.closePanic.mockClear();
    context.showToast.mockClear();
    sosMock.enabled = true;
    sosMock.activate.mockReset();
    sosMock.fetchActive.mockReset();
    sosMock.cancel.mockReset();
    sosMock.coords
      .mockReset()
      .mockResolvedValue({ latitude: 4.6, longitude: -74.1 });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
    expect(sosMock.activate).toHaveBeenCalledWith({
      latitude: 4.6,
      longitude: -74.1,
    });
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
    expect(sosMock.activate).toHaveBeenCalledWith(null);
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
