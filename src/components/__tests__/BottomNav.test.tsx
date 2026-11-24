import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ButtonHTMLAttributes } from "react";
import { BottomNav } from "../BottomNav";

const app = vi.hoisted(() => ({
  screen: "home",
  navigate: vi.fn(),
  openPanic: vi.fn(),
}));

vi.mock("../../context/AppContext", () => ({ useApp: () => app }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => (key: string) => key }));

// Playwright comprueba los botones Ionic reales y el layout responsive.
vi.mock("@ionic/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ionic/react")>()),
  IonButton: ({
    children,
    onClick,
    "aria-label": label,
    "aria-current": current,
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} aria-label={label} aria-current={current}>
      {children}
    </button>
  ),
}));

describe("BottomNav v5.1", () => {
  beforeEach(() => {
    app.screen = "home";
    vi.clearAllMocks();
  });

  it("muestra cinco acciones en orden y navega a las cuatro pantallas", () => {
    render(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Navegaci\u00f3n principal" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Inicio", "Nutrici\u00f3n", "SOS", "Ejercicio", "Perfil",
    ]);
    for (const name of ["Inicio", "Nutrici\u00f3n", "Ejercicio", "Perfil"]) {
      fireEvent.click(within(nav).getByRole("button", { name }));
    }
    expect(app.navigate.mock.calls).toEqual([
      ["home"], ["wellness-diet"], ["wellness-exercise"], ["prof"],
    ]);
  });

  it("conserva el SOS central y su nombre accesible", () => {
    render(<BottomNav />);

    fireEvent.click(screen.getByRole("button", { name: "Bot\u00f3n de p\u00e1nico" }));
    expect(app.openPanic).toHaveBeenCalledOnce();
    expect(app.navigate).not.toHaveBeenCalled();
  });

  it("marca la pesta\u00f1a activa", () => {
    app.screen = "wellness-exercise";
    render(<BottomNav />);

    expect(screen.getByRole("button", { current: "page" }).textContent).toBe("Ejercicio");
  });
});
