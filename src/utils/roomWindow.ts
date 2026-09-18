/**
 * Ventana de acceso a la sala virtual de una cita. `roomOpensAt`/`roomClosesAt`
 * viajan en la lista de citas del paciente (GET /api/v1/appointments/mine);
 * mientras el backend no los exponga el estado es "unknown" y la UI NO bloquea
 * la entrada (evita dejar al paciente fuera por un campo aún no desplegado).
 */

export type RoomWindowState = "before" | "open" | "after" | "unknown";

/** Estado de la ventana en un instante dado. Puro y determinista. */
export function roomWindowState(
  now: number | Date,
  opensAt?: string | null,
  closesAt?: string | null,
): RoomWindowState {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const openMs = parseMoment(opensAt);
  const closeMs = parseMoment(closesAt);

  if (openMs === null && closeMs === null) return "unknown";
  if (openMs !== null && nowMs < openMs) return "before";
  if (closeMs !== null && nowMs >= closeMs) return "after";
  return "open";
}

/** Epoch ms de una fecha ISO; null si falta, no es válida o no se pudo parsear. */
function parseMoment(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Fecha/hora local corta para los avisos ("15/09, 14:30"). "" si no hay dato. */
export function formatRoomMoment(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
