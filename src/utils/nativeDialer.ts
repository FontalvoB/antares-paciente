/**
 * Marcador nativo del teléfono: abre `tel:` para llamar desde iOS, Android o
 * el navegador. Los botones "Llamar 911" / "Llamar familiar" del SOS abren la
 * app de teléfono del dispositivo (antes simulaban una llamada dentro de la
 * app); la llamada automática al contacto la hace el backend con Twilio.
 */

/** Conserva el prefijo `+` y deja solo dígitos; vacío si no hay número. */
export function sanitizePhoneNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Abre el marcador nativo con el número indicado. Devuelve `false` (sin
 * navegar) cuando no hay dígitos utilizables.
 */
export function openNativeDialer(raw: string | null | undefined): boolean {
  const number = sanitizePhoneNumber(raw);
  if (!number) return false;
  window.location.assign(`tel:${number}`);
  return true;
}
