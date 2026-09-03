/**
 * Bounded offline mutation queue — localStorage-backed, FIFO.
 *
 * Persists failed transport mutations (timeout / network / 5xx) for replay
 * when connectivity is restored. Business errors (4xx) are NEVER enqueued.
 *
 * Constraints (R5.4 / R5.5):
 *   - Max 50 entries, oldest dropped with console.warn when full.
 *   - Total serialized size capped at 512 KB.
 *   - Payloads must NOT contain PHI.
 *   - Only `errorType` 'TIMEOUT' | 'network' | 'server' (5xx) are eligible.
 *
 * Generic over payload type so the same queue serves `completeTask`,
 * `nutritionLog`, and any future mutation.
 *
 * verbatimModuleSyntax: all external imports use `import type`.
 */

import type { ApiError } from '../../utils/apiClient'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Discriminator stored alongside each entry for logging/routing. */
export type ActionType = 'completeTask' | 'nutritionLog' | string

/**
 * One queued mutation.
 *
 * @typeParam T - The mutation payload shape (must be JSON-serializable, no PHI).
 */
export interface QueueEntry<T = unknown> {
  /** Mutation discriminator — 'completeTask', 'nutritionLog', etc. */
  readonly actionType: ActionType
  /** The exact payload that will be re-sent on replay. */
  readonly payload: T
  /** The clientRequestId used for idempotency (ULID/UUID). */
  readonly clientRequestId: string
  /** ISO-8601 timestamp of when the entry was enqueued. */
  readonly createdAt: string
}

/** Callback fired once after a flush cycle completes. */
export type OnBatchComplete = (result: {
  /** Number of entries that replayed successfully and were removed. */
  succeeded: number
  /** Number of entries dropped due to business-rule errors (4xx). */
  dropped: number
  /** Number of entries that remain queued (transport failure — will retry). */
  remaining: number
}) => void

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'program-offline-queue'
const MAX_ENTRIES = 50
/** Max serialized payload size in bytes (512 KB). */
const MAX_TOTAL_BYTES = 512 * 1024

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readStore(): QueueEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : []
  } catch {
    // Corrupted storage — start fresh.
    return []
  }
}

function writeStore(entries: QueueEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or unavailable — silent fail; queue remains in memory for
    // the current session but won't survive a page reload.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a mutation to the offline queue.
 *
 * Enforces the 50-entry cap (FIFO eviction) and a total serialized-size cap.
 * The payload MUST NOT contain PHI.
 *
 * @returns `true` if the entry was persisted, `false` if rejected (e.g. size cap).
 */
export function enqueue<T>(entry: QueueEntry<T>): boolean {
  const entries = readStore()

  // Size cap check — reject if adding this entry would exceed the limit.
  const entrySize = new Blob([JSON.stringify(entry)]).size
  const currentSize = new Blob([JSON.stringify(entries)]).size
  if (currentSize + entrySize > MAX_TOTAL_BYTES) {
    console.warn(
      `[offline-queue] Rejecting entry ${entry.clientRequestId} — total size cap (${MAX_TOTAL_BYTES} bytes) exceeded.`,
    )
    return false
  }

  // FIFO eviction when at capacity.
  if (entries.length >= MAX_ENTRIES) {
    const dropped = entries.shift()!
    console.warn(
      `[offline-queue] Evicting oldest entry ${dropped.clientRequestId} (${dropped.actionType}) — max ${MAX_ENTRIES} entries reached.`,
    )
  }

  entries.push({
    actionType: entry.actionType,
    payload: entry.payload,
    clientRequestId: entry.clientRequestId,
    createdAt: entry.createdAt,
  })

  writeStore(entries)
  return true
}

/**
 * Inspect the next entry without removing it.
 * Returns `undefined` when the queue is empty.
 */
export function peek<T = unknown>(): QueueEntry<T> | undefined {
  const entries = readStore()
  return entries.length > 0 ? (entries[0] as QueueEntry<T>) : undefined
}

/**
 * Remove and return the next entry from the queue.
 * Returns `undefined` when the queue is empty.
 */
export function dequeue<T = unknown>(): QueueEntry<T> | undefined {
  const entries = readStore()
  if (entries.length === 0) return undefined
  const first = entries.shift()!
  writeStore(entries)
  return first as QueueEntry<T>
}

/** Current number of entries in the queue. */
export function length(): number {
  return readStore().length
}

/** Remove all entries from the queue. */
export function clear(): void {
  writeStore([])
}

/**
 * Replay every queued entry in FIFO order.
 *
 * For each entry the caller provides an `action` function that performs the
 * actual API call (e.g. `completeTask(entry.payload)`).
 *
 * Behaviour per replay result:
 *   - **Success** → entry is removed from the queue.
 *   - **Transport failure** (timeout / network / 5xx) → entry STAYS for retry.
 *   - **Business-rule failure** (4xx) → entry is DROPPED and `onDropped` is called.
 *
 * After the entire batch is processed, `onBatchComplete` fires once with a
 * summary. This is the hook consumers use to invalidate TanStack Query caches.
 *
 * @typeParam T - The mutation payload shape.
 * @param action  Async function that replays one entry. Receives the full
 *                `QueueEntry` (including `clientRequestId` for idempotency).
 * @param opts.onDropped     Called when an entry is dropped due to a business error.
 * @param opts.onBatchComplete Called once after all entries have been processed.
 */
export async function flush<T = unknown>(
  action: (entry: QueueEntry<T>) => Promise<unknown>,
  opts: {
    onDropped?: (entry: QueueEntry<T>, error: ApiError) => void
    onBatchComplete?: OnBatchComplete
  } = {},
): Promise<void> {
  const { onDropped, onBatchComplete } = opts

  let succeeded = 0
  let dropped = 0

  // Read once, mutate in-memory, persist once at the end.
  let entries = readStore()

  while (entries.length > 0) {
    // peek — don't remove yet; only remove on success or drop.
    const entry = entries[0] as QueueEntry<T>

    try {
      await action(entry)
      // Success — remove from queue.
      entries.shift()
      succeeded++
    } catch (err) {
      if (isTransportError(err)) {
        // Transport failure — keep in queue for later retry.
        break
      }
      // Business-rule failure — drop with notice.
      entries.shift()
      dropped++
      onDropped?.(entry, err as ApiError)
    }
  }

  // Persist whatever state we ended up with.
  writeStore(entries)

  // Fire batch-complete hook once.
  if (onBatchComplete) {
    onBatchComplete({
      succeeded,
      dropped,
      remaining: entries.length,
    })
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether an error is a transport failure eligible for retry.
 *
 * Transport failures (keep in queue):
 *   - `ApiError` with `errorType` 'TIMEOUT' or 'network' (status 0)
 *   - `ApiError` with `errorType` 'server' AND status ≥ 500
 *
 * Business-rule errors (drop from queue):
 *   - `ApiError` with `errorType` 'business' OR status 4xx
 *   - Any non-ApiError (assumed transient but treated as business to be safe)
 */
function isTransportError(err: unknown): boolean {
  if (!(err instanceof Error) || !('errorType' in err)) {
    return false
  }
  const apiErr = err as ApiError
  if (apiErr.errorType === 'TIMEOUT' || apiErr.errorType === 'network') {
    return true
  }
  if (apiErr.errorType === 'server' && apiErr.status >= 500) {
    return true
  }
  return false
}
