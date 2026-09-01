import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Comunidad GraphQL directo al servicio en :5200 (el gateway no enruta /api/v1/community).
      // Debe declararse ANTES de '/api' para no caer en el proxy del gateway.
      "/api/v1/community": {
        target: "http://localhost:5200",
        changeOrigin: true,
      },
      // Proxy genérico hacia el gateway (YARP) en :5080 — única entrada pública.
      // El gateway enruta por prefijo: /api/auth → Auth, /api/v1/telemedicine → Telemedicine, /api/v1 → Api.
      "/api": {
        target: "http://localhost:5080",
        changeOrigin: true,
      },
      // WebSocket de GraphQL de la comunidad hacia el servicio en :5200.
      "/api/v1/community/subscriptions": {
        target: "ws://localhost:5200",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
