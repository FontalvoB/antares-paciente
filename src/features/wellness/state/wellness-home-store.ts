/**
 * Estado local del plan de bienestar (KAN-142).
 *
 * Hasta que exista el contrato `/v1` (KAN-130), el Home calcula su día,
 * adherencia, puntos, racha y nivel desde:
 * - el resumen que guarda el onboarding al generar el plan,
 * - el historial de pasos del protocolo (KAN-143),
 * - las baterías completadas (personalización progresiva).
 *
 * Todo vive en localStorage y es determinista para poder probarlo. Cuando
 * llegue el backend, este módulo pasa a ser un adaptador de lectura.
 */

import type {
  WellnessActivity,
  WellnessGoal,
  WellnessPace,
  WellnessSex,
} from "../domain/types";

export type ProtocolStepId =
  "exercise" | "diet" | "vitals" | "emotional" | "chest";

/**
 * Datos del objetivo con los que se generó el plan (KAN-144). Permiten
 * precargar el formulario al cambiar de objetivo desde Perfil. Las respuestas
 * de seguridad (PAR-Q/NQS) y los términos NO se guardan: se vuelven a pedir.
 */
export interface WellnessPlanObjective {
  sex: WellnessSex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  waistCm: number | null;
  targetWeightKg: number | null;
  activity: WellnessActivity | null;
  pace: WellnessPace;
  vegetarian: boolean;
  dairyFree: boolean;
}

/** Resumen del plan vigente (normalizado: siempre trae versión y objetivo). */
export interface WellnessPlanSnapshot extends WellnessPlanObjective {
  name: string;
  goal: WellnessGoal;
  /** Fecha local ISO (yyyy-mm-dd) del día 1. No cambia al cambiar objetivo. */
  startDate: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  totalDays: number;
  createdAt: string;
  /** Versión del plan (1 = onboarding). El ERP la leerá del snapshot. */
  version: number;
}

/**
 * Entrada de `savePlanSnapshot`: los campos de objetivo y la versión son
 * opcionales para aceptar el formato previo a KAN-144.
 */
export type WellnessPlanSnapshotInput = Omit<
  WellnessPlanSnapshot,
  keyof WellnessPlanObjective | "version"
> &
  Partial<WellnessPlanObjective> & { version?: number };

/** Versión archivada del plan (historial de cambios de objetivo). */
export interface WellnessPlanVersion {
  version: number;
  /** Momento en que esta versión dejó de ser la vigente. */
  changedAt: string;
  snapshot: WellnessPlanSnapshot;
}

export interface WellnessProtocolHistory {
  /** Fecha local ISO → pasos completados ese día. */
  [date: string]: ProtocolStepId[];
}

export interface WellnessProtocolStep {
  id: ProtocolStepId;
  label: string;
  done: boolean;
}

export interface WellnessHomeData {
  plan: WellnessPlanSnapshot;
  /** `true` cuando no hay plan guardado y se usa el ejemplo. */
  isDemo: boolean;
  day: number;
  totalDays: number;
  planCompleted: boolean;
  adherencePct: number;
  points: number;
  streakDays: number;
  level: number;
  protocol: WellnessProtocolStep[];
  protocolDone: number;
  batteriesCompleted: number;
  batteriesTotal: number;
}

export const PROTOCOL_STEPS: readonly { id: ProtocolStepId; label: string }[] =
  [
    { id: "exercise", label: "Ejercicio" },
    { id: "diet", label: "Dieta" },
    { id: "vitals", label: "Vitales" },
    { id: "emotional", label: "Emocional" },
    { id: "chest", label: "Cofre" },
  ] as const;

export const TOTAL_PLAN_DAYS = 365;
export const TOTAL_BATTERIES = 7;
const STREAK_MIN_DONE = PROTOCOL_STEPS.length;
const ADHERENCE_WINDOW_DAYS = 7;
const POINTS_PER_STEP = 10;
const POINTS_DAY_COMPLETE = 20;
const POINTS_PER_LEVEL = 500;

