import { ApiError } from "./apiClient";
import { getAccessToken } from "./authApi";
import { sessionUserId } from "./sessionIdentity";
import { requestLanguage, type RequestLanguage } from "./requestLanguage";
import type { LegalConsentScope } from "./legalConsents";

/**
 * Aviso y permiso local para las funciones de IA.
 *
 * Apple exige (5.1.1(i)/5.1.2(i)) explicar qué datos se envían a un servicio
 * de IA de terceros, identificarlo y pedir permiso antes de enviarlos. El
 * sistema de consentimientos versionados del backend sigue siendo la fuente
 * formal cuando está habilitado; este permiso local garantiza el aviso y el
 * bloqueo también en builds donde `VITE_ENFORCE_LEGAL_CONSENTS` está apagado.
 */
export const AI_DISCLOSURE_VERSION = "2026-11-21";

export const AI_DISCLOSURE_SCOPES = [
  "chat",
  "voice",
  "food",
  "lab",
  "patient-ai",
] as const satisfies readonly LegalConsentScope[];

export type AiDisclosureScope = (typeof AI_DISCLOSURE_SCOPES)[number];

export type AiDisclosureLocale = "es" | "en";

interface StoredDisclosure {
  version: string;
  acceptedAt: string;
}

const storagePrefix = "copp.ai-disclosure.";
const changeListeners = new Set<(accepted: boolean) => void>();
type DisclosurePrompt = (
  scope: AiDisclosureScope,
  locale: AiDisclosureLocale,
  signal?: AbortSignal,
) => Promise<boolean>;
let prompt: DisclosurePrompt | null = null;

export function isAiDisclosureScope(
  scope: LegalConsentScope,
): scope is AiDisclosureScope {
  return (AI_DISCLOSURE_SCOPES as readonly string[]).includes(scope);
}

export function aiDisclosureUserId(): string | null {
  return sessionUserId(getAccessToken());
}

export function aiDisclosureLocale(
  locale: RequestLanguage,
): AiDisclosureLocale {
  return locale === "en" ? "en" : "es";
}

function storageKey(userId: string): string {
  return `${storagePrefix}${userId}`;
}

function read(userId: string | null): StoredDisclosure | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDisclosure>;
    if (
      parsed?.version !== AI_DISCLOSURE_VERSION ||
      typeof parsed.acceptedAt !== "string"
    )
      return null;
    return { version: parsed.version, acceptedAt: parsed.acceptedAt };
  } catch {
    // Storage bloqueado o corrupto: se vuelve a pedir el permiso.
    return null;
  }
}

export function aiDisclosureAccepted(userId = aiDisclosureUserId()): boolean {
  return read(userId) !== null;
}

export function aiDisclosureAcceptedAt(
  userId = aiDisclosureUserId(),
): string | null {
  return read(userId)?.acceptedAt ?? null;
}

export function acceptAiDisclosure(userId = aiDisclosureUserId()): void {
  if (!userId) return;
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        version: AI_DISCLOSURE_VERSION,
        acceptedAt: new Date().toISOString(),
      } satisfies StoredDisclosure),
    );
  } catch {
    // Sin almacenamiento no se puede demostrar el permiso: la función seguirá bloqueada.
    return;
  }
  changeListeners.forEach((listener) => listener(true));
}

export function withdrawAiDisclosure(userId = aiDisclosureUserId()): void {
  if (!userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // La retirada debe ser efectiva aunque falle el almacenamiento.
  }
  changeListeners.forEach((listener) => listener(false));
}

export function onAiDisclosureChange(
  listener: (accepted: boolean) => void,
): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function registerAiDisclosurePrompt(
  handler: DisclosurePrompt,
): () => void {
  prompt = handler;
  return () => {
    if (prompt === handler) prompt = null;
  };
}

/**
 * Comprobación sin UI para refrescos y sesiones ya abiertas: si el permiso
 * local se retiró, la siguiente comprobación debe fallar cerrada.
 */
export function assertAiDisclosureAccepted(scope: LegalConsentScope): void {
  if (!isAiDisclosureScope(scope)) return;
  const userId = aiDisclosureUserId();
  if (!userId) return;
  if (!aiDisclosureAccepted(userId))
    throw disclosureFailure("CONSENT_REQUIRED");
}

function disclosureFailure(code: string, status = 403): ApiError {
  const message =
    code === "CONSENT_CANCELLED"
      ? "No se envió información. Puedes autorizar la IA cuando quieras."
      : "Revisa y acepta el aviso de IA antes de usar esta función.";
  return new ApiError({ code, status, message });
}

/**
 * Se ejecuta antes de cualquier petición de IA. El permiso es por cuenta y
 * por versión del aviso; un rechazo detiene la petición sin enviar datos.
 */
export async function requireAiDisclosure(
  scope: LegalConsentScope,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw disclosureFailure("CONSENT_CANCELLED");
  if (!isAiDisclosureScope(scope)) return;

  const userId = aiDisclosureUserId();
  // Sin sesión no hay envío posible: el backend exige JWT para estas rutas.
  if (!userId) return;
  if (aiDisclosureAccepted(userId)) return;
  if (!prompt) throw disclosureFailure("CONSENT_DOCUMENT_UNAVAILABLE", 503);

  let accepted: boolean;
  try {
    accepted = await prompt(
      scope,
      aiDisclosureLocale(requestLanguage()),
      signal,
    );
  } catch {
    throw disclosureFailure("CONSENT_CHECK_FAILED", 503);
  }
  if (!accepted || signal?.aborted)
    throw disclosureFailure("CONSENT_CANCELLED");
  if (!aiDisclosureAccepted(userId))
    throw disclosureFailure("CONSENT_CANCELLED");
}
