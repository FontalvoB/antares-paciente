import { flash, medkit } from "ionicons/icons";

/**
 * Punto de entrada directa de solicitud de cita (Decisión 5, REQ-APP-02).
 *
 * El Paso 1 del wizard ofrece ÚNICAMENTE estas especialidades; Nutrición,
 * Psicología y demás NO son entrada directa (acceso por remisión médica
 * tras la cita de Medicina General; el ERP conserva la visión completa).
 *
 * Fuente declarativa ÚNICA de la política: los códigos se comparan por
 * igualdad exacta contra el `code` del catálogo (`erp.specialties`) — sin
 * regex, sin coincidencia por nombre y sin lógica posicional. Cuando el
 * backend exponga la marca de entrada directa en `SpecialtyDto`, esta lista
 * se retira y el adapter filtra por ese campo (follow-up exec-backend).
 */
export const DIRECT_ENTRY_SPECIALTY_CODES: readonly string[] = [
  "FAMILY_MEDICINE",
  "URGENT_CARE",
];

export type EntryTone = "teal" | "org";

/**
 * Presentación distintiva por código de entrada (Paso 1 del wizard):
 * título en español (clave i18n), descripción corta, icono Ionicons y tono
 * de marca. Sin esta entrada, la tarjeta usa el nombre del catálogo y la
 * estética rotativa genérica (fallback).
 */
export interface EntryPointDisplay {
  titleKey: string;
  descKey: string;
  kickerKey: string;
  icon: string;
  tone: EntryTone;
  /** Muestra el aviso de SOS bajo la tarjeta (solo urgencia). */
  sosNote: boolean;
}

export const DIRECT_ENTRY_DISPLAY: Record<string, EntryPointDisplay> = {
  FAMILY_MEDICINE: {
    titleKey: "Medicina General",
    descKey: "Control y prevención",
    kickerKey: "Consulta",
    icon: medkit,
    tone: "teal",
    sosNote: false,
  },
  URGENT_CARE: {
    titleKey: "Urgencia",
    descKey: "Atención prioritaria",
    kickerKey: "Prioritaria",
    icon: flash,
    tone: "org",
    sosNote: true,
  },
};
