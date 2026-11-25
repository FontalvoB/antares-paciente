import { beforeEach, describe, expect, it } from "vitest";
import { decideReminders, planReminders, type ReminderProgress } from "../notifications/reminder-engine";
import { loadReminderPreferences, type ReminderType } from "../notifications/reminder-preferences";

const empty: ReminderProgress = { stepsDone: 0, chestReady: false, chestOpened: false, dayClosed: false };
const local = (hour: number, minute = 0, day = 25) => new Date(2026, 10, day, hour, minute);
const four = { ...empty, stepsDone: 4, chestReady: true };
const five = { ...four, stepsDone: 5, chestOpened: true };
const prefs = () => loadReminderPreferences("patient");
const due = (now: Date, progress = empty, sent = new Set<string>()) =>
  decideReminders(now, progress, prefs(), sent).map(({ type }) => type);

beforeEach(() => localStorage.clear());

describe("reminder engine", () => {
  it("reminds at the selected local hour only if no step has started", () => {
    expect(due(local(7, 59))).toEqual([]);
    expect(due(local(8))).toEqual(["protocol"]);
    expect(due(local(8), { ...empty, stepsDone: 1 })).toEqual([]);
  });

  it("notifies when the first four steps unlock the chest and stops once opened", () => {
    expect(due(local(9), { ...empty, stepsDone: 3 })).toEqual([]);
    expect(due(local(9), four)).toEqual(["chest"]);
    expect(due(local(9), five)).toEqual([]);
  });

  it("sends streak risk only at the closing hour while steps remain", () => {
    expect(due(local(19, 59), four)).not.toContain("streak");
    expect(due(local(20), four)).toContain("streak");
    expect(due(local(20), five)).not.toContain("streak");
  });

  it("skips the protocol, streak and AI prompts after a saved daily check-in", () => {
    expect(due(local(20), { ...empty, dayClosed: true })).toEqual([]);
  });

  it.each<ReminderType>(["protocol", "chest", "streak", "ai"])("can silence %s independently", (type) => {
    const settings = prefs();
    const progress = type === "protocol" ? empty : four;
    expect(due(local(20), progress)).toContain(type);
    settings[type].enabled = false;
    expect(decideReminders(local(20), progress, settings, new Set()).map((reminder) => reminder.type))
      .not.toContain(type);
  });

  it("respects quiet hours across midnight and shifts same-day candidates to the end", () => {
    const settings = prefs();
    settings.protocol.time = "06:30";
    const sent = new Set<string>();
    expect(decideReminders(local(6, 45), empty, settings, sent)).toEqual([]);
    expect(planReminders(local(6, 45), empty, settings, sent)[0].at).toEqual(local(7));
    expect(decideReminders(local(7), empty, settings, sent)[0].type).toBe("protocol");
    expect(due(local(23, 30), four)).toEqual([]);
    settings.protocol.quietStart = "07:00";
    settings.protocol.quietEnd = "09:00";
    expect(decideReminders(local(8), empty, settings, sent)).toEqual([]);
    expect(decideReminders(local(9), empty, settings, sent)[0].type).toBe("protocol");
  });

  it("deduplicates by type and local calendar date at 23:59 and 00:01", () => {
    const settings = prefs();
    settings.ai = { ...settings.ai, time: "00:00", quietStart: "00:00", quietEnd: "00:00" };
    const sent = new Set(["2026-11-25:ai"]);
    expect(decideReminders(local(23, 59), five, settings, sent)).toEqual([]);
    expect(decideReminders(local(0, 1, 26), five, settings, sent)[0].key).toBe("2026-11-26:ai");
    expect(due(local(20), four, new Set(["2026-11-25:chest", "2026-11-25:streak"]))).toEqual(["ai"]);
  });

  it("honors the AI snooze without allowing a second notification that day", () => {
    const settings = prefs();
    settings.ai.snoozeUntil = +local(19);
    const sent = new Set<string>();
    expect(decideReminders(local(18, 59), five, settings, sent)).toEqual([]);
    const [reminder] = decideReminders(local(19), five, settings, sent);
    expect(reminder).toMatchObject({ type: "ai", title: "Tienes un aviso", body: "Abre la app para verlo." });
    sent.add(reminder.key);
    settings.ai.snoozeUntil = null;
    expect(decideReminders(local(21), five, settings, sent)).toEqual([]);
  });
});
