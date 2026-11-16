import { canShowChatAction } from "./chatNutritionVisibility";
import type { Screen } from "../types";

export type VitaDestination = "program" | "nutrition" | "assessments" | "podcast" | "exercise" | "progress";
export interface VitaAction {
  type: "navigate";
  destination: VitaDestination;
  resourceId?: string;
  localDate: string;
  resourceVersion: string;
}
export interface VitaEnvelope<T = unknown> {
  status: "ok" | "empty" | "unavailable" | "forbidden" | "stale";
  asOf: string;
  localDate: string | null;
  resourceVersion: string | null;
  data: T | null;
  actions: VitaAction[];
  sources: Array<{ capability: string; caseUse: string }>;
}

export const vitaDestinations: Record<VitaDestination, { screen?: Screen; label: string }> = {
  program: { screen: "prog", label: "Mi programa" },
  nutrition: { screen: "nut", label: "Nutrición" },
  assessments: { label: "Evaluaciones" },
  podcast: { screen: "program-podcast", label: "Podcast" },
  exercise: { screen: "program-ejercicio", label: "Ejercicios" },
  progress: { screen: "hc", label: "Progreso" },
};

/** BACK v1: solo navegación; nunca URLs, escrituras o herramientas de citas. */
export function normalizeVitaActions(raw: unknown): VitaAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object" || item.type !== "navigate"
      || !Object.hasOwn(vitaDestinations, item.destination)
      || typeof item.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.localDate)
      || typeof item.resourceVersion !== "string" || !item.resourceVersion.trim()
      || !canShowChatAction(item.destination, vitaDestinations[item.destination as VitaDestination].label)) return [];
    return [{ type: "navigate" as const, destination: item.destination as VitaDestination,
      localDate: item.localDate, resourceVersion: item.resourceVersion,
      ...(typeof item.resourceId === "string" ? { resourceId: item.resourceId } : {}) }];
  });
}
