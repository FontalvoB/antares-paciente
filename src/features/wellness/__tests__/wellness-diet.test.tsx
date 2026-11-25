import english from "../../../i18n/en.json";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WellnessDiet } from "../nutrition/WellnessDiet";
import { logDietMeal, readDietDay } from "../nutrition/diet-store";
import { getWellnessHomeData, loadProtocolHistory, localISODate, savePlanSnapshot } from "../state/wellness-home-store";
import { analyzeFoodImage } from "../../../utils/foodAiApi";

vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ user: { nombre: "Ana" }, navigate: vi.fn() }),
}));
const locale = vi.hoisted(() => ({ lang: "es" }));
vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: locale.lang,
    t: (key: string, params: Record<string, string> = {}) =>
      (locale.lang === "en" ? (english as Record<string, string>)[key] ?? key : key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? name),
  }),
}));
vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../components/CameraCapture", () => ({
  CameraCapture: ({ onCapture }: { onCapture: (file: Blob, name: string) => void }) => (
    <button onClick={() => onCapture(new Blob(["fixture"]), "meal.png")}>Capturar</button>
  ),
}));
vi.mock("../../../utils/foodAiApi", () => ({ analyzeFoodImage: vi.fn() }));
vi.mock("@ionic/react", async (original) => ({
  ...(await original<object>()),
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

const today = new Date();
const date = localISODate(today);
const breakfast = () => within(screen.getByRole("region", { name: "Desayuno" }));

beforeEach(() => {
  locale.lang = "es";
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  savePlanSnapshot({
    name: "Ana", goal: "bajar", startDate: date, createdAt: today.toISOString(),
    totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
  });
});

describe("WellnessDiet", () => {
  it.each([["es", "Plan general de alimentación, solo informativo. Antes de cambiar tu alimentación, consulta a un profesional de la salud."], ["en", "General eating plan, for information only. Before changing how you eat, check with a health professional."]] as const)(
    "muestra el aviso permanente en %s",
    (lang, expected) => {
    locale.lang = lang;
    render(<WellnessDiet />);
      expect(screen.getByRole("note").textContent).toBe(expected);
    },
  );
  it("muestra cuatro comidas y registra adherencia en el protocolo", () => {
    render(<WellnessDiet />);
    expect(screen.getAllByText("Lo comí")).toHaveLength(4);
    fireEvent.click(breakfast().getByText("Lo comí"));
    expect(breakfast().getByText("Registrada")).toBeTruthy();
    expect(screen.getByText("1 de 4 comidas registradas")).toBeTruthy();
    expect(readDietDay(today, date).eaten.breakfast).toBeTruthy();
    expect(loadProtocolHistory()[date]).toEqual(["diet"]);
    expect(getWellnessHomeData("Ana", today).protocolDone).toBe(1);
    fireEvent.click(within(screen.getByRole("region", { name: "Cena" })).getByText("Lo comí"));
    expect(loadProtocolHistory()[date]).toEqual(["diet"]);
  });

  it("persiste el cambio de plato y mantiene la meta calórica", () => {
    const view = render(<WellnessDiet />);
    const original = breakfast().getByRole("list").textContent;
    const goal = screen.getByText(/^Meta diaria:/).textContent;
    fireEvent.click(breakfast().getByText("Cambiar plato"));
    const changed = breakfast().getByRole("list").textContent;
    expect(changed).not.toBe(original);
    expect(screen.getByText(/^Meta diaria:/).textContent).toBe(goal);
    view.unmount();
    render(<WellnessDiet />);
    expect(breakfast().getByRole("list").textContent).toBe(changed);
  });

  it("guarda la foto como borrador y solo aplica el registro al confirmar la edición", async () => {
    vi.mocked(analyzeFoodImage).mockResolvedValue({
      analysisId: "fixture", status: "done", modelVersion: "", segModelVersion: "",
      classifierVersion: "", inferenceTimeMs: 0, foods: [], summary: null, summaryRange: null,
      intake: { calories: 510, proteinG: 20, carbsG: 50, fatG: 25, fiberG: 6 },
    });
    const view = render(<WellnessDiet />);
    const original = breakfast().getByRole("list").textContent;
    fireEvent.click(breakfast().getByText("Foto de comida"));
    fireEvent.click(screen.getByText("Capturar"));
    await screen.findByText("Confirmar registro");
    expect(breakfast().getByRole("list").textContent).toBe(original);
    expect(readDietDay(today, date).pending.breakfast?.kcal).toBe("510");
    expect(readDietDay(today, date).eaten.breakfast).toBeUndefined();
    expect(loadProtocolHistory()).toEqual({});
    view.unmount();

    render(<WellnessDiet />);
    fireEvent.click(breakfast().getByText("Revisar registro"));
    const input = document.querySelector('ion-input[label="Energía (kcal)"]');
    expect(input).toBeTruthy();
    fireEvent(input!, new CustomEvent("ionInput", { detail: { value: "525" } }));
    fireEvent.click(screen.getByText("Confirmar registro"));
    expect(readDietDay(today, date).pending.breakfast).toBeUndefined();
    expect(readDietDay(today, date).eaten.breakfast?.values.kcal).toBe(525);
    expect(breakfast().getByText("Registro confirmado")).toBeTruthy();
    expect(breakfast().getByText("525 kcal")).toBeTruthy();
    expect(loadProtocolHistory()[date]).toEqual(["diet"]);
  });

  it("suma agua por fecha y la recupera al volver a la pantalla", () => {
    const view = render(<WellnessDiet />);
    fireEvent.click(screen.getByText("+250 ml"));
    fireEvent.click(screen.getByText("+250 ml"));
    view.unmount();
    render(<WellnessDiet />);
    expect(screen.getByText(/500 de 2[.,]?500 ml/)).toBeTruthy();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    expect(readDietDay(tomorrow, date).waterMl).toBe(0);
  });

  it("aplica modo manual y modo automático tras dos días por debajo de 60 %", () => {
    const view = render(<WellnessDiet />);
    fireEvent.click(screen.getByText("Modo simplificado"));
    expect(readDietDay(today, date).manualSimple).toBe(true);
    fireEvent.click(screen.getByText("Modo simplificado"));
    expect(readDietDay(today, date).manualSimple).toBe(false);
    view.unmount();

    const previous = new Date(today);
    previous.setDate(today.getDate() - 2);
    const start = localISODate(previous);
    const meal = { kcal: 300, proteinG: 15, carbsG: 35, fatG: 12 };
    logDietMeal(previous, "breakfast", 0, meal);
    previous.setDate(previous.getDate() + 1);
    logDietMeal(previous, "breakfast", 0, meal);
    expect(readDietDay(today, start).autoSimple).toBe(true);
    logDietMeal(previous, "lunch", 0, meal);
    logDietMeal(previous, "dinner", 0, meal);
    expect(readDietDay(today, start).autoSimple).toBe(false);
  });
});

