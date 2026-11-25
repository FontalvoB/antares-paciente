import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadReminderPreferences, subscribeReminderPreferences, updateReminderPreference } from "../notifications/reminder-preferences";

beforeEach(() => localStorage.clear());

describe("reminder preferences", () => {
  it("isolates each type and account and persists time, quiet hours and snooze", () => {
    updateReminderPreference("alice", "protocol", {
      enabled: false, time: "09:25", quietStart: "23:00", quietEnd: "06:00",
    });
    updateReminderPreference("alice", "ai", { snoozeUntil: 1_790_000_000_000 });
    const alice = loadReminderPreferences("alice");
    expect(alice.protocol).toEqual({
      enabled: false, time: "09:25", quietStart: "23:00", quietEnd: "06:00", snoozeUntil: null,
    });
    expect(alice.chest.enabled).toBe(true);
    expect(alice.ai.snoozeUntil).toBe(1_790_000_000_000);
    expect(loadReminderPreferences("bob").protocol).toMatchObject({ enabled: true, time: "08:00" });
    expect(loadReminderPreferences("bob").ai.snoozeUntil).toBeNull();
  });

  it("falls back on corrupt storage and invalid times", () => {
    localStorage.setItem("wellness.reminder-preferences.v1.alice", "broken");
    expect(loadReminderPreferences("alice").streak.time).toBe("20:00");
    expect(updateReminderPreference("alice", "streak", { time: "25:00", quietEnd: "7:00" }).streak)
      .toMatchObject({ time: "20:00", quietEnd: "07:00" });
  });

  it("refreshes only the account whose settings changed", () => {
    const refresh = vi.fn();
    const dispose = subscribeReminderPreferences("alice", refresh);
    updateReminderPreference("bob", "ai", { enabled: false });
    updateReminderPreference("alice", "ai", { enabled: false });
    dispose();
    updateReminderPreference("alice", "ai", { enabled: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
