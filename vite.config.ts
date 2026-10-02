import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Variables VITE_* del entorno (`.env`, `.env.local`). Los targets del proxy
  // se toman de ahí con fallback a los puertos locales de desarrollo.
  const env = loadEnv(mode, process.cwd(), "");

  // Única entrada pública: el API Gateway (YARP, 5080). Todos los servicios
  // (Auth, Api, Telemedicina, Comunidad, Storage) se enrutan por prefijo.
  const gatewayTarget = (
    env.VITE_GATEWAY_BASE_URL || "http://localhost:5080"
  ).replace(/\/+$/, "");
  const gatewayWsTarget = gatewayTarget.replace(/^http/, "ws");

  return {
    plugins: [react()],
    build: {
      // Antes todo node_modules caía en un index de ~3.2 MB. Con Rolldown
      // codeSplitting se separa por librería (cache por dependencia); "vendor"
      // queda como red de seguridad para el resto de node_modules.
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react",
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 20,
              },
              {
                name: "ionic",
                test: /node_modules[\\/](@ionic|ionicons)[\\/]/,
                priority: 19,
              },
              {
                name: "motion",
                test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
                priority: 18,
              },
              {
                name: "data",
                test: /node_modules[\\/](urql|@urql|graphql|graphql-ws|wonka|@0no-co)[\\/]/,
                priority: 17,
              },
              {
                name: "voice",
                test: /node_modules[\\/]@elevenlabs[\\/]/,
                priority: 16,
              },
              {
                name: "body",
                test: /node_modules[\\/]react-muscle-highlighter[\\/]/,
                priority: 16,
              },
              {
                name: "query",
                test: /node_modules[\\/]@tanstack[\\/]/,
                priority: 16,
              },
              {
                name: "capacitor",
                test: /node_modules[\\/]@capacitor/,
                priority: 15,
              },
              {
                name: "three",
                test: /node_modules[\\/](three|@react-three)[\\/]/,
                priority: 14,
              },
              {
                name: "vendor",
                test: /node_modules/,
                priority: 1,
              },
            ],
          },
        },
      },
      // Chunks grandes tras separar vendors: index (shell + todas las
      // pantallas, ~1.1 MB), ionic (~1.2 MB) y three (~0.9 MB, lazy de
      // Avatar). Bajarlos de verdad = lazy por pantalla (tarea aparte); el
      // umbral solo evita el warning conocido, no tapa código nuevo:
      // cualquier chunk nuevo por encima de esto sigue avisando.
      chunkSizeWarningLimit: 1300,
    },
    // Herramientas de dev (mock del wearable, tarjeta demo): ON en el dev
    // server y en `build:dev` (`--mode development`), OFF en producción —
    // constante literal para que Rollup elimine el import dinámico del mock.
    define: {
      __DEV_TOOLS__: JSON.stringify(
        mode !== "production" || env.VITE_DEV_TOOLS === "true",
      ),
    },
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
