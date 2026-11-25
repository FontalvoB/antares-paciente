import { useEffect, useState } from "react";
import { getWellnessHomeData, subscribeProtocolHistory } from "../state/wellness-home-store";

export const GOAL_LABEL = { bajar: "Bajar de peso", masa: "Subir masa muscular", def: "Definir" } as const;

export function useWellnessOverview(name: string) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    const unsubscribe = subscribeProtocolHistory(update);
    const timer = window.setInterval(update, 60_000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, []);
  return getWellnessHomeData(name);
}
