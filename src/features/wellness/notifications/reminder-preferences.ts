export const REMINDER_TYPES = ["protocol", "chest", "streak", "ai"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export interface ReminderPreference {
  enabled: boolean;
  time: string;
  quietStart: string;
  quietEnd: string;
  snoozeUntil: number | null;
}

export type ReminderPreferences = Record<ReminderType, ReminderPreference>;

const DEFAULT_TIMES: Record<ReminderType, string> = {
  protocol: "08:00",
  chest: "00:00",
  streak: "20:00",
  ai: "18:00",
};
const PREFIX = "wellness.reminder-preferences.v1.";
const CHANGE = "wellness-reminder-preferences-changed";

export function isReminderTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalize(prefs?: Partial<ReminderPreferences>): ReminderPreferences {
  const entry = (type: ReminderType): ReminderPreference => {
    const value = prefs?.[type];
    return {
      enabled: typeof value?.enabled === "boolean" ? value.enabled : true,
      time: isReminderTime(value?.time) ? value.time : DEFAULT_TIMES[type],
      quietStart: isReminderTime(value?.quietStart) ? value.quietStart : "22:00",
      quietEnd: isReminderTime(value?.quietEnd) ? value.quietEnd : "07:00",
      snoozeUntil: type === "ai" && typeof value?.snoozeUntil === "number" && Number.isFinite(value.snoozeUntil)
        ? value.snoozeUntil
        : null,
    };
  };
  return { protocol: entry("protocol"), chest: entry("chest"), streak: entry("streak"), ai: entry("ai") };
}

function storageKey(owner: string): string {
  return PREFIX + encodeURIComponent(owner);
}

export function loadReminderPreferences(owner: string): ReminderPreferences {
  try {
    return normalize(JSON.parse(localStorage.getItem(storageKey(owner)) ?? "null"));
  } catch {
    return normalize();
  }
}

export function updateReminderPreference(
  owner: string,
  type: ReminderType,
  change: Partial<ReminderPreference>,
): ReminderPreferences {
  const prefs = loadReminderPreferences(owner);
  prefs[type] = { ...prefs[type], ...change };
  const normalized = normalize(prefs);
  localStorage.setItem(storageKey(owner), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CHANGE, { detail: owner }));
  return normalized;
}

export function subscribeReminderPreferences(owner: string, refresh: () => void): () => void {
  const onChange = (event: Event) => {
    if ((event as CustomEvent<string>).detail === owner) refresh();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(owner) || event.key === null) refresh();
  };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
