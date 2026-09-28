import { flash, leaf, medkit, sparkles } from "ionicons/icons";
import {
  DIRECT_ENTRY_DISPLAY,
  DIRECT_ENTRY_SPECIALTY_CODES,
  type EntryPointDisplay,
} from "./careEntryPoints";
import type {
  AvailabilitySlotDto,
  ProfessionalCatalogItem,
  SpecialtyDto,
} from "../utils/appointmentsApi";
import { addDaysToISO, toLocalISODate } from "../utils/dates";

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
 * Punto de entrada directa (Decisión 5, REQ-APP-02): conserva ÚNICAMENTE las
 * opciones cuyo `code` pertenece a `DIRECT_ENTRY_SPECIALTY_CODES`
 * (igualdad exacta, orden del backend preservado).
 * `null` = catálogo aún no cargado (la UI no puede afirmar nada).
 */
export function entryPointCareOptions(
  options: CareOption[] | null,
): CareOption[] | null {
  if (!options) return null;
  const allowed = new Set<string>(DIRECT_ENTRY_SPECIALTY_CODES);
  return options.filter((o) => allowed.has(o.code));
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

/** Estética de marca por tono (tabla única, sin hex sueltos). */
export function toneVisual(tone: string): {
  tone: string;
  bg: string;
  fg: string;
} {
  const found = CARE_VISUALS.find((v) => v.tone === tone) ?? CARE_VISUALS[0];
  return { tone: found.tone, bg: found.bg, fg: found.fg };
}

/** Tarjeta resuelta para pintar (diseño distintivo o fallback genérico). */
export interface EntryCardDisplay {
  /** Clave i18n del título; ausente = usar el nombre del catálogo. */
  titleKey?: string;
  /** Clave i18n de la descripción; ausente = descripción del catálogo. */
  descKey?: string;
  /** Clave i18n del kicker; ausente = sin kicker (lo pone el llamador). */
  kickerKey?: string;
  icon: string;
  tone: string;
  bg: string;
  fg: string;
  sosNote: boolean;
}

/**
 * Presentación de una opción de entrada por `code` (Decisión 5): si el
 * código tiene entrada en `DIRECT_ENTRY_DISPLAY` usa su título en español,
 * icono y tono distintivos; si no, fallback genérico (nombre del catálogo +
 * estética rotativa) para no romper ante nuevos códigos.
 */
export function entryDisplayFor(code: string, index: number): EntryCardDisplay {
  const meta: EntryPointDisplay | undefined = DIRECT_ENTRY_DISPLAY[code];
  if (meta) {
    const visual = toneVisual(meta.tone);
    return {
      titleKey: meta.titleKey,
      descKey: meta.descKey,
      kickerKey: meta.kickerKey,
      icon: meta.icon,
      tone: visual.tone,
      bg: visual.bg,
      fg: visual.fg,
      sosNote: meta.sosNote,
    };
  }
  const fallback = careVisualFor(index);
  return {
    icon: fallback.icon,
    tone: fallback.tone,
    bg: fallback.bg,
    fg: fallback.fg,
    sosNote: false,
  };
}

/** Ranura disponible lista para pintar (B4: solo `isAvailable`). */
export interface AvailabilitySlotView {
  /** Inicio exacto en ISO (viaja como `preferred_start`/`new_start`). */
  startIso: string;
  endIso: string;
  /** "HH:mm" en hora local. */
  timeLabel: string;
  period: "morning" | "afternoon";
}

/** "HH:mm" local desde un ISO. */
function slotTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Slots disponibles del día, filtrados por `isAvailable` (B4: satisface en UI
 * ambas lecturas del contrato — el slot ocupado nunca se ofrece).
 * Ordenados por inicio.
 */
export function toAvailableSlotViews(
  slots: AvailabilitySlotDto[],
): AvailabilitySlotView[] {
  return slots
    .filter((s) => s.isAvailable)
    .map((s) => ({
      startIso: s.start,
      endIso: s.end,
      timeLabel: slotTimeLabel(s.start),
      period: (new Date(s.start).getHours() < 12
        ? "morning"
        : "afternoon") as AvailabilitySlotView["period"],
    }))
    .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
}

/** Parte las vistas en mañana/tarde para la UI del wizard. */
export function splitSlotViews(slots: AvailabilitySlotView[]): {
  morning: AvailabilitySlotView[];
  afternoon: AvailabilitySlotView[];
} {
  return {
    morning: slots.filter((s) => s.period === "morning"),
    afternoon: slots.filter((s) => s.period === "afternoon"),
  };
}

/**
 * Días seleccionables en la ruta por catálogo: ventana de 30 días. La agenda
 * real (fines de semana, turnos) la conoce el backend vía `/availability`;
 * la UI no hardcodea reglas por especialidad.
 */
export function isCatalogBookingDate(iso: string): boolean {
  const min = toLocalISODate();
  return iso >= min && iso <= addDaysToISO(min, 30);
}

/** ¿El día trae jornada (slots) aunque ninguno esté libre? */
export function dayHasSchedule(slots: AvailabilitySlotDto[]): boolean {
  return slots.length > 0;
}
