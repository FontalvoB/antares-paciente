/**
 * Contexto del módulo de origen para Vita (KAN-167).
 *
 * Cada pantalla pasa un identificador de módulo y un resumen corto de lo que
 * el usuario ve. Este fichero es la única puerta hacia el payload: acota el
 * tamaño y descarta cualquier cosa que parezca un dato personal, aunque el
 * llamador se equivoque.
 */
import type { ChatModuleContext } from "../../../services/chat/types";

/** Módulos desde los que se puede abrir Vita. */
export const VITA_MODULES = ["home", "protocol", "diet", "exercise", "close-day", "goal", "profile"] as const;
export type VitaModuleId = (typeof VITA_MODULES)[number];

/** Valor admitido en el resumen: solo primitivas cortas. */
export type VitaSummaryValue = string | number | boolean | null | undefined;
export type VitaModuleSummary = Readonly<Record<string, VitaSummaryValue>>;

/** Máximo de claves del resumen que viajan al backend. */
export const VITA_SUMMARY_MAX_KEYS = 8;
/** Longitud máxima de una clave del resumen. */
export const VITA_SUMMARY_MAX_KEY_LENGTH = 32;
/** Longitud máxima de un valor de texto del resumen. */
export const VITA_SUMMARY_MAX_VALUE_LENGTH = 60;

/**
 * Claves vetadas: cualquier clave que contenga estos fragmentos se descarta
 * (nombre, correo, teléfono, documento, dirección, identificadores).
 */
const BLOCKED_KEY = /(name|nombre|mail|correo|phone|tel[eé]fono|celular|mobile|document|cedula|c[eé]dula|dni|passport|address|direcci[oó]n|street|city|ciudad|zip|postal|patient|paciente|user|usuario|owner|\bid\b|id$|^id|uuid|token|birth|nacimiento|location|ubicaci[oó]n|lat|lon|gps|contact)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// 7+ dígitos seguidos (con espacios, puntos o guiones): teléfono o documento.
const LONG_NUMBER = /\d(?:[\s.\-()]*\d){6,}/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** `true` si el texto contiene un patrón de dato personal reconocible. */
export function looksPersonal(value: string): boolean {
  return EMAIL.test(value) || LONG_NUMBER.test(value) || UUID.test(value);
}

/**
 * Normaliza el resumen del módulo: descarta claves vetadas, valores vacíos o
 * con aspecto de dato personal, recorta textos y limita el número de claves.
 */
export function sanitizeVitaSummary(summary: VitaModuleSummary | undefined): ChatModuleContext["summary"] {
  const out: ChatModuleContext["summary"] = {};
  if (!summary) return out;
  let count = 0;
  for (const [rawKey, value] of Object.entries(summary)) {
    if (count >= VITA_SUMMARY_MAX_KEYS) break;
    const key = rawKey.trim().slice(0, VITA_SUMMARY_MAX_KEY_LENGTH);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || BLOCKED_KEY.test(key)) continue;
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "number") {
      if (!Number.isFinite(value) || Math.abs(value) >= 1_000_000) continue;
      out[key] = Math.round(value * 100) / 100;
    } else if (typeof value === "string") {
      const text = value.trim().replace(/\s+/g, " ").slice(0, VITA_SUMMARY_MAX_VALUE_LENGTH);
      if (!text || looksPersonal(text)) continue;
      out[key] = text;
    } else continue;
    count += 1;
  }
  return out;
}

/** Construye el `moduleContext` que viaja en el payload del chat. */
export function buildVitaModuleContext(module: VitaModuleId, summary?: VitaModuleSummary): ChatModuleContext {
  return { module, summary: sanitizeVitaSummary(summary) };
}
