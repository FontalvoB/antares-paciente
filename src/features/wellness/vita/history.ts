/**
 * Historial local de Vita por usuario y módulo (KAN-167).
 *
 * Retención documentada (ver README.md de esta carpeta):
 * - clave `wellness.vita.history.v1:<propietario seudónimo>:<módulo>`;
 * - el propietario es un hash FNV-1a del identificador de sesión: el id real
 *   nunca se escribe en el almacenamiento;
 * - se guardan como máximo `VITA_HISTORY_MAX_MESSAGES` mensajes por módulo y
 *   cada mensaje caduca a los `VITA_HISTORY_TTL_DAYS` días;
 * - solo se guarda rol, texto saneado, fecha y número de adjuntos (sin nombres
 *   de fichero, ids de ejecución, acciones ni identificadores de recurso);
 * - correos, números largos (teléfono/documento) y UUID se enmascaran antes de
 *   escribir.
 */
import { looksPersonal } from "./context";
import type { VitaModuleId } from "./context";

export const VITA_HISTORY_PREFIX = "wellness.vita.history.v1";
export const VITA_HISTORY_MAX_MESSAGES = 30;
export const VITA_HISTORY_TTL_DAYS = 7;
const TTL_MS = VITA_HISTORY_TTL_DAYS * 24 * 60 * 60 * 1000;
const MAX_TEXT = 2000;
const MASK = "•••";

export interface VitaHistoryMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  /** Fecha ISO de creación. */
  at: string;
  /** Número de adjuntos enviados con el mensaje del usuario. */
  attachments?: number;
  /** `true` si es un aviso de indisponibilidad local, no una respuesta real. */
  failed?: boolean;
}

/** Hash FNV-1a de 32 bits en hexadecimal: seudónimo estable del propietario. */
export function vitaOwnerKey(owner: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < owner.length; index += 1) {
    hash ^= owner.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function storageKey(owner: string, module: VitaModuleId): string {
  return `${VITA_HISTORY_PREFIX}:${vitaOwnerKey(owner)}:${module}`;
}

/** Enmascara correos, números largos y UUID de un texto antes de guardarlo. */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, MASK)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, MASK)
    .replace(/\+?\d(?:[\s.\-()]*\d){6,}/g, MASK);
}

function isMessage(value: unknown): value is VitaHistoryMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && (item.role === "user" || item.role === "bot")
    && typeof item.text === "string" && typeof item.at === "string" && Number.isFinite(Date.parse(item.at));
}

function prune(messages: VitaHistoryMessage[], now: number): VitaHistoryMessage[] {
  return messages
    .filter((message) => now - Date.parse(message.at) < TTL_MS)
    .slice(-VITA_HISTORY_MAX_MESSAGES);
}

/** Lee el historial vigente del módulo; descarta lo caducado o corrupto. */
export function loadVitaHistory(owner: string, module: VitaModuleId, now = Date.now()): VitaHistoryMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(owner, module));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const kept = prune(parsed.filter(isMessage), now);
    if (kept.length !== parsed.length) writeRaw(owner, module, kept);
    return kept;
  } catch {
    return [];
  }
}

function writeRaw(owner: string, module: VitaModuleId, messages: VitaHistoryMessage[]) {
  try {
    const key = storageKey(owner, module);
    if (messages.length) localStorage.setItem(key, JSON.stringify(messages));
    else localStorage.removeItem(key);
  } catch {
    // Almacenamiento lleno o bloqueado: el historial es una comodidad local.
  }
}

/** Guarda el historial del módulo aplicando saneado y retención. */
export function saveVitaHistory(owner: string, module: VitaModuleId, messages: VitaHistoryMessage[], now = Date.now()): VitaHistoryMessage[] {
  const clean = prune(messages.map((message) => {
    const text = redactPersonalData(message.text).slice(0, MAX_TEXT);
    return {
      id: message.id,
      role: message.role,
      text: looksPersonal(text) ? MASK : text,
      at: message.at,
      ...(message.attachments ? { attachments: message.attachments } : {}),
      ...(message.failed ? { failed: true } : {}),
    };
  }), now);
  writeRaw(owner, module, clean);
  return clean;
}

/** Borra el historial de un módulo del propietario. */
export function clearVitaHistory(owner: string, module: VitaModuleId): void {
  writeRaw(owner, module, []);
}
