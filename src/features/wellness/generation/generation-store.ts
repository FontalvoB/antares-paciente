import type { WellnessPlanSnapshotInput } from "../state/wellness-home-store";

export const GENERATION_ARTIFACTS = ["exercise", "nutrition", "inbox"] as const;
export type GenerationArtifact = (typeof GENERATION_ARTIFACTS)[number];
export type ArtifactStatus = "pending" | "running" | "ready" | "failed";

interface ArtifactState {
  status: ArtifactStatus;
  progress: number;
  startedAt: number;
}

export interface GenerationInboxItem {
  id: "welcome" | "exercise" | "nutrition" | "questionnaires";
  createdAt: string;
}

export interface GenerationJob {
  key: string;
  startedAt: number;
  attempts: number;
  artifacts: Record<GenerationArtifact, ArtifactState>;
  inbox: GenerationInboxItem[];
  failOnCompletion: GenerationArtifact | null;
}

type SnapshotIdentity = Pick<
  WellnessPlanSnapshotInput,
  "startDate" | "goal" | "createdAt"
>;

const STORAGE_KEY = "wellness.generation.v1";
const DURATION: Record<GenerationArtifact, number> = {
  exercise: 900,
  nutrition: 1300,
  inbox: 700,
};

let nextFailure: GenerationArtifact | null = null;
// Permite mostrar el fallo y reintentar incluso si el dispositivo bloquea la escritura.
let unsavedJob: GenerationJob | null = null;

export function resetWellnessGeneration(): void {
  unsavedJob = null;
  nextFailure = null;
}

function readJob(): GenerationJob | null {
  if (unsavedJob) return unsavedJob;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const job = raw ? (JSON.parse(raw) as GenerationJob | null) : null;
    return job?.artifacts && Array.isArray(job.inbox) ? job : null;
  } catch {
    return null;
  }
}

function writeJob(job: GenerationJob): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  unsavedJob = null;
}

function persistOrKeep(job: GenerationJob): void {
  try {
    writeJob(job);
  } catch {
    unsavedJob = job;
  }
}

function createJob(
  snapshot: SnapshotIdentity,
  now: number,
  status: "running" | "failed",
  failOnCompletion: GenerationArtifact | null,
): GenerationJob {
  const artifact = { status, progress: 0, startedAt: now };
  return {
    key: [snapshot.startDate, snapshot.goal, snapshot.createdAt].join("|"),
    startedAt: now,
    attempts: 1,
    artifacts: { exercise: artifact, nutrition: artifact, inbox: artifact },
    inbox: [],
    failOnCompletion,
  };
}

export function setNextFailure(artifact: GenerationArtifact): void {
  nextFailure = artifact;
}

export function requestGeneration(
  snapshot: SnapshotIdentity,
  now = Date.now(),
): GenerationJob {
  const job = createJob(snapshot, now, "running", nextFailure);
  const current = readJob();
  if (current?.key === job.key) return current;
  writeJob(job);
  nextFailure = null;
  return job;
}

export function recordGenerationFailure(
  snapshot: SnapshotIdentity,
  now = Date.now(),
): void {
  const job = createJob(snapshot, now, "failed", null);
  if (readJob()?.key !== job.key) persistOrKeep(job);
}

function materializeInbox(
  artifacts: GenerationJob["artifacts"],
): GenerationInboxItem[] {
  if (artifacts.inbox.status !== "ready") return [];

  const inboxReadyAt = artifacts.inbox.startedAt + DURATION.inbox;
  const createdAt = new Date(inboxReadyAt).toISOString();
  const items: GenerationInboxItem[] = [{ id: "welcome", createdAt }];
  for (const id of ["exercise", "nutrition"] as const) {
    if (artifacts[id].status === "ready") {
      const readyAt = artifacts[id].startedAt + DURATION[id];
      items.push({
        id,
        createdAt: new Date(Math.max(inboxReadyAt, readyAt)).toISOString(),
      });
    }
  }
  items.push({ id: "questionnaires", createdAt });
  return items;
}

export function getGenerationState(now = Date.now()): GenerationJob | null {
  const current = readJob();
  if (!current) return null;

  const artifacts = { ...current.artifacts };
  let changed = false;
  for (const id of GENERATION_ARTIFACTS) {
    const artifact = artifacts[id];
    if (artifact.status !== "running") continue;

    const elapsed = now - artifact.startedAt;
    const progress = Math.max(
      artifact.progress,
      Math.floor((elapsed / DURATION[id]) * 100),
    );
    if (elapsed >= DURATION[id]) {
      artifacts[id] =
        current.failOnCompletion === id
          ? { ...artifact, status: "failed", progress: 0 }
          : { ...artifact, status: "ready", progress: 100 };
    } else if (progress !== artifact.progress) {
      artifacts[id] = { ...artifact, progress };
    } else {
      continue;
    }
    changed = true;
  }
  if (!changed) return current;

  const job = { ...current, artifacts, inbox: materializeInbox(artifacts) };
  persistOrKeep(job);
  return job;
}

export function retryGeneration(now = Date.now()): GenerationJob | null {
  const current = getGenerationState(now);
  if (
    !current ||
    GENERATION_ARTIFACTS.some((id) => current.artifacts[id].status === "running")
  ) {
    return current;
  }

  const failed = GENERATION_ARTIFACTS.filter(
    (id) => current.artifacts[id].status === "failed",
  );
  if (failed.length === 0) return current;

  const artifacts = { ...current.artifacts };
  for (const id of failed) {
    artifacts[id] = { status: "running", progress: 0, startedAt: now };
  }
  const job = {
    ...current,
    artifacts,
    attempts: current.attempts + 1,
    failOnCompletion: null,
  };
  persistOrKeep(job);
  return job;
}
