import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Sin gateway por ahora: enrutado directo a los servicios.
      // /api/auth → Auth Service, /api/v1 → API principal, /graphql → community.
      '/api/auth': {
        target: 'http://localhost:5123',
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://localhost:5122',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:5200',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://localhost:5200',
        changeOrigin: true,
      },
    },
  },
})
