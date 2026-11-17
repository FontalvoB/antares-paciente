import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthSubmitButton } from "../AuthSubmitButton";

vi.mock("@ionic/react", () => ({
  IonButton: ({
    children,
    type,
    className,
    disabled,
    onClick,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    type?: "button" | "submit";
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    "aria-label"?: string;
  }) => (
    <button
      type={type ?? "button"}
      className={className}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
  IonIcon: () => null,
  IonSpinner: () => <span data-testid="spinner" />,
}));

afterEach(cleanup);

describe("AuthSubmitButton", () => {
  it("ejecuta la acción explícita con la etiqueta visible", () => {
    const onAct = vi.fn();
    render(
      <AuthSubmitButton
        label="Confirmar identidad"
        busyLabel="Buscando…"
        busy={false}
        icon="shield"
        onAct={onAct}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar identidad" }),
    );
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("durante el envío muestra el progreso, bloquea el clic y se anuncia", () => {
    const onAct = vi.fn();
    render(
      <AuthSubmitButton
        label="Verificar y entrar"
        busyLabel="Verificando…"
        busy
        icon="lock"
        onAct={onAct}
      />,
    );

    const button = screen.getByRole("button", { name: "Verificando…" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).toContain("is-busy");
    expect(screen.getByTestId("spinner")).toBeTruthy();

    fireEvent.click(button);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("sin acción válida se ve inactivo, sin spinner ni invitación a pulsar", () => {
    render(
      <AuthSubmitButton
        label="Verificar y entrar"
        busyLabel="Verificando…"
        busy={false}
        disabled
        icon="lock"
      />,
    );

    const button = screen.getByRole("button", { name: "Verificar y entrar" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).toContain("is-disabled");
    expect(screen.queryByTestId("spinner")).toBeNull();
  });
});
