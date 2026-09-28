/**
 * Cola offline de mutaciones de adherencia (Fase 12, tarea 2.1).
 *
 * Flujo: la UI encola con `enqueueOfflineMutation()` (o los constructores
 * `queueHydration` / `queueTaskCompletion` / `queueNotificationRead`) cuando
 * no hay red o el POST falla por transporte; `dispatchQueue()` reenvía en
 * FIFO secuencial al recuperar conexión (automático vía `ensureAutoSync()`).
 *
 * Reglas de despacho (REQ-12.4):
 * - 2xx → se remueve de inmediato.
 * - 4xx/negocio → se descarta con advertencia estructurada (no reintentable).
 * - Red/timeout/5xx → se conserva, `retryCount++` y backoff exponencial
 *   `min(1000 * 2^retryCount, 30_000)` + jitter; 5 intentos por ráfaga.
 * - Errores desconocidos (no `ApiError`) se conservan: jamás se descarta
 *   silenciosamente un avance clínico; el TTL de 72 h acota lo obsoleto.
 *
 * Idempotencia: cada entrada lleva `idempotencyKey` UUID v4 que viaja como
 * header `X-Idempotency-Key`; el Bearer lo inyecta `apiFetch` al enviar
 * (RND-12.1: la cola nunca guarda tokens).
 *
 * Eventos de ventana (reactividad sin prop-drilling):
 * - `offline:queue-changed` → la cola cambió (el banner relee el conteo).
 * - `offline:sync-state` (`{ isSyncing }`) → inicio/fin de despacho.
 * - `offline:synced` (DispatchSummary) → fin de ciclo (invalida caches).
 *
 * No toca la cola legada `program-offline-queue` (RND-12.3, sin regresiones).
 *
 * verbatimModuleSyntax: los tipos se importan con `import type`.
 */

import { apiFetch, ApiError } from "../../utils/apiClient";
import {
  loadQueue,
  saveQueue,
  purgeExpired,
  OFFLINE_QUEUE_MAX_ENTRIES,
} from "./offline-storage";

import type {
  DispatchSummary,
  OfflineMutationMethod,
  OfflineMutationType,
  QueuedMutation,
} from "./types";
import type { CompleteTaskInput } from "../program/types";

/** Eventos de ventana emitidos por la cola. */
export const OFFLINE_QUEUE_CHANGED_EVENT = "offline:queue-changed";
export const OFFLINE_SYNC_STATE_EVENT = "offline:sync-state";
export const OFFLINE_SYNCED_EVENT = "offline:synced";

/** Endpoints reales de adherencia (nunca inventados: espejo de los servicios). */
export const HYDRATION_LOG_ENDPOINT = "/api/v1/program/nutrition/log";
export const TASK_COMPLETE_ENDPOINT = "/api/v1/program/tasks/complete";
export const notificationReadEndpoint = (id: string): string =>
  `/api/v1/program/notifications/${encodeURIComponent(id)}/read`;

/** Tope de intentos por entrada dentro de una ráfaga de despacho. */
export const OFFLINE_MAX_ATTEMPTS_PER_BURST = 5;

/** Techo del backoff exponencial (30 s). */
export const OFFLINE_BACKOFF_CAP_MS = 30_000;

/** Conectividad actual (`true` cuando no se puede determinar). */
export function isOnline(): boolean {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.onLine === "boolean"
  ) {
    return navigator.onLine;
  }
  return true;
}

/** UUID v4 con fallback seguro (mismo patrón que `useCompleteTask`). */
export function newIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Backoff exponencial con jitter: `min(1000 * 2^retryCount, 30_000)` ms
 * más hasta 250 ms aleatorios (evita tormentas de reintento sincronizadas).
 * Exportado puro para tests.
 */
