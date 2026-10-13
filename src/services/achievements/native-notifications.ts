import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export async function enableAchievementNotifications(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  return (await LocalNotifications.requestPermissions()).display === "granted";
}
/** Aviso inmediato local tras sincronizar progreso real. No simula push del servidor. */
export async function notifyAchievement(
  title: string,
  body: string,
  isCurrent: () => boolean,
) {
  if (!Capacitor.isNativePlatform()) return;
  if (
    (await LocalNotifications.checkPermissions()).display !== "granted" ||
    !isCurrent()
  )
    return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 2147483646) + 1,
        title,
        body,
        extra: { destination: "achievements" },
      },
    ],
  });
}
