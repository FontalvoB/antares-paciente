import type { AvailabilitySlotDto } from "./appointmentsApi";

/**
 * Estado visible de la sección de horarios del Paso 2 del wizard de
 * agendamiento. Extraído como función pura para poder testear la regla
 * (QA TestFlight 2026-10-02: la ventana sin cupo y el rango fallido
 * giraban indefinidamente en el spinner de búsqueda).
 */
export type AvailabilityViewState =
  | "loading" // rango o día en curso → spinner
  | "empty" // ventana de 14 días escaneada sin ningún cupo → estado vacío guiado
  | "error" // la consulta falló → tarjeta de error con Reintentar
  | "chooseDay" // sin fecha y sin rango en caché (contrato days[] completo)
  | "slots"; // fecha con datos → lista de horarios (puede quedar vacía por día)

/**
 * Resuelve el estado de la sección en ORDEN DE PRIORIDAD:
 * 1. Cargas en curso (rango o día) → `loading`.
 * 2. Rango completado sin ningún `isAvailable` en los 14 días y sin error →
 *    `empty` (resultado vacío real, nunca un spinner).
 * 3. Error de red/servidor → `error` (aunque `date` esté vacío: el rango
 *    fallido debe mostrar su error, no un placeholder neutro).
 * 4. Sin fecha elegible residual → `chooseDay`.
 * 5. Fecha elegida → `slots`.
 */
export function availabilityViewState(
  probing: boolean,
  dayLoading: boolean,
  dayError: string | null | undefined,
  date: string | "" | undefined,
  daySlots: Record<string, AvailabilitySlotDto[]>,
): AvailabilityViewState {
  if (probing || dayLoading) {
    return "loading";
  }

  if (dayError) {
    return "error";
  }

  if (!date) {
    const hasCache = Object.keys(daySlots).length > 0;
    const anyAvailable = Object.values(daySlots).some((slots) =>
      slots.some((s) => s.isAvailable),
    );
    // Ventana escaneada completa sin cupo → estado vacío explícito.
    if (hasCache && !anyAvailable) {
      return "empty";
    }
    return "chooseDay";
  }

  return "slots";
}
