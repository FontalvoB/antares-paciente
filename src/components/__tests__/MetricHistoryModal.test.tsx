import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode, Ref } from "react";
import { describe, expect, it, vi } from "vitest";
import { MetricHistoryModal } from "../MetricHistoryModal";
import type { HomeMetricCard } from "../../data/metrics";
import { I18nProvider } from "../../i18n/I18nContext";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("../../context/AppContext", () => ({ useApp: () => ({ navigate }) }));
vi.mock("@ionic/react", async (importOriginal) => {
  const ionic = await importOriginal<typeof import("@ionic/react")>();
  const { useImperativeHandle } = await import("react");
  return {
    ...ionic,
    IonModal: ({ children, isOpen, onDidDismiss, ref }: {
      children: ReactNode;
      isOpen: boolean;
      onDidDismiss: (event: CustomEvent<{ role?: string }>) => void;
      ref: Ref<{ dismiss: (data: unknown, role: string) => Promise<boolean> }>;
    }) => {
      useImperativeHandle(ref, () => ({
        async dismiss(_data, role) {
          onDidDismiss(new CustomEvent("ionModalDidDismiss", { detail: { role } }));
          return true;
        },
      }));
      return isOpen ? <div role="dialog">{children}</div> : null;
    },
  };
});

describe("MetricHistoryModal · referencias", () => {
  it.each([
    ["imc", "IMC", "imc"],
    ["hba1c", "HbA1c", "hba1c"],
    ["fat", "% de grasa", "fat"],
    ["adh", "Adherencia", "adherence"],
    ["pts", "Puntos", "adherence"],
  ] as const)("abre las fuentes de %s al cerrarse el modal", (id, label, section) => {
    const card: HomeMetricCard = {
      id,
      label,
      color: "var(--blue)",
      decimals: 1,
      unit: id === "imc" ? "kg/m²" : "",
      kind: "value",
      current: 28.4,
      progress: null,
      target: null,
      points: [],
      first: null,
      last: null,
    };
    const onClose = vi.fn();
    render(<I18nProvider><MetricHistoryModal card={card} onClose={onClose} /></I18nProvider>);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: label })).toBeTruthy();
    fireEvent.click(screen.getByText("Ver fuentes"));

    expect(onClose).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("medical-sources", section);
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });
});
