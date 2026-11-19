/**
 * useClinicalHistoryAvailability — ¿la Historia clínica tiene contenido real?
 *
 * Compone las MISMAS fuentes que la pantalla de Historia (mediciones propias,
 * documentos y módulo de medicamentos) para que la entrada de navegación se
 * oculte solo cuando el backend confirmó que las tres están vacías (KAN-95).
 *
 * - Carga: la entrada se mantiene visible (evita parpadeo y no decide con
 *   datos parciales).
 * - Error / módulo no disponible: se mantiene visible (`unknown`); un fallo de
 *   red nunca debe esconder una sección que quizá tenga contenido.
 * - Vacío confirmado: única situación que la oculta.
 *
 * No añade endpoints: reutiliza hooks existentes y sus cachés de TanStack.
 */

import { useApp } from "../context/AppContext";
import { useDailyMedications } from "./useDailyMedications";
import { useMyDocuments } from "./useMyDocuments";
import { useMyMeasurements } from "./useMyMeasurements";
import {
  resolveClinicalHistoryAvailability,
  shouldShowClinicalHistory,
  type ClinicalHistoryAvailability,
  type ClinicalSourceState,
} from "../utils/clinicalHistoryAvailability";

export interface UseClinicalHistoryAvailabilityResult {
  availability: ClinicalHistoryAvailability;
  /** Atajo de render: false solo con vacío confirmado. */
  visible: boolean;
}

export function useClinicalHistoryAvailability(): UseClinicalHistoryAvailabilityResult {
  const { user } = useApp();
  // pageSize 1: solo interesa "hay al menos una fila", no el historial completo.
  const measurements = useMyMeasurements({ pageSize: 1 });
  const documents = useMyDocuments(user.id);
  const medications = useDailyMedications();

  const exams: ClinicalSourceState = measurements.isLoading
    ? { status: "loading" }
    : measurements.error
      ? { status: "error" }
      : { status: "ready", count: measurements.items.length };

  const documentsState: ClinicalSourceState = !user.id
    ? // Sin id de paciente la consulta ni siquiera se dispara: no se puede
      // afirmar que no haya documentos.
      { status: "unavailable" }
    : documents.loading
      ? { status: "loading" }
      : documents.error
        ? { status: "error" }
        : { status: "ready", count: documents.items.length };

  const medicationsState: ClinicalSourceState = medications.capabilityLoading
    ? { status: "loading" }
    : !medications.enabled
      ? // Módulo deshabilitado para esta cuenta: no hay verdad que afirmar.
        { status: "unavailable" }
      : medications.isLoading
        ? { status: "loading" }
        : medications.isError
          ? { status: "error" }
          : {
              status: "ready",
              count: medications.data?.treatments.length ?? 0,
            };

  const availability = resolveClinicalHistoryAvailability({
    exams,
    documents: documentsState,
    medications: medicationsState,
  });

  return {
    availability,
    visible: shouldShowClinicalHistory(availability),
  };
}
