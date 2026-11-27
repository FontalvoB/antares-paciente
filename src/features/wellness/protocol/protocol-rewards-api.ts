import { apiFetch } from "../../../utils/apiClient";
import { motorPlanUserId } from "../calendar/motor-plan-api";
import type { ProtocolStepId } from "../state/wellness-home-store";

const BASE = "/api/v1/people/me/protocol-rewards";
export const PROTOCOL_REWARDS_UPDATED = "wellness-protocol-rewards-updated";

export interface ProtocolRewardDay {
  localDate: string;
  steps: Partial<Record<ProtocolStepId, number>>;
  bonus: number;
  closed: boolean;
}

export interface ProtocolRewards {
  today: ProtocolRewardDay;
  balance: number;
  legacyBalance: number;
  level: number;
  levelName: string;
  streak: number;
  longestStreak: number;
  history: ProtocolRewardDay[];
  receipt?: { step: ProtocolStepId; amount: number; created: boolean } | null;
}

export function getProtocolRewards(account: string, signal?: AbortSignal) {
  return apiFetch<ProtocolRewards>(BASE, { expectedUserId: account, signal, cache: "no-store" });
}

async function writeProtocolRewards(account: string, action: "steps" | "close", data: object) {
  const result = await apiFetch<ProtocolRewards>(`${BASE}/${action}`, {
    method: "POST", expectedUserId: account, body: data,
  });
  if (motorPlanUserId() !== account) throw new Error("Protocol account changed");
  window.dispatchEvent(new CustomEvent(PROTOCOL_REWARDS_UPDATED, { detail: { account, result } }));
  return result;
}

export function submitProtocolStep(account: string, localDate: string, step: ProtocolStepId) {
  return writeProtocolRewards(account, "steps", { localDate, step });
}

export function closeProtocolDay(account: string, localDate: string) {
  return writeProtocolRewards(account, "close", { localDate });
}
