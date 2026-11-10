import { apiFetch } from "../../utils/apiClient";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

export interface PatientDocument {
  id: string;
  title: string;
  createdAt: string;
  contentType: string;
}

export interface PatientDocumentsPage {
  items: PatientDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** La API resuelve al paciente por JWT; no se envía un identificador de paciente. */
export function getMyDocuments(page = 1, signal?: AbortSignal): Promise<PatientDocumentsPage> {
  return apiFetch(`/api/v1/me/documents?page=${page}&pageSize=20`, { signal });
}

/** El backend comprueba la propiedad antes de emitir un enlace temporal. */
export async function getMyDocumentUrl(id: string, signal?: AbortSignal): Promise<string> {
  const result = await apiFetch<{ url: string }>(`/api/v1/me/documents/${encodeURIComponent(id)}/download`, { signal });
  if (typeof result?.url !== "string" || !result.url.trim()) throw new Error("Invalid document URL");
  const url = new URL(result.url, getApiBaseUrl() || window.location.origin);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid document URL");
  return url.href;
}
