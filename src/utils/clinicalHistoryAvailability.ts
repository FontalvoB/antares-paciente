/**
 * Disponibilidad de la Historia clínica (KAN-95).
 *
 * Regla de producto: la entrada a "Historia clínica" solo se oculta cuando el
 * backend confirmó que NO hay exámenes/mediciones, documentos ni medicamentos.
 * Mientras haya duda (carga, error, módulo deshabilitado o sesión sin perfil)
 * la entrada se conserva: ocultar por un fallo de red es peor que mostrar una
 * historia honestamente vacía.
 *
 * Función pura (sin React ni red) para poder probar la derivación por sí sola.
 * `verbatimModuleSyntax`: type imports con `import type` cuando aplique.
 */

/** Estado de una fuente clínica consultada por separado. */
export type ClinicalSourceStatus =
  "loading" | "ready" | "error" | "unavailable";

export interface ClinicalSourceState {
  status: ClinicalSourceStatus;
  /** Filas/pistas reales cuando `status === "ready"`. */
  count?: number;
}

export interface ClinicalHistorySources {
  /** Mediciones/exámenes propios (`GET /api/v1/me/measurements`). */
  exams: ClinicalSourceState;
  /** Documentos clínicos del paciente (`GET /api/v1/me/documents`). */
  documents: ClinicalSourceState;
  /** Medicamentos/nutracéuticos del paciente (módulo de medicamentos). */
  medications: ClinicalSourceState;
}

/** Resultado de la derivación (solo `empty` oculta la entrada). */
export type ClinicalHistoryAvailability =
  "loading" | "available" | "empty" | "unknown";

function hasContent(source: ClinicalSourceState): boolean {
  return source.status === "ready" && (source.count ?? 0) > 0;
}

/**
 * Deriva si la Historia clínica tiene contenido real.
 *
 * Precedencia:
 * 1. Cualquier fuente `ready` con filas → `available` (aunque otra falle).
 * 2. Alguna fuente cargando (y ninguna con filas) → `loading`.
 * 3. Alguna fuente con error o no disponible (y ninguna con filas) → `unknown`.
 * 4. Todas `ready` con 0 filas → `empty` (único caso que oculta la entrada).
 */
export function resolveClinicalHistoryAvailability(
  sources: ClinicalHistorySources,
): ClinicalHistoryAvailability {
  const states = [sources.exams, sources.documents, sources.medications];

  if (states.some(hasContent)) return "available";

  if (states.some((source) => source.status === "loading")) return "loading";

  if (
    states.some(
      (source) => source.status === "error" || source.status === "unavailable",
    )
  ) {
    return "unknown";
  }

  return "empty";
}

/** La entrada se muestra en `loading`, `available` y `unknown`. */
export function shouldShowClinicalHistory(
  availability: ClinicalHistoryAvailability,
): boolean {
  return availability !== "empty";
}
