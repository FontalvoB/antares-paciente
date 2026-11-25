import type { UserProfile } from "../../../types";

export const WELLNESS_CONSENT_VERSIONS = {
  "sensitive-data": "2026-11-25-draft.1",
  "apple-health": "2026-11-25-draft.1",
  notifications: "2026-11-25-draft.1",
} as const;

export type WellnessConsentScope = keyof typeof WELLNESS_CONSENT_VERSIONS;

export const WELLNESS_CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export const WELLNESS_PRIVACY_AUDIT_PREFIX = "copp.wellness-privacy.audit.v1.";
const DATA_PREFIX = "wellness.";

export interface WellnessConsent {
  scope: WellnessConsentScope;
  version: string;
  acceptedAt: string;
  actor: string;
}

type AuditEvent =
  | (WellnessConsent & { action: "accepted"; at: string })
  | { action: "withdrawn"; scope: WellnessConsentScope; version: string; actor: string; at: string }
  | { action: "deleted"; actor: string; at: string };

export function wellnessPrivacyActor(user: Partial<UserProfile>): string {
  return user.id?.trim() || user.email?.trim().toLowerCase() || "";
}

export function wellnessDataKeys(storage = window.localStorage): string[] {
  return keysWithPrefix(storage, DATA_PREFIX);
}

function keysWithPrefix(storage: Storage, prefix: string): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key?.startsWith(prefix) === true)
    .sort();
}

function readAudit(storage: Storage): AuditEvent[] {
  return keysWithPrefix(storage, WELLNESS_PRIVACY_AUDIT_PREFIX).flatMap((key) => {
    try {
      const event = JSON.parse(storage.getItem(key) ?? "null") as AuditEvent | null;
      return event && typeof event.actor === "string" && Number.isFinite(Date.parse(event.at))
        ? [event]
        : [];
    } catch {
      return [];
    }
  });
}

export function exportWellnessPrivacyAudit(actor: string, storage = window.localStorage) {
  return readAudit(storage).filter((event) => event.actor === actor);
}

function appendAudit(event: AuditEvent, storage: Storage): void {
  if (!event.actor) throw new Error("Wellness consent requires an actor");
  const prefix = WELLNESS_PRIVACY_AUDIT_PREFIX + event.at + ".";
  const order = String(keysWithPrefix(storage, prefix).length).padStart(8, "0");
  const key = prefix + order + "." + crypto.randomUUID();
  storage.setItem(key, JSON.stringify(event));
}

export function saveWellnessConsent(
  scope: WellnessConsentScope,
  actor: string,
  checked: boolean,
  now = new Date(),
  storage = window.localStorage,
): void {
  const at = now.toISOString();
  const fields = { actor, scope, version: WELLNESS_CONSENT_VERSIONS[scope], at };
  appendAudit(checked ? { ...fields, action: "accepted", acceptedAt: at } : {
    ...fields, action: "withdrawn",
  }, storage);
}

export function readWellnessConsent(
  scope: WellnessConsentScope,
  actor: string,
  now = new Date(),
  storage?: Storage,
): WellnessConsent | null {
  if (!actor) return null;
  try {
    const events = readAudit(storage ?? window.localStorage);
    const event = events.reverse().find((entry) =>
      entry.action === "deleted" || (entry.actor === actor && entry.scope === scope),
    );
    if (event?.action !== "accepted" || event.version !== WELLNESS_CONSENT_VERSIONS[scope]) return null;
    const age = now.getTime() - Date.parse(event.acceptedAt);
    return age >= 0 && age < WELLNESS_CONSENT_MAX_AGE_MS ? event : null;
  } catch {
    return null;
  }
}

/** El llamador vuelve a iniciar la acción después de revisar el consentimiento. */
export function requireWellnessConsent(
  scope: WellnessConsentScope,
  actor: string,
  openPrivacy: () => void,
): boolean {
  if (readWellnessConsent(scope, actor)) return true;
  openPrivacy();
  return false;
}

export function deleteWellnessData(actor: string, now = new Date(), storage = window.localStorage): void {
  appendAudit({ action: "deleted", actor, at: now.toISOString() }, storage);
  for (const key of wellnessDataKeys(storage)) storage.removeItem(key);
}
