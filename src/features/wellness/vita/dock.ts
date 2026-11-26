/**
 * Preferencias locales del orbe de Vita (KAN-167).
 *
 * - `wellness.vita.dock.v1`: "minimized" | "expanded" — comodidad por
 *   dispositivo, sin datos personales.
 * - `wellness.vita.nudge.v2:<espacio opaco de la cuenta>`: fecha local
 *   (aaaa-mm-dd) del último aviso proactivo, como máximo uno al día. Sin
 *   cuenta verificable no se muestra (no hay fallback compartido).
 *
 * Todo acceso va en try/catch: sin almacenamiento el orbe funciona igual.
 */

export const VITA_DOCK_KEY = "wellness.vita.dock.v1";
export const VITA_NUDGE_PREFIX = "wellness.vita.nudge.v2";

export function readVitaMinimized(): boolean {
  try {
    return localStorage.getItem(VITA_DOCK_KEY) === "minimized";
  } catch {
    return false;
  }
}

export function writeVitaMinimized(minimized: boolean): void {
  try {
    localStorage.setItem(VITA_DOCK_KEY, minimized ? "minimized" : "expanded");
  } catch {
    // Preferencia visual: si no se guarda, el orbe vuelve a su estado por defecto.
  }
}

/** Fecha local aaaa-mm-dd (no UTC: el aviso es "por día local"). */
export function localDay(now = new Date()): string {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function nudgeKey(namespace: string): string {
  return `${VITA_NUDGE_PREFIX}:${namespace}`;
}

/** `true` si hoy (día local) aún no se mostró el aviso proactivo. */
export function shouldShowVitaNudge(namespace: string | null, now = new Date()): boolean {
  if (!namespace) return false;
  try {
    return localStorage.getItem(nudgeKey(namespace)) !== localDay(now);
  } catch {
    return false;
  }
}

/** Marca el aviso de hoy como mostrado (se marca al mostrarse, no al cerrarse). */
export function markVitaNudgeShown(namespace: string | null, now = new Date()): void {
  if (!namespace) return;
  try {
    localStorage.setItem(nudgeKey(namespace), localDay(now));
  } catch {
    // Sin almacenamiento no se insiste: `shouldShowVitaNudge` devuelve false.
  }
}
