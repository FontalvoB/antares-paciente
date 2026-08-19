import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:5123',
        changeOrigin: true,
      },
      '/api/v1/chat': {
        target: 'http://localhost:5122',
        changeOrigin: true,
      },
    },
  },
})
