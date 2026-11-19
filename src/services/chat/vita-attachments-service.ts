import { apiFetch } from "../../utils/apiClient";
import { legalConsentOwner, requireLegalConsent } from "../../utils/legalConsents";
import type { ChatLanguage } from "../../utils/threadApi";

export interface VitaAttachment {
  attachmentId: string;
  kind: "pdf" | "image";
  contentType: string;
  sizeBytes: number;
  pageCount: number | null;
  expiresAt: string;
}

export interface PendingVitaAttachment extends VitaAttachment {
  name: string;
}

export interface VitaAttachmentReading {
  attachmentId: string;
  kind: VitaAttachment["kind"];
  readable: boolean;
}

export interface ArchivedVitaAttachment {
  documentId: string;
  attachmentId: string;
  title: string;
  documentTypeId: string;
  contentType: string;
  sizeBytes: number;
}

interface ClinicalDocumentType {
  id: string;
  name: string;
  code: string;
  allowedExtensions: string[];
}

const ATTACHMENTS = "/api/v1/vita/attachments";
// La API admite cuatro IDs. El lector de Vita puede rechazar más de tres.
export const VITA_ATTACHMENT_LIMIT = 3;
export const VITA_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const VITA_FILE_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

export async function uploadVitaAttachment(file: File, threadId: string, language: ChatLanguage, signal?: AbortSignal) {
  const expectedUserId = legalConsentOwner();
  await requireLegalConsent("chat", language, signal);
  const body = new FormData();
  body.append("file", file);
  body.append("threadId", threadId);
  body.append("language", language);
  return apiFetch<VitaAttachment>(ATTACHMENTS, { method: "POST", body, signal, expectedUserId, timeoutMs: 60_000 });
}

export function deleteVitaAttachment(attachmentId: string, expectedUserId = legalConsentOwner()) {
  return apiFetch<void>(`${ATTACHMENTS}/${encodeURIComponent(attachmentId)}`, { method: "DELETE", expectedUserId });
}

export async function archiveVitaAttachment(attachmentId: string, title: string, documentTypeId: string, language: ChatLanguage, signal?: AbortSignal) {
  const expectedUserId = legalConsentOwner();
  await requireLegalConsent("chat", language, signal);
  return apiFetch<ArchivedVitaAttachment>(`${ATTACHMENTS}/${encodeURIComponent(attachmentId)}/archive`, {
    method: "POST",
    body: { confirmed: true, title, documentTypeId },
    expectedUserId,
    signal,
    timeoutMs: 60_000,
  });
}

export async function getVitaDocumentTypes(contentType: string, signal?: AbortSignal): Promise<ClinicalDocumentType[]> {
  const extension = contentType === "application/pdf" ? "pdf" : contentType === "image/jpeg" ? "jpg" : "png";
  // El catálogo completo exige Documents.View. En la app de pacientes se
  // configura el tipo clínico genérico del entorno, que admite PDF, JPG y PNG.
  const generalTypeId = import.meta.env.VITE_VITA_GENERAL_DOCUMENT_TYPE_ID;
  if (generalTypeId) return [{ id: generalTypeId, code: "OTHER", name: "Otro documento", allowedExtensions: ["pdf", "jpg", "jpeg", "png"] }];
  const catalog = await apiFetch<{ types: ClinicalDocumentType[] }>("/api/v1/documents/catalog", {
    signal, expectedUserId: legalConsentOwner(),
  });
  return catalog.types.filter(type => !type.allowedExtensions.length || type.allowedExtensions.some(value => {
    const allowed = value.toLowerCase();
    return allowed === extension || (extension === "jpg" && allowed === "jpeg");
  }));
}
