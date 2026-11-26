/**
 * Historial local de Vita por cuenta y módulo (KAN-167, v2).
 *
 * Retención documentada (ver README.md de esta carpeta):
 * - clave `wellness.vita.history.v2:<espacio opaco>:<módulo>`. El espacio es un
 *   hash de 64 bits de `sal del dispositivo + id de cuenta del JWT`: no contiene
 *   el id, no se comparte entre dispositivos y no existe fallback compartido
 *   (sin cuenta verificable no se persiste nada);
 * - máximo `VITA_HISTORY_MAX_MESSAGES` mensajes por módulo; cada mensaje caduca
 *   a los `VITA_HISTORY_TTL_DAYS` días y la purga recorre TODAS las claves de
 *   Vita (también módulos y cuentas inactivos);
 * - el texto libre del usuario nunca se guarda: solo la clave de una sugerencia
 *   rápida o un marcador "mensaje enviado";
 * - la respuesta de Vita a un texto libre tampoco se guarda (puede repetir
 *   nombres o direcciones que la redacción heurística no reconozca): queda un
 *   marcador. Solo se guardan las respuestas a sugerencias rápidas, con
 *   redacción de identificadores del perfil, correos, números largos, UUID y
 *   direcciones;
 * - las claves v1 (texto sin redacción ampliada) se eliminan al purgar.
 */
import type { VitaModuleId } from "./context";

export const VITA_HISTORY_PREFIX = "wellness.vita.history.v2";
export const VITA_HISTORY_LEGACY_PREFIX = "wellness.vita.history.v1";
export const VITA_NAMESPACE_SALT_KEY = "wellness.vita.salt.v1";
export const VITA_HISTORY_MAX_MESSAGES = 30;
export const VITA_HISTORY_TTL_DAYS = 7;
const TTL_MS = VITA_HISTORY_TTL_DAYS * 24 * 60 * 60 * 1000;
const MAX_TEXT = 2000;
const MASK = "•••";
/** Claves de versiones anteriores (historial v1 y aviso v1 con hash de 32 bits). */
const LEGACY_PREFIXES = [VITA_HISTORY_LEGACY_PREFIX, "wellness.vita.nudge.v1"];

/** Mensaje persistido: sin texto libre del usuario. */
export interface VitaHistoryMessage {
  id: string;
  role: "user" | "bot";
  /** Texto de Vita (redactado). Vacío en mensajes del usuario. */
  text: string;
  /** Fecha ISO de creación. */
  at: string;
  /** Mensaje del usuario: clave i18n de la sugerencia rápida elegida. */
  promptKey?: string;
  /** Texto libre del usuario o respuesta a un texto libre: no persistido. */
  redacted?: boolean;
  /** Número de adjuntos enviados con el mensaje del usuario. */
  attachments?: number;
  /** Aviso local de indisponibilidad, no una respuesta real. */
  failed?: boolean;
}

/** Identificadores del perfil que se enmascaran en el texto persistido. */
export interface VitaRedactionTerms {
  profile: readonly string[];
  /** Texto libre del usuario en el mismo turno (para enmascarar ecos). */
  echo?: string;
}

