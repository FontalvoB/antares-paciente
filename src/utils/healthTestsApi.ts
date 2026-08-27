import { getAccessToken } from "./authApi";
import { getApiBaseUrl } from "./apiBaseUrl";

/**
 * Cliente del módulo Tests de Salud (backend .NET, gateway YARP).
 * API del paciente: /api/v1/health-tests/me/* — el paciente se resuelve
 * desde el JWT (aud "app"), nunca desde el payload.
 */

/** Test asignado al paciente (shape TestMeta de la UX mobile). */
export interface MeAssignment {
  id: string;
  patientId: string;
  patientName: string | null;
  versionId: string;
  testName: string | null;
  batteryAssignmentId: string | null;
  status: "pending" | "in_progress" | "completed" | "expired" | "cancelled";
  priority: number | null;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  dueDate: string | null;
  notes: string | null;
}

/** Batería asignada al paciente. */
export interface MeBattery {
  id: string;
  patientId: string;
  batteryId: string;
  batteryName: string | null;
  status: string;
  assignedAt: string;
  dueDate: string | null;
  completedAt: string | null;
}

/** Opción de respuesta de una pregunta. */
export interface MeAnswerOption {
  id: string;
  questionId: string;
  text: string;
  scoreValue: number | null;
  sortOrder: number;
  isActive: boolean;
}

/** Pregunta de la versión de un test (shape ScaleQ de la UX mobile). */
export interface MeQuestion {
  id: string;
  versionId: string;
  code: string;
  section: string | null;
  text: string;
  type: "scale" | "single" | "multi" | "open";
  scoringDirection: "positive" | "reverse";
  sortOrder: number;
  isActive: boolean;
  options: MeAnswerOption[];
}

/** Versión detallada de un test asignado. */
export interface MeTestDetail {
  id: string;
  instrumentId: string;
  versionNumber: number;
  name: string | null;
  status: string;
  isCurrent: boolean;
  scoringStrategy: string;
  points: number | null;
  questions: MeQuestion[];
  ranges: {
    id: string;
    versionId: string;
    minValue: number;
    maxValue: number;
    label: string;
    severity: string;
    isActive: boolean;
  }[];
}

/** Resultado de una evaluación. */
export interface MeResult {
  id: string;
  evaluationId: string;
  resultType: "score" | "subscale" | "indicator";
  code: string;
  label: string;
  value: number;
  qualifier: string | null;
  severity: string | null;
}

/** Evaluación (historial/evolución). */
export interface MeEvaluation {
  id: string;
  assignmentId: string;
  patientId: string;
  versionId: string;
  testName: string | null;
  status: "started" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  scorePercentage: number | null;
  results: MeResult[];
}

/** Respuesta enviada al submit. */
export interface MeSubmitAnswer {
  questionId: string;
  answerOptionId?: string | null;
  valueText?: string | null;
}

async function getJson<T>(path: string): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`HealthTests API error ${res.status} en ${path}`);
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : undefined),
      ...(body ? { "Content-Type": "application/json" } : undefined),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`HealthTests API error ${res.status} en ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Mis tests pendientes/en curso. */
export async function fetchMyAssignments(): Promise<MeAssignment[]> {
  return getJson<MeAssignment[]>("/api/v1/health-tests/me/assignments");
}

/** Mis baterías asignadas. */
export async function fetchMyBatteries(): Promise<MeBattery[]> {
  return getJson<MeBattery[]>("/api/v1/health-tests/me/batteries");
}

/** Preguntas de la versión de una asignación. */
export async function fetchMyTest(assignmentId: string): Promise<MeTestDetail> {
  return getJson<MeTestDetail>(`/api/v1/health-tests/me/tests/${assignmentId}`);
}

/** Inicia la evaluación de una asignación. */
export async function startMyTest(assignmentId: string): Promise<MeEvaluation> {
  return postJson<MeEvaluation>(
    `/api/v1/health-tests/me/tests/${assignmentId}/start`,
  );
}

/** Envía las respuestas y completa la evaluación (scoring + indicadores + alertas). */
export async function submitMyTest(
  assignmentId: string,
  answers: MeSubmitAnswer[],
): Promise<MeEvaluation> {
  return postJson<MeEvaluation>(
    `/api/v1/health-tests/me/tests/${assignmentId}/submit`,
    {
      answers,
    },
  );
}

/** Mis resultados (scores por dimensión + tipificación). */
export async function fetchMyResults(): Promise<MeResult[]> {
  return getJson<MeResult[]>("/api/v1/health-tests/me/results");
}

/** Mi historial de evaluaciones. */
export async function fetchMyHistory(): Promise<MeEvaluation[]> {
  return getJson<MeEvaluation[]>("/api/v1/health-tests/me/history");
}
