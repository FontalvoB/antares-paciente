import { useEffect, useState } from "react";
import {
  GENERATION_ARTIFACTS,
  getGenerationState,
  retryGeneration,
} from "./generation-store";

export function useGeneration(enabled = true) {
  const [job, setJob] = useState(() => enabled ? getGenerationState() : null);
  const isRunning = Boolean(
    enabled && job && GENERATION_ARTIFACTS.some((id) => job.artifacts[id].status === "running"),
  );

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => setJob(getGenerationState()), 400);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  return { job, isRunning, retry: () => setJob(retryGeneration()) };
}
