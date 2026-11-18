import { apiFetch } from "./apiClient";

export interface MedicationCapability {
  enabled: boolean;
  canView: boolean;
  canManage: boolean;
  canManageAccess: boolean;
}

export interface MedicationCapabilities {
  policyVersion: string;
  modules: { medications?: MedicationCapability };
}

export type MedicationProductType = "medication" | "vitamin" | "supplement";
export type MedicationStatus = "active" | "paused" | "completed";

export interface MedicationTreatment {
  id: string;
  medicationId: string | null;
  name: string;
  productType: MedicationProductType;
  status: MedicationStatus;
  origin: "patient_reported" | "staff_recorded" | "legacy_import";
  revision: number;
  createdAt: string;
  isRequired?: boolean;
  dosage: number;
  unit: string;
  route: string;
  instructions: string;
  times: string[];
  timeZone: string;
  startDate: string;
  endDate: string | null;
}

export interface MedicationDose {
  id: string;
  treatmentId: string;
  name: string;
  dosage: number;
  unit: string;
  scheduledAt: string;
  timeZone: string;
  status: "pending" | "taken" | "omitted" | "cancelled";
  occurredAt: string | null;
  revision: number;
}

export interface MedicationEvent {
  id: string;
  doseId: string;
  treatmentId: string;
  name: string;
  status: "taken" | "omitted";
  occurredAt: string;
  recordedAt: string;
  reason: string | null;
  origin: "patient_reported" | "staff_recorded";
}

export function isRequiredMedication(treatment: MedicationTreatment): boolean {
  return treatment.isRequired ?? (treatment.origin === "staff_recorded" && treatment.productType !== "supplement");
}

export interface MedicationAdherence {
  scheduledDoses: number;
  dueDoses: number;
  takenDoses: number;
  omittedDoses: number;
  unrecordedDoses: number;
  percent: number | null;
  offPlanTakenDoses: number;
}

export interface MedicationWorkspace {
  patient: { id: string; name: string; mrn: string };
  access: { enabled: boolean; revision: number };
  treatments: MedicationTreatment[];
  doses: MedicationDose[];
  history: MedicationEvent[];
  adherence?: MedicationAdherence | null;
  summary: {
    activeTreatments: number;
    scheduledDoses: number;
    takenDoses: number;
    pendingDoses: number;
  };
}

export interface CreateMedicationRequest {
  clientRequestId: string;
  medicationId: string | null;
  name: string;
  productType: MedicationProductType;
  dosage: number;
  unit: string;
  route: string;
  instructions: string;
  times: string[];
  timeZone: string;
  startDate: string;
  endDate: string | null;
}

export interface RecordMedicationDoseRequest {
  scheduledAt?: string;
  clientRequestId: string;
  status: "taken" | "omitted";
  occurredAt: string;
  reason: string | null;
  expectedRevision: number;
}

/** UUID también en WebKit antiguo y previews HTTP por LAN. No persiste datos clínicos. */
export function createMedicationRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Toda operación queda vinculada a la cuenta que la inició, incluido un retry 401.
export const fetchMedicationCapabilities = (owner: string, signal?: AbortSignal) =>
  apiFetch<MedicationCapabilities>("/api/v1/me/capabilities", { signal, expectedUserId: owner });

export const fetchMyMedications = (owner: string, date: string, timeZone: string, signal?: AbortSignal) =>
  apiFetch<MedicationWorkspace>(`/api/v1/me/medications?${new URLSearchParams({ date, timeZone })}`, {
    signal,
    expectedUserId: owner,
  });

export const createMyMedication = (owner: string, body: CreateMedicationRequest) =>
  apiFetch<MedicationTreatment>("/api/v1/me/medications/treatments", {
    method: "POST", body, expectedUserId: owner,
  });

export const recordMyMedicationDose = (owner: string, doseId: string, body: RecordMedicationDoseRequest) =>
  apiFetch<MedicationDose>(`/api/v1/me/medications/doses/${encodeURIComponent(doseId)}/events`, {
    method: "POST", body, expectedUserId: owner,
  });

export const setMyMedicationStatus = (owner: string, treatment: MedicationTreatment, status: MedicationStatus) =>
  apiFetch<MedicationTreatment>(`/api/v1/me/medications/treatments/${encodeURIComponent(treatment.id)}/status`, {
    method: "PUT", body: { status, expectedRevision: treatment.revision }, expectedUserId: owner,
  });
