import type { UserProfile } from "../types";

// ── Age helper ─────────────────────────────────────────────────────────

function computeAge(dob: string): number | null {
  if (!dob) return null;
  const parts = dob.split("-");
  if (parts.length !== 3) return null;
  const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

// ── Decimal → DMS-style display ────────────────────────────────────────

function formatCoordDMS(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const dir = isLat ? (decimal >= 0 ? "N" : "S") : (decimal >= 0 ? "E" : "W");
  return `${abs.toFixed(4)}° ${dir}`;
}

// ── Build SOS data block ───────────────────────────────────────────────

/**
 * Builds a localized emergency text block for TTS, SMS/email, and display.
 * Omit missing fields gracefully — output must NEVER contain "null", "undefined",
 * or empty placeholders.
 */
export function buildSosDataBlock(
  user: UserProfile,
  coords: { latitude: number; longitude: number; accuracy?: number } | null,
  vitals: {
    heartRate?: number | null;
    spo2?: number | null;
    bloodPressure?: string | null;
  },
  lang: "es" | "en",
): string {
  const isEs = lang === "es";
  const lines: string[] = [];

  // Header
  lines.push(isEs ? "ALERTA SOS — COPP-ADRESD" : "SOS ALERT — COPP-ADRESD");

  // Name
  if (user.nombre) {
    lines.push(
      isEs
        ? `Paciente: ${user.nombre}`
        : `Patient: ${user.nombre}`,
    );
  }

  // Age from dob
  const age = computeAge(user.dob);
  if (age !== null) {
    lines.push(
      isEs ? `Edad: ${age} años` : `Age: ${age} years`,
    );
  }

  // Cédula
  if (user.cedula) {
    lines.push(
      isEs ? `Cédula: ${user.cedula}` : `ID: ${user.cedula}`,
    );
  }

  // Blood type / grupo
  if (user.grupo) {
    lines.push(
      isEs ? `Grupo sangre: ${user.grupo}` : `Blood type: ${user.grupo}`,
    );
  }

  // Insurance
  if (user.seguro || user.poliza) {
    const parts = [user.seguro, user.poliza].filter(Boolean);
    lines.push(
      isEs
        ? `Seguro: ${parts.join(" · ")}`
        : `Insurance: ${parts.join(" · ")}`,
    );
  }

  // Vitals
  const vitalParts: string[] = [];
  if (vitals.heartRate != null && vitals.heartRate !== undefined) {
    vitalParts.push(`FC ${vitals.heartRate} lpm`);
  }
  if (vitals.spo2 != null && vitals.spo2 !== undefined) {
    vitalParts.push(`SpO2 ${vitals.spo2}%`);
  }
  if (vitals.bloodPressure) {
    vitalParts.push(`TA ${vitals.bloodPressure}`);
  }
  if (vitalParts.length > 0) {
    lines.push(isEs ? `Vitales: ${vitalParts.join(" · ")}` : `Vitals: ${vitalParts.join(" · ")}`);
  }

  // GPS
  if (coords) {
    const latStr = formatCoordDMS(coords.latitude, true);
    const lngStr = formatCoordDMS(coords.longitude, false);
    const mapsLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    const accStr =
      coords.accuracy != null
        ? isEs
          ? ` (±${Math.round(coords.accuracy)} m)`
          : ` (±${Math.round(coords.accuracy)} m)`
        : "";
    lines.push(
      isEs
        ? `Ubicación: ${latStr}, ${lngStr}${accStr}`
        : `Location: ${latStr}, ${lngStr}${accStr}`,
    );
    lines.push(mapsLink);
  } else {
    lines.push(isEs ? "Ubicación no disponible" : "Location unavailable");
  }

  // Family contact
  if (user.fam1Nombre) {
    const contactParts = [user.fam1Nombre, user.fam1Parentesco, user.fam1Cel]
      .filter(Boolean)
      .join(" · ");
    lines.push(
      isEs
        ? `Contacto de emergencia: ${contactParts}`
        : `Emergency contact: ${contactParts}`,
    );
  }

  return lines.join("\n");
}
