import {
  addDaysToISO,
  formatDateForDisplay,
  isWeekendISO,
  toLocalISODate,
  weekdayShortEs,
} from "../utils/dates";
import type {
  AppointmentDto,
  AppointmentRequestDto,
  ProfessionalCatalogItem,
} from "../utils/appointmentsApi";

export type ConsultTypeId = "medica" | "psicologia" | "nutricion" | "urgencia";
export type AppointmentMode = "Videollamada" | "Presencial";

export interface ConsultType {
  id: ConsultTypeId;
  label: string;
  short: string;
  emoji: string;
  tone: "teal" | "pur" | "blue" | "org";
}

export interface TeamProfessional {
  id: string;
  typeId: ConsultTypeId;
  name: string;
  role: string;
  emoji: string;
  accent: string;
  color: string;
  colorSoft: string;
}

export interface ListedAppointment {
  id: string;
  when: string;
  mode: string;
  accent: string;
  emoji: string;
  name: string;
  role: string;
  time: string;
  day: string;
  motivo: string;
  color: string;
  featured?: boolean;
  pending?: boolean;
}

export const CONSULT_TYPES: ConsultType[] = [
  {
    id: "medica",
    label: "Médica",
    short: "Control y prevención",
    emoji: "🩺",
    tone: "teal",
  },
  {
    id: "psicologia",
    label: "Psicología",
    short: "Bienestar emocional",
    emoji: "🧠",
    tone: "pur",
  },
  {
    id: "nutricion",
    label: "Nutrición",
    short: "Plan alimentario",
    emoji: "🥗",
    tone: "blue",
  },
  {
    id: "urgencia",
    label: "Urgencia",
    short: "Atención prioritaria",
    emoji: "🚨",
    tone: "org",
  },
];

export const TEAM_PROFESSIONALS: TeamProfessional[] = [
  {
    id: "ramirez",
    typeId: "medica",
    name: "Dr. Carlos Ramírez, MD",
    role: "Médico COPP-ADRESD",
    emoji: "🩺",
    accent: "linear-gradient(90deg,#0C3D2C,var(--teal))",
    color: "var(--teal)",
    colorSoft: "var(--teal-l)",
  },
  {
    id: "mora",
    typeId: "psicologia",
    name: "Psic. Luis Mora",
    role: "Psicólogo clínico · CBT",
    emoji: "🧠",
    accent: "linear-gradient(90deg,#2D1B69,#4C1D95)",
    color: "var(--pur)",
    colorSoft: "var(--pur-l)",
  },
  {
    id: "torres",
    typeId: "nutricion",
    name: "Nut. Ana Torres, RDN",
    role: "Nutricionista · CDR",
    emoji: "🥗",
    accent: "linear-gradient(90deg,#102a50,#2f78df)",
    color: "var(--blue)",
    colorSoft: "var(--blue-l)",
  },
  {
    id: "cruz",
    typeId: "urgencia",
    name: "Dra. Elena Cruz, MD",
    role: "Médica de guardia",
    emoji: "🚨",
    accent: "linear-gradient(90deg,#7a3b12,var(--org))",
    color: "var(--org)",
    colorSoft: "var(--org-l)",
  },
];

