/**
 * useNetworkStatus — conectividad en tiempo real + estado de la cola offline
 * (Fase 12, tarea 2.2).
 *
 * Expone `{ isOnline, isSyncing, pendingCount, syncNow }`:
 * - `isOnline`: `navigator.onLine` + listeners `online`/`offline`.
 * - `pendingCount`: entradas vigentes de la cola (reactivo vía el evento
 *   `offline:queue-changed` que emite el servicio en cada cambio).
 * - `isSyncing`: ciclo de despacho en curso (evento `offline:sync-state`).
 * - `syncNow`: despacho manual; al terminar (`offline:synced`) invalida las
 *   queries de los dominios despachados para reconciliar con el servidor.
 *
 * NUNCA toast en este hook: el feedback visual vive en `OfflineBanner`.
 *
 * verbatimModuleSyntax: los tipos se importan con `import type`.
 */

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  dispatchQueue,
  ensureAutoSync,
  isDispatching,
  isOnline,
  OFFLINE_QUEUE_CHANGED_EVENT,
  OFFLINE_SYNCED_EVENT,
  OFFLINE_SYNC_STATE_EVENT,
} from "../services/offline/offline-queue-service";
import { pendingCount as readPendingCount } from "../services/offline/offline-storage";
import { notificationsKeys, programInvalidation } from "./queryKeys";

import type { DispatchSummary } from "../services/offline/types";
import type { NetworkState } from "../services/offline/types";

export interface UseNetworkStatusResult extends NetworkState {
  /** Despacho manual de la cola + reconciliación de caches. */
  syncNow: () => Promise<void>;
}

export function useNetworkStatus(): UseNetworkStatusResult {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [syncing, setSyncing] = useState<boolean>(() => isDispatching());
  const [pending, setPending] = useState<number>(() => readPendingCount());

  const invalidateAfterSync = useCallback(
    (summary: DispatchSummary) => {
      if (summary.succeeded === 0) return;
      const jobs: Promise<unknown>[] = [];
      if (
        summary.types.some((t) =>
          ["hydration", "task_completion", "meal_log"].includes(t),
        )
      ) {
        // Reconcilia snapshot/scores/path (mismo patrón que tras un log
        // nutricional o una tarea confirmada) + avisos por si cambió el
        // conteo de no leídas desde otro dispositivo.
        jobs.push(programInvalidation.afterMutation(queryClient));
        jobs.push(
          queryClient.invalidateQueries({
            queryKey: notificationsKeys.list(1, 50),
          }),
        );
      }
      if (summary.types.includes("notification_read")) {
        jobs.push(
          queryClient.invalidateQueries({
            queryKey: notificationsKeys.list(1, 50),
          }),
        );
      }
      void Promise.all(jobs);
    },
    [queryClient],
  );

  useEffect(() => {
    ensureAutoSync();

    const onOnline = (): void => setOnline(true);
    const onOffline = (): void => setOnline(false);
    const onQueueChanged = (): void => setPending(readPendingCount());
    const onSyncState = (e: Event): void => {
      const detail = (e as CustomEvent<{ isSyncing: boolean }>).detail;
      setSyncing(Boolean(detail?.isSyncing));
    };
    const onSynced = (e: Event): void => {
      const summary = (e as CustomEvent<DispatchSummary>).detail;
      setPending(readPendingCount());
      if (summary) invalidateAfterSync(summary);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onQueueChanged);
    window.addEventListener(OFFLINE_SYNC_STATE_EVENT, onSyncState);
    window.addEventListener(OFFLINE_SYNCED_EVENT, onSynced);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onQueueChanged);
      window.removeEventListener(OFFLINE_SYNC_STATE_EVENT, onSyncState);
      window.removeEventListener(OFFLINE_SYNCED_EVENT, onSynced);
    };
  }, [invalidateAfterSync]);

  const syncNow = useCallback(async (): Promise<void> => {
    await dispatchQueue();
  }, []);

  return {
    isOnline: online,
    isSyncing: syncing,
    pendingCount: pending,
    syncNow,
  };
}
