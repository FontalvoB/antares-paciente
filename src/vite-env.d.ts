/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL (origen) del API Gateway YARP (5080) — única entrada pública. Vacío = proxy de Vite. */
  readonly VITE_GATEWAY_BASE_URL?: string
  /** Código de aplicación (claim `aud` del JWT): "app" (móvil) o "erp" (consola). Default "app". */
  readonly VITE_APPLICATION_CODE?: string
  /** Feature flag: integración API del programa (progress). */
  readonly VITE_PROGRAM_API_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}