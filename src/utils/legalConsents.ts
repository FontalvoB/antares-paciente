import { apiFetch, ApiError } from "./apiClient";
import { requestLanguage } from "./requestLanguage";
import { getAccessToken } from "./authApi";
import { sessionUserId } from "./sessionIdentity";

export const LEGAL_CONSENT_SCOPES = ["program", "chat", "voice", "food", "lab", "patient-ai", "sos"] as const;
export type LegalConsentScope = typeof LEGAL_CONSENT_SCOPES[number];
export type ConsentLocale = "es" | "en";
export interface LegalConsentDocument {
  code: string;
  versionId: string;
  version: string;
  title: string;
  content: string;
  locale: ConsentLocale;
  publishedAt: string;
}
export interface LegalConsentRequirement {
  scope: LegalConsentScope;
  available: boolean;
  accepted: boolean;
  disclosureId: string | null;
  providers: string[];
  documents: LegalConsentDocument[];
  receiptId: string | null;
  acceptedAt: string | null;
}
export interface LegalConsentStatus { locale: ConsentLocale; scopes: LegalConsentRequirement[] }
export interface LegalConsentReceipt {
  id: string; scope: LegalConsentScope; versionId: string; locale: ConsentLocale;
  disclosureId: string; acceptedAt: string; withdrawnAt: string | null;
}

export const legalConsentEnforcementEnabled = () => import.meta.env.VITE_ENFORCE_LEGAL_CONSENTS === "true";

const route = "/api/v1/me/legal-consents";
export const legalConsentOwner = () => sessionUserId(getAccessToken());
export function assertLegalConsentOwner(owner: string | null) {
  if (owner !== legalConsentOwner()) throw consentFailure("CONSENT_CANCELLED");
}
export function createConsentRequestKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const changeListeners = new Set<(scope: LegalConsentScope | null) => void>();
type ConsentPrompt = (scope: LegalConsentScope, locale: ConsentLocale, signal?: AbortSignal) => Promise<boolean>;
let prompt: ConsentPrompt | null = null;

export function registerLegalConsentPrompt(handler: ConsentPrompt) {
  prompt = handler;
  return () => { if (prompt === handler) prompt = null; };
}
export function onLegalConsentChange(listener: (scope: LegalConsentScope | null) => void) {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}
/** La cuenta siguiente no hereda una decisión pendiente ni una sesión de voz. */
export function resetLegalConsentSession() { changeListeners.forEach(listener => listener(null)); }