export const INITIAL_UPCOMING: ListedAppointment[] = [
  {
    id: "apt-ramirez-hoy",
    when: "HOY · CONFIRMADA",
    mode: "Telemedicina",
    accent: "linear-gradient(90deg,#0C3D2C,var(--teal))",
    emoji: "🩺",
    name: "Dr. Carlos Ramírez, MD",
    role: "Médico COPP-ADRESD",
    time: "15:00",
    day: "Hoy",
    motivo: "Control preventivo · Semana 12",
    color: "var(--teal)",
    featured: true,
  },
  {
    id: "apt-torres",
    when: "JUE 08/08 · CONFIRMADA",
    mode: "Presencial",
    accent: "linear-gradient(90deg,#102a50,#2f78df)",
    emoji: "🥗",
    name: "Nut. Ana Torres, RDN",
    role: "Nutricionista · CDR",
    time: "10:00",
    day: "08/08",
    motivo: "Seguimiento plan nutricional MNT #4",
    color: "var(--blue)",
  },
  {
    id: "apt-reyes",
    when: "VIE 09/08 · CONFIRMADA",
    mode: "Telemedicina",
    accent: "linear-gradient(90deg,#2D1B69,#4C1D95)",
    emoji: "💪",
    name: "Coach Marco Reyes, NBHWC",
    role: "Health Coach",
    time: "11:00",
    day: "09/08",
    motivo: "Revisión de metas SMART · Semana 12",
    color: "var(--pur)",
  },
];

const WEEKDAY_SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
] as const;

const URGENCY_WEEKEND_SLOTS = ["09:00", "11:00", "14:00", "16:00"] as const;

/** Huecos ocupados por profesional y día de la semana (0 = domingo). */
const BUSY: Record<string, Partial<Record<number, readonly string[]>>> = {
  ramirez: { 2: ["15:00"], 4: ["09:00", "09:30"] },
  mora: { 3: ["10:00"], 5: ["11:00", "14:00"] },
  torres: { 2: ["08:30"], 4: ["10:00", "10:30"] },
  cruz: { 1: ["12:00"], 6: ["11:00"] },
};

export function consultTypeById(id: ConsultTypeId): ConsultType {
  return CONSULT_TYPES.find((t) => t.id === id) ?? CONSULT_TYPES[0];
}

export function professionalByType(typeId: ConsultTypeId): TeamProfessional {
  return (
    TEAM_PROFESSIONALS.find((p) => p.typeId === typeId) ?? TEAM_PROFESSIONALS[0]
  );
}

