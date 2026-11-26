/**
 * Origen de módulo para la sesión de voz de Vita (KAN-167).
 *
 * `VitaEntry` lo fija justo antes de abrir el agente de voz global y
 * `VoiceOverlay` lo lee en cada solicitud de sesión (incluidos reintentos) y
 * lo borra al cerrarse la voz. Vive en memoria: nunca se persiste. Caduca a
 * los 30 s sin uso para no contaminar una apertura de voz posterior desde
 * otro sitio.
 */
import { sendChatMessage } from "./chat-service";
import type { ChatModuleContext } from "./types";

const TTL_MS = 30_000;
let pending: { context: ChatModuleContext; at: number } | null = null;

export function setVitaVoiceOrigin(context: ChatModuleContext): void {
  pending = { context, at: Date.now() };
}

/** Lee el origen vigente sin consumirlo y renueva su vigencia. */
export function readVitaVoiceOrigin(now = Date.now()): ChatModuleContext | null {
  if (!pending) return null;
  if (now - pending.at > TTL_MS) {
    pending = null;
    return null;
  }
  pending = { ...pending, at: now };
  return pending.context;
}

/** Borra el origen (al cerrar la voz). */
export function clearVitaVoiceOrigin(): void {
  pending = null;
}

/**
 * Turno de voz Web Speech abierto desde Vita: mismo servicio de chat, sin
 * `threadId` ni usuario del cliente (el backend deriva el hilo del JWT) y con
 * el contexto del módulo. Devuelve `null` si no hay respuesta.
 */
export async function sendVitaVoiceTurn(text: string, language: "es" | "en", moduleContext: ChatModuleContext) {
  const result = await sendChatMessage(text, "", language, [], undefined, { moduleContext, omitThreadId: true });
  const answer = (result.answer ?? result.reply ?? "").trim();
  return answer ? { text: answer } : null;
}
