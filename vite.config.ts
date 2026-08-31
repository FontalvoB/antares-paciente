import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Storage directo al servicio Community en :5200 (archivos subidos localmente).
      "/storage": {
        target: "http://localhost:5200",
        changeOrigin: true,
      },
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
      "/graphql": {
        target: "http://localhost:5200",
        changeOrigin: true,
      },
    },
  },
});
