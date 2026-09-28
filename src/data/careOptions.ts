import { flash, leaf, medkit, sparkles } from "ionicons/icons";
import type {
  ProfessionalCatalogItem,
  SpecialtyDto,
} from "../utils/appointmentsApi";

/**
 * Adaptador del catálogo de atención (`erp.specialties`) a opciones del
 * wizard de solicitud de cita.
 *
 * Reglas del change `citas-e2e-app-erp` (veredicto D1 parcial):
 * - `Specialty.Category` = área clínica de agrupación.
 * - Cada `Specialty` activa = tipo de atención agendable.
 * - Sin listas hardcodeadas de códigos/nombres y sin regex sobre
 *   `professionalTypeName`: todo se deriva por igualdad exacta de ids y por
 *   el orden que ya trae el backend (categoría + `sort_order`).
 */

/** Tipo de atención agendable (una especialidad activa del catálogo). */
export interface CareOption {
  specialtyId: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
}

/** Área clínica (categoría) con sus tipos de atención. */
export interface CareAreaGroup {
  category: string;
  options: CareOption[];
}

/**
 * Especialidades activas como opciones de atención, en el orden del backend.
 * `null` = catálogo aún no cargado (la UI no puede afirmar nada).
 */
export function activeCareOptions(
  specialties: SpecialtyDto[] | null,
): CareOption[] | null {
  if (!specialties) return null;
  return specialties
    .filter((s) => s.isActive)
    .map((s) => ({
      specialtyId: s.id,
      code: s.code,
      name: s.name,
      category: s.category,
      description: s.description,
    }));
}

/**
 * Agrupa las opciones por área clínica (`category`), conservando el orden de
 * primera aparición (el backend ya ordena por categoría + `sort_order`).
 */
export function groupCareOptionsByCategory(
  options: CareOption[],
): CareAreaGroup[] {
  const byCategory = new Map<string, CareOption[]>();
  for (const opt of options) {
    const list = byCategory.get(opt.category);
    if (list) list.push(opt);
    else byCategory.set(opt.category, [opt]);
  }
  return [...byCategory.entries()].map(([category, opts]) => ({
    category,
    options: opts,
  }));
}

/**
 * Profesionales activos que atienden la especialidad (igualdad exacta de id,
 * sin regex ni inferencia por nombre de profesión).
 * `null` = catálogo aún no cargado; `[]` = sin profesionales elegibles.
 */
export function professionalsForSpecialty(
  catalog: ProfessionalCatalogItem[] | null,
  specialtyId: string,
): ProfessionalCatalogItem[] | null {
  if (!catalog) return null;
  return catalog.filter(
    (p) =>
      p.status === "Active" && p.specialties.some((s) => s.id === specialtyId),
  );
}

/** Paleta visual rotativa por índice de área (no por nombre/código). */
const CARE_VISUALS = [
  { tone: "teal", bg: "var(--teal-l)", fg: "var(--teal)", icon: medkit },
  { tone: "pur", bg: "var(--pur-l)", fg: "var(--pur)", icon: sparkles },
  { tone: "blue", bg: "var(--blue-l)", fg: "var(--blue)", icon: leaf },
  { tone: "org", bg: "var(--org-l)", fg: "var(--org)", icon: flash },
] as const;

/** Estética de un área clínica según su posición (cíclica, sin hardcodear). */
export function careVisualFor(areaIndex: number): {
  tone: string;
  bg: string;
  fg: string;
  icon: string;
} {
  const visual =
    CARE_VISUALS[
      ((areaIndex % CARE_VISUALS.length) + CARE_VISUALS.length) %
        CARE_VISUALS.length
    ] ?? CARE_VISUALS[0];
  return { tone: visual.tone, bg: visual.bg, fg: visual.fg, icon: visual.icon };
}

/**
 * Perfil de slots mock TEMPORAL para la ruta por catálogo.
 * TODO(2.A.4/B1): eliminar con el wiring a `GET /availability`. Los slots
 * mock por tipo (`WEEKDAY_SLOTS`/`BUSY`) se retiran en 2.A.2; mientras tanto
 * la ruta por catálogo usa el perfil neutro de semana para no inventar
 * precisión por especialidad ni hardcodear reglas de fin de semana.
 */
export const TEMPORARY_CATALOG_SLOT_PROFILE = "medica" as const;
