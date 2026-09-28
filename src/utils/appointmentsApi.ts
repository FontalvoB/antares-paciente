import { getAccessToken } from "./authApi";
import { getGatewayBaseUrl } from "./apiBaseUrl";

/**
 * Cliente del módulo de citas/telemedicina del paciente contra el API Gateway
 * (YARP :5080 → Telemedicine). Patrón de threadApi.ts: Bearer del access token,
 * errores con mensaje legible. Todos los endpoints se resuelven por la
 * identidad del JWT (el paciente nunca envía ids ajenos).
 */

// ── Tipos (espejo de los DTOs del microservicio Telemedicine) ─────────────

export type AppointmentStatus =
  | "Requested"
  | "Confirmed"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | "NoShow";

export type AppointmentRequestStatus =
  "Pending" | "Approved" | "Rejected" | "Cancelled" | "Converted";

export interface AppointmentDto {
  id: string;
  requestId: string | null;
  patientId: string;
  patientName: string | null;
  professionalId: string;
  professionalName: string | null;
  specialtyId: string;
  specialtyName: string | null;
  organizationId: string;
  clinicId: string | null;
  locationId: string | null;
  locationName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  status: AppointmentStatus;
  rescheduleCount: number;
  cancellationReason: string | null;
  createdAt: string;
  /**
   * Ventana de acceso a la sala virtual y cierre real. El backend los está
   * enriqueciendo en paralelo → opcionales hasta su despliegue (la sala NO usa
   * GET /appointments/{id}, que da 403 al paciente: la ventana viene de aquí).
   */
  completedAt?: string | null;
  roomOpensAt?: string | null;
  roomClosesAt?: string | null;
}

export type VirtualRoomStatus =
  "Created" | "Waiting" | "Active" | "Ended" | "Expired" | "Failed";

export type TelemedicineSessionStatus =
  "Created" | "Waiting" | "Active" | "Ended" | "Expired" | "Failed";

