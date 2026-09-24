import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MealLoggedPanel } from "../MealLoggedPanel";

vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "es",
    toggleLang: vi.fn(),
    t: (key: string) => key,
  }),
  useT: () => (key: string) => key,
}));

describe("MealLoggedPanel — estado registrado de la comida", () => {
  it("manual muestra check, hora del log y botones de detalle/edición", () => {
    const onDetail = vi.fn();
    const onEdit = vi.fn();
    render(
      <MealLoggedPanel
        source="manual"
        createdAt="2026-09-24T08:30:00.000Z"
        onDetail={onDetail}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("Registrado manualmente")).toBeTruthy();
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeTruthy();
    fireEvent.click(screen.getByText("Ver detalle"));
    fireEvent.click(screen.getByText("Editar comida"));
    expect(onDetail).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("ai_photo muestra el estado con foto", () => {
    render(
      <MealLoggedPanel
        source="ai_photo"
        createdAt={null}
        onDetail={() => {}}
        onEdit={() => {}}
      />,
    );

    expect(screen.getByText("Registrado con foto · análisis IA")).toBeTruthy();
  });

  it("sin fuente muestra el registrado genérico", () => {
    render(
      <MealLoggedPanel
        source={null}
        createdAt="no-es-fecha"
        onDetail={() => {}}
        onEdit={() => {}}
      />,
    );

    expect(screen.getByText("Registrado")).toBeTruthy();
    // Fecha inválida → sin hora inventada.
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull();
  });
});
