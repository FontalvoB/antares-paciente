import { ApiError, apiFetch } from "../../../utils/apiClient";
import type { ObjectiveDraft } from "../domain";

const base = "/api/v1/wellness/journey";
export type JourneyStatus = "pending" | "running" | "ready" | "failed";

export interface JourneyPlan {
  status: JourneyStatus;
  result?: { version: string; title: string; items: string[] } | null;
}

export interface JourneyGeneration {
  submissionId: string;
  generationId: string;
  status: JourneyStatus;
  attempts: number;
  exercise: JourneyPlan;
  nutrition: JourneyPlan;
  inbox: {
    status: JourneyStatus;
    items: { id: string; title: string; body: string; createdAt: string }[];
  };
}

export async function latestJourneyGeneration(userId: string, lang: string, signal: AbortSignal) {
  try {
    return await apiFetch<JourneyGeneration>(`${base}/latest`, { headers: { "Accept-Language": lang, "X-App-Language": lang }, expectedUserId: userId, signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === "no_generation") return null;
    throw error;
  }
}

export function submitJourneyGoal(userId: string, lang: string, submissionId: string, draft: ObjectiveDraft) {
  return apiFetch<JourneyGeneration>(`${base}/submissions`, {
    headers: { "Accept-Language": lang, "X-App-Language": lang }, expectedUserId: userId,
    body: { submissionId, draft },
  });
}

export function retryJourneyGeneration(userId: string, lang: string, generation: JourneyGeneration) {
  return apiFetch<JourneyGeneration>(`${base}/generation/${generation.generationId}/retry`, {
    headers: { "Accept-Language": lang, "X-App-Language": lang }, expectedUserId: userId,
    body: { expectedAttempts: generation.attempts },
  });
}
