import { useEffect, useState } from "react";
import { getWellnessHomeData, subscribeProtocolHistory } from "../state/wellness-home-store";
import { useProtocolRewards } from "../protocol/useProtocolRewards";

export const GOAL_LABEL = { bajar: "Bajar de peso", masa: "Subir masa muscular", def: "Definir" } as const;

export function useWellnessOverview(name: string) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    const unsubscribe = subscribeProtocolHistory(update);
    const timer = window.setInterval(update, 60_000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, []);
  const rewards = useProtocolRewards();
  const local = getWellnessHomeData(name, new Date(), rewards.account ? {} : undefined);
  if (!rewards.account) return { ...local, rewards };

  const snapshot = rewards.snapshot;
  const protocol = local.protocol.map(step => ({ ...step, done: snapshot?.today.steps[step.id] !== undefined }));
  return {
    ...local, rewards, protocol, protocolDone: protocol.filter(step => step.done).length,
    points: snapshot?.balance ?? 0,
    streakDays: snapshot?.streak ?? 0,
    level: snapshot?.level ?? 1,
  };
}
