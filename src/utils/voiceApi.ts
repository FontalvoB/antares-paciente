/**
 * Asistente de voz conversacional (ElevenLabs Agents) — cliente de sesión y
 * ejecutores de client tools (change integración ElevenLabs, FASE 8).
 *
 * Arquitectura (docs/elevenlabs/03-target-architecture.md):
 *  - La app pide la sesión al backend .NET (POST /api/v1/chat/voice/session,
 *    JWT aud=app). El backend valida identidad/estado/auditoría y devuelve un
 *    signed URL de vida corta. La API key JAMÁS llega al frontend.
 *  - Con el signed URL, la app conecta directo al WebSocket de ElevenLabs con
 *    el SDK oficial (`@elevenlabs/react`).
 *  - Las client tools las ejecuta ESTE dispositivo con el JWT del paciente
 *    contra endpoints reales del backend: la identidad no depende de datos
 *    que ElevenLabs pueda reenviar (nunca confiar solo en el agente).
 *
 * Todos los textos orientados al agente van preformateados en español
 * (fechas dd/mm/aaaa) para que la voz natural lea los datos sin ambigüedad.
 */

import { getAccessToken } from "./authApi";
import { getApiBaseUrl } from "./apiBaseUrl";
import {
  cancelAppointment,
  createRequest,
  fetchAvailabilitySlots,
  fetchMyAppointments,
  fetchMyContext,
  fetchMyRequests,
  fetchProfessionalsCatalog,
  fetchSpecialties,
  rescheduleAppointment,
  type PatientContextDto,
} from "./appointmentsApi";
import { formatDateForDisplay, toLocalISODate } from "./dates";

/** Contrato del backend (camelCase, ASP.NET). */
export interface VoiceSession {
  signedUrl: string;
  agentId: string;
  conversationId?: string | null;
}

/**
 * Solicita una sesión de voz al backend. Devuelve null ante cualquier fallo
 * (sin sesión, backend sin voz configurada, red) — el caller degrada al
 * agente de voz Web Speech y nunca muestra detalles técnicos al paciente.
 */
