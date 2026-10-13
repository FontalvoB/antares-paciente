import { useSyncExternalStore } from "react";
import { useApp } from "../context/AppContext";
import {
  getAchievements,
  subscribeAchievements,
} from "../services/achievements/achievement-store";
export function useAchievements() {
  const { user } = useApp();
  const owner = user?.id ?? "";
  const items = useSyncExternalStore(subscribeAchievements, () =>
    getAchievements(owner),
  );
  return { owner, items };
}
