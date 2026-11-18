import { apiFetch } from "./apiClient";
export interface MedicationPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface MedicationSupply {
  id: string;
  patientId: string;
  patientName: string;
  treatmentId: string;
  name: string;
  unit: string;
  balance: number;
  dailyUsage: number;
  daysRemaining: number | null;
  expiresOn: string | null;
  revision: number;
  tracked: boolean;
}
export interface StockRequest {
  clientRequestId: string;
  kind: "initial" | "refill" | "adjustment";
  quantity: number;
  expectedRevision: number;
  expiresOn: string | null;
  reason: string | null;
}
export interface StockMovement {
  id: string;
  kind: string;
  quantityDelta: number;
  balanceAfter: number;
  reason: string | null;
  recordedAt: string;
  origin: string;
}
export interface MedicationEffect {
  id: string;
  patientId: string;
  treatmentId: string | null;
  treatmentName: string | null;
  symptom: string;
  severity: "mild" | "moderate" | "severe";
  status: "open" | "follow_up" | "resolved";
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  revision: number;
  followUps: {
    id: string;
    actorId: string;
    status: string;
    note: string;
    createdAt: string;
  }[];
}
export interface EffectRequest {
  clientRequestId: string;
  treatmentId: string | null;
  symptom: string;
  severity: "mild" | "moderate" | "severe";
  notes: string | null;
}
const root = "/api/v1/me/medications";
export const fetchMyInventory = (
  owner: string,
  page: number,
  signal?: AbortSignal,
) =>
  apiFetch<MedicationPage<MedicationSupply>>(
    `${root}/inventory?page=${page}&pageSize=20`,
    { signal, expectedUserId: owner },
  );
export const saveMyStock = (
  owner: string,
  treatmentId: string,
  body: StockRequest,
) =>
  apiFetch<MedicationSupply>(
    `${root}/inventory/${encodeURIComponent(treatmentId)}/movements`,
    { method: "POST", body, expectedUserId: owner },
  );
export const fetchMyStockMovements = (
  owner: string,
  treatmentId: string,
  signal?: AbortSignal,
) =>
  apiFetch<StockMovement[]>(
    `${root}/inventory/${encodeURIComponent(treatmentId)}/movements`,
    { signal, expectedUserId: owner },
  );
export const fetchMyEffects = (owner: string, signal?: AbortSignal) =>
  apiFetch<MedicationEffect[]>(`${root}/effects`, {
    signal,
    expectedUserId: owner,
  });
export const reportMyEffect = (owner: string, body: EffectRequest) =>
  apiFetch<MedicationEffect>(`${root}/effects`, {
    method: "POST",
    body,
    expectedUserId: owner,
  });