export function isLegalConsentError(error: unknown): error is ApiError {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  return typeof code === "string" && (code.startsWith("CONSENT_") || code === "DOCUMENT_VERSION_CHANGED");
}
export function legalConsentMessage(error: unknown): string {
  const code = isLegalConsentError(error) ? error.code : undefined;
  if (code === "CONSENT_CANCELLED") return "No se envió información. Puedes revisar tus autorizaciones cuando quieras.";
  if (code === "DOCUMENT_VERSION_CHANGED" || code === "CONSENT_REQUEST_CONFLICT") return "El documento o los proveedores cambiaron. Revisa la versión actual y vuelve a decidir.";
  if (code === "CONSENT_REQUIRED") return "Revisa y acepta la autorización vigente antes de usar esta función.";
  if (code === "CONSENT_DOCUMENT_UNAVAILABLE" || code === "CONSENT_SUBJECT_REQUIRED") return "La autorización aprobada todavía no está disponible. Esta función no puede iniciarse.";
  return "No pudimos comprobar tu autorización. Intenta de nuevo.";
}
export function consentFailure(code: string, status = 403): ApiError {
  const error = new ApiError({ code, status, message: "" });
  return new ApiError({ code, status, message: legalConsentMessage(error) });
}
/** Conserva códigos de consentimiento en los clientes con fetch/stream/multipart. */
export async function legalConsentResponseError(response: Response): Promise<ApiError | null> {
  if (![400, 403, 409, 503].includes(response.status)) return null;
  try {
    const body = await response.clone().json();
    if (isLegalConsentError(body)) return consentFailure(body.code!, response.status);
  } catch { /* La respuesta habitual conserva el manejo de errores existente. */ }
  return null;
}
export async function getLegalConsents(locale: ConsentLocale, signal?: AbortSignal, expectedUserId = legalConsentOwner()) {
  const status = await apiFetch<LegalConsentStatus>(`${route}?locale=${locale}`, { cache: "no-store", signal, expectedUserId });
  assertLegalConsentOwner(expectedUserId);
  return status;
}
export function availableLegalDocument(requirement: LegalConsentRequirement | undefined, locale: ConsentLocale) {
  if (!requirement?.available || !requirement.disclosureId || requirement.documents.length !== 1) return null;
  const document = requirement.documents[0];
  return document.locale === locale && document.versionId && document.content.trim() ? document : null;
}
export async function verifyLegalConsent(scope: LegalConsentScope, locale: ConsentLocale = requestLanguage(), signal?: AbortSignal) {
  if (signal?.aborted) throw consentFailure("CONSENT_CANCELLED");
  if (!legalConsentEnforcementEnabled()) return null;
  let status: LegalConsentStatus;
  try { status = await getLegalConsents(locale, signal); }
  catch (error) {
    if (isLegalConsentError(error)) throw error;
    throw consentFailure(signal?.aborted ? "CONSENT_CANCELLED" : "CONSENT_CHECK_FAILED", 503);
  }
  const requirement = status.scopes.find(item => item.scope === scope);
  if (!availableLegalDocument(requirement, locale)) throw consentFailure("CONSENT_DOCUMENT_UNAVAILABLE", 503);
  if (!requirement?.accepted || !requirement.receiptId) throw consentFailure("CONSENT_REQUIRED");
  return requirement;
}
/** Siempre consulta al servidor; un recibo local nunca autoriza una nueva petición. */
export async function requireLegalConsent(scope: LegalConsentScope, locale: ConsentLocale = requestLanguage(), signal?: AbortSignal) {
  if (signal?.aborted) throw consentFailure("CONSENT_CANCELLED");
  if (!legalConsentEnforcementEnabled()) return;
  if (prompt) {
    let accepted: boolean;
    try { accepted = await prompt(scope, locale, signal); }
    catch (error) {
      if (isLegalConsentError(error)) throw error;
      throw consentFailure("CONSENT_CHECK_FAILED", 503);
    }
    if (!accepted || signal?.aborted) throw consentFailure("CONSENT_CANCELLED");
  } else {
    await verifyLegalConsent(scope, locale, signal);
  }
}
export async function acceptLegalConsent(requirement: LegalConsentRequirement, locale: ConsentLocale, idempotencyKey: string, signal?: AbortSignal) {
  const expectedUserId = legalConsentOwner();
  const document = availableLegalDocument(requirement, locale);
  if (!document) throw consentFailure("CONSENT_DOCUMENT_UNAVAILABLE", 503);
  await apiFetch<LegalConsentReceipt>(`${route}/acceptances`, { method: "POST", signal, expectedUserId, body: {
    scope: requirement.scope, versionId: document.versionId, locale,
    disclosureId: requirement.disclosureId, idempotencyKey,
  } });
  assertLegalConsentOwner(expectedUserId);
  // Un POST idempotente puede devolver un recibo histórico retirado o sustituido.
  const status = await getLegalConsents(locale, signal, expectedUserId);
  const current = status.scopes.find(item => item.scope === requirement.scope);
  if (!current?.accepted || !current.receiptId || current.disclosureId !== requirement.disclosureId
    || availableLegalDocument(current, locale)?.versionId !== document.versionId) {
    throw consentFailure("DOCUMENT_VERSION_CHANGED", 409);
  }
  return status;
}
export async function withdrawLegalConsent(receiptId: string, scope: LegalConsentScope, signal?: AbortSignal) {
  const expectedUserId = legalConsentOwner();
  await apiFetch<void>(`${route}/acceptances/${encodeURIComponent(receiptId)}`, { method: "DELETE", signal, expectedUserId });
  assertLegalConsentOwner(expectedUserId);
  changeListeners.forEach(listener => listener(scope));
}
