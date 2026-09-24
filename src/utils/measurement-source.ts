import {
  bluetoothOutline,
  flaskOutline,
  medkitOutline,
  personOutline,
} from "ionicons/icons";

/**
 * Origen de una medición → etiqueta humana (clave t()).
 *
 * El contrato documenta `device | patient | professional | lab`, pero en la
 * práctica llegan alias clínicos (`seed-hist`, `provider`, `clinic`): todos
 * describen una toma en consulta y se agrupan bajo "Consulta médica".
 * Separación marca/presentación (PROMPT_CONTINUA §5): el crudo del backend
 * nunca se renombra, solo su etiqueta visible.
 */
export const SOURCE_LABEL_KEYS: Record<string, string> = {
  device: "Dispositivo",
  lab: "Laboratorio",
  patient: "Autorreporte",
  professional: "Consulta médica",
  provider: "Consulta médica",
  clinic: "Consulta médica",
  "seed-hist": "Consulta médica",
  seed_hist: "Consulta médica",
};

/** Chip pastel + mini-ícono por origen (clases `.hc-src-*` en global.css). */
export const SOURCE_META: Record<string, { className: string; icon: string }> =
  {
    device: { className: "hc-src-device", icon: bluetoothOutline },
    lab: { className: "hc-src-lab", icon: flaskOutline },
    patient: { className: "hc-src-patient", icon: personOutline },
    professional: { className: "hc-src-prof", icon: medkitOutline },
    provider: { className: "hc-src-prof", icon: medkitOutline },
    clinic: { className: "hc-src-prof", icon: medkitOutline },
    "seed-hist": { className: "hc-src-prof", icon: medkitOutline },
    seed_hist: { className: "hc-src-prof", icon: medkitOutline },
  };

/** Normaliza el crudo del backend antes de buscar etiqueta o chip. */
export function normalizeSource(source: string): string {
  return source.trim().toLowerCase();
}
