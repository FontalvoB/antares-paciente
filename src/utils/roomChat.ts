import type { AppointmentStatus, ChatMessageDto } from "./appointmentsApi";

/**
 * Helpers puros del chat de la sala (F3): mezcla con dedupe por id, cursor
 * incremental (`after`/`afterId`) y habilitación por estado de la cita.
 */

export interface RoomChatMessage extends ChatMessageDto {
  /** Mensaje optimista aún no confirmado por el backend. */
  pending?: boolean;
  /** El POST falló; el texto se conserva para reintentar. */
  failed?: boolean;
}

/**
 * El chat exige la misma autorización que la sala y el backend responde 409
 * con la cita Requested/Cancelled/NoShow (contrato F3); con Confirmed,
 * InProgress o Completed se puede leer y escribir (el paciente puede esperar
 * en la sala con la cita aún confirmada y conserva el acceso posterior).
 */
export function isRoomChatEnabled(
  status?: AppointmentStatus | null,
): boolean {
  return (
    status === "Confirmed" ||
    status === "InProgress" ||
    status === "Completed"
  );
}

function timeOf(message: ChatMessageDto): number | null {
  const ms = new Date(message.createdAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function compareMessages(a: ChatMessageDto, b: ChatMessageDto): number {
  const ta = timeOf(a);
  const tb = timeOf(b);
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  return a.id.localeCompare(b.id);
}

/**
 * Fusiona el historial local con un lote del servidor: dedupe por id, orden
 * (createdAt, id) y los pendientes siempre al final (aún sin id real).
 */
export function mergeRoomChatMessages(
  current: RoomChatMessage[],
  incoming: ChatMessageDto[],
): RoomChatMessage[] {
  const byId = new Map<string, RoomChatMessage>();
  for (const message of current) {
    if (message.pending || byId.has(message.id)) continue;
    byId.set(message.id, message);
  }
  for (const message of incoming) byId.set(message.id, message);

  const real = [...byId.values()].sort(compareMessages);
  const pending = current.filter((message) => message.pending);
  return [...real, ...pending];
}

/** Cursor para el siguiente GET incremental; null si aún no hay historial. */
export function roomChatCursor(
  messages: RoomChatMessage[],
): { after: string; afterId: string } | null {
  const real = messages.filter((message) => !message.pending);
  if (real.length === 0) return null;
  const last = real.reduce((a, b) => (compareMessages(a, b) >= 0 ? a : b));
  if (timeOf(last) === null) return null;
  return { after: last.createdAt, afterId: last.id };
}
