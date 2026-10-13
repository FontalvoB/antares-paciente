import { describe, it, expect, vi } from "vitest";
import {
  getAchievements,
  observeAchievements,
  markAchievementRead,
} from "../achievement-store";
import type { ProgramSnapshotDto } from "../../program/types";
function snapshot(patch: Partial<ProgramSnapshotDto> = {}): ProgramSnapshotDto {
  return {
    enrollmentId: "real-enrollment",
    todayLocalDate: "2026-10-13",
    todayTasks: [],
    todayBonusAvailable: true,
    streakChests: [],
    ...patch,
  } as ProgramSnapshotDto;
}
describe("confirmed achievements", () => {
  it("baselines historical rewards without notifying; only newly granted rewards notify once", () => {
    const owner = crypto.randomUUID();
    const first = snapshot({
      streakChests: [{ days: 7, xp: 100, granted: true }],
    });
    expect(observeAchievements(owner, first)).toEqual([]);
    expect(getAchievements(owner)[0].readAt).not.toBeNull();
    const next = snapshot({
      streakChests: [
        ...first.streakChests!,
        { days: 14, xp: 150, granted: true },
      ],
    });
    expect(observeAchievements(owner, next)).toHaveLength(1);
    expect(observeAchievements(owner, next)).toEqual([]);
    markAchievementRead(owner);
    expect(getAchievements(owner).every((a) => a.readAt)).toBe(true);
  });
  it("isolates patients and re-enrollments and ignores mock snapshots", () => {
    const a = crypto.randomUUID(),
      b = crypto.randomUUID();
    observeAchievements(a, snapshot());
    expect(
      observeAchievements(a, snapshot({ todayBonusAvailable: false })),
    ).toHaveLength(1);
    expect(getAchievements(b)).toEqual([]);
    expect(
      observeAchievements(
        a,
        snapshot({
          enrollmentId: "mock-enrollment",
          todayBonusAvailable: false,
        }),
      ),
    ).toEqual([]);
    expect(
      observeAchievements(a, snapshot({ enrollmentId: "new-enrollment" })),
    ).toEqual([]);
    expect(getAchievements(a)).toEqual([]);
  });
  it("does not grant pending tasks and does not repeat after a module restart", async () => {
    const owner = crypto.randomUUID();
    observeAchievements(owner, snapshot());
    const done = snapshot({
      todayTasks: [
        {
          taskCode: "ejercicio",
          status: "Completed",
          completedAt: "2026-10-13T18:00:00Z",
        },
      ] as ProgramSnapshotDto["todayTasks"],
    });
    expect(observeAchievements(owner, done)).toHaveLength(1);
    vi.resetModules();
    const fresh = await import("../achievement-store");
    expect(fresh.observeAchievements(owner, done)).toEqual([]);
    expect(fresh.getAchievements(owner)).toHaveLength(1);
  });
});
