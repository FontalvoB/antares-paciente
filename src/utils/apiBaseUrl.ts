import { Capacitor } from "@capacitor/core";

/**
 * Base URL para las llamadas a los servicios del backend.
 *
 * Regla del proyecto: TODA la comunicación pasa por el API Gateway (YARP,
 * puerto 5080) — única entrada pública — que enruta por prefijo de path a
 * cada microservicio (Auth, Api, Telemedicina, Comunidad, Storage).
 *
 * Prioridad de resolución (todos los helpers):
 *   1. Web en desarrollo: rutas relativas al proxy de Vite; `VITE_*`
 *      selecciona el gateway destino en vite.config.ts, sin exigir CORS.
 *   2. Producción o app nativa: variable de entorno `VITE_*`.
 *   3. App nativa (Capacitor) sin env: iOS Simulator comparte la red del
 *      Mac → `localhost` funciona; el emulador Android usa `10.0.2.2`
 *      (alias del loopback del host). En iPhone físico hay que definir
 *      `VITE_GATEWAY_BASE_URL` con la IP LAN del Mac.
 *   4. Sin configuración en web: rutas relativas al origen actual.
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
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) return "";
  const fromEnv = import.meta.env.VITE_GATEWAY_BASE_URL;
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (Capacitor.isNativePlatform()) {
    // iOS Simulator comparte la red del Mac (localhost válido); Android no.
    if (Capacitor.getPlatform() === "ios") return "http://localhost:5080";
    return "http://10.0.2.2:5080";
  }
  return "";
}

/**
 * Origen de la web pública (coppadresdWeb), donde se completa la eliminación
 * de la cuenta. `VITE_WEB_BASE_URL` manda; sin ella solo hay valor por defecto
 * en desarrollo (localhost / alias del host en Android). En producción, vacío
 * = no configurada: la UI avisa en lugar de abrir una URL inventada.
 */
export function getWebBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WEB_BASE_URL;
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (!import.meta.env.DEV) return "";
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() !== "ios") {
    return "http://10.0.2.2:5174";
  }
  return "http://localhost:5174";
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
 * En web dev usa la ruta relativa y la resuelve el proxy de Vite.
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
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${COMMUNITY_WS_PATH}`;
}

/**
 * Código de aplicación que identifica este cliente ante el Auth Service
 * ("app" para la móvil, "erp" para la consola administrativa). Determina el
 * claim `aud` del JWT y el acceso vía UserApplication. Default: "app".
 */
export function getApplicationCode(): string {
  return import.meta.env.VITE_APPLICATION_CODE || "app";
}
