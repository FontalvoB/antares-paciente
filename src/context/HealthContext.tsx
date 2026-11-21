import { App } from "@capacitor/app";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { measurementsKeys, programKeys } from "../hooks/queryKeys";
import {
  getHealthPermission, HealthError, healthDeviceMetrics, healthSource,
  isHealthAvailable, openHealthSettings, persistHealthDay, readHealthData,
  recentHealthStart, requestHealthPermissions, summarizeHealthData,
} from "../services/health/health-service";
import type { HealthAvailability, HealthDay, HealthErrorCode, HealthPermission } from "../services/health/health-service";
import { useApp } from "./AppContext";
import { getAccessToken, onSessionInvalid } from "../utils/authApi";
import { sessionUserId } from "../utils/sessionIdentity";
import { HEALTH_ENABLED } from "../utils/features";

const RESUME_THROTTLE_MS = 2_000;
const saveErrorCodes = ["save-failed", "save-unavailable", "save-rejected"] as const;
type SaveError = (typeof saveErrorCodes)[number];

function permissionRequestsFor(key: string | null) {
  try { return key ? Math.max(0, Number(localStorage.getItem(key)) || 0) : 0; }
  catch { return 0; }
}

function useHealthSession(userId: string | null, active: boolean) {
  const queryClient = useQueryClient();
  const source = healthSource();
  const key = userId && source ? `copp.health-read-v1.${source}.${userId}` : null;
  const [permissionRequests, setPermissionRequests] = useState(() => permissionRequestsFor(key));
  const requests = useRef(permissionRequests);
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [permission, setPermission] = useState<HealthPermission>("not-requested");
  const [summary, setSummary] = useState<HealthDay[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<HealthErrorCode | null>(null);
  const pending = useRef(false);
  const lastAttempt = useRef(-Infinity);
  const controller = useRef<AbortController | null>(null);
  const saved = useRef(new Map<string, string>());
  const saveErrors = useRef(new Map<string, SaveError>());

  useEffect(() => {
    const endSession = () => {
      controller.current?.abort();
      saved.current.clear();
      saveErrors.current.clear();
      setSummary([]);
      setLastSync(null);
      setSyncing(false);
    };
    const stop = onSessionInvalid(endSession);
    return () => { stop(); controller.current?.abort(); };
  }, []);

  const sync = useCallback(async (mode: "request" | "manual" | "open" | "resume" | "retry" = "manual") => {
    const now = new Date();
    if (pending.current || (mode === "resume" && now.getTime() - lastAttempt.current < RESUME_THROTTLE_MS)) return;
    const abort = new AbortController();
    controller.current = abort;
    const current = () => !abort.signal.aborted;
    pending.current = true;
    lastAttempt.current = now.getTime();
    setSyncing(true);
    setError(null);
    let updated = false;
    try {
      let status = await isHealthAvailable();
      if (!current()) return;
      setAvailability(status.availability);
      if (status.availability !== "available") throw new HealthError(status.availability);
      if (mode === "request") {
        try {
          await requestHealthPermissions();
        } catch {
          throw new HealthError(source === "apple-health" ? "permission-unknown" : "read-failed");
        }
        if (!current()) return;
        const count = ++requests.current;
        setPermissionRequests(count);
        // Solo recordamos las solicitudes de esta cuenta en este dispositivo.
        try { if (key) localStorage.setItem(key, String(count)); } catch { /* La sesión sigue funcionando. */ }
        status = await isHealthAvailable();
        if (!current()) return;
      }
      setAvailability(status.availability);
      if (status.availability !== "available") throw new HealthError(status.availability);
      const access = getHealthPermission(status, requests.current > 0);
      setPermission(access);
      if (access === "not-requested") return;
      if (access === "denied") throw new HealthError("permission-denied");
      const from = recentHealthStart(now);
      const samples = await readHealthData(from, now, status);
      if (!current()) return;
      const days = summarizeHealthData(samples, from, now);
      if (!days.length) throw new HealthError("no-data");
      setSummary(days);

      if (!userId || sessionUserId(getAccessToken()) !== userId) throw new HealthError("save-rejected");
      for (const date of saveErrors.current.keys()) {
        if (!days.some(day => day.date === date)) saveErrors.current.delete(date);
      }
      for (const day of days) {
        if (!current()) return;
        if (mode === "retry" && saveErrors.current.get(day.date) !== "save-failed") continue;
        const input = healthDeviceMetrics(day);
        if (!input) {
          saveErrors.current.delete(day.date);
          continue;
        }
        const { recordedAt: _recordedAt, ...values } = input;
        const fingerprint = JSON.stringify(values);
        if (saved.current.get(day.date) === fingerprint) {
          saveErrors.current.delete(day.date);
          continue;
        }
        try {
          const persisted = await persistHealthDay(input, userId, abort.signal);
          updated = true;
          if (!current()) return;
          if (persisted.date !== day.date) {
            saveErrors.current.set(day.date, "save-rejected");
            continue;
          }
          saved.current.set(day.date, fingerprint);
          saveErrors.current.delete(day.date);
        } catch (cause) {
          if (!current()) return;
          const code = cause instanceof HealthError
            ? saveErrorCodes.find(code => code === cause.code)
            : undefined;
          saveErrors.current.set(day.date, code ?? "save-failed");
        }
      }
      const remaining = new Set(saveErrors.current.values());
      const saveError = saveErrorCodes.find(code => remaining.has(code));
      if (saveError) throw new HealthError(saveError);
      if (current()) setLastSync(now);
    } catch (cause) {
      if (!current()) return;
      const code = cause instanceof HealthError ? cause.code : "read-failed";
      if (!saveErrorCodes.some(saveCode => saveCode === code) && code !== "settings-failed") {
        setSummary([]);
        if (code === "permission-denied") setPermission("denied");
        if (code === "permission-unknown") setPermission("unknown");
      }
      setError(code);
    } finally {
      pending.current = false;
      if (current()) {
        if (updated) {
          void queryClient.invalidateQueries({ queryKey: programKeys.all });
          void queryClient.invalidateQueries({ queryKey: measurementsKeys.myMeasurements });
          void queryClient.invalidateQueries({ queryKey: measurementsKeys.myMetricsHistory });
        }
        setSyncing(false);
      }
    }
  }, [queryClient, key, source, userId]);

  useEffect(() => {
    if (active) void sync("open");
  }, [active, sync]);

  useEffect(() => {
    if (!source) return;
    let stopped = false;
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (!stopped && isActive && (active || requests.current > 0)) void sync("resume");
    });
    return () => {
      stopped = true;
      void listener.then(handle => handle.remove()).catch(() => {});
    };
  }, [active, source, sync]);

  const openSettings = async () => {
    try { await openHealthSettings(); }
    catch { setError("settings-failed"); }
  };

  return { source, availability, permission, permissionRequests, summary, lastSync, syncing, error, sync, openSettings };
}

const HealthContext = createContext<ReturnType<typeof useHealthSession> | null>(null);

function HealthSession({ userId, active, children }: { userId: string | null; active: boolean; children: ReactNode }) {
  const value = useHealthSession(userId, active);
  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const { flow, screen, user } = useApp();
  if (!HEALTH_ENABLED || flow !== "app") return children;
  const userId = sessionUserId(getAccessToken());
  return (
    <HealthSession key={userId ?? user.id ?? "anonymous"} userId={userId} active={screen === "health-accessory"}>
      {children}
    </HealthSession>
  );
}

export function useHealth() {
  return useContext(HealthContext);
}
