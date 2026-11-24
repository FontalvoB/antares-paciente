import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { WellnessHome } from "../home/WellnessHome";
import { getGenerationState, requestGeneration, setNextFailure } from "../generation/generation-store";
import {
  localISODate,
  saveBatteriesCompleted,
  savePlanSnapshot,
  saveProtocolHistory,
  type ProtocolStepId,
} from "../state/wellness-home-store";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  openVoice: vi.fn(),
  openTests: vi.fn(),
  lang: "es" as "es" | "en",
}));

vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({
    user: { nombre: "Ana Torres", id: "u1" },
    navigate: state.navigate,
    openVoice: state.openVoice,
    openTests: state.openTests,
  }),
}));

vi.mock("../../../i18n/I18nContext", async () => {
  const { default: english } = await import("../../../i18n/en.json");
  const t = (key: string, params?: Record<string, string>) => {
    let text =
      state.lang === "en"
        ? ((english as Record<string, string>)[key] ?? key)
        : key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, value);
    }
    return text;
  };
  return { useT: () => t, useI18n: () => ({ t, lang: state.lang }) };
});

vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../components/LanguageToggle", () => ({
  LanguageToggle: () => <span>lang</span>,
}));

const ALL: ProtocolStepId[] = [
  "exercise",
  "diet",
  "vitals",
  "emotional",
  "chest",
];

function seedPlan(daysAgo: number) {
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);
  return savePlanSnapshot({
    name: "Ana Torres",
    goal: "bajar",
    startDate: localISODate(start),
    kcal: 1660,
    proteinG: 115,
    carbsG: 201,
    fatG: 44,
    waterMl: 2500,
    totalDays: 365,
    createdAt: new Date().toISOString(),
  });
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
  state.lang = "es";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WellnessHome (KAN-142)", () => {
  it("muestra día, progreso y protocolo sin datos clínicos retirados", () => {
    seedPlan(9);
    render(<WellnessHome />);
    expect(document.querySelector(".wh-day")?.textContent).toMatch(
      /Día\s*10\s*de\s*365/,
    );
    expect(document.querySelector(".wh-day-progress")).toBeTruthy();
    expect(screen.getByText("0/5")).toBeTruthy();
    expect(screen.getByText("0 de 7")).toBeTruthy();
    for (const removed of ["IMC", "HbA1c", "% de grasa"]) {
      expect(screen.queryByText(new RegExp(removed))).toBeNull();
    }
  });

  it("no pasa del día 365", () => {
    seedPlan(400);
    render(<WellnessHome />);
    expect(document.querySelector(".wh-day")?.textContent).toMatch(
      /Día\s*365\s*de\s*365/,
    );
    expect(document.querySelector(".wh-day")?.textContent).not.toMatch(/366/);
  });

  it("abre el primer paso pendiente desde el CTA", () => {
    seedPlan(0);
    render(<WellnessHome />);
    fireEvent.click(screen.getByText("Empezar mi día"));
    expect(state.navigate).toHaveBeenCalledWith("protocol");
  });

  it("refleja el estado real de los 5 pasos y los puntos", () => {
    seedPlan(0);
    saveProtocolHistory({ [localISODate(new Date())]: ALL });
    render(<WellnessHome />);
    expect(screen.getByText("5/5")).toBeTruthy();
    expect(screen.getByText("Día completo")).toBeTruthy();
    expect(screen.getByText("70")).toBeTruthy();
  });

  it("oculta la tarjeta de cuestionarios al llegar a 7/7", () => {
    seedPlan(0);
    saveBatteriesCompleted(7);
    render(<WellnessHome />);
    expect(screen.queryByText("Cuestionarios de bienestar")).toBeNull();
  });

  it("lleva a los cuestionarios y a Vita", () => {
    seedPlan(0);
    render(<WellnessHome />);
    fireEvent.click(screen.getByText("Continuar cuestionarios"));
    expect(state.openTests).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Vita"));
    expect(state.openVoice).toHaveBeenCalled();
  });

  it("se traduce al inglés", () => {
    state.lang = "en";
    seedPlan(0);
    render(<WellnessHome />);
    expect(screen.getByText("Today's protocol")).toBeTruthy();
    expect(screen.getByText("Start my day")).toBeTruthy();
    expect(screen.getByText("Wellness questionnaires")).toBeTruthy();
  });

  it("muestra tres barras en Inicio y se actualiza sola hasta que aparece la bandeja completa", () => {
    vi.useFakeTimers();
    requestGeneration(seedPlan(0));
    render(<WellnessHome />);

    const generation = screen.getByRole("region", { name: "Preparación del plan" });
    expect(within(generation).getByText("Estamos preparando tu plan")).toBeTruthy();
    for (const label of ["Ejercicio", "Nutrición", "Bandeja"]) {
      expect(generation.querySelector(`ion-progress-bar[aria-label="${label}"]`)).toBeTruthy();
    }
    const inbox = within(screen.getByRole("region", { name: "Bandeja" }));
    expect(inbox.getByText("Preparando tu bandeja")).toBeTruthy();
    expect(screen.getByText("Protocolo de hoy")).toBeTruthy();

    act(() => vi.advanceTimersByTime(400));
    expect(within(generation).getByText("44%")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.queryByText("Estamos preparando tu plan")).toBeNull();
    expect(inbox.getByText("Te damos la bienvenida")).toBeTruthy();
    expect(inbox.getByText("Tu plan de ejercicio está listo")).toBeTruthy();
    expect(inbox.getByText("Tu plan de nutrición está listo")).toBeTruthy();
    expect(inbox.getByText("Tus cuestionarios")).toBeTruthy();
    expect(inbox.getByText("Abre Ejercicio para ver tu primera sesión.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Bandeja" }).querySelectorAll("time[datetime]")).toHaveLength(4);
  });

  it("reintenta el fallo desde Inicio sin descartar los mensajes listos", () => {
    vi.useFakeTimers();
    setNextFailure("nutrition");
    requestGeneration(seedPlan(0));
    render(<WellnessHome />);
    act(() => vi.advanceTimersByTime(1600));

    expect(screen.getByRole("alert").textContent).toBe("No pudimos preparar tu plan de nutrición");
    expect(screen.getByText("Tus respuestas están guardadas")).toBeTruthy();
    expect(screen.getByText("Tu plan de ejercicio está listo")).toBeTruthy();
    expect(screen.queryByText("Tu plan de nutrición está listo")).toBeNull();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(getGenerationState()?.attempts).toBe(2);
    expect(screen.getByText("Estamos preparando tu plan")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Tu plan de nutrición está listo")).toBeTruthy();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("muestra el estado vacío de la bandeja cuando no hay mensajes", () => {
    seedPlan(0);
    render(<WellnessHome />);
    const inbox = within(screen.getByRole("region", { name: "Bandeja" }));
    expect(inbox.getByText("No tienes mensajes nuevos")).toBeTruthy();
  });
});
