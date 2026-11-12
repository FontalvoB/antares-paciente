import type { Screen } from "../types";

/** Desactivado por defecto; conserva la implementación para una futura reactivación. */
export const APPOINTMENTS_ENABLED =
  import.meta.env.VITE_APPOINTMENTS_ENABLED === "true";
export function visibleScreen(screen: Screen): Screen {
  return !APPOINTMENTS_ENABLED && (screen === "book" || screen === "room")
    ? "nut"
    : screen;
}
export function isAppointmentNotification(type: string): boolean {
  return /^(appointment|telemedicine|telemedicina)[_.-]/i.test(type);
}
export function isAppointmentAction(type: string, label: string): boolean {
  return /appointment|telemedicine|telemedicina|\bcitas?\b|\bagendar\b|\bschedule\b|\breschedule\b/i.test(
    `${type} ${label}`,
  );
}
function isAppointmentDestination(value: string): boolean {
  let decoded = value;
  for (let pass = 0; pass < 2; pass++) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }
  return /(?:^|[/?#=&])(?:appointments?|telemedicine|telemedicina|citas?|book|room)(?=$|[/?#=&_.-])/i.test(
    decoded,
  );
}
/** Solo oculta enlaces de navegación; no modifica mensajes guardados ni consejo clínico. */
export function appointmentLinksForDisplay(text: string): string {
  if (APPOINTMENTS_ENABLED) return text;
  return text
    .replace(
      /\[([^\]]+)\]\(([^\s)]+)\)/g,
      (link, _label: string, href: string) =>
        isAppointmentDestination(href) ? "" : link,
    )
    .replace(/https?:\/\/[^\s<>]+/g, (href) =>
      isAppointmentDestination(href) ? "" : href,
    );
}
