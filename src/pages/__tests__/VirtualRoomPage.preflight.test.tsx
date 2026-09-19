import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { VirtualRoomPage } from "../VirtualRoomPage";
import type { ListedAppointment } from "../../data/appointments";

const mockState = vi.hoisted(() => ({
  roomAppointment: null as ListedAppointment | null,
}));

vi.mock("../../context/AppContext", () => ({
  useApp: () => ({
    roomAppointment: mockState.roomAppointment,
    closeRoom: vi.fn(),
    navigate: vi.fn(),
    user: { nombre: "María González" },
  }),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ lang: "es", t: (key: string) => key }),
}));

function listed(overrides: Partial<ListedAppointment> = {}): ListedAppointment {
  const now = Date.now();
  return {
    id: "3f6a1c2e-9b4d-4a1e-8c7f-1234567890ab",
    when: "CONFIRMADA",
    mode: "Telemedicina",
    accent: "linear-gradient(90deg,#0C3D2C,var(--teal))",
    emoji: "🩺",
    name: "Dr. Carlos Ramírez",
    role: "Medicina general",
    time: "15:00",
    day: "Hoy",
    motivo: "Medicina general",
    color: "var(--teal)",
    status: "Confirmed",
    roomOpensAt: new Date(now - 60_000).toISOString(),
    roomClosesAt: new Date(now + 60_000).toISOString(),
    ...overrides,
  };
}

const originalMediaDevices = navigator.mediaDevices;

function setMediaDevices(value: unknown) {
  Object.defineProperty(window.navigator, "mediaDevices", {
    value,
    configurable: true,
  });
}

/** Botón "Entrar a la consulta" (bt-teal); el CTA de pre-consulta va antes. */
function joinButton(container: HTMLElement) {
  return container.querySelector(".room-empty ion-button.bt-teal") as
    | (HTMLElement & { disabled?: boolean })
    | null;
}

describe("VirtualRoomPage — preflight de dispositivos", () => {
  beforeEach(() => {
    mockState.roomAppointment = listed();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
    });
  });

  it("cámara ausente con micrófono listo: ofrece 'Unirme solo con audio'", async () => {
    const getUserMedia = vi.fn(async (constraints: { video?: boolean }) => {
      if (constraints.video) {
        throw Object.assign(new Error("sin cámara"), {
          name: "NotFoundError",
        });
      }
      return { getTracks: () => [{ stop: vi.fn() }] };
    });
    setMediaDevices({
      enumerateDevices: async () => [{ kind: "audioinput" }],
      getUserMedia,
    });

    const { container } = render(<VirtualRoomPage />);

    await screen.findByText("Unirme solo con audio");
    expect(screen.getByText("No se detectó cámara")).toBeTruthy();
    expect(screen.getByText("Micrófono listo")).toBeTruthy();
    expect(joinButton(container)?.disabled).toBeFalsy();
  });

  it("micrófono listo con cámara denegada: el plan de conexión es solo audio", async () => {
    const getUserMedia = vi.fn(async (constraints: { video?: boolean }) => {
      if (constraints.video) {
        throw Object.assign(new Error("denegado"), {
          name: "NotAllowedError",
        });
      }
      return { getTracks: () => [{ stop: vi.fn() }] };
    });
    setMediaDevices({
      enumerateDevices: async () => [
        { kind: "videoinput" },
        { kind: "audioinput" },
      ],
      getUserMedia,
    });

    render(<VirtualRoomPage />);

    await screen.findByText("Permiso de cámara denegado");
    expect(screen.getByText("Unirme solo con audio")).toBeTruthy();
    expect(screen.getByText("Micrófono listo")).toBeTruthy();
  });

  it("ambos dispositivos denegados: entrada deshabilitada y guía accionable", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(
      Object.assign(new Error("denegado"), { name: "NotAllowedError" }),
    );
    setMediaDevices({
      enumerateDevices: async () => [
        { kind: "videoinput" },
        { kind: "audioinput" },
      ],
      getUserMedia,
    });

    const { container } = render(<VirtualRoomPage />);

    await screen.findByText(
      "Revisa los permisos de cámara y micrófono en los ajustes del sistema.",
    );
    expect(joinButton(container)?.disabled).toBe(true);
  });

  it("sin getUserMedia (WKWebView viejo): informa y no bloquea la entrada", async () => {
    setMediaDevices({});

    const { container } = render(<VirtualRoomPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          "Tu navegador no permite usar la cámara o el micrófono",
        ).length,
      ).toBe(2);
    });
    expect(joinButton(container)?.disabled).toBeFalsy();
  });
});