function slotMinutes(slot: string): number {
  const [h, m] = slot.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function bookingWindow() {
  const min = toLocalISODate();
  return { min, max: addDaysToISO(min, 30) };
}

export function isSelectableBookingDate(
  iso: string,
  typeId: ConsultTypeId | "",
): boolean {
  const { min, max } = bookingWindow();
  if (iso < min || iso > max) return false;
  if (typeId !== "urgencia" && isWeekendISO(iso)) return false;
  return true;
}

export function listSelectableDates(
  typeId: ConsultTypeId,
  limit = 12,
): string[] {
  const { min, max } = bookingWindow();
  const out: string[] = [];
  let iso = min;
  while (iso <= max && out.length < limit) {
    if (isSelectableBookingDate(iso, typeId)) out.push(iso);
    iso = addDaysToISO(iso, 1);
  }
  return out;
}

export function splitSlots(slots: string[]): {
  morning: string[];
  afternoon: string[];
} {
  const morning: string[] = [];
  const afternoon: string[] = [];
  for (const slot of slots) {
    if (slotMinutes(slot) < 12 * 60) morning.push(slot);
    else afternoon.push(slot);
  }
  return { morning, afternoon };
}

export function getAvailableSlots(
  typeId: ConsultTypeId,
  isoDate: string,
): string[] {
  const pro = professionalByType(typeId);
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  const weekend = weekday === 0 || weekday === 6;
  const pool = weekend
    ? typeId === "urgencia"
      ? [...URGENCY_WEEKEND_SLOTS]
      : []
    : [...WEEKDAY_SLOTS];
  const busy = new Set(BUSY[pro.id]?.[weekday] ?? []);
  const today = toLocalISODate();
  const cutoff = isoDate === today ? nowMinutes() : -1;
  return pool.filter((slot) => !busy.has(slot) && slotMinutes(slot) > cutoff);
}

export function firstOpenSlot(
  typeId: ConsultTypeId,
): { date: string; time: string } | null {
  for (const iso of listSelectableDates(typeId, 31)) {
    const open = getAvailableSlots(typeId, iso);
    if (open[0]) return { date: iso, time: open[0] };
  }
  return null;
}

export function buildRequestedAppointment(input: {
  typeId: ConsultTypeId;
  date: string;
  time: string;
  reason: string;
  mode: AppointmentMode;
}): ListedAppointment {
  const pro = professionalByType(input.typeId);
  const type = consultTypeById(input.typeId);
  const today = toLocalISODate();
  const dayLabel =
    input.date === today ? "Hoy" : formatDateForDisplay(input.date).slice(0, 5);
  return {
    id: `req-${Date.now()}`,
    when: `${weekdayShortEs(input.date)} ${formatDateForDisplay(input.date)} · PENDIENTE`,
    mode: input.mode,
    accent: pro.accent,
    emoji: pro.emoji,
    name: pro.name,
    role: pro.role,
    time: input.time,
    day: dayLabel,
    motivo: `${type.label} · ${input.reason.trim()}`,
    color: pro.color,
    pending: true,
  };
}

// ── Conexión con el backend real (modo sesión): adaptador DTO → UI ────────
// El diseño de la pantalla no cambia: los datos del microservicio se mapean al
// shape ListedAppointment que ya renderiza AppointmentsPage.

/** Rol → tipo de consulta de la UI (por keywords del professionalTypeName). */
function typeFromProfessional(
  professionalTypeName: string | null,
): ConsultTypeId {
  const name = professionalTypeName ?? "";
  if (/psych|psyc|psychiat|counsel|social/i.test(name)) return "psicologia";
  if (/dietit|nutrition/i.test(name)) return "nutricion";
  return "medica";
}

/** Estética por tipo (misma paleta del mock: no cambia el diseño). */
function styleForType(
  typeId: ConsultTypeId,
): Pick<TeamProfessional, "emoji" | "accent" | "color" | "colorSoft"> {
  const mock =
    TEAM_PROFESSIONALS.find((p) => p.typeId === typeId) ??
    TEAM_PROFESSIONALS[0];
  return {
    emoji: mock.emoji,
    accent: mock.accent,
    color: mock.color,
    colorSoft: mock.colorSoft,
  };
}

/**
 * Profesional real del catálogo para el tipo de consulta elegido (el primero
 * activo de esa profesión). Con catálogo nulo (demo) devuelve el mock actual.
 */
export function realProfessionalByType(
  typeId: ConsultTypeId,
  catalog: ProfessionalCatalogItem[] | null,
): TeamProfessional {
  const candidates = (catalog ?? []).filter((p) => p.status === "Active");
  const medica = typeId === "medica" || typeId === "urgencia";
  const match =
    (medica
      ? candidates.find(
          (p) =>
            typeFromProfessional(p.professionalTypeName) === typeId &&
            /physician/i.test(p.professionalTypeName ?? ""),
        )
      : undefined) ??
    candidates.find(
      (p) => typeFromProfessional(p.professionalTypeName) === typeId,
    ) ??
    (medica
      ? candidates.find(
          (p) => typeFromProfessional(p.professionalTypeName) === "medica",
        )
      : undefined);
  if (!match) return professionalByType(typeId);

  const type = typeFromProfessional(match.professionalTypeName);
  return {
    id: match.id,
    typeId,
    name: match.fullName,
    role: match.professionalTypeName ?? "Profesional COPP-ADRESD",
    ...styleForType(type),
  };
}

/** "Hoy" o dd/mm en hora local. */
function dayLabelFor(iso: string): string {
  const d = new Date(iso);
  const today = toLocalISODate();
  if (iso.slice(0, 10) === today) return "Hoy";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** HH:mm local. */
function timeLabelFor(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Solicitud del backend → fila de la lista (pendiente de confirmación). */
export function mapRequestToListed(
  req: AppointmentRequestDto,
): ListedAppointment {
  const style = styleForType("medica");
  const when =
    req.status === "Approved"
      ? "APROBADA"
      : req.status === "Rejected"
        ? "RECHAZADA"
        : "PENDIENTE";
  const preferred = req.preferredStart ? new Date(req.preferredStart) : null;
  return {
    id: `req-${req.id}`,
    when,
    mode: "Telemedicina",
    accent: style.accent,
    emoji: style.emoji,
    name: req.professionalId ? "Profesional asignado" : "Equipo COPP-ADRESD",
    role: req.specialtyName ?? "Consulta",
    time: preferred ? timeLabelFor(preferred.toISOString()) : "—",
    day: preferred ? dayLabelFor(preferred.toISOString()) : "Por definir",
    motivo: req.reason.trim(),
    color: style.color,
    pending: req.status === "Pending" || req.status === "Approved",
  };
}

/** Cita del backend → fila de la lista. */
export function mapAppointmentToListed(
  appt: AppointmentDto,
): ListedAppointment {
  const style = styleForType("medica");
  const statusLabel: Record<AppointmentDto["status"], string> = {
    Requested: "SOLICITADA",
    Confirmed: "CONFIRMADA",
    InProgress: "EN CURSO",
    Completed: "COMPLETADA",
    Cancelled: "CANCELADA",
    NoShow: "NO SHOW",
  };
  return {
    id: appt.id,
    when: statusLabel[appt.status],
    mode: "Telemedicina",
    accent: style.accent,
    emoji: "🩺",
    name: appt.professionalName ?? "Profesional COPP-ADRESD",
    role: appt.specialtyName ?? "Consulta",
    time: timeLabelFor(appt.scheduledStart),
    day: dayLabelFor(appt.scheduledStart),
    motivo: appt.specialtyName ?? "Consulta",
    color: style.color,
  };
}

/**
 * Compone la lista real de la pantalla de citas: próximas (cita destacada +
 * siguientes, incluidas solicitudes pendientes) y anteriores.
 */
export function buildRealAppointments(
  appointments: AppointmentDto[],
  requests: AppointmentRequestDto[],
): { upcoming: ListedAppointment[]; past: ListedAppointment[] } {
  const now = Date.now();

  // Activas: Confirmada/En curso. Se conservan aunque su hora ya pasó (sigue
  // Confirmed sin sesión iniciada — el paciente mantiene Unirse/Cancelar hasta
  // que el profesional la finalice). Sin esto la cita "se cae" de ambas listas.
  const active = appointments
    .filter((a) => a.status === "Confirmed" || a.status === "InProgress")
    .sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() -
        new Date(b.scheduledStart).getTime(),
    );

  const upcomingItems: ListedAppointment[] = [];
  // Destacada: la próxima futura; si todas pasaron, la más reciente (visible
  // con Unirse/Cancelar mientras el profesional no la finalice).
  const future = active.find(
    (a) => new Date(a.scheduledStart).getTime() >= now,
  );
  const featuredAppointment = future ?? active[active.length - 1];
  if (featuredAppointment)
    upcomingItems.push(mapAppointmentToListed(featuredAppointment));

  for (const a of active) {
    if (a.id !== featuredAppointment?.id)
      upcomingItems.push(mapAppointmentToListed(a));
  }

  const pendingRequests = requests
    .filter((r) => r.status === "Pending" || r.status === "Approved")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  for (const r of pendingRequests) upcomingItems.push(mapRequestToListed(r));

  if (upcomingItems[0])
    upcomingItems[0] = { ...upcomingItems[0], featured: true };

  const past = appointments
    .filter(
      (a) =>
        a.status === "Completed" ||
        a.status === "Cancelled" ||
        a.status === "NoShow",
    )
    .sort(
      (a, b) =>
        new Date(b.scheduledStart).getTime() -
        new Date(a.scheduledStart).getTime(),
    )
    .map(mapAppointmentToListed);

  return { upcoming: upcomingItems, past };
}
