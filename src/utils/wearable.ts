// Etiquetas compartidas de los datos del wearable (Reloj y Programa).

type Translate = (source: string, params?: Record<string, string>) => string;

/** "En vivo" / "Hace X min" / "Hace X h" a partir de la marca de la muestra. */
export function agoLabel(ts: number | undefined, t: Translate): string {
  if (!ts) return t("Sin datos aún");
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (minutes < 2) return t("En vivo");
  if (minutes < 60) return t("Hace {min} min", { min: String(minutes) });
  return t("Hace {h} h", { h: String(Math.round(minutes / 60)) });
}

/** Minutos de sueño → "7 h 15 min" ("7 h" si los minutos son exactos). */
export function formatSleep(minutes: number, t: Translate): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return t("{min} min", { min: String(m) });
  if (m === 0) return t("{h} h", { h: String(h) });
  return t("{h} h {min} min", { h: String(h), min: String(m) });
}
