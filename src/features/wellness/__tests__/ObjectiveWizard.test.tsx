import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ObjectiveWizard } from "../components/objective/ObjectiveWizard";
import { EMPTY_OBJECTIVE_DRAFT, WELLNESS_TERMS_VERSION } from "../domain/draft";
import type { ObjectiveDraft } from "../domain/types";

vi.mock("../../../i18n/I18nContext", async () => {
  const { default: english } = await import("../../../i18n/en.json");
  const t = (key: string, params?: Record<string, string>) => {
    let text = (english as Record<string, string>)[key] ?? key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, value);
    }
    return text;
  };
  return { useT: () => t, useI18n: () => ({ t, lang: "en" as const }) };
});

vi.mock("@ionic/react", () => ({
  IonButton: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
  }) => (
    <button type={type ?? "button"} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  IonInput: ({
    label,
    value,
    onIonInput,
    "data-wl-field": dataField,
  }: {
    label?: string;
    value?: string;
    onIonInput?: (event: { detail: { value: string } }) => void;
    "data-wl-field"?: string;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        data-wl-field={dataField}
        value={value ?? ""}
        onChange={(event) =>
          onIonInput?.({ detail: { value: event.target.value } })
        }
      />
    </label>
  ),
  IonCheckbox: ({
    checked,
    onIonChange,
    children,
    "data-wl-field": dataField,
  }: {
    checked?: boolean;
    onIonChange?: (event: { detail: { checked: boolean } }) => void;
    children?: ReactNode;
    "data-wl-field"?: string;
  }) => (
    <label>
      <input
        type="checkbox"
        data-wl-field={dataField}
        checked={checked ?? false}
        onChange={(event) =>
          onIonChange?.({ detail: { checked: event.target.checked } })
        }
      />
      {children}
    </label>
  ),
  IonBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonIcon: () => null,
  IonSpinner: () => null,
  IonProgressBar: () => null,
}));

const complete: ObjectiveDraft = {
  ...EMPTY_OBJECTIVE_DRAFT,
  email: "ana@example.com",
  name: "Ana",
  goal: "bajar",
  sex: "F",
  age: 34,
  heightCm: 165,
  weightKg: 72,
  waistCm: 82,
  targetWeightKg: 65,
  activity: 2,
  pace: "m",
  parq: [0, 0, 0, 0, 0, 0, 0],
  nqs: [0, 0, 0, 0, 0, 0],
  terms: {
    version: WELLNESS_TERMS_VERSION,
    acceptedAt: "2026-11-24T15:00:00.000Z",
  },
};

const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

function walkToGenerate() {
  for (let step = 0; step < 7; step += 1) next();
}

beforeEach(() => cleanup());

describe("ObjectiveWizard (KAN-136)", () => {
  it("muestra los 8 pasos con progreso accesible", () => {
    render(
      <ObjectiveWizard
        draft={complete}
        onChange={vi.fn()}
        gate={{ ok: true, issues: [] }}
        generating={false}
        onGenerate={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Your goal",
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "1",
    );
    expect(screen.getByText("Step 1 of 8")).toBeTruthy();
  });

  it("recorre los 8 pasos y permite generar con la compuerta aprobada", () => {
    const onGenerate = vi.fn();
    render(
      <ObjectiveWizard
        draft={complete}
        onChange={vi.fn()}
        gate={{ ok: true, issues: [] }}
        generating={false}
        onGenerate={onGenerate}
        onExit={vi.fn()}
      />,
    );
    walkToGenerate();
    expect(screen.getByText("Review your choices")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Generate my plan" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("exige confirmar la consulta cuando hay un Sí en PAR-Q", () => {
    const onChange = vi.fn();
    const draft = {
      ...complete,
      parq: [1, 0, 0, 0, 0, 0, 0] as ObjectiveDraft["parq"],
      doctorConfirmed: false,
    };
    render(
      <ObjectiveWizard
        draft={draft}
        onChange={onChange}
        gate={{ ok: true, issues: [] }}
        generating={false}
        onGenerate={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    for (let step = 0; step < 4; step += 1) next();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Exercise safety",
    );
    expect(screen.getByText("Consult your health professional first")).toBeTruthy();

    next();
    expect(screen.getByRole("alert").textContent).toContain(
      "One of your exercise safety answers requires",
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Exercise safety",
    );

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith({ doctorConfirmed: true });
  });

  it("avisa del IMC bajo y deja cambiar el objetivo", () => {
    const draft = {
      ...complete,
      weightKg: 45,
      heightCm: 170,
      targetWeightKg: 42,
    };
    render(
      <ObjectiveWizard
        draft={draft}
        onChange={vi.fn()}
        gate={{ ok: true, issues: [] }}
        generating={false}
        onGenerate={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    next();
    expect(screen.getByRole("alert").textContent).toContain(
      "With your current BMI, a weight loss or definition goal is not recommended.",
    );
  });
});
