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
  /** Ventana de la sala virtual (opcional hasta el despliegue del backend). */
  roomOpensAt?: string | null;
  roomClosesAt?: string | null;
  /** Ids reales para disponibilidad/reprogramación (2.A.4/2.A.5). */
  professionalId?: string | null;
  specialtyId?: string | null;
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
    roomOpensAt: appt.roomOpensAt ?? null,
    roomClosesAt: appt.roomClosesAt ?? null,
    professionalId: appt.professionalId,
    specialtyId: appt.specialtyId,
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