export function computeBackoffMs(retryCount: number): number {
  const safe = Number.isFinite(retryCount) && retryCount > 0 ? retryCount : 0;
  const capped = Math.min(1000 * 2 ** safe, OFFLINE_BACKOFF_CAP_MS);
  return capped + Math.random() * 250;
}

/** ¿El error amerita conservar la entrada y reintentar (red/timeout/5xx)? */
export function isTransportError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  if (err.errorType === "network" || err.errorType === "TIMEOUT") return true;
  return err.errorType === "server" && err.status >= 500;
}

function emit(name: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    detail === undefined ? new Event(name) : new CustomEvent(name, { detail }),
  );
}

function emitQueueChanged(): void {
  emit(OFFLINE_QUEUE_CHANGED_EVENT);
}

function emitSyncState(syncing: boolean): void {
  emit(OFFLINE_SYNC_STATE_EVENT, { isSyncing: syncing });
}

// ---------------------------------------------------------------------------
// Encolado
// ---------------------------------------------------------------------------

export interface EnqueueInput {
  type: OfflineMutationType;
  endpoint: string;
  method?: OfflineMutationMethod;
  payload?: unknown;
}

/**
 * Encola una mutación con `idempotencyKey` UUID v4 recién generado. Si la
 * cola está al tope, desaloja la más vieja (FIFO) con advertencia.
 */
export function enqueueOfflineMutation(input: EnqueueInput): QueuedMutation {
  if (!input.endpoint || input.endpoint.trim().length === 0) {
    throw new Error("La mutación offline requiere un endpoint válido.");
  }
  const entry: QueuedMutation = {
    id: newIdempotencyKey(),
    type: input.type,
    endpoint: input.endpoint,
    method: input.method ?? "POST",
    payload: input.payload ?? null,
    idempotencyKey: newIdempotencyKey(),
    createdAt: Date.now(),
    retryCount: 0,
  };
  const entries = loadQueue();
  if (entries.length >= OFFLINE_QUEUE_MAX_ENTRIES) {
    const dropped = entries.shift();
    console.warn(
      `[offline-queue] Desalojada mutación ${dropped?.id} (${dropped?.type}) — tope ${OFFLINE_QUEUE_MAX_ENTRIES}.`,
    );
  }
  entries.push(entry);
  saveQueue(entries);
  emitQueueChanged();
  return entry;
}

/** Vasos de agua: mismo shape wire que `logMeal` (`mealCode` + `intake`). */
export function queueHydration(input: {
  localDate?: string;
  waterMl: number;
  source?: string;
}): QueuedMutation {
  if (!Number.isFinite(input.waterMl) || input.waterMl <= 0) {
    throw new Error("La hidratación encolada requiere waterMl positivo.");
  }
  return enqueueOfflineMutation({
    type: "hydration",
    endpoint: HYDRATION_LOG_ENDPOINT,
    method: "POST",
    payload: {
      mealCode: "agua",
      ...(input.localDate !== undefined && { localDate: input.localDate }),
      intake: { waterMl: input.waterMl, source: input.source ?? "manual" },
    },
  });
}

/** Check-in de hábito: el payload viene del snapshot (nunca de la UI). */
export function queueTaskCompletion(
  payload: CompleteTaskInput,
): QueuedMutation {
  if (!payload.enrollmentId || !payload.localDate || !payload.taskCode) {
    throw new Error(
      "La tarea encolada requiere enrollmentId, localDate y taskCode del snapshot.",
    );
  }
  return enqueueOfflineMutation({
    type: "task_completion",
    endpoint: TASK_COMPLETE_ENDPOINT,
    method: "POST",
    payload: { ...payload },
  });
}

/** Aviso leído: POST sin cuerpo (el servidor lo trata como idempotente). */
export function queueNotificationRead(id: string): QueuedMutation {
  if (!id || id.trim().length === 0) {
    throw new Error("El aviso encolado requiere un id válido.");
  }
  return enqueueOfflineMutation({
    type: "notification_read",
    endpoint: notificationReadEndpoint(id),
    method: "POST",
    payload: null,
  });
}

