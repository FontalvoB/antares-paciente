/**
 * SOS como acceso rápido global (KAN-137).
 *
 * Utilidades puras y de almacenamiento local, sin backend ni IA:
 * - auditoría de cada activación (fecha, hora, resultado y pantalla);
 * - registro local (mock) del aviso a contactos al terminar la cuenta regresiva;
 * - evento global `wellness:sos` para abrir el SOS desde voz, chat o IA;
 * - detección de frases de ayuda urgente;
 * - regla de disponibilidad del botón (oculto en el registro inicial sin contactos).
 */

/** Clave de la auditoría local de activaciones SOS. */
export const SOS_AUDIT_KEY = "wellness.sos.audit.v1";
/** Clave del registro local (mock) de avisos a contactos de emergencia. */
export const SOS_NOTICE_KEY = "wellness.sos.notices.v1";
/** Máximo de entradas conservadas en cada registro local. */
export const SOS_LOG_MAX = 50;
/** Duración de la cuenta regresiva antes de llamar a emergencias. */
export const SOS_COUNTDOWN_SECONDS = 5;
/** Evento global que abre el SOS (voz, chat, IA o cualquier módulo). */
export const SOS_EVENT = "wellness:sos";

export type SosAuditResult = "cancelled" | "called_911" | "called_contact";
export type SosTriggerSource =
  "nav" | "quick" | "voice" | "chat" | "ai" | "event";

export interface SosAuditEntry {
  /** Fecha local `YYYY-MM-DD`. */
  date: string;
  /** Hora local `HH:mm:ss`. */
  time: string;
  result: SosAuditResult;
  /** Pantalla desde la que se activó (identificador interno, sin datos personales). */
  screen: string;
}

export interface SosContactNotice {
  date: string;
  time: string;
  /** Solo la cantidad de contactos avisados: nunca nombres ni teléfonos. */
  contacts: number;
}

const pad = (value: number) => String(value).padStart(2, "0");

function stamp(now: Date): { date: string; time: string } {
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

function readList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function appendCapped<T>(key: string, entry: T): T[] {
  const next = [...readList<T>(key), entry].slice(-SOS_LOG_MAX);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Almacenamiento lleno o bloqueado: la emergencia nunca depende de la auditoría.
  }
  return next;
}

/** Lee la auditoría local (más antigua primero). */
export function readSosAudit(): SosAuditEntry[] {
  return readList<SosAuditEntry>(SOS_AUDIT_KEY);
}

/** Registra el resultado de una activación; conserva las últimas {@link SOS_LOG_MAX}. */
export function recordSosAudit(
  result: SosAuditResult,
  screen: string,
  now = new Date(),
): SosAuditEntry {
  const entry: SosAuditEntry = {
    ...stamp(now),
    result,
    screen: screen.slice(0, 40) || "unknown",
  };
  appendCapped(SOS_AUDIT_KEY, entry);
  return entry;
}

/** Lee el registro local de avisos a contactos. */
export function readSosNotices(): SosContactNotice[] {
  return readList<SosContactNotice>(SOS_NOTICE_KEY);
}

/** Mock local del aviso a contactos de emergencia (sin backend). */
export function recordSosContactNotice(
  contacts: number,
  now = new Date(),
): SosContactNotice {
  const entry: SosContactNotice = {
    ...stamp(now),
    contacts: Math.max(0, Math.trunc(contacts)),
  };
  appendCapped(SOS_NOTICE_KEY, entry);
  return entry;
}

/** Pide abrir el SOS desde cualquier punto de la app (voz, chat, IA). */
export function requestSos(source: SosTriggerSource = "event"): void {
  window.dispatchEvent(new CustomEvent(SOS_EVENT, { detail: { source } }));
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Frases explícitas de ayuda urgente (ES/EN). Se evitan palabras sueltas ambiguas. */
const URGENT_PHRASES = [
  "ayuda urgente",
  "necesito ayuda ya",
  "necesito ayuda ahora",
  "auxilio",
  "socorro",
  "es una emergencia",
  "tengo una emergencia",
  "llama al 911",
  "llamar al 911",
  "llama a emergencias",
  "llamar a emergencias",
  "activa el sos",
  "activar sos",
  "urgent help",
  "i need help now",
  "help me now",
  "this is an emergency",
  "i have an emergency",
  "call 911",
  "call emergency",
];

/**
 * `true` si el texto es "SOS" o pide ayuda urgente de forma explícita.
 * "contacto de emergencia" o "qué hago en una emergencia" no disparan.
 */
export function isSosUtterance(text: string | null | undefined): boolean {
  if (!text) return false;
  const value = normalize(text);
  if (!value) return false;
  // "SOS" como orden (sola o con un refuerzo corto); "¿qué hace el botón SOS?" no dispara.
  if (
    /^(s o s|sos)( (sos|ayuda|help|please|por favor|ya|ahora|now))*$/.test(
      value,
    )
  )
    return true;
  const padded = ` ${value} `;
  return URGENT_PHRASES.some((phrase) => padded.includes(` ${phrase} `));
}

/** Datos mínimos para decidir si el SOS global está disponible. */
export interface SosAvailabilityInput {
  flow: string;
  user: { fam1Cel?: string | null; fam2Cel?: string | null };
}

/** Hay al menos un contacto de emergencia con teléfono. */
export function hasEmergencyContact(
  user: SosAvailabilityInput["user"],
): boolean {
  return Boolean(
    user.fam1Cel?.replace(/\D/g, "") || user.fam2Cel?.replace(/\D/g, ""),
  );
}

/**
 * El SOS está en todas las pantallas excepto antes de iniciar sesión y en el
 * registro inicial (onboarding/tests) mientras no haya contactos.
 */
export function isSosAvailable({ flow, user }: SosAvailabilityInput): boolean {
  if (flow === "app") return true;
  if (flow === "onboarding" || flow === "tests")
    return hasEmergencyContact(user);
  return false;
}
