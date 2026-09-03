import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    // Hardening 4.4: un `.only`/`.skip` commiteado rompe el pipeline en vez
    // de pasar en silencio (guard estilo forbidOnly de mocha).
    forbidOnly: true,
  },
})