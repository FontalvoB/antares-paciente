/**
 * Recomendador de clubes afines al plan clínico (Fase 10 — Comunidad).
 *
 * Función pura: dada la lista de clubes y la condición objetivo del paciente
 * (p. ej. `targetCondition` del plan nutricional: "Obesidad", "Diabetes"),
 * devuelve el club más afín o `null` (sin condición, sin clubes o sin
 * coincidencia → sin insignia, degradación honesta).
 *
 * La unión sigue siendo voluntaria (Grill Me): esto solo destaca, nunca
 * inscribe.
 */

import type { Club } from "../graphql/clubs";

/** Minúsculas sin tildes para comparar condición contra clubes. */
function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Condición → categorías candidatas en orden de preferencia. */
const CONDITION_CATEGORIES: Array<{ match: RegExp; categories: string[] }> = [
  {
    match: /diabet|prediabet|glucos|azucar|hba1c/,
    categories: ["Diabetes", "Nutrición", "Salud"],
  },
  {
    match: /obesidad|sobrepeso|adelgaz|imc/,
    categories: ["Nutrición", "Deporte", "Salud"],
  },
  {
    match: /hipertens|presion|tension|corazon|cardio|colesterol/,
    categories: ["Salud", "Deporte", "Nutrición"],
  },
  {
    match: /ansiedad|estres|depres|animo|mente|sueno|insomnio|dormir/,
    categories: ["Bienestar", "Salud"],
  },
  {
    match: /movimiento|ejercicio|actividad|fisico|deporte/,
    categories: ["Deporte", "Salud"],
  },
  { match: /embaraz|gestac/, categories: ["Embarazo", "Salud"] },
  {
    match: /nutri|aliment|dieta|comida/,
    categories: ["Nutrición", "Salud"],
  },
];

export function recommendClubForCondition(
  clubs: Club[],
  condition?: string | null,
): Club | null {
  if (!condition || !condition.trim() || clubs.length === 0) return null;
  const normalized = norm(condition);

  // 1) Categoría preferida por condición (orden de la regla).
  const rule = CONDITION_CATEGORIES.find((r) => r.match.test(normalized));
  if (rule) {
    for (const category of rule.categories) {
      const wanted = norm(category);
      const found = clubs.find((c) => norm(c.category) === wanted);
      if (found) return found;
    }
  }

  // 2) Mención directa: algún token significativo de la condición aparece
  // en nombre/descripción/tags del club (p. ej. "Yoga" → club de yoga).
  const tokens = normalized.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (tokens.length > 0) {
    const found = clubs.find((c) => {
      const haystack = norm(`${c.name} ${c.description} ${c.tags.join(" ")}`);
      return tokens.some((token) => haystack.includes(token));
    });
    if (found) return found;
  }

  return null;
}
