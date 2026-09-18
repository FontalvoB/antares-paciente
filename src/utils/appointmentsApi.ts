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
  | "Created"
  | "Waiting"
  | "Active"
  | "Ended"
  | "Expired"
  | "Failed";

export type TelemedicineSessionStatus =
  | "Created"
  | "Waiting"
  | "Active"
  | "Ended"
  | "Expired"
  | "Failed";

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

/** Catálogo de profesionales clínicos del backend (público-autenticado, sin PHI). */
export function fetchProfessionalsCatalog(): Promise<{
  data: ProfessionalCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  return api("/api/v1/professionals-catalog?page=1&pageSize=100");
}

/** Árbol de organizaciones del backend (para la org de la solicitud). */
export function fetchOrganizationsTree(): Promise<
  Array<{ id: string; name: string }>
> {
  return api<Array<{ id: string; name: string }>>("/api/v1/organizations/tree");
}
