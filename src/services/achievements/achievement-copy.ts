import type { EarnedAchievement } from "./achievement-store";
type T = (key: string, params?: Record<string, string>) => string;
export function achievementCopy(item: EarnedAchievement, t: T) {
  const title =
    item.kind === "streak"
      ? t("{days} días de constancia", { days: String(item.value) })
      : item.kind === "day"
        ? t("Un día completo para mí")
        : t("Un paso más, un logro más");
  const message =
    item.kind === "streak"
      ? t("He ganado un logro de racha en mi programa.")
      : item.kind === "day"
        ? t("Completé las actividades de mi programa de hoy.")
        : t("Completé una actividad de mi programa. Cada paso cuenta.");
  return {
    title,
    message,
    caption: `${title} ✨\n${message}\n#CoppAdresd #MiConstancia`,
  };
}
