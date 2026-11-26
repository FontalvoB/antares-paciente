import { useEffect, useState } from "react";
import { ApiError } from "../../../utils/apiClient";
import { motorPlanUserId, readMotorDay, type MotorDay } from "./motor-plan-api";

type MotorDayState =
  | { kind: "legacy" | "loading" | "locked" | "error" }
  | { kind: "ready"; day: MotorDay };

export function useMotorDay(): MotorDayState {
  const account = motorPlanUserId();
  const [loaded, setLoaded] = useState<{ account: string; value: MotorDayState }>();
  useEffect(() => {
    if (!account) return;
    let controller: AbortController | undefined;
    const load = () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      void readMotorDay(account, current.signal).then(
        (day) => {
          if (!current.signal.aborted) setLoaded({ account, value: { kind: "ready", day } });
        },
        (error: unknown) => {
          if (current.signal.aborted) return;
          const kind = error instanceof ApiError && error.status === 404 && error.code === "person_not_found"
            ? "legacy" : error instanceof ApiError && error.status === 409 ? "locked" : "error";
          setLoaded((previous) => kind === "error" && !navigator.onLine &&
            previous?.account === account && previous.value.kind === "ready" ? previous : { account, value: { kind } });
        },
      );
    };
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener("online", load);
    window.addEventListener("focus", load);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", load);
      window.removeEventListener("focus", load);
    };
  }, [account]);
  return !account ? { kind: "legacy" } : loaded?.account === account ? loaded.value : { kind: "loading" };
}
