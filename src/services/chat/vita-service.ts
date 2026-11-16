import { apiFetch } from "../../utils/apiClient";
import { requireLegalConsent } from "../../utils/legalConsents";
import type { VitaAction, VitaEnvelope } from "../../utils/vitaActions";

export interface VitaTaskProposal {
  proposalToken: string;
  taskCode: "podcast" | "ejercicio";
  localDate: string;
  resourceVersion: string;
  expiresAt: string;
  requiresConfirmation: boolean;
}
export interface VitaRequestContext { owner: string | null; language: "es" | "en"; signal: AbortSignal }
const scopeFor = (action: VitaAction) => ({ program: "day", nutrition: "nutrition", assessments: "assessments", podcast: "podcast", exercise: "exercise", progress: "progress" })[action.destination];

export async function readVitaContext(action: VitaAction, context: VitaRequestContext, currentVersion = true) {
  await requireLegalConsent("chat", context.language, context.signal);
  const query = new URLSearchParams({ scope: scopeFor(action) });
  if (currentVersion) query.set("resourceVersion", action.resourceVersion);
  return apiFetch<VitaEnvelope>(`/api/v1/vita/me/context?${query}`, { signal: context.signal, expectedUserId: context.owner, cache: "no-store" });
}

export async function prepareVitaCompletion(action: VitaAction, context: VitaRequestContext) {
  if (action.destination !== "podcast" && action.destination !== "exercise") throw new Error("VITA_TASK_NOT_ALLOWED");
  await requireLegalConsent("chat", context.language, context.signal);
  const taskCode = action.destination === "podcast" ? "podcast" : "ejercicio";
  const result = await apiFetch<VitaTaskProposal>("/api/v1/vita/me/task-completion-proposals", {
    method: "POST", expectedUserId: context.owner, signal: context.signal,
    body: { taskCode, localDate: action.localDate, resourceVersion: action.resourceVersion },
  });
  if (!result?.proposalToken || result.taskCode !== taskCode || result.localDate !== action.localDate
    || result.resourceVersion !== action.resourceVersion || result.requiresConfirmation !== true
    || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) throw new Error("VITA_STALE");
  return result;
}

export async function confirmVitaCompletion(proposal: VitaTaskProposal, context: VitaRequestContext) {
  if (Date.parse(proposal.expiresAt) <= Date.now()) throw new Error("VITA_STALE");
  await requireLegalConsent("chat", context.language, context.signal);
  return apiFetch<{ taskCompletionId: string }>("/api/v1/vita/me/task-completion-confirmations", {
    method: "POST", expectedUserId: context.owner, signal: context.signal,
    body: { proposalToken: proposal.proposalToken, confirmed: true },
  });
}
