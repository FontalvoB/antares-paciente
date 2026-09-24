/**
 * Tarjeta visual de logro para compartir hitos del programa en el feed
 * (Fase 10 — Comunidad, "Compartir Logros").
 *
 * Componente de dominio presentacional: medalla según el tipo de hito,
 * título, mensaje conmemorativo y XP ganado. Los textos `title`/`message`
 * llegan localizados desde el llamador (pueden incluir conteos dinámicos
 * que no existen como claves de diccionario); el cromo propio ("Compartir")
 * usa `t()` + `es.json`/`en.json` (skill `i18n-translations`).
 *
 * El botón Compartir solo aparece con `onShare`: la publicación real en el
 * feed se integra cuando `PostCard` libere su rediseño (front-artisan).
 */

import { IonButton, IonIcon } from "@ionic/react";
import {
  fitnessOutline,
  flame,
  leafOutline,
  shareOutline,
  trophy,
  water,
} from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";

export type AchievementKind =
  "streak" | "hydration" | "nutrition" | "exercise" | "custom";

export interface Achievement {
  kind: AchievementKind;
  /** Título display-ready (localizado por el llamador). */
  title: string;
  /** Mensaje conmemorativo display-ready (localizado por el llamador). */
  message: string;
  /** XP ganado con el hito. */
  xp: number;
}

const KIND_ICON: Record<AchievementKind, string> = {
  streak: flame,
  hydration: water,
  nutrition: leafOutline,
  exercise: fitnessOutline,
  custom: trophy,
};

const KIND_GRADIENT: Record<AchievementKind, string> = {
  streak: "linear-gradient(135deg, #f97316, #c2410c)",
  hydration: "linear-gradient(135deg, #06b6d4, #0e7490)",
  nutrition: "linear-gradient(135deg, #f59e0b, #b45309)",
  exercise: "linear-gradient(135deg, #22c55e, #15803d)",
  custom: "linear-gradient(135deg, #a78bfa, #6d28d9)",
};

export function AchievementCard({
  achievement,
  onShare,
}: {
  achievement: Achievement;
  /** Al compartir: el llamador publica en el feed (Fase 10, Task 2.4). */
  onShare?: (achievement: Achievement) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="article"
      aria-label={achievement.title}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: 20,
        border: "1px solid var(--ion-color-light-shade)",
        background: "var(--ion-background-color)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 52,
          height: 52,
          flexShrink: 0,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: KIND_GRADIENT[achievement.kind],
        }}
      >
        <IonIcon
          icon={KIND_ICON[achievement.kind]}
          style={{ fontSize: 26, color: "#fff" }}
        />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 900, margin: "0 0 2px" }}>
          {achievement.title}
        </p>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ion-color-medium)",
            margin: "0 0 6px",
            lineHeight: 1.45,
          }}
        >
          {achievement.message}
        </p>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 900,
            color: "#fff",
            background: "var(--ion-color-primary)",
            padding: "3px 10px",
            borderRadius: 99,
          }}
        >
          +{achievement.xp} XP
        </span>
      </div>
      {onShare && (
        <IonButton
          size="small"
          shape="round"
          aria-label={t("Compartir")}
          onClick={() => onShare(achievement)}
        >
          <IonIcon icon={shareOutline} slot="start" />
          {t("Compartir")}
        </IonButton>
      )}
    </div>
  );
}

/**
 * Hito de racha del programa (Fase 5 → feed). Textos fuente en español
 * (idioma fuente del proyecto); el llamador los envuelve con `t()` con
 * placeholders si necesita inglés.
 */
export function streakAchievement(
  streakDays: number,
  xpAwarded: number,
): Achievement {
  return {
    kind: "streak",
    title: `Racha de ${streakDays} días`,
    message: `¡${streakDays} días seguidos protegiendo tu protocolo!`,
    xp: xpAwarded,
  };
}

/** Hito de hidratación (8 vasos / 2L del día). */
export function hydrationAchievement(xpAwarded: number): Achievement {
  return {
    kind: "hydration",
    title: "Meta de hidratación alcanzada",
    message: "8 vasos hoy: tu cuerpo lo agradece.",
    xp: xpAwarded,
  };
}
