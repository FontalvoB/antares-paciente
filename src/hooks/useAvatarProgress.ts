import { useEffect, useState } from "react";
import { getAccessToken, onSessionInvalid } from "../utils/authApi";
import { getMetricsHistory } from "../services/program/metrics-history-service";
import {
  AVATAR_HISTORY_DAYS,
  AvatarHistoryDataError,
  weightRecords,
} from "../components/avatar/avatar-body-state";
import type { WeightRecord } from "../components/avatar/avatar-body-state";
import { ApiError } from "../utils/apiClient";

type Status =
  "session-required" | "loading" | "ready" | "empty" | "unavailable" | "error";
interface HistoryError {
  status?: number;
  code?: string;
  message?: string;
  correlationId?: string;
  unit?: string;
}
interface Progress {
  owner: string | null;
  status: Status;
  records: WeightRecord[];
  error?: HistoryError;
  resolved?: boolean;
  historyMs?: number;
}

/** Misma consulta real para entrada, actualización manual y después de guardar peso. */
export async function loadUserAvatarData() {
  return weightRecords(
    await getMetricsHistory(["weight"], AVATAR_HISTORY_DAYS, {
      cache: "no-store",
    }),
  );
}

/** Estado efímero por sesión, sin caché compartida ni persistencia de medidas. */
export function useAvatarProgress(configurationReady = true) {
  const token = getAccessToken();
  const hasSession = Boolean(token);
  const enabled = hasSession && configurationReady;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Progress>({
    owner: null,
    status: "loading",
    records: [],
  });
  useEffect(
    () =>
      onSessionInvalid(() =>
        setResult({ owner: null, status: "session-required", records: [] }),
      ),
    [],
  );
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const owner = token;
    const started = performance.now();
    const publish = (
      status: Status,
      records: WeightRecord[] = [],
      error?: HistoryError,
    ) => {
      // Una respuesta tardía de A nunca debe aparecer en la sesión B.
      if (active && getAccessToken() === owner)
        setResult((previous) => {
          const retained = previous.owner === owner && previous.resolved;
          const success = status === "ready" || status === "empty";
          return {
            owner,
            status,
            error,
            resolved: success || Boolean(retained),
            records: success ? records : retained ? previous.records : [],
            historyMs:
              status === "loading"
                ? previous.historyMs
                : performance.now() - started,
          };
        });
    };
    publish("loading");
    void loadUserAvatarData()
      .then((records) => {
        publish(records.length ? "ready" : "empty", records);
      })
      .catch((error) => {
        const detail: HistoryError =
          error instanceof ApiError
            ? {
                status: error.status,
                code: error.code,
                message: error.message,
                correlationId: error.correlationId,
              }
            : error instanceof AvatarHistoryDataError
              ? { code: error.code, unit: error.unit }
              : { code: "UNEXPECTED_HISTORY_ERROR" };
        publish(
          error instanceof ApiError &&
            error.status === 404 &&
            error.code === "NO_ACTIVE_ENROLLMENT"
            ? "unavailable"
            : "error",
          [],
          detail,
        );
      });
    return () => {
      active = false;
    };
  }, [token, enabled, attempt]);
  const current: Progress = !hasSession
    ? { owner: null, status: "session-required", records: [] }
    : !configurationReady
      ? { owner: token, status: "loading", records: [] }
      : result.owner !== token
        ? { owner: token, status: "loading", records: [] }
        : result;
  return {
    status: current.status,
    records: current.records,
    error: current.error,
    resolved: Boolean(current.resolved),
    owner: current.owner,
    historyMs: current.historyMs,
    refresh: () => setAttempt((a) => a + 1),
  };
}
