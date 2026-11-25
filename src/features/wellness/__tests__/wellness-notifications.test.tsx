import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WellnessNotifications } from "../notifications/WellnessNotifications";
import { loadReminderPreferences } from "../notifications/reminder-preferences";

const app = vi.hoisted(() => ({ user: { id: "patient" }, navigate: vi.fn(), showToast: vi.fn() }));
vi.mock("../../../context/AppContext", () => ({ useApp: () => app }));
vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "es",
    t: (key: string, params: Record<string, string> = {}) =>
      key.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? name),
  }),
}));
vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@ionic/react", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  IonToggle: ({ checked, onIonChange, children }: {
    checked: boolean;
    onIonChange: (event: { detail: { checked: boolean } }) => void;
    children: ReactNode;
  }) => <button role="switch" aria-checked={checked} onClick={() => onIonChange({ detail: { checked: !checked } })}>{children}</button>,
  IonButton: ({ onClick, children }: { onClick: () => void; children: ReactNode }) =>
    <button onClick={onClick}>{children}</button>,
  IonPopover: () => null,
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("WellnessNotifications", () => {
  it("saves an individual toggle and restores it after reopening", () => {
    const name = "Recordatorio del protocolo";
    const view = render(<WellnessNotifications />);
    fireEvent.click(screen.getByRole("switch", { name }));
    expect(screen.getByRole("switch", { name }).getAttribute("aria-checked")).toBe("false");
    expect(loadReminderPreferences("patient").protocol.enabled).toBe(false);
    expect(loadReminderPreferences("patient").chest.enabled).toBe(true);
    view.unmount();
    render(<WellnessNotifications />);
    expect(screen.getByRole("switch", { name }).getAttribute("aria-checked")).toBe("false");
  });

  it("saves and cancels the AI snooze and sends an in-app test", () => {
    render(<WellnessNotifications />);
    fireEvent.click(screen.getByRole("button", { name: "Posponer la pregunta 1 hora" }));
    expect(loadReminderPreferences("patient").ai.snoozeUntil).toBeGreaterThan(Date.now());
    expect(screen.getByRole("status").textContent).toContain("Pregunta pospuesta");
    fireEvent.click(screen.getByRole("button", { name: "Quitar el aplazamiento" }));
    expect(loadReminderPreferences("patient").ai.snoozeUntil).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Probar aviso en la app" }));
    expect(app.showToast).toHaveBeenCalledWith("Aviso de prueba en la app.", "info");
  });
});
