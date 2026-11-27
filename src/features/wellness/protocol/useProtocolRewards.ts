import { useCallback, useEffect, useState } from "react";
import { MOTOR_CLOSURE_CONFIRMED, motorPlanUserId } from "../calendar/motor-plan-api";
import { getProtocolRewards, PROTOCOL_REWARDS_UPDATED, type ProtocolRewards } from "./protocol-rewards-api";

export function useProtocolRewards() {
  const account = motorPlanUserId();
  const [loaded, setLoaded] = useState<{ account: string; snapshot?: ProtocolRewards; unavailable?: boolean }>();
  const [epoch, setEpoch] = useState(0);
  const refresh = useCallback(() => setEpoch((value) => value + 1), []);
  useEffect(() => {
    if (!account) return;
    let controller: AbortController | undefined;
    const canApply = () => motorPlanUserId() === account;
    const load = () => {
      controller?.abort();
      const active = new AbortController();
      controller = active;
      void getProtocolRewards(account, active.signal).then(
        snapshot => { if (!active.signal.aborted && canApply()) setLoaded({ account, snapshot }); },
        () => { if (!active.signal.aborted && canApply()) setLoaded({ account, unavailable: true }); },
      );
    };
    const update = (event: Event) => {
      const { detail } = event as CustomEvent<{ account: string; result: ProtocolRewards }>;
      if (detail.account === account && canApply()) {
        controller?.abort();
        setLoaded({ account, snapshot: detail.result });
      }
    };
    const events = ["online", "focus", "pageshow", MOTOR_CLOSURE_CONFIRMED];
    events.forEach(event => window.addEventListener(event, load));
    window.addEventListener(PROTOCOL_REWARDS_UPDATED, update);
    const timer = window.setInterval(load, 30_000);
    load();
    return () => {
      controller?.abort();
      events.forEach(event => window.removeEventListener(event, load));
      window.removeEventListener(PROTOCOL_REWARDS_UPDATED, update);
      window.clearInterval(timer);
    };
  }, [account, epoch]);
  const state = loaded?.account === account ? loaded : undefined;
  return { account, snapshot: state?.snapshot, unavailable: state?.unavailable ?? false, refresh };
}
