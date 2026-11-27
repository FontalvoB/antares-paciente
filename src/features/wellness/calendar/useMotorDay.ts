import { useEffect, useState } from "react";
import { ApiError } from "../../../utils/apiClient";
import { syncMotorCheckins } from "../checkin/checkin-store";
import { cachedMotorDay, clearCachedMotorDay, isCurrentMotorDay, MOTOR_ADJUSTMENT_CHANGED, MOTOR_CLOSURE_CONFIRMED, motorPlanUserId, readMotorDay, type MotorDay } from "./motor-plan-api";

type MotorDayState =
  | { kind: "legacy" | "loading" | "unlinked" | "locked" | "error" }
  | { kind: "ready"; day: MotorDay; stale?: boolean };

interface MotorDayOptions {
  historyDays?: number;
  includeMenu?: boolean;
}

export function useMotorDay({ historyDays = 28, includeMenu = false }: MotorDayOptions = {}): MotorDayState {
  const account = motorPlanUserId();
  const [loaded, setLoaded] = useState<{ account: string; value: MotorDayState }>();
  useEffect(() => {
    if (!account) return;
    let controller: AbortController | undefined;
    let lastGood = cachedMotorDay(account);
    const unavailable = () => {
      const day = lastGood && lastGood.aiAdjustment?.status !== "applied" && isCurrentMotorDay(lastGood)
        ? lastGood : cachedMotorDay(account);
      setLoaded({ account, value: day ? { kind: "ready", day, stale: true } : { kind: "error" } });
    };
    const load = () => {
      controller?.abort();
      if (motorPlanUserId() !== account) {
        lastGood = undefined;
        return;
      }
      if (!navigator.onLine) {
        unavailable();
        return;
      }
      const current = new AbortController();
      controller = current;
      void readMotorDay(account, current.signal, historyDays, includeMenu).then(
        (day) => {
          if (current.signal.aborted) return;
          lastGood = day;
          setLoaded({ account, value: { kind: "ready", day } });
          void syncMotorCheckins(account);
        },
        (error: unknown) => {
          if (current.signal.aborted) return;
          if (error instanceof ApiError && [401, 403, 404, 409].includes(error.status)) {
            lastGood = undefined;
            clearCachedMotorDay(account);
            const kind = error.status === 404 ? "unlinked" : error.status === 409 ? "locked" : "error";
            setLoaded({ account, value: { kind } });
          } else {
            unavailable();
          }
        },
      );
    };
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener("online", load);
    window.addEventListener("offline", load);
    window.addEventListener("focus", load);
    window.addEventListener(MOTOR_CLOSURE_CONFIRMED, load);
    window.addEventListener(MOTOR_ADJUSTMENT_CHANGED, load);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", load);
      window.removeEventListener("offline", load);
      window.removeEventListener("focus", load);
      window.removeEventListener(MOTOR_CLOSURE_CONFIRMED, load);
      window.removeEventListener(MOTOR_ADJUSTMENT_CHANGED, load);
    };
  }, [account, historyDays, includeMenu]);
  return !account ? { kind: "legacy" } : loaded?.account === account ? loaded.value : { kind: "loading" };
}
