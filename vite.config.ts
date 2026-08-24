import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Proxy genérico hacia el gateway (YARP) en :5080 — única entrada pública.
      // El gateway enruta por prefijo: /api/auth → Auth, /api/v1/telemedicine → Telemedicine, /api/v1 → Api.
      '/api': {
        target: 'http://localhost:5080',
        changeOrigin: true,
      },
    },
  },
})
