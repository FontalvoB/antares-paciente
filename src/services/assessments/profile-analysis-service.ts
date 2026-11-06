import { apiFetch, ApiError } from '../../utils/apiClient';

export interface AssessmentProfileGuidance {
  summary: string;
  priorities: Array<{ title: string; explanation: string; action: string; evidenceCodes: string[] }>;
  encouragement: string;
  questions: string[];
  generatedAt: string;
  sourceRevision: string;
  isPartial?: boolean;
  sources?: Array<{
    evidenceCode: string;
    testCode: string;
    testName: string;
    code: string;
    label: string;
    resultType: 'score' | 'subscale' | 'indicator';
    value: number;
    qualifier: string | null;
    severity: string | null;
    completedAt: string | null;
  }>;
}
const route = '/api/v1/health-tests/me/profile-analysis';

/** La identidad y los resultados siempre se resuelven en el servidor. */
export async function getProfileGuidance(language: 'es' | 'en', signal?: AbortSignal): Promise<AssessmentProfileGuidance | null> {
  try { return await apiFetch<AssessmentProfileGuidance>(`${route}?language=${language}`, { signal }); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}
export function generateProfileGuidance(language: 'es' | 'en', signal?: AbortSignal) {
  return apiFetch<AssessmentProfileGuidance>(`${route}?language=${language}`, { method: 'POST', signal, timeoutMs: 90_000 });
}
