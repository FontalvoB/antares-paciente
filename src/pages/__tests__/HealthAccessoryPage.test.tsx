import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n/I18nContext";
import { HealthAccessoryPage } from "../HealthAccessoryPage";
import type { useHealth } from "../../context/HealthContext";

const state = vi.hoisted(() => ({
  health: {} as NonNullable<ReturnType<typeof useHealth>>,
  sync: vi.fn(), openSettings: vi.fn(), navigate: vi.fn(), openLink: vi.fn(),
  bluetooth: false,
}));
vi.mock("../../context/AppContext", () => ({
  useApp: () => ({ navigate: state.navigate, healthReturnTo: "prof", showToast: vi.fn() }),
}));
vi.mock("../../context/HealthContext", () => ({ useHealth: () => state.health }));
vi.mock("../../utils/features", () => ({ get WEARABLE_ENABLED() { return state.bluetooth; } }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: state.openLink } }));
vi.mock("../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../components/avatar/WeightRecordModal", () => ({ WeightRecordModal: () => <form aria-label="Peso manual" /> }));
vi.mock("@ionic/react", () => {
  const Block = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
  IonAccordion: Block, IonAccordionGroup: Block, IonChip: Block, IonContent: Block,
  IonHeader: Block, IonItem: Block, IonLabel: Block, IonList: Block, IonTitle: Block, IonToolbar: Block,
  IonIcon: () => null, IonProgressBar: () => null,
  IonButton: ({ children, onClick, disabled, "aria-label": label }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>
  ),
  IonModal: ({ isOpen, onDidDismiss, children }: {
    isOpen: boolean; onDidDismiss: () => void; children: ReactNode;
  }) => {
    const wasOpen = useRef(false);
    useEffect(() => {
      if (wasOpen.current && !isOpen) onDidDismiss();
      wasOpen.current = isOpen;
    }, [isOpen, onDidDismiss]);
    return isOpen ? <div role="dialog">{children}</div> : null;
  },
  };
});

function showPage() {
  return render(<QueryClientProvider client={new QueryClient()}>
    <I18nProvider><HealthAccessoryPage /></I18nProvider>
  </QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  state.bluetooth = false;
  state.health = {
    source: "apple-health", availability: "available", permission: "not-requested",
    permissionRequests: 0,
    syncing: false, summary: [], lastSync: null, error: null,
    sync: state.sync, openSettings: state.openSettings,
  };
});

describe("Pantalla de accesorio", () => {
  it("enfoca el título y muestra el pre-permiso de la plataforma antes de la solicitud", () => {
    showPage();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Conecta tu accesorio" }));
    expect(screen.queryByText("Health Connect")).toBeNull();
    expect(screen.queryByText("Conectar por Bluetooth")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Autorizar lectura" }));
    const dialog = screen.getByRole("dialog");
    for (const category of ["Pasos", "Distancia", "Energía activa", "Frecuencia cardíaca", "Frecuencia cardíaca en reposo", "Sueño"]) {
      expect(dialog.textContent).toContain(category);
    }
    expect(dialog.textContent).not.toMatch(/SpO2|glucosa|temperatura|HRV/);
    expect(state.sync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(state.sync).toHaveBeenCalledWith("request");
  });

  it("ofrece el registro manual en web y vuelve a Perfil", () => {
    state.health.source = null;
    state.health.availability = "web";
    showPage();
    expect(screen.getByText("No disponible en este dispositivo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Registrar peso" }));
    expect(screen.getByRole("form", { name: "Peso manual" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(state.navigate).toHaveBeenCalledWith("prof");
  });

  it("distingue Health Connect faltante y permite instalarlo", () => {
    state.health.source = "health-connect";
    state.health.availability = "not-installed";
    showPage();
    expect(screen.getByText("Necesitas Health Connect")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Instalar Health Connect" }));
    expect(state.openLink).toHaveBeenCalledWith({ url: expect.stringContaining("com.google.android.apps.healthdata") });
    expect(screen.queryByRole("button", { name: "Autorizar lectura" })).toBeNull();
  });

  it("ofrece ajustes si Android deniega y BLE solo cuando su flag está habilitado", () => {
    state.bluetooth = true;
    state.health.source = "health-connect";
    state.health.permission = "denied";
    state.health.error = "permission-denied";
    showPage();
    expect(screen.getByText("No tenemos permiso de lectura")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Health Connect" }));
    expect(state.openSettings).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Conectar por Bluetooth" }));
    expect(state.navigate).toHaveBeenCalledWith("bt");
  });

  it("trata un resultado vacío de iOS como vacío y permite actualizar", () => {
    state.health.permission = "unknown";
    state.health.error = "no-data";
    showPage();
    expect(screen.getByText("Todavía no encontramos datos")).toBeTruthy();
    expect(screen.queryByText("No tenemos permiso de lectura")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(state.sync).toHaveBeenCalledWith("manual");
  });

  it("promueve los ajustes después de dos solicitudes sin permiso", () => {
    state.health.source = "health-connect";
    state.health.permission = "denied";
    state.health.permissionRequests = 2;
    state.health.error = "permission-denied";
    showPage();
    expect(screen.queryByRole("button", { name: "Autorizar de nuevo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir Health Connect" })).toBeTruthy();
  });

  it("mantiene las lecturas visibles cuando el programa no admite el guardado", () => {
    state.health.permission = "unknown";
    state.health.error = "save-unavailable";
    state.health.summary = [{ date: "2026-11-21", start: 0, end: 1, values: { steps: 42 } }];
    showPage();
    expect(screen.getByText(/Se guardarán en tu programa cuando esté activo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(screen.getByText("42", { exact: false })).toBeTruthy();
  });
});
