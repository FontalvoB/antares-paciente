import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SensitiveDataGate, WellnessPrivacy } from "../privacy/WellnessPrivacy";
import { exportWellnessPrivacyAudit, readWellnessConsent } from "../privacy/privacy-consent-store";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), download: vi.fn() }));
vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ user: { id: "patient" }, navigate: mocks.navigate }),
}));
vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "es",
    t: (text: string, params: Record<string, string> = {}) =>
      text.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? ""),
  }),
}));
vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../privacy/wellness-export", () => ({ downloadWellnessExport: mocks.download }));
vi.mock("@ionic/react", () => ({
  IonButton: ({ children, onClick, disabled }: ComponentProps<"button">) =>
    <button type="button" {...{ onClick, disabled }}>{children}</button>,
  IonCheckbox: ({ children, checked, onIonChange }: {
    children: ReactNode;
    checked: boolean;
    onIonChange: (event: { detail: { checked: boolean } }) => void;
  }) => (
    <label><input type="checkbox" checked={checked} onChange={(event) =>
      onIonChange({ detail: { checked: event.currentTarget.checked } })} />{children}</label>
  ),
  IonAlert: ({ isOpen, header, message, buttons, onDidDismiss }: {
    isOpen: boolean; header: string; message: string;
    buttons: { text: string; handler?: () => void }[]; onDidDismiss: () => void;
  }) => isOpen && (
    <div role="alertdialog" aria-label={header}>
      <p>{message}</p>
      {buttons.map(({ text, handler }) => <button key={text} onClick={() => {
        handler?.();
        onDidDismiss();
      }}>{text}</button>)}
    </div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

it("presenta el borrador, los permisos separados y acepta un scope a la vez", () => {
  render(<WellnessPrivacy />);
  expect(screen.getByText("Borrador para revisión legal")).toBeTruthy();
  for (const name of ["Qué recogemos", "Para qué los usamos", "Con quién los compartimos", "Consentimientos y permisos", "Tus datos en este dispositivo"]) {
    expect(screen.getByRole("heading", { name })).toBeTruthy();
  }
  const checkboxes = screen.getAllByRole<HTMLInputElement>("checkbox");
  expect(checkboxes.map(({ checked }) => checked)).toEqual([false, false]);
  fireEvent.click(checkboxes[0]);
  expect(checkboxes.map(({ checked }) => checked)).toEqual([true, false]);
  expect(screen.getByText(/^Aceptado el/).tagName).toBe("TIME");
  expect(readWellnessConsent("sensitive-data", "patient")).toBeTruthy();
});

it("ofrece contexto antes de mostrar un formulario de datos sensibles", () => {
  render(<SensitiveDataGate actor="patient" onBack={vi.fn()}><h1>Formulario</h1></SensitiveDataGate>);
  expect(screen.queryByRole("heading", { name: "Formulario" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.queryByRole("heading", { name: "Formulario" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByRole("heading", { name: "Formulario" })).toBeTruthy();
});

it("exporta con el actor de la sesión", async () => {
  render(<WellnessPrivacy />);
  fireEvent.click(screen.getByRole("button", { name: "Exportar mis datos" }));
  expect(mocks.download).toHaveBeenCalledWith("patient");
  expect(await screen.findByText("Tu archivo JSON está listo.")).toBeTruthy();
});

it("conserva los datos al cancelar y borra solo al confirmar", () => {
  localStorage.setItem("wellness.plan.v1", "{}");
  localStorage.setItem("session", "active");
  render(<WellnessPrivacy />);
  const remove = screen.getByRole("button", { name: "Borrar mis datos" });
  fireEvent.click(remove);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
  expect(localStorage.getItem("wellness.plan.v1")).toBe("{}");
  fireEvent.click(remove);
  expect(exportWellnessPrivacyAudit("patient")).toEqual([]);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Borrar datos" }));
  expect(localStorage.getItem("wellness.plan.v1")).toBeNull();
  expect(localStorage.getItem("session")).toBe("active");
  expect(exportWellnessPrivacyAudit("patient").at(-1)?.action).toBe("deleted");
  expect(screen.getByRole("status").textContent).toContain("Tu sesión sigue abierta.");
});
