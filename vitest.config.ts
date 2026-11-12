import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    // Los tests del módulo conservado lo activan; E2E cubre la app por defecto sin citas.
    env: { VITE_ENFORCE_LEGAL_CONSENTS: 'true', VITE_APPOINTMENTS_ENABLED: 'true' },
    globals: true,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    // Hardening 4.4: un `.only`/`.skip` commiteado rompe el pipeline en vez
    // de pasar en silencio (guard estilo forbidOnly de mocha).
    forbidOnly: true,
  },
})
