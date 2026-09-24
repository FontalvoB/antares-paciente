import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({ t: (key: string) => key, lang: "es" as const }),
}));

import {
  AchievementCard,
  hydrationAchievement,
  streakAchievement,
} from "../AchievementCard";
import type { Achievement } from "../AchievementCard";

const achievement: Achievement = {
  kind: "streak",
  title: "Racha de 7 días",
  message: "¡7 días seguidos protegiendo tu protocolo!",
  xp: 150,
};

describe("AchievementCard", () => {
  it("renderiza medalla, título, mensaje y XP", () => {
    render(<AchievementCard achievement={achievement} />);

    expect(
      screen.getByRole("article", { name: "Racha de 7 días" }),
    ).toBeTruthy();
    expect(
      screen.getByText("¡7 días seguidos protegiendo tu protocolo!"),
    ).toBeTruthy();
    expect(screen.getByText("+150 XP")).toBeTruthy();
  });

  it("sin onShare no muestra botón de compartir", () => {
    render(<AchievementCard achievement={achievement} />);

    expect(screen.queryByLabelText("Compartir")).toBeNull();
  });

  it("con onShare publica el logro al pulsar Compartir", () => {
    const onShare = vi.fn();
    render(<AchievementCard achievement={achievement} onShare={onShare} />);

    // ion-button es un web component sin rol button implícito en happy-dom:
    // se localiza por aria-label (patrón de ChatPage.test.tsx).
    fireEvent.click(screen.getByLabelText("Compartir"));
    expect(onShare).toHaveBeenCalledWith(achievement);
  });
});

describe("streakAchievement / hydrationAchievement", () => {
  it("construye el hito de racha con días y XP", () => {
    expect(streakAchievement(7, 150)).toEqual({
      kind: "streak",
      title: "Racha de 7 días",
      message: "¡7 días seguidos protegiendo tu protocolo!",
      xp: 150,
    });
  });

  it("construye el hito de hidratación con su XP", () => {
    expect(hydrationAchievement(50)).toEqual({
      kind: "hydration",
      title: "Meta de hidratación alcanzada",
      message: "8 vasos hoy: tu cuerpo lo agradece.",
      xp: 50,
    });
  });
});
