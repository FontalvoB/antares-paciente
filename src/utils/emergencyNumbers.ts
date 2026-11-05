/**
 * Número de emergencia del SOS según el país del dispositivo.
 *
 * La selección actual usa coordenadas del dispositivo, nunca la zona
 * horaria como prueba de ubicación. El helper legado de zona horaria se
 * conserva para consumidores antiguos, sin presentarlo como detección GPS.
 * - Colombia (`America/Bogota`) → 123 (línea nacional de emergencias).
 * - Estados Unidos (zonas del listado) → 911.
 * Cualquier zona desconocida cae al 911 (comportamiento previo).
 */

import countryBoundaries from "../data/emergency-country-boundaries.json";

export type EmergencyCountry = "CO" | "US";

export interface EmergencyCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
const boundaries = countryBoundaries as unknown as {
  CO: Polygon[];
  US: Polygon[];
  borders: Record<EmergencyCountry, [Point, Point][]>;
};

const countries: EmergencyCountry[] = ["CO", "US"];
const indexed = countries.map((country) => ({
  country,
  polygons: boundaries[country].map((polygon) => {
    const longitudes = polygon[0].map(([x]) => x);
    const latitudes = polygon[0].map(([, y]) => y);
    return { polygon, west: Math.min(...longitudes), east: Math.max(...longitudes), south: Math.min(...latitudes), north: Math.max(...latitudes) };
  }),
}));

function insideRing(longitude: number, latitude: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function borderDistanceMeters(coordinates: EmergencyCoordinates, [a, b]: [Point, Point]): number {
  const xScale = 111_320 * Math.cos((coordinates.latitude * Math.PI) / 180);
  const ax = (a[0] - coordinates.longitude) * xScale;
  const ay = (a[1] - coordinates.latitude) * 111_320;
  const bx = (b[0] - coordinates.longitude) * xScale;
  const by = (b[1] - coordinates.latitude) * 111_320;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Resolución offline sobre polígonos de Natural Earth 1:10m (dominio público).
 * Incluye Alaska, Hawái y territorios estadounidenses; no rectángulos que
 * incorporen países vecinos. La cartografía es generalizada: dentro de 1 km
 * de una frontera internacional, o si la precisión alcanza esa frontera,
 * la selección requiere confirmación del usuario en vez de adivinar.
 */
export function countryFromCoordinates(coordinates: EmergencyCoordinates | null | undefined): EmergencyCountry | null {
  if (!coordinates) return null;
  const { latitude, longitude, accuracyMeters = 0 } = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
    !Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 50_000) return null;
  for (const { country, polygons } of indexed) {
    const inside = polygons.some(({ polygon, west, east, south, north }) => {
      // Natural Earth generaliza la costa. Un margen corto de 500 m evita
      // descartar barrios costeros (p. ej. Miami) por esa simplificación;
      // las fronteras internacionales siguen teniendo la guarda inferior.
      const latitudeMargin = 500 / 111_320;
      const longitudeMargin = latitudeMargin / Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
      if (longitude < west - longitudeMargin || longitude > east + longitudeMargin ||
        latitude < south - latitudeMargin || latitude > north + latitudeMargin) return false;
      if (polygon.slice(1).some((hole) => insideRing(longitude, latitude, hole))) return false;
      if (insideRing(longitude, latitude, polygon[0])) return true;
      const ring = polygon[0];
      return ring.some((point, index) => index > 0 && borderDistanceMeters(coordinates, [ring[index - 1], point]) <= 500);
    });
    if (!inside) continue;
    if (boundaries.borders[country].some((edge) => borderDistanceMeters(coordinates, edge) <= Math.max(1000, accuracyMeters))) return null;
    return country;
  }
  return null;
}

/** Las tres acciones abren el centro unificado que despacha cada servicio. */
export function emergencyNumberForCountry(country: EmergencyCountry): "123" | "911" {
  if (country === "CO") return "123";
  if (country === "US") return "911";
  throw new Error("Selecciona un país compatible antes de llamar a emergencias.");
}

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
 * desconocida o vacía → 911. API legada: las nuevas acciones usan GPS o
 * una selección explícita con `emergencyNumberForCountry`.
 */
export function resolveEmergencyNumber(
  timeZone: string | null | undefined = getDeviceTimeZone(),
): string {
  const zone = timeZone ?? "";
  if (COLOMBIA_TIME_ZONES.has(zone)) return COLOMBIA_EMERGENCY_NUMBER;
  if (USA_TIME_ZONES.has(zone)) return USA_EMERGENCY_NUMBER;
  return DEFAULT_EMERGENCY_NUMBER;
}
