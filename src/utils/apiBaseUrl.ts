import { Capacitor } from "@capacitor/core";

/**
 * Base URL para las llamadas a los servicios del backend.
 *
 * Regla del proyecto: TODA la comunicación pasa por el API Gateway (YARP,
 * puerto 5080) — única entrada pública — que enruta por prefijo de path a
 * cada microservicio (Auth, Api, Telemedicina, Comunidad, Storage).
 *
 * Prioridad de resolución (todos los helpers):
 *   1. Variable de entorno `VITE_*` (ver `.env` / `.env.example`).
 *   2. App nativa (Capacitor): `10.0.2.2` (IP que el emulador Android usa
 *      para alcanzar el host), siempre apuntando al gateway (5080).
 *   3. Web (Vite dev): cadena vacía → el fetch usa rutas relativas (`/api/...`)
 *      y el proxy de Vite las enruta al gateway local.
 *
 * En producción, `VITE_GATEWAY_BASE_URL` apunta al gateway público real
 * (p. ej. https://api.coppaddresd.com).
 */

const COMMUNITY_API_PATH = "/api/v1/community/graphql";
const COMMUNITY_WS_PATH = "/api/v1/community/subscriptions";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Origen (sin path) del gateway. */
function gatewayOrigin(): string {
  const fromEnv = import.meta.env.VITE_GATEWAY_BASE_URL;
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (Capacitor.isNativePlatform()) return "http://10.0.2.2:5080";
  return "";
}

/** Base URL de la API principal — siempre vía gateway. */
export function getApiBaseUrl(): string {
  return gatewayOrigin();
}

/** Base URL del Auth Service — siempre vía gateway (ruta /api/auth). */
export function getAuthBaseUrl(): string {
  return gatewayOrigin();
}

/** Base URL del API Gateway (YARP) — única entrada pública. */
export function getGatewayBaseUrl(): string {
  return gatewayOrigin();
}

/**
 * URL del GraphQL de la comunidad — vía gateway (ruta /api/v1/community).
 * En web dev sin env cae a la ruta relativa y la resuelve el proxy de Vite.
 */
export function getCommunityApiUrl(): string {
  const origin = gatewayOrigin();
  return origin ? `${origin}${COMMUNITY_API_PATH}` : COMMUNITY_API_PATH;
}

/**
 * URL del WebSocket de GraphQL de la comunidad — vía gateway (YARP reenvía
 * el WS al servicio Community). Siempre derivada del gateway.
 */
export function getCommunityWsUrl(): string {
  const origin = gatewayOrigin();
  if (origin) {
    if (origin.startsWith("http")) {
      return `${origin.replace(/^http/, "ws")}${COMMUNITY_WS_PATH}`;
    }
    return `${origin}${COMMUNITY_WS_PATH}`;
  }
  return `ws://localhost:5080${COMMUNITY_WS_PATH}`;
}

/**
 * Código de aplicación que identifica este cliente ante el Auth Service
 * ("app" para la móvil, "erp" para la consola administrativa). Determina el
 * claim `aud` del JWT y el acceso vía UserApplication. Default: "app".
 */
export function getApplicationCode(): string {
  return import.meta.env.VITE_APPLICATION_CODE || "app";
}