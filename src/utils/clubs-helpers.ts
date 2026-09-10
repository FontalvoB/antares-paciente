// Helpers de presentación del módulo de Clubes (app).

export const CLUB_CATEGORIES = [
  "Salud",
  "Deporte",
  "Bienestar",
  "Nutrición",
  "Embarazo",
  "Diabetes",
  "Adultos mayores",
  "Empresas",
  "Hobbies",
] as const;

export const CATEGORY_GRADIENTS: Record<string, string> = {
  Salud: "linear-gradient(135deg, #0ea5e9, #1d4ed8)",
  Deporte: "linear-gradient(135deg, #22c55e, #15803d)",
  Bienestar: "linear-gradient(135deg, #a78bfa, #6d28d9)",
  Nutrición: "linear-gradient(135deg, #f59e0b, #b45309)",
  Embarazo: "linear-gradient(135deg, #ec4899, #9d174d)",
  Diabetes: "linear-gradient(135deg, #06b6d4, #0e7490)",
  "Adultos mayores": "linear-gradient(135deg, #64748b, #334155)",
  Empresas: "linear-gradient(135deg, #6366f1, #4338ca)",
  Hobbies: "linear-gradient(135deg, #f97316, #c2410c)",
};

export function coverGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Salud;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatRelative(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  return new Date(isoDate).toLocaleDateString();
}

export function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  return (
    d.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
  );
}
