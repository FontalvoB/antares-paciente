/**
 * Tipos de la cola offline de mutaciones (Fase 12, tarea 2.1).
 *
 * Contratos espejo de `openspec/changes/app-fase-12-offline-resiliencia`:
 * solo mutaciones de adherencia (hidratación, tareas, comidas, lectura de
 * avisos). Nada transaccional crítico (citas, pagos, contraseña) viaja en
 * esta cola: eso requiere conexión activa y avisa al usuario.
 *
 * Seguridad (RND-12.1): los ítems NUNCA llevan tokens ni contraseñas; el
 * Bearer se inyecta al despachar desde `apiFetch`.
 *
 * verbatimModuleSyntax: los consumidores importan estos tipos con `import type`.
 */

/** Familias de mutación admitidas en la cola offline (REQ-12.2). */
export type OfflineMutationType =
  "hydration" | "task_completion" | "notification_read" | "meal_log";

/** Métodos HTTP admitidos al reenviar. */
export type OfflineMutationMethod = "POST" | "PUT" | "PATCH";

/**
 * Mutación encolada. `createdAt` en ms Unix (comparación directa para el
 * TTL de 72 h). `payload` debe ser JSON-serializable y sin PHI sensible.
 */
export interface QueuedMutation {
  /** Id único de la entrada en cola (UUID v4). */
  id: string;
  /** Familia de mutación (enruta invalidaciones tras el despacho). */
  type: OfflineMutationType;
  /** Path relativo al gateway (p. ej. `/api/v1/program/nutrition/log`). */
  endpoint: string;
  /** Verbo HTTP del reenvío. */
  method: OfflineMutationMethod;
  /** Cuerpo verbatim del POST original (o null cuando no lleva cuerpo). */
  payload: unknown;
  /** Clave de idempotencia UUID v4: viaja como header `X-Idempotency-Key`. */
  idempotencyKey: string;
  /** Creación en ms Unix (base del TTL). */
  createdAt: number;
  /** Reintentos de transporte acumulados. */
  retryCount: number;
  /** Último intento en ms Unix (diagnóstico). */
  lastAttemptAt?: number;
}

/** Estado de red expuesto por `useNetworkStatus`. */
export interface NetworkState {
  /** `navigator.onLine` en tiempo real (eventos online/offline). */
  isOnline: boolean;
  /** Hay un ciclo de despacho en curso. */
  isSyncing: boolean;
  /** Entradas pendientes en la cola persistente. */
  pendingCount: number;
}

/** Resumen de un ciclo de despacho FIFO. */
export interface DispatchSummary {
  /** Entradas enviadas con 2xx y removidas. */
  succeeded: number;
  /** Entradas descartadas por 4xx (no recuperable). */
  dropped: number;
  /** Entradas que siguen en cola (fallo de transporte). */
  remaining: number;
  /** Familias despachadas con éxito (guían invalidaciones de cache). */
  types: OfflineMutationType[];
}
