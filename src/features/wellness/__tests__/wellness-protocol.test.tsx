import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { WellnessProtocol } from "../protocol/WellnessProtocol";
import {
  localISODate,
  savePlanSnapshot,
  saveProtocolHistory,
  type ProtocolStepId,
} from "../state/wellness-home-store";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({
    user: { nombre: "Ana Torres", id: "u1" },
    navigate: state.navigate,
    showToast: state.toast,
  }),
}));

vi.mock("../../../i18n/I18nContext", () => {
  const t = (key: string, params?: Record<string, string>) => {
    let text = key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, value);
    }
    return text;
  };
  return { useT: () => t, useI18n: () => ({ t, lang: "es" as const }) };
});

vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@ionic/react", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  IonAlert: ({
    isOpen,
    header,
    message,
    buttons,
  }: {
    isOpen: boolean;
    header?: string;
    message?: string;
    buttons?: { text: string; handler?: () => void }[];
  }) =>
    isOpen ? (
      <div role="dialog">
        <h2>{header}</h2>
        <p>{message}</p>
        <button onClick={() => buttons?.[0]?.handler?.()}>
          {buttons?.[0]?.text}
        </button>
      </div>
    ) : null,
}));

const TODAY = () => localISODate(new Date());
const FIRST_FOUR: ProtocolStepId[] = [
  "exercise",
  "diet",
  "vitals",
  "emotional",
];

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
  savePlanSnapshot({
    name: "Ana Torres",
    goal: "bajar",
    startDate: TODAY(),
    kcal: 1660,
    proteinG: 115,
    carbsG: 201,
    fatG: 44,
    waterMl: 2500,
    totalDays: 365,
    createdAt: new Date().toISOString(),
  });
});

describe("WellnessProtocol (KAN-143)", () => {
  it("muestra los 5 pasos y el cofre bloqueado al inicio", () => {
    render(<WellnessProtocol />);
    expect(screen.getByText("0 de 5 pasos")).toBeTruthy();
    for (const label of [
      "Ejercicio",
      "Dieta",
      "Vitales",
      "Emocional",
      "Cofre",
    ]) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
    expect(document.querySelectorAll(".wp-card")).toHaveLength(5);
    const locked = screen.getByText("Cofre bloqueado").closest("ion-button") as
      (HTMLElement & { disabled: boolean }) | null;
    expect(locked?.disabled).toBe(true);
    expect(screen.getByText(/Falta completar:/)).toBeTruthy();
  });

  it("completa un paso y actualiza el contador al instante", () => {
    render(<WellnessProtocol />);
    fireEvent.click(screen.getAllByText("Marcar como hecho")[0]);
    expect(screen.getByText("1 de 5 pasos")).toBeTruthy();
    expect(state.toast).toHaveBeenCalledWith("+10 puntos", "ok");
  });

  it("la versión reducida del ejercicio también cuenta", () => {
    render(<WellnessProtocol />);
    fireEvent.click(screen.getByText("Hice la versión reducida"));
    expect(screen.getByText("1 de 5 pasos")).toBeTruthy();
  });

  it("el chequeo emocional completa el paso con el estado elegido", () => {
    render(<WellnessProtocol />);
    fireEvent.click(screen.getByText("Bien"));
    expect(screen.getByText("1 de 5 pasos")).toBeTruthy();
  });

  it("abre el cofre solo con los 4 pasos y no lo abre dos veces", () => {
    saveProtocolHistory({ [TODAY()]: FIRST_FOUR });
    render(<WellnessProtocol />);
    expect(screen.getByText("4 de 5 pasos")).toBeTruthy();

    fireEvent.click(screen.getByText("Abrir mi cofre"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("¡Cofre abierto!")).toBeTruthy();
    expect(screen.getByText("5 de 5 pasos")).toBeTruthy();
    expect(screen.getByText("Cofre abierto hoy. Vuelve mañana.")).toBeTruthy();
    expect(screen.queryByText("Abrir mi cofre")).toBeNull();
  });

  it("muestra el día completo cuando cierra los 5 pasos", () => {
    saveProtocolHistory({
      [TODAY()]: ["exercise", "diet", "vitals", "emotional", "chest"],
    });
    render(<WellnessProtocol />);
    expect(screen.getByText("Día completo")).toBeTruthy();
    expect(screen.getByText(/bonus de cierre/)).toBeTruthy();
  });

  it("vuelve al inicio", () => {
    render(<WellnessProtocol />);
    fireEvent.click(screen.getByLabelText("Volver al inicio"));
    expect(state.navigate).toHaveBeenCalledWith("home");
  });
});
