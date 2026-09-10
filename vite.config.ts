import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Variables VITE_* del entorno (`.env`, `.env.local`). Los targets del proxy
  // se toman de ahí con fallback a los puertos locales de desarrollo.
  const env = loadEnv(mode, process.cwd(), "");

  // Única entrada pública: el API Gateway (YARP, 5080). Todos los servicios
  // (Auth, Api, Telemedicina, Comunidad, Storage) se enrutan por prefijo.
  const gatewayTarget = (env.VITE_GATEWAY_BASE_URL || "http://localhost:5080").replace(/\/+$/, "");
  const gatewayWsTarget = gatewayTarget.replace(/^http/, "ws");

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        // Comunidad GraphQL + storage vía gateway (el gateway enruta
        // /api/v1/community y /storage hacia el servicio Community en :5200).
        // Debe declararse ANTES de '/api' para no caer en el proxy genérico.
        "/api/v1/community": {
          target: gatewayTarget,
          changeOrigin: true,
        },
        // Proxy genérico hacia el gateway (YARP) en :5080 — única entrada pública.
        // El gateway enruta por prefijo: /api/auth → Auth, /api/v1/telemedicine → Telemedicine, /api/v1 → Api.
        "/api": {
          target: gatewayTarget,
          changeOrigin: true,
        },
        // Storage de la comunidad (upload/descarga de imágenes) vía gateway.
        "/storage": {
          target: gatewayTarget,
          changeOrigin: true,
        },
        // WebSocket de GraphQL de la comunidad vía gateway (YARP reenvía WS al servicio :5200).
        "/api/v1/community/subscriptions": {
          target: gatewayWsTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});