const NAME_IDENTIFIER = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

/**
 * Identidad local de un token ya guardado por auth: permite seleccionar la
 * caché del mismo paciente sin depender de /me. No valida ni autoriza la sesión;
 * el servidor y el refresh siguen decidiendo su vigencia y permisos.
 */
export function sessionUserId(token: string | null): string | null {
  if (!token || token.split(".").length !== 3) return null;
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
    const id = claims[NAME_IDENTIFIER] ?? claims.sub;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}
