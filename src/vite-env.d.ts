/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del WebSocket de GraphQL para las suscripciones de la comunidad. */
  readonly VITE_COMMUNITY_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