export interface RoomParticipantDto {
  participantSid: string;
  identity: string;
  isConnected: boolean;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

/** Sala virtual de la cita (GET /appointments/{id}/room, participante). */
export interface AppointmentRoomDto {
  id: string;
  provider: string;
  providerRoomName: string;
  status: VirtualRoomStatus;
  scheduledOpenAt: string;
  scheduledCloseAt: string;
  activeSessionId: string | null;
  activeSessionStatus: TelemedicineSessionStatus | null;
  participants: RoomParticipantDto[];
}

/** Pre-consulta de la cita (F4): una fila por cita, escrita por el paciente. */
export interface PreVisitIntakeDto {
  id: string;
  appointmentId: string;
  patientId: string;
  reason: string;
  symptoms: string | null;
  allergies: string | null;
  medications: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Body del PUT de la pre-consulta (textos opcionales vacíos viajan como null). */
export interface PreVisitIntakeInput {
  reason: string;
  symptoms: string | null;
  allergies: string | null;
  medications: string | null;
}

export type ChatSenderRole = "Professional" | "Patient" | "Supervisor";

/** Mensaje del chat de la consulta (sender_user_id/role derivados del JWT). */
export interface ChatMessageDto {
  id: string;
  appointmentId: string;
  senderUserId: string;
  senderRole: ChatSenderRole;
  body: string;
  createdAt: string;
}

export interface AppointmentRequestDto {
  id: string;
  patientId: string;
  patientName: string | null;
  professionalId: string | null;
  specialtyId: string;
  specialtyName: string | null;
  organizationId: string;
  clinicId: string | null;
  locationId: string | null;
  preferredStart: string | null;
  reason: string;
  status: AppointmentRequestStatus;
  createdAt: string;
  rejectionReason: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProfessionalCatalogItem {
  id: string;
  employeeId: string;
  fullName: string;
  professionalTypeName: string | null;
  specialties: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  clinicIds: string[];
  status: string;
}

/**
 * Especialidad del catálogo ERP (`erp.specialties`, vía
 * `GET /api/v1/specialties`). `category` es el área clínica de agrupación
 * (ej. "Medicina") y cada especialidad activa es un tipo de atención
 * agendable. Agregar especialidades no requiere cambios de código.
 */
export interface SpecialtyDto {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  isActive: boolean;
}

export interface PatientContextDto {
  professional: {
    id: string;
    employeeId: string;
    userId: string;
    fullName: string;
    professionalTypeName: string;
    specialtyIds: string[];
    locationIds: string[];
    clinicIds: string[];
  } | null;
  patient: {
    id: string;
    fullName: string;
    email: string | null;
    clinicId: string | null;
    locationId: string | null;
    /** Organización ERP de la clínica del paciente (FASE 6, resuelta backend). */
    organizationId?: string | null;
  } | null;
}

export interface JoinSessionResultDto {
  token: string;
  expiresAt: string;
  room: {
    id: string;
    provider: string;
    providerRoomName: string;
    status: string;
    scheduledOpenAt: string;
    scheduledCloseAt: string;
    activeSessionId: string | null;
    activeSessionStatus: string | null;
    participants: unknown[];
  };
}

export interface CreateRequestInput {
  patientId: string;
  organizationId: string;
  specialtyId: string;
  professionalId?: string;
  clinicId?: string;
  locationId?: string;
  preferredStart?: string;
  reason: string;
}

/** ¿Hay una sesión real (JWT) o modo demo? */
export function hasRealSession(): boolean {
  return getAccessToken() !== null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${getGatewayBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = `Error del servidor (${res.status})`;
    try {
      const data = (await res.json()) as {
        message?: string;
        title?: string;
        detail?: string;
      };
      if (data?.detail) message = data.detail;
      else if (data?.message) message = data.message;
      else if (data?.title) message = data.title;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ApiClientError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiClientError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

/** Contexto del paciente autenticado (resuelve su patientId por el JWT). */
export function fetchMyContext(): Promise<PatientContextDto> {
  return api<PatientContextDto>("/api/v1/telemedicine/me");
}

/** Citas del paciente autenticado (identidad JWT), paginadas y filtrables. */
export function fetchMyAppointments(params?: {
  status?: AppointmentStatus;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AppointmentDto>> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  qs.set("page", String(params?.page ?? 1));
  qs.set("pageSize", String(params?.pageSize ?? 50));
  return api<PaginatedResult<AppointmentDto>>(
    `/api/v1/appointments/mine?${qs.toString()}`,
  );
}

/** Solicitudes del paciente autenticado (identidad JWT). */
export function fetchMyRequests(): Promise<AppointmentRequestDto[]> {
  return api<AppointmentRequestDto[]>("/api/v1/telemedicine/requests/mine");
}

/** Crea una solicitud de cita (el patientId debe ser el del JWT). */
export function createRequest(
  input: CreateRequestInput,
): Promise<AppointmentRequestDto> {
  return api<AppointmentRequestDto>("/api/v1/telemedicine/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Cancela una cita del paciente (CancelledBy.Patient, identidad JWT). */
export function cancelAppointment(
  id: string,
  reason: string,
): Promise<AppointmentDto> {
  return api<AppointmentDto>(`/api/v1/appointments/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason, cancelledBy: "Patient" }),
  });
}

/** Token de acceso a la sala virtual de una cita (participante por identidad). */
export function fetchJoinToken(
  appointmentId: string,
): Promise<JoinSessionResultDto> {
  return api<JoinSessionResultDto>(
    `/api/v1/appointments/${appointmentId}/join-token`,
    {
      method: "POST",
    },
  );
}

/**
 * Sala virtual de una cita (estado y participantes en vivo). Autorizado al
 * participante por identidad del JWT; 404 mientras la sala no exista (se crea
 * perezosamente en el primer join-token).
 */
export function fetchAppointmentRoom(
  appointmentId: string,
): Promise<AppointmentRoomDto> {
  return api<AppointmentRoomDto>(`/api/v1/appointments/${appointmentId}/room`);
}

/**
 * Pre-consulta del paciente para una cita (paciente escribe/lee; profesional y
 * supervisor leen). El backend responde 200 con null cuando aún no existe; un
 * 404 se trata igual para no romper la UI si la cita no está disponible.
 */
export async function fetchPreVisitIntake(
  appointmentId: string,
): Promise<PreVisitIntakeDto | null> {
  try {
    return await api<PreVisitIntakeDto | null>(
      `/api/v1/appointments/${appointmentId}/pre-visit-intake`,
    );
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Guarda/actualiza la pre-consulta de una cita (solo el paciente; el backend
 * responde 409 cuando la sesión ya inició).
 */
export function savePreVisitIntake(
  appointmentId: string,
  input: PreVisitIntakeInput,
): Promise<PreVisitIntakeDto> {
  return api<PreVisitIntakeDto>(
    `/api/v1/appointments/${appointmentId}/pre-visit-intake`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

/**
 * Mensajes del chat de la consulta (participante por identidad, mismo
 * contrato que la sala). El cursor incremental `after`/`afterId` viaja como
 * query string; sin cursor devuelve el historial desde el inicio.
 */
export function fetchRoomChatMessages(
  appointmentId: string,
  params?: { after?: string; afterId?: string; limit?: number },
): Promise<ChatMessageDto[]> {
  const qs = new URLSearchParams();
  if (params?.after) qs.set("after", params.after);
  if (params?.afterId) qs.set("afterId", params.afterId);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api<ChatMessageDto[]>(
    `/api/v1/appointments/${appointmentId}/chat/messages${suffix}`,
  );
}

/** Envía un mensaje al chat de la consulta (sender derivado server-side). */
export function sendRoomChatMessage(
  appointmentId: string,
  body: string,
): Promise<ChatMessageDto> {
  return api<ChatMessageDto>(
    `/api/v1/appointments/${appointmentId}/chat/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}

/** Catálogo de profesionales clínicos del backend (público-autenticado, sin PHI). */ export function fetchProfessionalsCatalog(): Promise<{
  data: ProfessionalCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  return api("/api/v1/professionals-catalog?page=1&pageSize=100");
}

/**
 * Catálogo de especialidades del ERP (`erp.specialties`), ordenado por el
 * backend por categoría y `sort_order`. Reutiliza el endpoint existente —
 * no inventa endpoints. La UI agrupa por `category` y trata cada
 * especialidad activa como tipo de atención agendable.
 */
export function fetchSpecialties(): Promise<SpecialtyDto[]> {
  return api<SpecialtyDto[]>("/api/v1/specialties");
}
