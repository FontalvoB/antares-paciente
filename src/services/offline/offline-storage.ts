/**
 * Persistencia de la cola offline (Fase 12, tarea 2.1).
 *
 * `localStorage` bajo la clave `copp_offline_mutation_queue`: sobrevive al
 * cierre forzado de la app (REQ-12.3) y es síncrono (sin promesas en el
 * camino crítico del tap). TTL de 72 horas: las entradas más viejas se
 * purgan al cargar y antes de cada ciclo de despacho (REQ-12.5).
 *
 * Cap de 100 entradas con desalojo FIFO del más viejo (aviso por consola):
 * decenas de mutaciones diarias quedan muy por debajo de 50 KB (RND-12.2).
 * Todo acceso a `localStorage` está blindado con try/catch (modo privado).
 *
 * verbatimModuleSyntax: los tipos se importan con `import type`.
 */

import type { QueuedMutation } from "./types";

/** Clave de persistencia (contrato REQ-12.3). */
export const OFFLINE_QUEUE_STORAGE_KEY = "copp_offline_mutation_queue";

/** TTL de 72 horas en ms (contrato REQ-12.5). */
export const OFFLINE_QUEUE_TTL_MS = 72 * 60 * 60 * 1000;

/** Tope de entradas (desalojo FIFO del más viejo). */
export const OFFLINE_QUEUE_MAX_ENTRIES = 100;

function isStorageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isValidEntry(value: unknown): value is QueuedMutation {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    typeof entry.type === "string" &&
    typeof entry.endpoint === "string" &&
    entry.endpoint.length > 0 &&
    typeof entry.idempotencyKey === "string" &&
    typeof entry.createdAt === "number" &&
    typeof entry.retryCount === "number"
  );
}

function isExpired(entry: QueuedMutation, now: number): boolean {
  return now - entry.createdAt > OFFLINE_QUEUE_TTL_MS;
}

function readRaw(): QueuedMutation[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    // Almacén corrupto: se empieza de cero (nunca se rompe la app).
    return [];
  }
}

function writeRaw(entries: QueuedMutation[]): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Almacén lleno o bloqueado: la cola vive en memoria esta sesión.
  }
}

/**
 * Carga la cola purgando entradas vencidas (>72 h). No escribe: usar
 * `purgeExpired()` cuando se quiera persistir la purga.
 */
export function loadQueue(now: number = Date.now()): QueuedMutation[] {
  return readRaw().filter((entry) => !isExpired(entry, now));
}

/**
 * Persiste la cola completa (reemplazo total). Devuelve true si persistió.
 */
export function saveQueue(entries: QueuedMutation[]): boolean {
  if (!isStorageAvailable()) return false;
  writeRaw(entries);
  return true;
}

/**
 * Purga entradas vencidas y persiste si hubo cambios. Retorna cuántas
 * descartó (llamado al iniciar y antes de cada despacho).
 */
export function purgeExpired(now: number = Date.now()): number {
  const all = readRaw();
  if (all.length === 0) return 0;
  const fresh = all.filter((entry) => !isExpired(entry, now));
  const purged = all.length - fresh.length;
  if (purged > 0) {
    writeRaw(fresh);
    console.warn(
      `[offline-queue] Descartadas ${purged} mutaciones vencidas (>72 h).`,
    );
  }
  return purged;
}

/** Número de entradas vigentes (lo que pinta el banner). */
export function pendingCount(now: number = Date.now()): number {
  return loadQueue(now).length;
}

/** Vacía la cola por completo (solo mantenimiento/tests). */
export function clearQueue(): void {
  writeRaw([]);
}
