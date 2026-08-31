import { Capacitor } from "@capacitor/core";

/**
 * Base URL para las llamadas al backend.
 *
 * - **Web (Vite dev)**: cadena vacía → el fetch usa rutas relativas (`/api/...`)
 *   y el proxy de Vite las enruta a localhost (puerto correcto).
 * - **App nativa (Capacitor)**: usa `10.0.2.2` (la IP que el emulador Android
 *   usa para alcanzar el host). Las rutas relativas no existen en la app nativa
 *   porque no hay proxy de Vite.
 *
 * Para producción se cambiaría a la URL real del gateway (api.coppaddresd.com).
 */

export function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return "http://10.0.2.2:5122"; // API .NET
  }
  return ""; // proxy de Vite en dev web
}

/** Base URL del Auth Service (puerto 5123). */
export function getAuthBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return "http://10.0.2.2:5123";
  }
  return ""; // proxy de Vite
}

/**
 * Base URL del API Gateway (YARP, puerto 5080) — única entrada pública para
 * citas/telemedicina: enruta /api/v1/appointments → Telemedicine y
 * /api/v1/telemedicine → Telemedicine. En web dev el proxy de Vite enruta
 * /api → 5080; en la app nativa se apunta directo al gateway del host.
 */
export function getGatewayBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return "http://10.0.2.2:5080";
  }
  return ""; // proxy de Vite
}