const PLAN_KEY = "wellness.plan.v1";
const PLAN_VERSIONS_KEY = "wellness.plan.versions.v1";
const PROTOCOL_KEY = "wellness.protocol.v1";
const BATTERIES_KEY = "wellness.batteries.v1";
let unsavedPlan: WellnessPlanSnapshot | null = null;

// ---------- almacenamiento ----------

function read<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const EMPTY_OBJECTIVE: WellnessPlanObjective = {
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  waistCm: null,
  targetWeightKg: null,
  activity: null,
  pace: "m",
  vegetarian: false,
  dairyFree: false,
};

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Normaliza un snapshot leído o recibido: rellena con valores por defecto los
 * campos que no existían antes de KAN-144 para no romper KAN-142/143.
 */
export function normalizePlanSnapshot(
  stored: Partial<WellnessPlanSnapshot> | null | undefined,
): WellnessPlanSnapshot | null {
  if (!stored || typeof stored.startDate !== "string") return null;
  const activity = finiteOrNull(stored.activity);
  const version = finiteOrNull(stored.version);
  return {
    name: stored.name ?? "",
    goal: stored.goal ?? "bajar",
    startDate: stored.startDate,
    kcal: finiteOrNull(stored.kcal) ?? 0,
    proteinG: finiteOrNull(stored.proteinG) ?? 0,
    carbsG: finiteOrNull(stored.carbsG) ?? 0,
    fatG: finiteOrNull(stored.fatG) ?? 0,
    waterMl: finiteOrNull(stored.waterMl) ?? 0,
    totalDays: TOTAL_PLAN_DAYS,
    createdAt: stored.createdAt ?? "",
    version: version && version >= 1 ? Math.round(version) : 1,
    sex: stored.sex === "F" || stored.sex === "M" ? stored.sex : null,
    age: finiteOrNull(stored.age),
    heightCm: finiteOrNull(stored.heightCm),
    weightKg: finiteOrNull(stored.weightKg),
    waistCm: finiteOrNull(stored.waistCm),
    targetWeightKg: finiteOrNull(stored.targetWeightKg),
    activity:
      activity !== null && [1, 2, 3, 4].includes(activity)
        ? (activity as WellnessActivity)
        : null,
    pace:
      stored.pace === "s" || stored.pace === "m" || stored.pace === "max"
        ? stored.pace
        : EMPTY_OBJECTIVE.pace,
    vegetarian: Boolean(stored.vegetarian),
    dairyFree: Boolean(stored.dairyFree),
  };
}

/**
 * Guarda el plan vigente. Si ya había uno, lo archiva en el historial de
 * versiones y la nueva versión es la anterior + 1. No toca protocolo ni
 * baterías: puntos, racha y registros se conservan.
 */
export function savePlanSnapshot(
  input: WellnessPlanSnapshotInput,
  now = new Date(),
): WellnessPlanSnapshot {
  const previous = loadPlanSnapshot();
  if (previous) {
    write(PLAN_VERSIONS_KEY, [
      ...loadPlanVersions(),
      {
        version: previous.version,
        changedAt: now.toISOString(),
        snapshot: previous,
      } satisfies WellnessPlanVersion,
    ]);
  }
  const snapshot = normalizePlanSnapshot({
    ...EMPTY_OBJECTIVE,
    ...input,
    version: input.version ?? (previous ? previous.version + 1 : 1),
  }) as WellnessPlanSnapshot;
  unsavedPlan = write(PLAN_KEY, snapshot) ? null : snapshot;
  return snapshot;
}

export function loadPlanSnapshot(): WellnessPlanSnapshot | null {
  return (
    unsavedPlan ??
    normalizePlanSnapshot(read<Partial<WellnessPlanSnapshot> | null>(PLAN_KEY, null))
  );
}

