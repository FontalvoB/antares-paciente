/**
 * Número de emergencia del SOS según el país del dispositivo.
 *
 * Detección: la zona horaria del dispositivo
 * (`Intl.DateTimeFormat().resolvedOptions().timeZone`), que sigue su
 * ubicación real. El SOS solo tiene soporte para dos países:
 * - Colombia (`America/Bogota`) → 123 (línea nacional de emergencias).
 * - Estados Unidos (zonas del listado) → 911.
 * Cualquier zona desconocida cae al 911 (comportamiento previo).
 */

/** Número de emergencia de Colombia (línea nacional). */
export const COLOMBIA_EMERGENCY_NUMBER = "123";

/** Número de emergencia de Estados Unidos. */
export const USA_EMERGENCY_NUMBER = "911";

/** Número por defecto cuando la zona horaria no es reconocida. */
export const DEFAULT_EMERGENCY_NUMBER = "911";

/** Zona horaria de Colombia (única del país). */
const COLOMBIA_TIME_ZONES = new Set(["America/Bogota"]);

/**
 * Zonas IANA de Estados Unidos (50 estados + Alaska, Hawái y territorios).
 * Lista explícita a propósito: las zonas IANA no están prefijadas por país
 * (`America/Mexico_City` o `America/Toronto` no son de EE. UU.) y un número
 * de emergencia no se adivina.
 */
const USA_TIME_ZONES = new Set([
  "America/New_York",
  "America/Detroit",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Indiana/Indianapolis",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Vevay",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Chicago",
  "America/Indiana/Knox",
  "America/Indiana/Tell_City",
  "America/Menominee",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/North_Dakota/Beulah",
  "America/Denver",
  "America/Boise",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Adak",
  "America/Juneau",
  "America/Sitka",
  "America/Metlakatla",
  "America/Nome",
  "America/Yakutat",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
  "America/St_Thomas",
  "Pacific/Guam",
  "Pacific/Saipan",
  "Pacific/Pago_Pago",
]);

/** Zona horaria del dispositivo; vacío si el entorno no la expone. */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/**
 * Resuelve el número de emergencia para la zona horaria indicada (por
 * defecto, la del dispositivo): Colombia → 123; EE. UU. → 911; zona
 * desconocida o vacía → 911.
 */
export function resolveEmergencyNumber(
  timeZone: string | null | undefined = getDeviceTimeZone(),
): string {
  const zone = timeZone ?? "";
  if (COLOMBIA_TIME_ZONES.has(zone)) return COLOMBIA_EMERGENCY_NUMBER;
  if (USA_TIME_ZONES.has(zone)) return USA_EMERGENCY_NUMBER;
  return DEFAULT_EMERGENCY_NUMBER;
}
