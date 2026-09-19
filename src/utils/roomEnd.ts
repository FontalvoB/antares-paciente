import type {
  AppointmentStatus,
  TelemedicineSessionStatus,
  VirtualRoomStatus,
} from "./appointmentsApi";
import type { RoomWindowState } from "./roomWindow";

/**
 * Clasificación del final de una llamada (F3, reconexión con causa explícita).
 * Puro y determinista: la UI decide el copy y el CTA «Reintentar conexión»
 * según la causa, y la autoridad final es el backend (GET /room + cita).
 */

export type RoomEndCause = "network" | "session-ended" | "window-closed";

/** Motivo del cierre a partir del estado de la sala y de la cita. */
export function classifyRoomEnd(input: {
  windowState: RoomWindowState;
  appointmentStatus?: AppointmentStatus | null;
  roomStatus?: VirtualRoomStatus | null;
  activeSessionStatus?: TelemedicineSessionStatus | null;
}): RoomEndCause {
  const roomDone =
    input.roomStatus === "Ended" ||
    input.roomStatus === "Expired" ||
    input.roomStatus === "Failed";
  if (
    roomDone ||
    input.activeSessionStatus === "Ended" ||
    input.appointmentStatus === "Completed"
  ) {
    return "session-ended";
  }
  if (
    input.windowState === "after" ||
    input.appointmentStatus === "Cancelled" ||
    input.appointmentStatus === "NoShow"
  ) {
    return "window-closed";
  }
  return "network";
}

/** Título (clave i18n) de la pantalla de fin según la causa. */
export function roomEndTitleKey(cause: RoomEndCause): string {
  switch (cause) {
    case "session-ended":
      return "La consulta finalizó";
    case "window-closed":
      return "La ventana de acceso a la sala ya terminó";
    default:
      return "Se perdió la conexión";
  }
}

/** Código numérico de un error de Twilio Video (`.code`), si lo trae. */
export function twilioErrorCode(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "number" && Number.isFinite(code)) return code;
  if (typeof code === "string" && /^\d+$/.test(code)) return Number(code);
  return null;
}

/**
 * Mapeo de códigos Twilio Video a copy accionable (clave i18n); null si el
 * error no es de Twilio o no está mapeado (se usa el mensaje del backend).
 */
export function twilioErrorMessageKey(err: unknown): string | null {
  switch (twilioErrorCode(err)) {
    case 53105:
      return "La sala alcanzó el máximo de participantes.";
    case 20101:
    case 20104:
      return "El acceso a la sala venció. Vuelve a intentarlo.";
    case 53000:
    case 53405:
      return "Problema de red o de cámara/micrófono. Revisa tu conexión.";
    default:
      return null;
  }
}