/** Versiones anteriores del plan, de la más antigua a la más reciente. */
export function loadPlanVersions(): WellnessPlanVersion[] {
  const stored = read<unknown>(PLAN_VERSIONS_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((entry: Partial<WellnessPlanVersion> | null) => {
    const snapshot = normalizePlanSnapshot(entry?.snapshot);
    if (!entry || !snapshot) return [];
    return [
      {
        version: finiteOrNull(entry.version) ?? snapshot.version,
        changedAt: typeof entry.changedAt === "string" ? entry.changedAt : "",
        snapshot,
      },
    ];
  });
}

export function clearWellnessState(): void {
  unsavedPlan = null;
  for (const key of [PLAN_KEY, PLAN_VERSIONS_KEY, PROTOCOL_KEY, BATTERIES_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
}

export function loadProtocolHistory(): WellnessProtocolHistory {
  return read<WellnessProtocolHistory>(PROTOCOL_KEY, {});
}

export function saveProtocolHistory(history: WellnessProtocolHistory): void {
  write(PROTOCOL_KEY, history);
}

export function loadBatteriesCompleted(): number {
  const value = read<number>(BATTERIES_KEY, 0);
  return Number.isFinite(value)
    ? Math.min(TOTAL_BATTERIES, Math.max(0, Math.round(value)))
    : 0;
}

export function saveBatteriesCompleted(value: number): void {
  write(
    BATTERIES_KEY,
    Math.min(TOTAL_BATTERIES, Math.max(0, Math.round(value))),
  );
}

// ---------- fechas ----------

/** ISO local (yyyy-mm-dd) sin depender de UTC. */
export function localISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return localISODate(date) === iso ? date : null;
}

/** Día del plan, acotado a 1..365. */
export function planDay(startDate: string, today = new Date()): number {
  const start = parseLocalDate(startDate);
  if (!start) return 1;
  const diff = Math.round(
    (startOfDay(today).getTime() - start.getTime()) / 86_400_000,
  );
  return Math.min(TOTAL_PLAN_DAYS, Math.max(1, diff + 1));
}

function previousDays(today: Date, count: number): Date[] {
  const base = startOfDay(today);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - index);
    return date;
  });
}

// ---------- métricas ----------

export function pointsForDay(done: number): number {
  if (done <= 0) return 0;
  return (
    done * POINTS_PER_STEP + (done >= STREAK_MIN_DONE ? POINTS_DAY_COMPLETE : 0)
  );
}

export function adherencePct(
  history: WellnessProtocolHistory,
  today = new Date(),
): number {
  const max = PROTOCOL_STEPS.length * ADHERENCE_WINDOW_DAYS;
  const done = previousDays(today, ADHERENCE_WINDOW_DAYS).reduce(
    (total, date) => total + (history[localISODate(date)]?.length ?? 0),
    0,
  );
  return Math.round((done / max) * 100);
}

export function streakDays(
  history: WellnessProtocolHistory,
  today = new Date(),
): number {
  const doneToday =
    (history[localISODate(today)]?.length ?? 0) >= STREAK_MIN_DONE;
  // Si hoy aún no cierra, la racha se mide desde ayer (no se pierde a media tarde).
  const days = previousDays(today, TOTAL_PLAN_DAYS).slice(doneToday ? 0 : 1);
  let streak = 0;
  for (const date of days) {
    if ((history[localISODate(date)]?.length ?? 0) >= STREAK_MIN_DONE)
      streak += 1;
    else break;
  }
  return streak;
}

export function totalPoints(history: WellnessProtocolHistory): number {
  return Object.values(history).reduce(
    (total, steps) => total + pointsForDay(steps?.length ?? 0),
    0,
  );
}

export function levelForPoints(points: number): number {
  return Math.min(5, 1 + Math.floor(Math.max(0, points) / POINTS_PER_LEVEL));
}

// ---------- lectura para el Home ----------

function demoSplan(name: string, today: Date): WellnessPlanSnapshot {
  return {
    name,
    goal: "bajar",
    startDate: localISODate(today),
    kcal: 1800,
    proteinG: 110,
    carbsG: 210,
    fatG: 50,
    waterMl: 2500,
    totalDays: TOTAL_PLAN_DAYS,
    createdAt: new Date().toISOString(),
    version: 1,
    ...EMPTY_OBJECTIVE,
  };
}

/**
 * Datos completos del Home. Si no hay plan guardado se usa un plan de ejemplo
 * (`isDemo`) para que la pantalla nunca quede vacía en una cuenta sin onboarding.
 */
