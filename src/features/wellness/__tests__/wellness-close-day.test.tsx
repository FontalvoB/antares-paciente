import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WellnessCloseDay } from "../checkin/WellnessCloseDay";
import { loadCheckins, syncCheckins } from "../checkin/checkin-store";
import { EFFECT_COPY } from "../checkin/close-day";

const navigate = vi.hoisted(() => vi.fn());
// KAN-167: el orbe de Vita tiene sus propias pruebas (vita-entry.test.tsx).
vi.mock("../vita", () => ({ VitaEntry: () => null }));
vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ user: { id: "patient" }, navigate }),
}));
vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "es", t: (text: string) => text }),
}));
vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@ionic/react", () => ({
  IonButton: ({ children, type = "button", onClick, disabled }: ComponentProps<"button">) =>
    <button {...{ type, onClick, disabled }}>{children}</button>,
  IonInput: ({ label, type, value, required, onIonInput }: {
    label: string; type: string; value: string; required: boolean;
    onIonInput: (event: { detail: { value: string } }) => void;
  }) => (
    <label>{label}<input type={type} required={required} value={value} onChange={(event) =>
      onIonInput({ detail: { value: event.currentTarget.value } })} /></label>
  ),
  IonCheckbox: ({ children, checked, onIonChange }: {
    children: ReactNode; checked: boolean;
    onIonChange: (event: { detail: { checked: boolean } }) => void;
  }) => (
    <label><input type="checkbox" checked={checked} onChange={(event) =>
      onIonChange({ detail: { checked: event.currentTarget.checked } })} />{children}</label>
  ),
  IonRadioGroup: ({ children, onIonChange }: {
    children: ReactNode; onIonChange: (event: { detail: { value: string } }) => void;
  }) => <div onChange={(event) => onIonChange({ detail: { value: (event.target as HTMLInputElement).value } })}>{children}</div>,
  IonRadio: ({ children, value }: { children: ReactNode; value: string }) =>
    <label><input type="radio" name="exercised" value={value} />{children}</label>,
  IonLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonListHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("WellnessCloseDay", () => {
  it("muestra el formulario y valida campos obligatorios antes del cierre", () => {
    render(<WellnessCloseDay />);
    expect(screen.getByRole("heading", { name: "Cerrar el día" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Náuseas" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Cintura (cm, opcional)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar el día" }));
    expect(screen.getByRole("alert").textContent).toContain("Revisa los valores");
    expect(loadCheckins("patient")).toEqual({});
  });

  it("muestra el resumen offline y conserva como local el cierre sin ordinal del motor", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const view = render(<WellnessCloseDay />);
    fill("Adherencia (%)", "70");
    fill("Horas de sueño", "5");
    fill("Energía (1–5)", "3");
    fill("Dolor (0–10)", "0");
    fill("Peso (kg, opcional)", "72.5");
    fireEvent.click(screen.getByRole("checkbox", { name: "Hambre" }));
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    const close = screen.getByRole("button", { name: "Cerrar el día" });
    fireEvent.click(close);
    fireEvent.click(close);

    const summary = await screen.findByRole("heading", { name: "Día cerrado" });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(screen.getByText(EFFECT_COPY.gentleSleep)).toBeTruthy();
    expect(screen.getByText(EFFECT_COPY.hunger)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Cierre guardado en este dispositivo.");
    const entries = Object.values(loadCheckins("patient"));
    expect(entries).toHaveLength(1);
    expect(entries[0].input).toMatchObject({ exercised: false, weightKg: 72.5, waistCm: null });

    online.mockReturnValue(true);
    await act(async () => { await syncCheckins("patient"); });
    expect(screen.getByRole("status").textContent).toBe("Cierre guardado en este dispositivo.");
    expect(Object.values(loadCheckins("patient"))[0].status).toBe("pending");
    view.unmount();
    render(<WellnessCloseDay />);
    expect(screen.getByRole("heading", { name: "Día cerrado" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cerrar el día" })).toBeNull();
    expect(Object.keys(loadCheckins("patient"))).toHaveLength(1);
  });
});
