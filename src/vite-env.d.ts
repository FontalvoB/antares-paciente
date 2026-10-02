/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL (origen) del API Gateway YARP (5080) — única entrada pública. Vacío = proxy de Vite. */
  readonly VITE_GATEWAY_BASE_URL?: string;
  /** Código de aplicación (claim `aud` del JWT): "app" (móvil) o "erp" (consola). Default "app". */
  readonly VITE_APPLICATION_CODE?: string;
  /** Feature flag: integración API del programa (progress). */
  readonly VITE_PROGRAM_API_ENABLED?: string;
  /**
   * Feature flag: SOS real contra `POST /api/v1/sos/alerts` (change
   * sos-panic-real). Default `false`: simulación local con doble
   * confirmación; solo en `"true"` se despacha al backend.
   */
  readonly VITE_SOS_ENABLED?: string;
  /** `"true"` habilita las herramientas de dev en un build de pruebas (`sync:dev`). */
  readonly VITE_DEV_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** `true` en dev server y en `build:dev`; `false` literal en producción. */
declare const __DEV_TOOLS__: boolean;
