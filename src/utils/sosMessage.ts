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

// ── DOB → MM/dd/yyyy ──────────────────────────────────────────────────

function formatDob(dob: string): string | null {
  if (!dob) return null;
  const parts = dob.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return `${m.padStart(2, "0")}/${d.padStart(2, "0")}/${y}`;
}

// ── Build SOS data block ───────────────────────────────────────────────

/**
 * Builds an English emergency text block matching the backend format:
 *   === SOS ALERT - EMERGENCY ===
 *   Patient: <name>
 *   Age N years (DOB MM/dd/yyyy)
 *   Document: <cedula>
 *   Blood type: <grupo>
 *   Insurer: <seguro>
 *   Member ID: <poliza>
 *   --- Vital Signs ---
 *   Heart Rate N bpm / SpO2 N% / Blood Pressure X
 *   Location:
 *   Address: <label>          (only if coords.label is provided)
 *   Decimal: lat, lng (±N m)
 *   DMS: lat° dir, lng° dir
 *   --- Emergency Contact ---
 *   <name> · <relationship> · <phone>
 *   Call 911 if needed.
 *
 * Signature kept as (user, coords, vitals, lang) for backward compat.
 * Output is always English regardless of `lang`.
 * NEVER emits "null", "undefined", or empty placeholders.
 */
export function buildSosDataBlock(
  user: UserProfile,
  coords: { latitude: number; longitude: number; accuracy?: number; label?: string | null } | null,
  vitals: {
    heartRate?: number | null;
    spo2?: number | null;
    bloodPressure?: string | null;
  },
  lang: "es" | "en", // kept for backward-compat signature; output always English
): string {
  void lang; // output is always English regardless of lang param
  const lines: string[] = [];

  // Header
  lines.push("=== SOS ALERT - EMERGENCY ===");

  // Patient
  if (user.nombre) {
    lines.push(`Patient: ${user.nombre}`);
  }

  // Age + DOB
  const age = computeAge(user.dob);
  if (age !== null) {
    const dobFormatted = formatDob(user.dob);
    lines.push(dobFormatted ? `Age ${age} years (DOB ${dobFormatted})` : `Age ${age} years`);
  }

  // Document
  if (user.cedula) {
    lines.push(`Document: ${user.cedula}`);
  }

  // Blood type
  if (user.grupo) {
    lines.push(`Blood type: ${user.grupo}`);
  }

  // Insurer
  if (user.seguro) {
    lines.push(`Insurer: ${user.seguro}`);
  }

  // Member ID
  if (user.poliza) {
    lines.push(`Member ID: ${user.poliza}`);
  }

  // Vital Signs
  const vitalParts: string[] = [];
  if (vitals.heartRate != null && vitals.heartRate !== undefined) {
    vitalParts.push(`Heart Rate ${vitals.heartRate} bpm`);
  }
  if (vitals.spo2 != null && vitals.spo2 !== undefined) {
    vitalParts.push(`SpO2 ${vitals.spo2}%`);
  }
  if (vitals.bloodPressure) {
    vitalParts.push(`Blood Pressure ${vitals.bloodPressure}`);
  }
  if (vitalParts.length > 0) {
    lines.push("--- Vital Signs ---");
    lines.push(vitalParts.join(" / "));
  }

  // Location
  if (coords) {
    const latStr = formatCoordDMS(coords.latitude, true);
    const lngStr = formatCoordDMS(coords.longitude, false);
    const accStr =
      coords.accuracy != null
        ? ` (\u00B1${Math.round(coords.accuracy)} m)`
        : "";
    lines.push("Location:");
    if (coords.label) {
      lines.push(`Address: ${coords.label}`);
    }
    lines.push(
      `Decimal: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}${accStr}`,
    );
    lines.push(`DMS: ${latStr}, ${lngStr}`);
  } else {
    lines.push("Location: Not available");
  }

  // Emergency Contact
  if (user.fam1Nombre) {
    lines.push("--- Emergency Contact ---");
    const contactParts = [user.fam1Nombre, user.fam1Parentesco, user.fam1Cel]
      .filter(Boolean)
      .join(" · ");
    lines.push(contactParts);
  }

  // Footer
  lines.push("Call 911 if needed.");

  return lines.join("\n");
}
