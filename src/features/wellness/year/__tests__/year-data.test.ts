import { describe, expect, it } from "vitest";
import type { DailyCheckin } from "../../checkin/close-day";
import { normalizePlanSnapshot, TOTAL_PLAN_DAYS } from "../../state/wellness-home-store";
import { bodyMeasurementFormatter, DEFAULT_UNITS, loadUnitPrefs, saveUnitPrefs } from "../../vitals/unit-prefs";
import { buildCalendar, planMilestones, readings, selectRange, summarizeMonth } from "../year-data";

function checkin(adherence: number, weightKg: number | null = null, waistCm: number | null = null): DailyCheckin {
  return { adherence, weightKg, waistCm, sleepHours: 7, energy: 4, pain: 0, symptoms: [], exercised: true };
}

describe("Año 365", () => {
  it("keeps exactly 365 local plan dates, including missing days, leap day and future days", () => {
    const days = buildCalendar("2024-02-27", "2024-03-01", {
      "2024-02-26": checkin(100),
      "2024-02-27": checkin(50),
      "2024-02-29": checkin(100),
      "2024-03-01": checkin(0),
      "2024-03-02": checkin(100, 80, 90),
    }).flatMap(({ days }) => days);

    expect(days).toHaveLength(TOTAL_PLAN_DAYS);
    expect(days.at(-1)?.date).toBe("2025-02-25");
    expect(days.slice(0, 5).map(({ date, status }) => [date, status])).toEqual([
      ["2024-02-27", "partial"],
      ["2024-02-28", "missing"],
      ["2024-02-29", "complete"],
      ["2024-03-01", "partial"],
      ["2024-03-02", "future"],
    ]);
    expect(days[4].checkin).toBeUndefined();
    expect(readings(days, "weightKg")).toEqual([]);
    expect(buildCalendar("2024-02-30", "2024-03-01", {})).toEqual([]);
  });

  it("averages recorded adherence and measures each delta from its own first and last readings", () => {
    const [month] = buildCalendar("2026-01-01", "2026-01-10", {
      "2026-01-01": checkin(100, 80),
      "2026-01-02": checkin(60, null, 90),
      "2026-01-04": checkin(100, 78),
      "2026-01-05": checkin(0, null, 87),
      "2026-01-06": checkin(59),
      "2026-01-11": checkin(100, 70, 80),
    });
    expect(summarizeMonth(month.days)).toEqual({
      count: 5, adherence: 63.8, weight: -2, waist: -3, longestStreak: 2,
    });
  });

  it("resets streaks at gaps, below threshold and at month boundaries", () => {
    const [jan, feb, mar] = buildCalendar("2026-01-30", "2026-02-10", {
      "2026-01-30": checkin(60),
      "2026-01-31": checkin(80),
      "2026-02-01": checkin(90),
      "2026-02-02": checkin(90),
      "2026-02-03": checkin(59),
      "2026-02-04": checkin(90),
      "2026-02-06": checkin(100, 80, 90),
    });
    expect(summarizeMonth(jan.days).longestStreak).toBe(2);
    expect(summarizeMonth(feb.days)).toMatchObject({ longestStreak: 2, weight: null, waist: null });
    expect(summarizeMonth(mar.days)).toEqual({ count: 0, adherence: null, weight: null, waist: null, longestStreak: 0 });
  });

  it("filters inclusive rolling windows and the selected local calendar month", () => {
    const days = buildCalendar("2026-01-10", "2026-04-15", {}).flatMap(({ days }) => days);
    for (const [period, from] of [["7", "2026-04-09"], ["30", "2026-03-17"], ["90", "2026-01-16"]] as const) {
      const result = selectRange(days, period, "", "2026-04-15");
      expect(result).toHaveLength(Number(period));
      expect(result[0].date).toBe(from);
      expect(result.at(-1)?.date).toBe("2026-04-15");
    }
    expect(selectRange(days, "7", "", "2026-01-09")).toEqual([]);
    expect(selectRange(days, "7", "", "2026-01-12")).toHaveLength(3);
    expect(selectRange(days, "7", "", "2027-02-01").at(-1)).toEqual(days.at(-1));
    expect(selectRange(days, "month", "2026-02", "2026-04-15")).toHaveLength(28);
    expect(selectRange(days, "month", "2026-05", "2026-04-15").every(({ status }) => status === "future")).toBe(true);
  });

  it("keeps only real, nonfuture milestones from the same plan", () => {
    const snapshot = normalizePlanSnapshot({ startDate: "2026-01-01" })!;
    const change = { version: 1, snapshot, changedAt: new Date(2026, 0, 10, 12).toISOString() };
    expect(planMilestones([
      change,
      { ...change, changedAt: "invalid" },
      { ...change, changedAt: new Date(2026, 0, 12, 12).toISOString() },
      { ...change, snapshot: { ...snapshot, startDate: "2025-01-01" } },
    ], snapshot.startDate, "2026-01-11")).toEqual([{ date: "2026-01-10", time: change.changedAt }]);
  });

  it("defaults to metric and applies US conversion only when formatting", () => {
    localStorage.removeItem("antares_units");
    const owner = "year-qa";
    expect(loadUnitPrefs(owner)).toEqual(DEFAULT_UNITS);
    const record = checkin(100, 80, 90);
    localStorage.setItem("antares_units", "us");
    try {
      const prefs = loadUnitPrefs(owner);
      expect(bodyMeasurementFormatter("weight", prefs, "en-US")(record.weightKg!)).toBe("176.4 lb");
      expect(bodyMeasurementFormatter("waist", prefs, "en-US")(record.waistCm!)).toBe("35.4 in");
      saveUnitPrefs(owner, DEFAULT_UNITS);
      expect(bodyMeasurementFormatter("waist", loadUnitPrefs(owner), "en-US")(record.waistCm!)).toBe("90 cm");
      expect(record).toMatchObject({ weightKg: 80, waistCm: 90 });
    } finally {
      localStorage.removeItem("antares_units");
      localStorage.removeItem("wellness.vitals.units.v1." + owner);
    }
  });
});
