import { apiFetch, ApiError } from "./apiClient";

/**
 * Perfil autogestionado del PACIENTE (/api/v1/me/patient-profile). El backend
 * resuelve la identidad por JWT (anti-IDOR R7.2): ninguna ruta lleva ids.
 * Los errores no se tragan — el llamador decide la UX (R1.4, R5.6).
 */

/** Espejo del PatientSelfProfileDto del backend (camelCase, ASP.NET default). */
export interface PatientSelfProfileDto {
  patientId: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  dateOfBirth: string | null;
  email: string;
  phone: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyEmail: string;
  insurerId: string | null;
  memberId: string;
}

export async function fetchMyPatientProfile(
  signal?: AbortSignal,
): Promise<PatientSelfProfileDto> {
  return apiFetch<PatientSelfProfileDto>("/api/v1/me/patient-profile", {
    signal,
  });
}

/** Payload parcial: solo los campos editables por el paciente (v1). */
export interface UpdatePatientProfileRequest {
  dateOfBirth: string | null;
  email: string;
  phone: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyEmail: string;
  insurerId: string | null;
  memberId: string;
}

export async function updateMyPatientProfile(
  body: UpdatePatientProfileRequest,
  signal?: AbortSignal,
): Promise<PatientSelfProfileDto> {
  return apiFetch<PatientSelfProfileDto>("/api/v1/me/patient-profile", {
    method: "PUT",
    body,
    signal,
  });
}

/** Catálogo de aseguradoras administrado por el ERP (GET /api/v1/insurers). */
export interface InsurerOption {
  id: string;
  name: string;
}

export async function fetchInsurers(
  signal?: AbortSignal,
): Promise<InsurerOption[]> {
  return apiFetch<InsurerOption[]>("/api/v1/insurers", { signal });
}

/** Mapea el DTO del backend al perfil de sesión de la APP (in-memory, no persistente). */
export function toUserProfile(
  dto: PatientSelfProfileDto,
): import("../types").UserProfile {
  const emg = dto.emergencyName
    ? {
        fam1Nombre: dto.emergencyName,
        fam1Parentesco: dto.emergencyRelationship,
        fam1Cel: dto.emergencyPhone,
        fam1Email: dto.emergencyEmail,
      }
    : { fam1Nombre: "", fam1Parentesco: "", fam1Cel: "", fam1Email: "" };

  return {
    id: dto.patientId,
    nombre: `${dto.firstName} ${dto.lastName}`.trim(),
    cedula: dto.documentNumber,
    dob: dto.dateOfBirth ? dto.dateOfBirth.slice(0, 10) : "",
    seguro: dto.insurerId ?? "",
    poliza: dto.memberId,
    grupo: "",
    email: dto.email,
    celular: dto.phone,
    ...emg,
  };
}

export { ApiError };
