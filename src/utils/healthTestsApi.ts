import { apiFetch } from "./apiClient";

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
  testCode: string | null;
  testCategory: string | null;
  batteryAssignmentId: string | null;
  status: "pending" | "in_progress" | "completed" | "expired" | "cancelled";
  priority: number | null;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  dueDate: string | null;
  notes: string | null;
  /** Metadatos del catálogo inicial; ausentes en servidores anteriores. */
  isRequired?: boolean | null;
  batteryRequiredCount?: number | null;
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
  type: "scale" | "single" | "multi" | "open" | "num";
  scoringDirection: "positive" | "reverse";
  sortOrder: number;
  isActive: boolean;
  options: MeAnswerOption[];
  /** Unidad del valor numérico (tipo num, p. ej. kg/cm). */
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  defaultValue: number | null;
  /** Etiquetas de los extremos de la escala Likert. */
  minLabel: string | null;
  maxLabel: string | null;
  /** Instrucción/ayuda bajo el texto de la pregunta. */
  hint: string | null;
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

function getJson<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body });
}

/** Mis tests asignados: pendientes, en curso y completados. */
export async function fetchMyAssignments(): Promise<MeAssignment[]> {
  return getJson<MeAssignment[]>("/api/v1/health-tests/me/assignments?scope=initial");
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