// ---------------------------------------------------------------------------
// Despacho FIFO secuencial
// ---------------------------------------------------------------------------

type DelayFn = (ms: number) => Promise<void>;

const realDelay: DelayFn = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Promesa del ciclo en curso (las llamadas concurrentes la comparten). */
let currentRun: Promise<DispatchSummary> | null = null;

/** ¿Hay un despacho en curso? (lo pinta el banner). */
export function isDispatching(): boolean {
  return currentRun !== null;
}

async function sendEntry(entry: QueuedMutation): Promise<void> {
  await apiFetch<unknown>(entry.endpoint, {
    method: entry.method,
    body: entry.payload ?? undefined,
    headers: { "X-Idempotency-Key": entry.idempotencyKey },
  });
}

/**
 * Despacha la cola en FIFO secuencial. Purga vencidos primero. Las llamadas
 * concurrentes comparten el mismo ciclo (StrictMode-safe). `delay` es
 * inyectable para tests (por defecto `setTimeout` real).
 */
export function dispatchQueue(
  opts: { delay?: DelayFn } = {},
): Promise<DispatchSummary> {
  if (currentRun) return currentRun;
  currentRun = runDispatch(opts.delay ?? realDelay).finally(() => {
    currentRun = null;
  });
  return currentRun;
}

async function runDispatch(delay: DelayFn): Promise<DispatchSummary> {
  emitSyncState(true);
  purgeExpired();
  const entries = loadQueue();
  const summary: DispatchSummary = {
    succeeded: 0,
    dropped: 0,
    remaining: entries.length,
    types: [],
  };

  while (entries.length > 0) {
    const entry = entries[0];
    let attempts = 0;
    let resolved = false;

    while (attempts < OFFLINE_MAX_ATTEMPTS_PER_BURST && !resolved) {
      attempts += 1;
      entry.lastAttemptAt = Date.now();
      try {
        await sendEntry(entry);
        entries.shift();
        summary.succeeded += 1;
        if (!summary.types.includes(entry.type)) summary.types.push(entry.type);
        saveQueue(entries);
        emitQueueChanged();
        resolved = true;
      } catch (err) {
        if (!isTransportError(err)) {
          // 4xx/negocio: descarte definitivo con advertencia estructurada.
          entries.shift();
          summary.dropped += 1;
          saveQueue(entries);
          emitQueueChanged();
          console.warn(
            `[offline-queue] Descartada mutación ${entry.id} (${entry.type} ${entry.endpoint}): error no recuperable.`,
            err instanceof Error ? err.message : err,
          );
          resolved = true;
        } else {
          entry.retryCount += 1;
          saveQueue(entries);
          if (attempts < OFFLINE_MAX_ATTEMPTS_PER_BURST) {
            await delay(computeBackoffMs(entry.retryCount));
          }
        }
      }
    }

    if (!resolved) {
      // Cabeza bloqueada tras 5 intentos: se detiene la ráfaga; el resto
      // espera al próximo evento `online` (sin inanición silenciosa).
      break;
    }
  }

  summary.remaining = entries.length;
  emitSyncState(false);
  emit(OFFLINE_SYNCED_EVENT, summary);
  return summary;
}

// ---------------------------------------------------------------------------
// Arranque automático
// ---------------------------------------------------------------------------

let autoSyncStarted = false;

/**
 * Despacho automático: purga vencidos al arrancar, despacha si hay red y
 * reintenta ante cada evento `online`. Idempotente (doble montaje seguro).
 */
export function ensureAutoSync(): void {
  if (autoSyncStarted || typeof window === "undefined") return;
  autoSyncStarted = true;
  purgeExpired();
  if (isOnline()) {
    void dispatchQueue().catch(() => {});
  }
  window.addEventListener("online", () => {
    void dispatchQueue().catch(() => {});
  });
}
