/**
 * Tests de OfflineBanner (Fase 12, tarea 2.5).
 *
 * Se mockean el hook de red (misma ruta que importa el banner) y el i18n:
 * el banner solo decide qué fase pintar. Cobertura: oculto en online
 * idle, offline sin/con pendientes, sincronizando, restaurado con fadeout
 * a los 2.5 s (salida suavizada a los 2.1 s).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

const networkState = vi.hoisted(() => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  syncNow: vi.fn(),
}));

vi.mock("../../../hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => networkState,
}));

vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "es",
    t: (key: string, params?: Record<string, string>) =>
      key.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? name),
  }),
}));

import { OfflineBanner } from "../OfflineBanner";

describe("OfflineBanner — fases de red", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    networkState.isOnline = true;
    networkState.isSyncing = false;
    networkState.pendingCount = 0;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("online idle no renderiza nada", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("offline sin pendientes muestra mensaje automático", () => {
    networkState.isOnline = false;
    render(<OfflineBanner />);
    expect(screen.getByText("Sin conexión")).toBeTruthy();
    expect(
      screen.getByText(
        "Tus avances se guardarán y sincronizarán automáticamente",
      ),
    ).toBeTruthy();
  });

  it("offline con pendientes muestra el conteo (singular/plural)", () => {
    networkState.isOnline = false;
    networkState.pendingCount = 1;
    const { unmount } = render(<OfflineBanner />);
    expect(
      screen.getByText("Tienes 1 cambio pendiente de sincronizar"),
    ).toBeTruthy();
    unmount();
    cleanup();

    networkState.pendingCount = 3;
    render(<OfflineBanner />);
    expect(
      screen.getByText("Tienes 3 cambios pendientes de sincronizar"),
    ).toBeTruthy();
  });

  it("online sincronizando muestra el estado verde", () => {
    networkState.isSyncing = true;
    render(<OfflineBanner />);
    expect(screen.getByText("Sincronizando tus avances…")).toBeTruthy();
  });

  it("al recuperar red muestra restaurado y se oculta a los 2.5 s", () => {
    networkState.isOnline = false;
    networkState.pendingCount = 2;
    const { rerender } = render(<OfflineBanner />);
    expect(screen.getByText("Sin conexión")).toBeTruthy();

    // Vuelve la red y termina el despacho: ventana de confirmación.
    networkState.isOnline = true;
    networkState.pendingCount = 0;
    rerender(<OfflineBanner />);
    expect(screen.getByText("Conexión restablecida")).toBeTruthy();

    // A los 2.1 s empieza la salida suavizada…
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(document.querySelector(".ob-leaving")).toBeTruthy();
    expect(screen.getByText("Conexión restablecida")).toBeTruthy();

    // …y a los 2.5 s desaparece por completo.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText("Conexión restablecida")).toBeNull();
  });

  it("el banner expone role status para lectores de pantalla", () => {
    networkState.isOnline = false;
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
