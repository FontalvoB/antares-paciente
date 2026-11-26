import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { WellnessGoalPage } from "../goal/WellnessGoalPage";
import { WELLNESS_TERMS_VERSION } from "../domain/draft";
import type { ObjectiveDraft } from "../domain/types";
import {
  loadPlanSnapshot,
  loadPlanVersions,
  loadProtocolHistory,
  localISODate,
  savePlanSnapshot,
  saveProtocolHistory,
} from "../state/wellness-home-store";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  lastDraft: null as ObjectiveDraft | null,
}));

// KAN-167: el orbe de Vita tiene sus propias pruebas (vita-entry.test.tsx).
vi.mock("../vita", () => ({ VitaEntry: () => null }));
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

vi.mock("@ionic/react", () => ({
  IonButton: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  IonBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonIcon: () => null,
}));

// El wizard tiene sus propios tests; aquí solo importa el contrato con la página.
vi.mock("../components/objective", () => ({
  ObjectiveWizard: ({
    draft,
    onChange,
    onGenerate,
    onExit,
  }: {
    draft: ObjectiveDraft;
    onChange: (patch: Partial<ObjectiveDraft>) => void;
    onGenerate: () => void;
    onExit: () => void;
  }) => {
    state.lastDraft = draft;
    return (
      <div data-testid="wizard">
        <span>goal:{draft.goal}</span>
        <button
          type="button"
          onClick={() =>
            onChange({
              goal: "masa",
              parq: Array(7).fill(0),
              nqs: Array(6).fill(0),
              terms: {
                version: WELLNESS_TERMS_VERSION,
                acceptedAt: new Date().toISOString(),
              },
            })
          }
        >
          elegir masa
        </button>
        <button type="button" onClick={onGenerate}>
          generar
        </button>
        <button type="button" onClick={onExit}>
          salir
        </button>
      </div>
    );
  },
}));

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localISODate(date);
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
  state.lastDraft = null;
  savePlanSnapshot({
    name: "Ana Torres",
    goal: "bajar",
    startDate: isoDaysAgo(11),
    kcal: 1570,
    proteinG: 115,
    carbsG: 160,
    fatG: 42,
    waterMl: 2500,
    totalDays: 365,
    createdAt: "2026-11-13T12:00:00.000Z",
    sex: "F",
    age: 34,
    heightCm: 165,
    weightKg: 72,
    waistCm: 84,
    targetWeightKg: 64,
    activity: 2,
    pace: "m",
    vegetarian: true,
    dairyFree: false,
  });
  saveProtocolHistory({ [isoDaysAgo(1)]: ["exercise", "diet"] });
});

describe("WellnessGoalPage (KAN-144)", () => {
  it("pide confirmación con las consecuencias y el día actual", () => {
    render(<WellnessGoalPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Cambiar objetivo" }),
    ).toBeTruthy();
    expect(screen.getByText("Objetivo actual: Bajar de peso")).toBeTruthy();
    expect(
      screen.getByText("Se genera un plan nuevo con tu objetivo actualizado."),
    ).toBeTruthy();
    expect(
      screen.getByText("Tu historial, tus puntos y tu racha se conservan."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Sigues en el día 12 de 365; el plan no vuelve a empezar.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("wizard")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(state.navigate).toHaveBeenCalledWith("prof");
  });

  it("precarga el formulario con los datos del plan vigente", () => {
    render(<WellnessGoalPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar objetivo" }));
    expect(screen.getByTestId("wizard")).toBeTruthy();
    expect(state.lastDraft).toMatchObject({
      name: "Ana Torres",
      goal: "bajar",
      sex: "F",
      age: 34,
      heightCm: 165,
      weightKg: 72,
      waistCm: 84,
      targetWeightKg: 64,
      activity: 2,
      vegetarian: true,
      terms: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "salir" }));
    expect(screen.getByText("Antes de cambiar tu objetivo")).toBeTruthy();
  });

  it("sin respuestas de seguridad no genera y avisa", () => {
    render(<WellnessGoalPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar objetivo" }));
    fireEvent.click(screen.getByRole("button", { name: "generar" }));
    expect(state.toast).toHaveBeenCalledWith(
      "Revisa lo que falta para generar tu plan.",
      "warn",
    );
    expect(loadPlanSnapshot()?.version).toBe(1);
  });

  it("genera la nueva versión, muestra qué cambió y vuelve al Home", () => {
    render(<WellnessGoalPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar objetivo" }));
    fireEvent.click(screen.getByRole("button", { name: "elegir masa" }));
    fireEvent.click(screen.getByRole("button", { name: "generar" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Tu plan se actualizó" }),
    ).toBeTruthy();
    expect(screen.getByText("Versión 2")).toBeTruthy();

    const plan = loadPlanSnapshot()!;
    expect(plan.goal).toBe("masa");
    expect(plan.startDate).toBe(isoDaysAgo(11));
    expect(loadPlanVersions()).toHaveLength(1);
    expect(loadProtocolHistory()).toEqual({
      [isoDaysAgo(1)]: ["exercise", "diet"],
    });

    const goalRow = screen
      .getByText("Objetivo")
      .closest(".wl-kpi") as HTMLElement;
    expect(within(goalRow).getByText("Subir masa muscular")).toBeTruthy();
    expect(within(goalRow).getByText("Antes: Bajar de peso")).toBeTruthy();
    const kcalRow = screen
      .getByText("Energía")
      .closest(".wl-kpi") as HTMLElement;
    expect(
      within(kcalRow).getByText(/Antes: 1570 kcal|Antes: 1\.570 kcal/),
    ).toBeTruthy();
    expect(screen.getByText("Sigues en el día 12 de 365.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ir al inicio" }));
    expect(state.navigate).toHaveBeenCalledWith("home");
  });
});
