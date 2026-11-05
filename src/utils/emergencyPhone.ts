/** Misma regla de normalización que EmergencyContactPhone en el backend. */
export function normalizeEmergencyPhone(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!raw || raw.length > 30 || !/^\+?[0-9().\s-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  const phone = raw.startsWith("+") || (digits.startsWith("57") && digits.length === 12)
    ? `+${digits}` : `+57${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  // Colombia y NANP (EE. UU./Canadá) usan diez dígitos nacionales.
  if (phone.startsWith("+57") && phone.length !== 13) return null;
  if (phone.startsWith("+1") && phone.length !== 12) return null;
  return phone;
}

export type ContactPhoneCountry = "57" | "1" | "other";
export function splitEmergencyPhone(value: string): { country: ContactPhoneCountry; number: string } {
  const raw = value.trim();
  if (raw.startsWith("+57")) return { country: "57", number: raw.slice(3) };
  if (raw.startsWith("+1")) return { country: "1", number: raw.slice(2) };
  if (raw.startsWith("+")) return { country: "other", number: raw };
  if (raw.replace(/\D/g, "").length === 12 && raw.startsWith("57")) return { country: "57", number: raw.slice(2) };
  return { country: "57", number: raw };
}
export function composeEmergencyPhone(country: ContactPhoneCountry, number: string): string {
  const raw = number.trim();
  if (!raw) return "";
  if (raw.startsWith("+") || country === "other") return raw;
  return `+${country}${raw}`;
}
