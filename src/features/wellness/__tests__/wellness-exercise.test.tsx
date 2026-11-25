import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { I18nProvider } from "../../../i18n/I18nContext";
import { WellnessExercise } from "../exercise/WellnessExercise";
import { localISODate } from "../state/wellness-home-store";

vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ user: null, navigate: vi.fn(), showToast: vi.fn() }),
}));

vi.mock("../../../components/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const sessionKey = "wellness.exercise.session.v1";
const restMessage = "Hoy toca descanso. Mañana volvemos.";

function renderExercise() {
  return render(
    <I18nProvider>
      <WellnessExercise />
    </I18nProvider>,
  );
}

function changeIonicControl(control: Element, detail: object) {
  fireEvent(control, new CustomEvent("ionChange", { detail, bubbles: true }));
}

beforeEach(() => window.localStorage.clear());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WellnessExercise", () => {
  it("muestra las cuatro tarjetas del plan del día", () => {
    const { container } = renderExercise();
    const cards = container.querySelectorAll(".wx-list > li");
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(within(card as HTMLElement).getByRole("heading", { level: 2 })).toBeTruthy();
    }
    expect(screen.getByText("Empezar sesión")).toBeTruthy();
  });

  it("muestra un aviso de descanso al indicar dolor 7", () => {
    renderExercise();
    const label = screen.getByText("Dolor de 0 a 10:");
    changeIonicControl(label.closest("ion-range")!, { value: 7 });

    expect(screen.getByRole("status").textContent).toContain("Descansa dos días");
    expect(screen.getByText(restMessage)).toBeTruthy();
    expect(screen.queryByText("Empezar sesión")).toBeNull();
  });

  it("muestra un aviso de descanso al indicar mareo", () => {
    renderExercise();
    const toggle = screen.getByText("Mareo");
    changeIonicControl(toggle, { checked: true });

    expect(screen.getByRole("status").textContent).toContain("Hoy no hagas ejercicio");
    expect(screen.getByText(restMessage)).toBeTruthy();
    expect(screen.queryByText("Empezar sesión")).toBeNull();
  });

  it("inicia el cronómetro, avanza y registra el ejercicio al terminar", () => {
    renderExercise();
    fireEvent.click(screen.getByText("Empezar sesión"));
    expect(screen.getByRole("timer").textContent).toMatch(/\d+:\d{2}/);
    expect(screen.getByText("Ejercicio 1 de 4")).toBeTruthy();

    for (const step of [2, 3, 4]) {
      fireEvent.click(screen.getByText("Siguiente"));
      expect(screen.getByText(`Ejercicio ${step} de 4`)).toBeTruthy();
    }

    expect(window.localStorage.getItem("wellness.protocol.v1")).toBeNull();
    fireEvent.click(screen.getByText("Terminar sesión"));
    expect(screen.getByRole("heading", { name: "Sesión completada" })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("wellness.protocol.v1") ?? "{}")).toEqual({
      [localISODate(new Date())]: ["exercise"],
    });
    expect(window.localStorage.getItem(sessionKey)).toBeNull();
  });

  it("restaura el tiempo en pausa y detiene el cronómetro en cero", () => {
    vi.useFakeTimers();
    window.localStorage.setItem(sessionKey, JSON.stringify({
      date: localISODate(new Date()),
      index: 1,
      remaining: 2,
      endAt: null,
      paused: true,
      running: true,
    }));
    renderExercise();
    expect(screen.getByText("Ejercicio 2 de 4")).toBeTruthy();
    expect(within(screen.getByRole("timer")).getByText("0:02")).toBeTruthy();
    expect(screen.getByText("En pausa")).toBeTruthy();

    fireEvent.click(screen.getByText("Continuar"));
    act(() => vi.advanceTimersByTime(3000));
    expect(within(screen.getByRole("timer")).getByText("0:00")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByText("Siguiente"));
    expect(screen.getByText("Ejercicio 3 de 4")).toBeTruthy();
  });
});
