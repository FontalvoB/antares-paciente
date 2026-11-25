import english from "../../../i18n/en.json";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WellnessVitals } from "../vitals/WellnessVitals";
import { loadVitals, saveVital, VITAL_METRICS } from "../vitals/vitals-store";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ user: { id: "patient" }, navigate, vitalsReturnTo: "protocol" }),
}));
vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const locale = vi.hoisted(() => ({ lang: "es" }));
vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: locale.lang,
    t: (text: string, variables: Record<string, string> = {}) =>
      Object.entries(variables).reduce((message, [key, value]) => message.replace("{" + key + "}", value), (locale.lang === "en" ? (english as Record<string, string>)[text] ?? text : text)),
  }),
}));
vi.mock("@ionic/react", () => ({
  IonNote: ({ children }: { children: ReactNode }) => <span role="note">{children}</span>,
  IonBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonIcon: () => null,
  IonButton: ({ children, onClick, type = "button", disabled, ...props }: ComponentProps<"button">) =>
    <button aria-label={props["aria-label"]} aria-pressed={props["aria-pressed"]} {...{ onClick, type, disabled }}>
      {children}
    </button>,
  IonInput: ({ label, value, onIonInput }: {
    label: string; value: string;
    onIonInput: (event: { detail: { value: string } }) => void;
  }) => (
    <label>{label}<input value={value} onChange={(event) =>
      onIonInput({ detail: { value: event.currentTarget.value } })} /></label>
  ),
  IonSelect: ({ children, label, value, onIonChange }: {
    children: ReactNode; label: string; value: string;
    onIonChange: (event: { detail: { value: string } }) => void;
  }) => (
    <label>{label}<select value={value} onChange={(event) =>
      onIonChange({ detail: { value: event.currentTarget.value } })}>{children}</select></label>
  ),
  IonSelectOption: ({ children, value }: ComponentProps<"option">) => <option value={value}>{children}</option>,
  IonSegment: ({ children, onIonChange }: {
    children: ReactNode;
    onIonChange: (event: { detail: { value: string } }) => void;
  }) => (
    <div onClick={(event) => {
      if (event.target instanceof HTMLButtonElement) {
        onIonChange({ detail: { value: event.target.value } });
      }
    }}>{children}</div>
  ),
  IonSegmentButton: ({ children, value }: ComponentProps<"button">) => <button value={value}>{children}</button>,
}));

beforeEach(() => {
  locale.lang = "es";
  localStorage.clear();
  navigate.mockClear();
});
afterEach(cleanup);

const history = () => within(screen.getByRole("region", { name: "Historial" }));

function dayAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe("WellnessVitals", () => {
  it.each([["es", "Tus registros son informativos y no reemplazan la orientación de un profesional de la salud. Consúltalo ante cualquier duda."], ["en", "Your records are informational and do not replace a health professional's guidance. Check with one if you have any doubt."]] as const)(
    "muestra el aviso permanente en %s",
    (lang, expected) => {
    locale.lang = lang;
    render(<WellnessVitals />);
      expect(screen.getByRole("note").textContent).toBe(expected);
    },
  );
  it("ofrece ocho mediciones, el aviso permanente y volver al protocolo", () => {
    render(<WellnessVitals />);
    const metrics = within(screen.getByRole("region", { name: "Mediciones" }));
    expect(metrics.getAllByRole("button")).toHaveLength(8);
    for (const metric of Object.values(VITAL_METRICS)) expect(metrics.getByText(metric.label)).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("orientación de un profesional de la salud");
    expect(history().getByText("Sin registros en este período.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Volver al protocolo" }));
    expect(navigate).toHaveBeenCalledWith("protocol");
  });

  it("valida y guarda presión con ambos valores y su procedencia", async () => {
    render(<WellnessVitals />);
    fireEvent.click(screen.getByRole("button", { name: /^Presión arterial/ }));
    const save = screen.getByRole("button", { name: "Guardar medición" });
    fireEvent.click(save);
    expect(screen.getByRole("alert").textContent).toMatch(/sistólica debe ser mayor/);
    fireEvent.change(screen.getByLabelText("Sistólica (mmHg)"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Diastólica (mmHg)"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Origen de la medición"), { target: { value: "watch" } });
    fireEvent.click(save);
    expect(await history().findByText("120/80 mmHg")).toBeTruthy();
    expect(history().getByText("Reloj")).toBeTruthy();
    expect(history().getByRole("img", { name: /Mínimo 80, máximo 120 mmHg/ })).toBeTruthy();
    expect(history().getByText("Sistólica")).toBeTruthy();
    expect(history().getByText("Diastólica")).toBeTruthy();
  });

  it("muestra cambios del día y revela la tendencia al ampliar a tres registros", async () => {
    await saveVital("patient", "heartRate", 70, "apple", dayAgo(20));
    await saveVital("patient", "heartRate", 80, "watch", dayAgo(5));
    await saveVital("patient", "heartRate", 82, "apple", dayAgo(0));
    render(<WellnessVitals />);
    expect(history().queryByText(/Tendencia:/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Frecuencia cardíaca (lpm)"), { target: { value: "81" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar medición" }));
    expect(await history().findByText("Cambios del día")).toBeTruthy();
    expect(history().getByText("82 lpm")).toBeTruthy();
    expect(history().getByText("81 lpm")).toBeTruthy();
    expect(history().getByText("Manual")).toBeTruthy();
    expect(history().getByText("Apple")).toBeTruthy();
    expect(history().queryByText(/Tendencia:/)).toBeNull();
    fireEvent.click(history().getByRole("button", { name: "30 días" }));
    expect(history().getByText("Tendencia: Manteniéndose")).toBeTruthy();
  });

  it("cambia la presentación de peso sin reescribir valores", async () => {
    await saveVital("patient", "weight", 72, "manual");
    const baseline = loadVitals("patient");
    render(<WellnessVitals />);
    fireEvent.click(screen.getByRole("button", { name: /^Peso/ }));
    fireEvent.change(history().getByLabelText("Unidad de visualización"), { target: { value: "lb" } });
    expect(history().getByText(/158[,.]73 lb/)).toBeTruthy();
    expect(screen.getByLabelText("Peso (kg)")).toBeTruthy();
    expect(loadVitals("patient")).toEqual(baseline);
  });
});
