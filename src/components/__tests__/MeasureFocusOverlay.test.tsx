import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  MeasureFocusOverlay,
  MeasureSyncOverlay,
} from "../MeasureFocusOverlay";
import { MeasureProgressCard } from "../MeasureProgressCard";
import type { MeasurePhase } from "../../utils/measure";

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => (key: string) => key,
}));

// El overlay Stencil no presenta hijos en happy-dom: se sustituye por un div
// cuando isOpen (patrón de NutritionPage.test), verificando cableado + estados.
vi.mock("@ionic/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ionic/react")>();
  return {
    ...actual,
    IonModal: ({
      children,
      isOpen,
    }: {
      children: ReactNode;
      isOpen?: boolean;
    }) => (isOpen ? <div data-testid="test-ion-modal">{children}</div> : null),
    IonContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

const phase: MeasurePhase = {
  progress: 0.4,
  phase: "measuring",
  remainingMs: 18_000,
  windowMs: 30_000,
  expectedMs: 12_000,
};

const base = {
  kind: "heart_rate" as const,
  phase,
  elapsedSec: 12,
  liveValue: "72",
  liveUnit: "lpm",
  steps: [{ kind: "heart_rate" as const, state: "active" as const }],
  queue: 0,
  onCancel: vi.fn(),
  onRetry: vi.fn(),
  onClose: vi.fn(),
};

describe("MeasureFocusOverlay", () => {
  it("midiendo muestra fase, valor en vivo, pasos y Cancelar", () => {
    const onCancel = vi.fn();
    render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId("test-ion-modal")).not.toBeNull();
    expect(screen.getByText("72")).not.toBeNull();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cerrado no presenta nada", () => {
    render(<MeasureFocusOverlay {...base} isOpen={false} result={null} />);
    expect(screen.queryByTestId("test-ion-modal")).toBeNull();
  });

  it("al llegar la lectura la tarjeta va al 100 % sin cambiar de vista", () => {
    const { container } = render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        complete
        onCancel={vi.fn()}
      />,
    );
    // Sigue la vista de medición (hay Cancelar, no resumen) con barra llena.
    expect(screen.getByText("Cancelar")).not.toBeNull();
    expect(container.querySelector(".mfocus-summary-row")).toBeNull();
    const bar = container.querySelector(
      ".measure-card.is-bare [role='progressbar']",
    );
    expect(bar?.getAttribute("aria-valuenow")).toBe("100");
  });

  it("fallo muestra el mensaje con Reintentar y Cerrar", () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={{ ok: false, kind: "spo2", message: "Sin señal" }}
        onRetry={onRetry}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Sin señal")).not.toBeNull();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(onRetry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Cerrar"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("modo bare de la tarjeta: solo mensaje, % y barra (sin orbe ni pie)", () => {
    const { container } = render(
      <MeasureProgressCard
        kind="heart_rate"
        phase={phase}
        elapsedSec={12}
        bare
      />,
    );
    expect(screen.getByText("Midiendo {metric}…")).not.toBeNull();
    expect(container.querySelector(".measure-orb")).toBeNull();
    expect(container.querySelector(".measure-foot")).toBeNull();
    expect(container.querySelector(".measure-copy")).toBeNull();
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute("aria-valuenow")).toBe("40");
  });
});

describe("MeasureFocusOverlay — visuales por métrica", () => {
  it("FC muestra ECG y el icono late al ritmo medido", () => {
    const { container } = render(
      <MeasureFocusOverlay {...base} isOpen result={null} />,
    );
    expect(container.querySelector("canvas")).not.toBeNull();
    const icon = container.querySelector(".mfocus-bigico ion-icon");
    expect(icon?.getAttribute("style") ?? "").toContain("0.83s");
  });

  it("FC sin lectura: ECG plano y ritmo de reposo", () => {
    const { container } = render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        liveValue={null}
        liveUnit=""
      />,
    );
    expect(container.querySelector("canvas")).not.toBeNull();
    const icon = container.querySelector(".mfocus-bigico ion-icon");
    expect(icon?.getAttribute("style") ?? "").toContain("1.00s");
  });

  it("SpO2 muestra la gota con tres burbujas", () => {
    const { container } = render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        kind="spo2"
        liveValue={null}
        liveUnit="%"
      />,
    );
    expect(container.querySelector("svg.mmo-spo2")).not.toBeNull();
    expect(container.querySelectorAll(".mmo-spo2 .mmo-bubble").length).toBe(3);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("presión muestra la onda", () => {
    const { container } = render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        kind="blood_pressure"
        liveValue={null}
        liveUnit="mmHg"
      />,
    );
    expect(container.querySelector("svg.mmo-bp path")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });
});

describe("MeasureFocusOverlay — valores en su lugar, sin vista de resumen", () => {
  const stepsWithValues = [
    {
      kind: "heart_rate" as const,
      state: "done" as const,
      value: "72",
      unit: "lpm",
    },
    {
      kind: "spo2" as const,
      state: "done" as const,
      value: "98",
      unit: "%",
    },
    { kind: "blood_pressure" as const, state: "active" as const },
  ];

  it("el paso hecho muestra su número en lugar de la etiqueta", () => {
    const { container } = render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        kind="blood_pressure"
        liveValue={null}
        liveUnit="mmHg"
        steps={stepsWithValues}
      />,
    );
    // Sin fila separada: los valores viven dentro de sus pasos.
    expect(container.querySelector(".mfocus-tray")).toBeNull();
    const doneStep = container.querySelector(".mfocus-step.is-done");
    expect(doneStep?.textContent).toContain("72");
    expect(doneStep?.textContent).not.toContain("FC");
  });

  it("la tira acumula los valores sin pantalla de resumen", () => {
    const { container } = render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        kind="blood_pressure"
        liveValue={null}
        liveUnit="mmHg"
        steps={stepsWithValues}
        onCancel={vi.fn()}
      />,
    );
    // Los valores viven dentro de sus pasos; no hay resumen aparte.
    expect(container.querySelector(".mfocus-summary-row")).toBeNull();
    const doneSteps = container.querySelectorAll(".mfocus-step.is-done");
    expect(doneSteps.length).toBe(2);
    expect(doneSteps[0]?.textContent).toContain("72");
    expect(doneSteps[1]?.textContent).toContain("98");
  });

  it("el paso activo con valor comparte el número en vivo (vuelo)", () => {
    const { container } = render(
      <MeasureFocusOverlay
        {...base}
        isOpen
        result={null}
        kind="heart_rate"
        liveValue="72"
        liveUnit="lpm"
        steps={[
          {
            kind: "heart_rate" as const,
            state: "active" as const,
            value: "72",
            unit: "lpm",
          },
        ]}
        onCancel={vi.fn()}
      />,
    );
    // El número grande y el del paso coexisten: el layoutId compartido los
    // anima de uno al otro.
    const hits = Array.from(
      container.querySelectorAll(".mfocus-live strong, .mfocus-step strong"),
    ).filter((el) => el.textContent === "72");
    expect(hits.length).toBe(2);
  });
});

describe("MeasureSyncOverlay", () => {
  it("muestra la fase de volcado con Cancelar funcional", () => {
    const onCancel = vi.fn();
    render(<MeasureSyncOverlay isOpen onCancel={onCancel} />);
    expect(screen.getByText("Sincronizando historial…")).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Progreso de la sincronización"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cerrado no presenta nada", () => {
    render(<MeasureSyncOverlay isOpen={false} onCancel={vi.fn()} />);
    expect(screen.queryByText("Sincronizando historial…")).toBeNull();
  });
});
