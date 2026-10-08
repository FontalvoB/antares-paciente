import {
  addDaysToISO,
  formatDateForDisplay,
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
  /** Estado real de la cita (ausente en mocks/solicitudes). */
  status?: AppointmentDto["status"];
  requestStatus?: AppointmentRequestDto["status"];
  scheduledAt?: string | null;
  /** Ventana de la sala virtual (opcional hasta el despliegue del backend). */
  roomOpensAt?: string | null;
  roomClosesAt?: string | null;
  /** Ids reales para disponibilidad/reprogramación (2.A.4/2.A.5). */
  professionalId?: string | null;
  specialtyId?: string | null;
  /** Motivo de cancelación/inasistencia (REQ-APP-04: visible en Anteriores). */
  cancellationReason?: string | null;
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

export function bookingWindow() {
  const min = toLocalISODate();
  return { min, max: addDaysToISO(min, 30) };
}

export function consultTypeById(id: ConsultTypeId): ConsultType {
  return CONSULT_TYPES.find((t) => t.id === id) ?? CONSULT_TYPES[0];
}

export function professionalByType(typeId: ConsultTypeId): TeamProfessional {
  return (
    TEAM_PROFESSIONALS.find((p) => p.typeId === typeId) ?? TEAM_PROFESSIONALS[0]
  );
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
 * Primer profesional REAL activo del catálogo para el tipo de consulta; null
 * si el catálogo no está disponible o no hay profesionales activos de ese tipo.
 * A diferencia de `realProfessionalByType`, NUNCA cae al mock: el llamador
 * decide cómo degradar (p. ej. el equipo del perfil oculta la fila).
 */
function findRealProfessional(
  typeId: ConsultTypeId,
  catalog: ProfessionalCatalogItem[] | null,
): TeamProfessional | null {
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
  if (!match) return null;

  const type = typeFromProfessional(match.professionalTypeName);
  return {
    id: match.id,
    typeId,
    name: match.fullName,
    role: match.professionalTypeName ?? "Profesional COPP-ADRESD",
    ...styleForType(type),
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
  return findRealProfessional(typeId, catalog) ?? professionalByType(typeId);
}

/** Roles que la sección "Equipo ANTARES" muestra, en orden. */
const TEAM_ROLE_TYPES: readonly ConsultTypeId[] = [
  "medica",
  "nutricion",
  "psicologia",
];

/**
 * Equipo real del catálogo: un profesional activo por rol disponible, sin
 * duplicados. `null` = catálogo no disponible (demo/sin sesión) — la UI no
 * puede afirmar nada; `[]` = catálogo cargado sin profesionales activos.
 * NUNCA inventa nombres ni rellena con el mock.
 */
export function realTeamFromCatalog(
  catalog: ProfessionalCatalogItem[] | null,
): TeamProfessional[] | null {
  if (!catalog) return null;
  const seen = new Set<string>();
  const team: TeamProfessional[] = [];
  for (const typeId of TEAM_ROLE_TYPES) {
    const pro = findRealProfessional(typeId, catalog);
    if (pro && !seen.has(pro.id)) {
      seen.add(pro.id);
      team.push(pro);
    }
  }
  return team;
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
  // Estado legible de la solicitud (REQ-APP-03 bugfix: "En revisión" /
  // "Aprobada", sin botón de sala — la sala no existe hasta confirmar).
  const when =
    req.status === "Approved"
      ? "Aprobada"
      : req.status === "Rejected"
        ? "Rechazada"
        : "En revisión";
  const preferred = req.preferredStart ? new Date(req.preferredStart) : null;
  return {
    id: `req-${req.id}`,
    requestStatus: req.status,
    scheduledAt: req.preferredStart,
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

/** Etiqueta del estado de la cita (clave i18n en es/en.json). */
export const APPOINTMENT_STATUS_LABELS: Record<
  AppointmentDto["status"],
  string
> = {
  Requested: "SOLICITADA",
  Confirmed: "CONFIRMADA",
  InProgress: "EN CURSO",
  Completed: "COMPLETADA",
  Cancelled: "CANCELADA",
  NoShow: "NO SHOW",
};

/**
 * ¿La fila puede abrir sala? (REQ-APP-03 bugfix 2026-09-28): solo citas
 * reales con sala potencial (`Confirmed`/`InProgress`) y nunca ids de
 * solicitud (`req-*`, sin sala en el backend → 404). Las solicitudes
 * muestran su estado sin botón de sala.
 */
export function canJoinAppointment(
  appointment: Pick<ListedAppointment, "id" | "status">,
): boolean {
  if (appointment.id.startsWith("req-")) return false;
  return (
    appointment.status === "Confirmed" || appointment.status === "InProgress"
  );
}

/** Cita del backend → fila de la lista. */
export function mapAppointmentToListed(
  appt: AppointmentDto,
): ListedAppointment {
  const style = styleForType("medica");
  return {
    id: appt.id,
    when: APPOINTMENT_STATUS_LABELS[appt.status],
    mode: "Telemedicina",
    accent: style.accent,
    emoji: "🩺",
    name: appt.professionalName ?? "Profesional COPP-ADRESD",
    role: appt.specialtyName ?? "Consulta",
    time: timeLabelFor(appt.scheduledStart),
    day: dayLabelFor(appt.scheduledStart),
    motivo: appt.specialtyName ?? "Consulta",
    color: style.color,
    status: appt.status,
    scheduledAt: appt.scheduledStart,
    roomOpensAt: appt.roomOpensAt ?? null,
    roomClosesAt: appt.roomClosesAt ?? null,
    professionalId: appt.professionalId,
    specialtyId: appt.specialtyId,
    cancellationReason: appt.cancellationReason ?? null,
  };
}

/**
 * Chip de cita histórica (2.A.6): `Completed` → "Hecha" verde,
 * `Cancelled` → "Cancelada" rojo, `NoShow` → "No asistió" ámbar.
 * Sin estado (legado) → "Hecha" para no romper la vista demo.
 */
export function pastAppointmentChip(
  status: AppointmentDto["status"] | undefined,
): { label: string; className: string } {
  switch (status) {
    case "Cancelled":
      return { label: "Cancelada", className: "chip chip-red" };
    case "Confirmed":
    case "Requested":
      return { label: "Sin completar", className: "chip chip-org" };
    case "NoShow":
      return { label: "No asistió", className: "chip chip-org" };
    default:
      return { label: "Hecha", className: "chip chip-teal" };
  }
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

  // Una cita en curso permanece visible; las citas sin iniciar y vencidas van al historial.
  const stillActive = (a: AppointmentDto) => a.status === "InProgress" ||
    ((a.status === "Confirmed" || a.status === "Requested") && new Date(a.scheduledEnd).getTime() >= now);
  const active = appointments.filter(stillActive).sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart));
  // Approved ya tiene cita real: no duplica la solicitud ni conserva fechas pasadas como próximas.
  const pendingRequests = requests.filter(r => r.status === "Pending" &&
    (!r.preferredStart || Date.parse(r.preferredStart) >= now));
  const upcomingItems = [...active.map(mapAppointmentToListed), ...pendingRequests.map(mapRequestToListed)].sort((a, b) => (a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity) - (b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity));
  if (upcomingItems[0]) upcomingItems[0] = { ...upcomingItems[0], featured: true };
  const past = [
    ...appointments.filter(a => !stillActive(a)).sort((a, b) => Date.parse(b.scheduledStart) - Date.parse(a.scheduledStart)).map(mapAppointmentToListed),
    ...requests.filter(r => r.status === "Pending" && r.preferredStart && Date.parse(r.preferredStart) < now).map(mapRequestToListed),
  ].sort((a, b) => Date.parse(b.scheduledAt ?? "") - Date.parse(a.scheduledAt ?? ""));

  return { upcoming: upcomingItems, past };
}