function fnv1a(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Hash de 64 bits (dos FNV-1a con semillas distintas). */
export function hash64(input: string): string {
  return fnv1a(input, 0x811c9dc5) + fnv1a(`${input.length}:${input}`, 0x9747b28c);
}

function deviceSalt(): string | null {
  try {
    const existing = localStorage.getItem(VITA_NAMESPACE_SALT_KEY);
    if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const salt = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(VITA_NAMESPACE_SALT_KEY, salt);
    return salt;
  } catch {
    return null;
  }
}

/**
 * Espacio opaco de la cuenta. `null` sin cuenta verificable o sin
 * almacenamiento: en ese caso el historial vive solo en memoria.
 */
export function vitaNamespace(accountId: string | null | undefined): string | null {
  const id = accountId?.trim();
  if (!id) return null;
  const salt = deviceSalt();
  return salt ? hash64(`${salt}:${id}`) : null;
}

function storageKey(namespace: string, module: VitaModuleId): string {
  return `${VITA_HISTORY_PREFIX}:${namespace}:${module}`;
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_NUMBER = /\+?\d(?:[\s.\-()]*\d){6,}/g;
// Dirección: vía + número (ES/EN), p. ej. "Calle 45 # 12-30", "Av. Siempre Viva 742", "221B Baker Street".
const ADDRESS = /\b(?:calle|cl|carrera|cra|kr|avenida|av|diagonal|dg|transversal|tv|street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln)\.?\s+[\p{L}\d .#-]{0,40}?\d+[\p{L}\d#-]*(?:\s*[#-]\s*\d+[\p{L}\d-]*)?/giu;
const ADDRESS_EN = /\b\d+[a-z]?\s+(?:[\p{Lu}][\p{L}]+\s+){1,3}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln)\b\.?/giu;
// Palabra con mayúscula inicial (posible nombre propio o lugar).
const PROPER = /\p{Lu}[\p{L}'-]{2,}/gu;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Enmascara datos personales reconocibles de un texto antes de guardarlo. */
export function redactPersonalData(text: string, terms: VitaRedactionTerms = { profile: [] }): string {
  const words = new Set<string>();
  for (const value of terms.profile) {
    for (const part of value.split(/[\s,;]+/)) if (part.trim().length >= 3) words.add(part.trim());
  }
  // Ecos: nombres propios que el usuario escribió en su turno (salvo inicio de frase común).
  for (const match of terms.echo?.matchAll(PROPER) ?? []) words.add(match[0]);
  let result = text
    .replace(EMAIL, MASK)
    .replace(UUID, MASK)
    .replace(ADDRESS, MASK)
    .replace(ADDRESS_EN, MASK)
    .replace(LONG_NUMBER, MASK);
  for (const word of words) {
    result = result.replace(new RegExp(`(?<![\\p{L}\\d])${escapeRegExp(word)}(?![\\p{L}\\d])`, "giu"), MASK);
  }
  return result;
}

function isMessage(value: unknown): value is VitaHistoryMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && (item.role === "user" || item.role === "bot")
    && typeof item.text === "string" && typeof item.at === "string" && Number.isFinite(Date.parse(item.at))
    && (item.role === "bot" || item.text === "");
}

function prune(messages: VitaHistoryMessage[], now: number): VitaHistoryMessage[] {
  return messages
    .filter((message) => now - Date.parse(message.at) < TTL_MS)
    .slice(-VITA_HISTORY_MAX_MESSAGES);
}

function writeRaw(key: string, messages: VitaHistoryMessage[]) {
  try {
    if (messages.length) localStorage.setItem(key, JSON.stringify(messages));
    else localStorage.removeItem(key);
  } catch {
    // Almacenamiento lleno o bloqueado: el historial es una comodidad local.
  }
}

/**
 * Purga global: elimina las claves v1, los mensajes vencidos de cualquier
 * cuenta y módulo, y las claves corruptas o vacías.
 */
export function purgeVitaHistory(now = Date.now()): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && [VITA_HISTORY_PREFIX, ...LEGACY_PREFIXES].some((prefix) => key.startsWith(`${prefix}:`))) keys.push(key);
    }
    for (const key of keys) {
      if (LEGACY_PREFIXES.some((prefix) => key.startsWith(`${prefix}:`))) {
        localStorage.removeItem(key);
        continue;
      }
      let parsed: unknown;
      try { parsed = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { parsed = null; }
      writeRaw(key, Array.isArray(parsed) ? prune(parsed.filter(isMessage), now) : []);
    }
  } catch {
    // Sin acceso al almacenamiento no hay nada que purgar.
  }
}

/** Lee el historial vigente del módulo para el espacio dado. */
export function loadVitaHistory(namespace: string | null, module: VitaModuleId, now = Date.now()): VitaHistoryMessage[] {
  if (!namespace) return [];
  try {
    const key = storageKey(namespace, module);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const kept = prune(parsed.filter(isMessage), now);
    if (kept.length !== parsed.length) writeRaw(key, kept);
    return kept;
  } catch {
    return [];
  }
}

/** Mensaje en memoria: puede llevar el texto libre del usuario (no se guarda). */
export interface VitaHistoryInput extends Omit<VitaHistoryMessage, "text"> {
  text: string;
}

/**
 * Guarda el historial del módulo: descarta el texto libre del usuario, redacta
 * el de Vita (con eco del turno anterior del usuario) y aplica la retención.
 */
export function saveVitaHistory(
  namespace: string | null,
  module: VitaModuleId,
  messages: readonly VitaHistoryInput[],
  profile: readonly string[] = [],
  now = Date.now(),
): VitaHistoryMessage[] {
  let answersPrompt = false;
  const clean = prune(messages.map((message): VitaHistoryMessage => {
    const base = { id: message.id, role: message.role, at: message.at };
    if (message.role === "user") {
      answersPrompt = Boolean(message.promptKey);
      return {
        ...base, text: "",
        ...(message.promptKey ? { promptKey: message.promptKey } : { redacted: true }),
        ...(message.attachments ? { attachments: message.attachments } : {}),
      };
    }
    // Respuesta a texto libre: no se persiste (marcador). Los avisos locales de
    // indisponibilidad son texto propio de la app y se conservan.
    if (message.failed) return { ...base, text: redactPersonalData(message.text, { profile }).slice(0, MAX_TEXT), failed: true };
    if (!answersPrompt) return { ...base, text: "", redacted: true };
    const text = redactPersonalData(message.text, { profile }).slice(0, MAX_TEXT);
    return { ...base, text };
  }), now);
  if (namespace) writeRaw(storageKey(namespace, module), clean);
  return clean;
}

/** Borra el historial de un módulo del espacio dado. */
export function clearVitaHistory(namespace: string | null, module: VitaModuleId): void {
  if (namespace) writeRaw(storageKey(namespace, module), []);
}