export function getWellnessHomeData(
  fallbackName = "",
  today = new Date(),
  history = loadProtocolHistory(),
): WellnessHomeData {
  const stored = loadPlanSnapshot();
  const plan = stored ?? demoSplan(fallbackName, today);
  const day = planDay(plan.startDate, today);
  const doneIds = new Set(history[localISODate(today)] ?? []);
  const protocol = PROTOCOL_STEPS.map((step) => ({
    ...step,
    done: doneIds.has(step.id),
  }));
  const points = totalPoints(history);

  return {
    plan,
    isDemo: !stored,
    day,
    totalDays: TOTAL_PLAN_DAYS,
    planCompleted: day >= TOTAL_PLAN_DAYS,
    adherencePct: adherencePct(history, today),
    points,
    streakDays: streakDays(history, today),
    level: levelForPoints(points),
    protocol,
    protocolDone: protocol.filter((step) => step.done).length,
    batteriesCompleted: loadBatteriesCompleted(),
    batteriesTotal: TOTAL_BATTERIES,
  };
}

/** Marca/desmarca un paso del día (lo usará KAN-143). */
export function toggleProtocolStep(
  id: ProtocolStepId,
  done: boolean,
  today = new Date(),
): WellnessProtocolHistory {
  const history = loadProtocolHistory();
  const date = localISODate(today);
  const current = new Set(history[date] ?? []);
  if (done) current.add(id);
  else current.delete(id);
  history[date] = [...current];
  saveProtocolHistory(history);
  return history;
}

// ---------- protocolo diario (KAN-143) ----------

const CHEST_ID: ProtocolStepId = "chest";
const CHEST_REQUIRED: ProtocolStepId[] = [
  "exercise",
  "diet",
  "vitals",
  "emotional",
];

/** `true` cuando los pasos 1–4 están completos y el cofre puede abrirse. */
export function isChestUnlocked(
  history: WellnessProtocolHistory,
  today = new Date(),
): boolean {
  const done = new Set(history[localISODate(today)] ?? []);
  return CHEST_REQUIRED.every((id) => done.has(id));
}

/** Pasos que faltan para abrir el cofre, en el orden del protocolo. */
export function missingForChest(
  history: WellnessProtocolHistory,
  today = new Date(),
): ProtocolStepId[] {
  const done = new Set(history[localISODate(today)] ?? []);
  return CHEST_REQUIRED.filter((id) => !done.has(id));
}

export interface CompleteStepResult {
  history: WellnessProtocolHistory;
  /** `false` si ya estaba hecho o el cofre estaba bloqueado. */
  completed: boolean;
  /** Puntos instantáneos ganados (sin bonus de secuencia). */
  pointsEarned: number;
  /** `true` si este paso cerró los 5 del día. */
  dayComplete: boolean;
  /** `true` si el cofre está desbloqueado después de la operación. */
  chestUnlocked: boolean;
}

/**
 * Completa un paso una sola vez al día. El cofre exige los pasos 1–4.
 * No reinicia ni arrastra pasos: todo se guarda por fecha local.
 */
export function completeProtocolStep(
  id: ProtocolStepId,
  today = new Date(),
): CompleteStepResult {
  const history = loadProtocolHistory();
  const date = localISODate(today);
  const current = new Set(history[date] ?? []);
  const alreadyDone = current.has(id);
  const locked = id === CHEST_ID && !isChestUnlocked(history, today);

  if (alreadyDone || locked) {
    return {
      history,
      completed: false,
      pointsEarned: 0,
      dayComplete: current.size >= PROTOCOL_STEPS.length,
      chestUnlocked: isChestUnlocked(history, today),
    };
  }

  current.add(id);
  history[date] = [...current];
  saveProtocolHistory(history);

  return {
    history,
    completed: true,
    pointsEarned: POINTS_PER_STEP,
    dayComplete: current.size >= PROTOCOL_STEPS.length,
    chestUnlocked: isChestUnlocked(history, today),
  };
}

/** ¿Se puede completar este paso hoy? El cofre depende de los pasos 1–4. */
export function canCompleteStep(
  id: ProtocolStepId,
  today = new Date(),
): boolean {
  if (id !== CHEST_ID) return true;
  return isChestUnlocked(loadProtocolHistory(), today);
}
