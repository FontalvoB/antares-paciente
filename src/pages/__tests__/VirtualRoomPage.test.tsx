import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VirtualRoomPage } from "../VirtualRoomPage";
import type { ListedAppointment } from "../../data/appointments";

// Estado mutable compartido con el mock de AppContext (vi.mock se hoistea).
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
    ...overrides,
  };
}

/**
 * Estado del botón "Entrar a la consulta" (IonButton bt-teal). El prejoin
 * puede renderizar antes el CTA de pre-consulta, por eso se selecciona por
 * clase y no como primer ion-button del bloque.
 */
function joinButton(container: HTMLElement) {
  return container.querySelector(".room-empty ion-button.bt-teal") as
    | (HTMLElement & { disabled?: boolean })
    | null;
}

describe("VirtualRoomPage — prejoin y ventana de acceso", () => {
  beforeEach(() => {
    mockState.roomAppointment = listed();
  });

  it("dentro de la ventana: contexto del paciente y entrada habilitada", () => {
    const now = Date.now();
    mockState.roomAppointment = listed({
      roomOpensAt: new Date(now - 60_000).toISOString(),
      roomClosesAt: new Date(now + 60_000).toISOString(),
    });

    const { container } = render(<VirtualRoomPage />);

    expect(screen.getByText("María González")).toBeTruthy();
    expect(screen.getAllByText("Dr. Carlos Ramírez").length).toBeGreaterThan(0);
    expect(screen.getByText("Medicina general")).toBeTruthy();
    expect(screen.getByText("3F6A1C2E")).toBeTruthy();
    expect(screen.getByText("CONFIRMADA")).toBeTruthy();
    expect(screen.queryByText("La sala todavía no está abierta")).toBeNull();
    expect(joinButton(container)?.disabled).toBeFalsy();
  });

  it("antes de abrir: aviso 'Abre el {fecha}' y entrada deshabilitada", () => {
    const now = Date.now();
    mockState.roomAppointment = listed({
      roomOpensAt: new Date(now + 60_000).toISOString(),
      roomClosesAt: new Date(now + 120_000).toISOString(),
    });

    const { container } = render(<VirtualRoomPage />);

    expect(screen.getByText("La sala todavía no está abierta")).toBeTruthy();
    expect(screen.getByText("Abre el {fecha}")).toBeTruthy();
    expect(joinButton(container)?.disabled).toBe(true);
  });

  it("después de cerrar: aviso 'Cerró el {fecha}' y entrada deshabilitada", () => {
    const now = Date.now();
    mockState.roomAppointment = listed({
      roomOpensAt: new Date(now - 120_000).toISOString(),
      roomClosesAt: new Date(now - 60_000).toISOString(),
    });

    const { container } = render(<VirtualRoomPage />);

    expect(
      screen.getByText("La ventana de acceso a la sala ya terminó"),
    ).toBeTruthy();
    expect(screen.getByText("Cerró el {fecha}")).toBeTruthy();
    expect(joinButton(container)?.disabled).toBe(true);
  });

  it("sin campos enriquecidos (unknown): no bloquea la entrada", () => {
    const { container } = render(<VirtualRoomPage />);

    expect(screen.queryByText("La sala todavía no está abierta")).toBeNull();
    expect(
      screen.queryByText("La ventana de acceso a la sala ya terminó"),
    ).toBeNull();
    expect(joinButton(container)?.disabled).toBeFalsy();
  });
});