export async function requestVoiceSession(): Promise<VoiceSession | null> {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) return null;
    const res = await fetch(`${getApiBaseUrl()}/api/v1/chat/voice/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as VoiceSession;
    return data.signedUrl ? data : null;
  } catch (error) {
    console.warn("[voice] No se pudo iniciar la sesión de voz:", error);
    return null;
  }
}

// ── Ejecutores de client tools (JWT del propio paciente) ───────────────────

/** Hora local legible (HH:mm) de un ISO UTC, para voz natural. */
function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Contexto del paciente (para organizationId y patientId de solicitudes). */
let cachedContext: PatientContextDto | null = null;
async function patientContext(): Promise<PatientContextDto | null> {
  if (cachedContext) return cachedContext;
  try {
    cachedContext = await fetchMyContext();
  } catch {
    cachedContext = null;
  }
  return cachedContext;
}

/** Citas confirmadas del paciente, compactas y legibles por voz. */
export async function toolGetUpcomingAppointments(): Promise<string> {
  try {
    const page = await fetchMyAppointments({ status: "Confirmed" });
    const upcoming = page.items
      .filter((a) => new Date(a.scheduledStart).getTime() > Date.now())
      .sort(
        (a, b) =>
          new Date(a.scheduledStart).getTime() -
          new Date(b.scheduledStart).getTime(),
      )
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        fecha: formatDateForDisplay(a.scheduledStart),
        hora: timeOf(a.scheduledStart),
        profesional: a.professionalName ?? null,
        especialidad: a.specialtyName ?? null,
        sede: a.locationName ?? null,
      }));
    return JSON.stringify({
      total: upcoming.length,
      citas: upcoming,
      nota: upcoming.length
        ? undefined
        : "El paciente no tiene citas confirmadas futuras.",
    });
  } catch {
    return JSON.stringify({
      error: "No se pudieron consultar las citas ahora.",
    });
  }
}

/** Estado de las solicitudes de cita del paciente. */
export async function toolGetMyRequests(): Promise<string> {
  try {
    const requests = (await fetchMyRequests())
      .filter((r) => r.status !== "Converted")
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        especialidad: r.specialtyName ?? null,
        estado: r.status,
        preferida: r.preferredStart
          ? `${formatDateForDisplay(r.preferredStart)} ${timeOf(r.preferredStart)}`
          : null,
        motivo: r.reason,
      }));
    return JSON.stringify({
      total: requests.length,
      solicitudes: requests,
      nota: requests.length
        ? undefined
        : "El paciente no tiene solicitudes activas.",
    });
  } catch {
    return JSON.stringify({
      error: "No se pudieron consultar las solicitudes ahora.",
    });
  }
}

/** Catálogo de especialidades agendables. */
export async function toolListSpecialties(): Promise<string> {
  try {
    const items = (await fetchSpecialties())
      .filter((s) => s.isActive)
      .slice(0, 30)
      .map((s) => ({ id: s.id, nombre: s.name, categoria: s.category }));
    return JSON.stringify({ especialidades: items });
  } catch {
    return JSON.stringify({ error: "No se pudo consultar el catálogo ahora." });
  }
}

/** Directorio público de profesionales (sin PHI). */
export async function toolListProfessionals(): Promise<string> {
  try {
    const page = await fetchProfessionalsCatalog();
    const items = page.data
      .slice(0, 30)
      .map(
        (
          p,
        ): {
          nombre: string;
          tipo: string | null;
          especialidades: string | null;
        } => ({
          nombre: p.fullName,
          tipo: p.professionalTypeName,
          especialidades: p.specialties.map((s) => s.name).join(", ") || null,
        }),
      );
    return JSON.stringify({ profesionales: items });
  } catch {
    return JSON.stringify({
      error: "No se pudo consultar el directorio ahora.",
    });
  }
}

/** Ranuras disponibles en un día (especialidad o profesional). */
export async function toolGetAvailabilitySlots(args: {
  date: string;
  specialty_id?: string;
  professional_id?: string;
}): Promise<string> {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(args.date ?? "")
      ? args.date
      : toLocalISODate();
    const ctx = await patientContext();
    const slots = await fetchAvailabilitySlots({
      date,
      specialtyId: args.specialty_id,
      professionalId: args.professional_id,
      // Modo especialidad exige organización; el contexto del JWT la aporta.
      organizationId: args.specialty_id
        ? (ctx?.patient?.organizationId ?? undefined)
        : undefined,
    });
    const disponibles = slots.slots
      .filter((s) => s.isAvailable)
      .slice(0, 12)
      .map((s) => ({ inicio: timeOf(s.start), iso: s.start }));
    return JSON.stringify({
      fecha: formatDateForDisplay(`${date}T12:00:00`),
      total: disponibles.length,
      horarios: disponibles,
      nota: disponibles.length
        ? undefined
        : "No hay horarios disponibles ese día.",
    });
  } catch {
    return JSON.stringify({
      error: "No se pudo consultar la disponibilidad ahora.",
    });
  }
}

/** Crea una solicitud de cita (el personal la aprueba después). */
export async function toolRequestAppointment(args: {
  specialty_id: string;
  reason: string;
  professional_id?: string;
  preferred_start?: string;
}): Promise<string> {
  try {
    const ctx = await patientContext();
    const patientId = ctx?.patient?.id;
    const organizationId = ctx?.patient?.organizationId;
    if (!patientId || !organizationId) {
      return JSON.stringify({
        error:
          "No se pudo resolver el perfil del paciente para crear la solicitud.",
      });
    }
    const request = await createRequest({
      patientId,
      organizationId,
      specialtyId: args.specialty_id,
      professionalId: args.professional_id || undefined,
      preferredStart: args.preferred_start || undefined,
      reason: args.reason,
    });
    return JSON.stringify({
      ok: true,
      id: request.id,
      estado: request.status,
      mensaje:
        "Solicitud creada. El personal la revisará y confirmará la cita.",
    });
  } catch {
    return JSON.stringify({ error: "No se pudo crear la solicitud ahora." });
  }
}

/** Reprograma una cita confirmada a un slot disponible. */
export async function toolRescheduleAppointment(args: {
  appointment_id: string;
  new_start: string;
  reason?: string;
}): Promise<string> {
  try {
    const updated = await rescheduleAppointment(args.appointment_id, {
      newStart: args.new_start,
      reason: args.reason || null,
    });
    return JSON.stringify({
      ok: true,
      id: updated.id,
      nuevaFecha: `${formatDateForDisplay(updated.scheduledStart)} ${timeOf(updated.scheduledStart)}`,
      mensaje: "Cita reprogramada.",
    });
  } catch {
    return JSON.stringify({
      error:
        "No se pudo reprogramar la cita. Verifica que sea confirmada y que el horario esté disponible.",
    });
  }
}

/** Cancela una cita confirmada. */
export async function toolCancelAppointment(args: {
  appointment_id: string;
  reason: string;
}): Promise<string> {
  try {
    const cancelled = await cancelAppointment(args.appointment_id, args.reason);
    return JSON.stringify({
      ok: true,
      id: cancelled.id,
      mensaje: "Cita cancelada.",
    });
  } catch {
    return JSON.stringify({
      error: "No se pudo cancelar la cita. Verifica que esté confirmada.",
    });
  }
}
