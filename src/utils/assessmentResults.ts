import type { MeResult } from "./healthTestsApi";

/** Se conserva cada evaluación: nunca se mezclan intentos ni se normalizan puntos sin su escala. */
export function groupAssessmentResults(results: MeResult[]) {
  const groups = new Map<string, MeResult[]>();
  for (const result of results) {
    const key = result.evaluationId || result.id;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  return Array.from(groups, ([id, items]) => ({
    id,
    score: items.find(item => item.resultType === "score") ?? items[0],
    details: items.filter(item => item !== (items.find(score => score.resultType === "score") ?? items[0])),
  }));
}
