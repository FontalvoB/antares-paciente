/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Web de pruebas detrás de un proxy /api; no cambia el gateway nativo. */
  readonly VITE_WEB_SAME_ORIGIN?: string;
  /** Base URL (origen) del API Gateway YARP (5080) — única entrada pública. Vacío = proxy de Vite. */
  readonly VITE_GATEWAY_BASE_URL?: string;
  /** Origen de la web pública (coppadresdWeb) para la eliminación de cuenta. Sin valor en producción = deshabilitado. */
  readonly VITE_WEB_BASE_URL?: string;
  /** Código de aplicación (claim `aud` del JWT): "app" (móvil) o "erp" (consola). Default "app". */
  readonly VITE_APPLICATION_CODE?: string;
  /** Feature flag: integración API del programa (progress). */
  readonly VITE_PROGRAM_API_ENABLED?: string;
  /** Solo "true" restaura los accesos de Nutrición dentro del chat. */
  readonly VITE_CHAT_NUTRITION_ENABLED?: string;
  /** Tipo clínico general para archivar adjuntos Vita con JWT app. */
  readonly VITE_VITA_GENERAL_DOCUMENT_TYPE_ID?: string;
  /** `"true"` habilita las herramientas de dev en un build de pruebas (`sync:dev`). */
  readonly VITE_DEV_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** `true` en dev server y en `build:dev`; `false` literal en producción. */
declare const __DEV_TOOLS__: boolean;
