import { localISODate } from "../state/wellness-home-store";
import { REMINDER_TYPES, type ReminderPreference, type ReminderPreferences, type ReminderType } from "./reminder-preferences";

export const REMINDER_TITLE = "Tienes un aviso";
export const REMINDER_BODY = "Abre la app para verlo.";

export interface ReminderProgress {
  stepsDone: number;
  chestReady: boolean;
  chestOpened: boolean;
  dayClosed: boolean;
}

export interface Reminder {
  type: ReminderType;
  key: string;
  at: Date;
  title: typeof REMINDER_TITLE;
  body: typeof REMINDER_BODY;
}

function clock(date: Date): string {
  return [date.getHours(), date.getMinutes()].map((part) => String(part).padStart(2, "0")).join(":");
}

function atLocalTime(date: Date, time: string, offset = 0): Date {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, hour, minute);
}

export function isQuiet(now: Date, pref: ReminderPreference): boolean {
  const { quietStart, quietEnd } = pref;
  const time = clock(now);
  if (quietStart < quietEnd) return time >= quietStart && time < quietEnd;
  if (quietStart > quietEnd) return time >= quietStart || time < quietEnd;
  return false;
}

function eligible(type: ReminderType, progress: ReminderProgress): boolean {
  switch (type) {
    case "protocol": return !progress.dayClosed && progress.stepsDone === 0;
    case "chest": return progress.chestReady && !progress.chestOpened;
    case "streak": return !progress.dayClosed && progress.stepsDone < 5;
    case "ai": return !progress.dayClosed;
  }
}

/** Same-day candidates only. Re-evaluate against progress before showing or scheduling them. */
export function planReminders(
  now: Date,
  progress: ReminderProgress,
  prefs: ReminderPreferences,
  sent: ReadonlySet<string>,
): Reminder[] {
  const day = localISODate(now);
  return REMINDER_TYPES.flatMap((type): Reminder[] => {
    const key = `${day}:${type}`;
    const pref = prefs[type];
    if (!pref.enabled || sent.has(key) || !eligible(type, progress)) return [];

    let at = new Date(Math.max(now.getTime(), atLocalTime(now, pref.time).getTime(), pref.snoozeUntil ?? 0));
    if (isQuiet(at, pref)) {
      const nextDay = clock(at) >= pref.quietEnd ? 1 : 0;
      at = atLocalTime(at, pref.quietEnd, nextDay);
    }
    if (localISODate(at) !== day || at < now || isQuiet(at, pref)) return [];
    return [{ key, type, at, title: REMINDER_TITLE, body: REMINDER_BODY }];
  });
}

export function decideReminders(...input: Parameters<typeof planReminders>): Reminder[] {
  return planReminders(...input).filter(({ at }) => at.getTime() <= input[0].getTime());
}
