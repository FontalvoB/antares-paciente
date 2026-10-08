import type { MeResult } from "./healthTestsApi";

/** Se conserva cada evaluación: nunca se mezclan intentos ni se normalizan puntos sin su escala. */
export function groupAssessmentResults(results: MeResult[]) {
  const groups = new Map<string, MeResult[]>();
  for (const result of results) {
    const key = result.evaluationId || result.id;
    // Compatibilidad con respuestas históricas/servidores anteriores: los
    // rangos del total no son válidos para las dimensiones individuales.
    const displayed = result.resultType === "subscale"
      ? { ...result, qualifier: null, severity: null }
      : result;
    groups.set(key, [...(groups.get(key) ?? []), displayed]);
  }
  return Array.from(groups, ([id, items]) => ({
    id,
    score: items.find(item => item.resultType === "score") ?? items[0],
    details: items.filter(item => item !== (items.find(score => score.resultType === "score") ?? items[0])),
  }));
}
