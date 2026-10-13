import type { ProgramSnapshotDto } from "../program/types";

export interface EarnedAchievement {
  id: string;
  kind: "streak" | "task" | "day";
  value: number;
  earnedAt: string;
  readAt: string | null;
}
interface Ledger {
  enrollment: string;
  streak?: number;
  items: EarnedAchievement[];
}
const cache = new Map<string, Ledger>();
const listeners = new Set<() => void>();
const prefix = "copp:achievements:v1:";
const empty: EarnedAchievement[] = [];
export const subscribeAchievements = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function ledger(owner: string): Ledger | null {
  if (!owner) return null;
  if (cache.has(owner)) return cache.get(owner)!;
  try {
    const value = JSON.parse(
      localStorage.getItem(prefix + owner) || "null",
    ) as Ledger | null;
    if (
      value &&
      typeof value.enrollment === "string" &&
      Array.isArray(value.items)
    ) {
      value.items = value.items.filter(
        (a) =>
          a &&
          typeof a.id === "string" &&
          ["streak", "task", "day"].includes(a.kind) &&
          Number.isFinite(a.value) &&
          typeof a.earnedAt === "string",
      );
      cache.set(owner, value);
      return value;
    }
  } catch {
    /* Almacenamiento deshabilitado: conservar la sesión en memoria. */
  }
  return null;
}
function save(owner: string, value: Ledger) {
  cache.set(owner, value);
  try {
    localStorage.setItem(prefix + owner, JSON.stringify(value));
  } catch {
    /* Sin espacio: sigue funcionando en esta sesión. */
  }
  listeners.forEach((l) => l());
}
export function getAchievements(owner: string): EarnedAchievement[] {
  return ledger(owner)?.items ?? empty;
}
export function markAchievementRead(owner: string, id?: string) {
  const current = ledger(owner);
  if (!current) return;
  save(owner, {
    ...current,
    items: current.items.map((a) =>
      !id || a.id === id
        ? { ...a, readAt: a.readAt ?? new Date().toISOString() }
        : a,
    ),
  });
}
/** Solo snapshots obtenidos de la red. Nunca llamar con optimismo o fallback. */
export function observeAchievements(
  owner: string,
  snapshot: ProgramSnapshotDto,
  now = new Date().toISOString(),
): EarnedAchievement[] {
  if (
    !owner ||
    !snapshot.enrollmentId ||
    snapshot.enrollmentId.startsWith("mock")
  )
    return [];
  const previous = ledger(owner);
  const baseline = !previous || previous.enrollment !== snapshot.enrollmentId;
  const items = baseline ? [] : previous.items;
  const seen = new Set(items.map((a) => a.id));
  const candidates: EarnedAchievement[] = [];
  const add = (
    id: string,
    kind: EarnedAchievement["kind"],
    value: number,
    earnedAt: string,
  ) => {
    if (!seen.has(id))
      candidates.push({
        id,
        kind,
        value,
        earnedAt,
        readAt: baseline ? now : null,
      });
  };
  for (const chest of snapshot.streakChests ?? []) {
    if (chest.granted && chest.days > 0)
      add(
        `chest:${snapshot.enrollmentId}:${chest.days}`,
        "streak",
        chest.days,
        chest.grantedAt || now,
      );
  }
  const streak = snapshot.streak?.current ?? 0;
  const newStreak =
    streak > 0 &&
    (baseline || (previous?.streak !== undefined && streak > previous.streak));
  if (
    newStreak &&
    !(snapshot.streakChests ?? []).some((c) => c.granted && c.days === streak)
  ) {
    add(
      `streak:${snapshot.enrollmentId}:${snapshot.todayLocalDate}:${streak}`,
      "streak",
      streak,
      now,
    );
  }
  for (const task of snapshot.todayTasks) {
    if (task.status === "Completed")
      add(
        `task:${snapshot.enrollmentId}:${snapshot.todayLocalDate}:${task.taskCode}`,
        "task",
        1,
        task.completedAt || now,
      );
  }
  if (snapshot.todayBonusAvailable === false)
    add(
      `day:${snapshot.enrollmentId}:${snapshot.todayLocalDate}`,
      "day",
      1,
      `${snapshot.todayLocalDate}T12:00:00`,
    );
  if (baseline || candidates.length || previous?.streak !== streak) {
    // Los cofres son únicos por inscripción: conservarlos incluso tras muchos días.
    const merged = [...candidates, ...items].sort((a, b) =>
      b.earnedAt.localeCompare(a.earnedAt),
    );
    save(owner, {
      enrollment: snapshot.enrollmentId,
      streak,
      items: [
        ...merged.filter((a) => a.kind === "streak"),
        ...merged.filter((a) => a.kind !== "streak").slice(0, 150),
      ].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)),
    });
  }
  return baseline ? [] : candidates;
}
