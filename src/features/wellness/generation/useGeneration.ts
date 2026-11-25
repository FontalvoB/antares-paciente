import { useEffect, useState } from "react";
import {
  GENERATION_ARTIFACTS,
  getGenerationState,
  retryGeneration,
} from "./generation-store";

export function useGeneration() {
  const [job, setJob] = useState(() => getGenerationState());
  const isRunning = Boolean(
    job && GENERATION_ARTIFACTS.some((id) => job.artifacts[id].status === "running"),
  );

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => setJob(getGenerationState()), 400);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  return { job, isRunning, retry: () => setJob(retryGeneration()) };
}
