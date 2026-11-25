import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { loadCheckins } from "../checkin/checkin-store";
import { isChestUnlocked, loadPlanSnapshot, loadProtocolHistory, localISODate, PROTOCOL_STEPS } from "../state/wellness-home-store";
import { isQuiet, planReminders } from "./reminder-engine";
import { loadReminderPreferences, REMINDER_TYPES, type ReminderType } from "./reminder-preferences";

const IDS: Record<ReminderType, number> = { protocol: -17601, chest: -17602, streak: -17603, ai: -17604 };
const LEDGER = "wellness.reminder-delivery.v1.";
type Delivery = { state: "sent" } | { state: "scheduled"; at: number; settings: string };
type Ledger = Record<string, Delivery>;
let queue = Promise.resolve();

export function supportsNativeReminders(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications");
}

export function reminderTypeForNativeId(id: number): ReminderType | undefined {
  return REMINDER_TYPES.find((type) => IDS[type] === id);
}

function readLedger(owner: string): Ledger {
  try {
    const value = JSON.parse(localStorage.getItem(LEDGER + encodeURIComponent(owner)) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeLedger(owner: string, ledger: Ledger): void {
  const recent = Object.entries(ledger).sort(([a], [b]) => b.localeCompare(a)).slice(0, 120);
  localStorage.setItem(LEDGER + encodeURIComponent(owner), JSON.stringify(Object.fromEntries(recent)));
}

function run(work: () => Promise<void>): Promise<void> {
  const locked = () => navigator.locks
    ? navigator.locks.request(LEDGER, work)
    : work();
  queue = queue.then(locked).catch(() => {
    console.warn("[wellness] Could not reconcile notification delivery");
  });
  return queue;
}

export function cancelNativeReminders(owner: string): void {
  if (!supportsNativeReminders()) return;
  void run(async () => {
    const { notifications } = await LocalNotifications.getPending();
    const own = notifications.filter(({ id }) => reminderTypeForNativeId(id));
    if (own.length === 0) return;
    await LocalNotifications.cancel({ notifications: own.map(({ id }) => ({ id })) });
    const ledger = readLedger(owner);
    for (const [key, delivery] of Object.entries(ledger)) {
      if (delivery.state === "scheduled" && delivery.at > Date.now()) delete ledger[key];
    }
    writeLedger(owner, ledger);
  });
}

interface ReminderSession {
  owner: string;
  active: () => boolean;
  mayShowToast: () => boolean;
  show: (type: ReminderType) => void;
  translate: (source: string) => string;
}

function getCandidates(owner: string, now: Date, ledger: Ledger) {
  const day = localISODate(now);
  const prefs = loadReminderPreferences(owner);
  const plan = loadPlanSnapshot();
  if (!plan || plan.startDate > day) return { day, prefs, reminders: [] };

  const history = loadProtocolHistory();
  const steps = new Set(history[day] ?? []);
  const sent = new Set(Object.keys(ledger).filter((key) => ledger[key]?.state === "sent"));
  const progress = {
    stepsDone: PROTOCOL_STEPS.filter(({ id }) => steps.has(id)).length,
    chestReady: isChestUnlocked(history, now),
    chestOpened: steps.has("chest"),
    dayClosed: Boolean(loadCheckins(owner)[day]),
  };
  return { day, prefs, reminders: planReminders(now, progress, prefs, sent) };
}

export function reconcileReminders({ owner, active, mayShowToast, show, translate }: ReminderSession): Promise<void> {
  return run(async () => {
    if (!active()) return;
    let pending = new Set<number>();
    let canSchedule = false;
    if (supportsNativeReminders()) {
      try {
        const { notifications } = await LocalNotifications.getPending();
        pending = new Set(notifications.map(({ id }) => id));
        canSchedule = (await LocalNotifications.checkPermissions()).display === "granted";
      } catch {
        // In-app fallback if the native transport is unavailable.
      }
    }

    const ledger = readLedger(owner);
    for (const type of REMINDER_TYPES) {
      if (!active()) return;
      const now = new Date();
      const { day, prefs, reminders } = getCandidates(owner, now, ledger);
      const key = `${day}:${type}`;
      const reminder = reminders.find((entry) => entry.type === type);
      const delivery = ledger[key];
      const id = IDS[type];
      const title = reminder ? translate(reminder.title) : "";
      const body = reminder ? translate(reminder.body) : "";
      const settings = JSON.stringify([title, body, prefs[type]]);
      const scheduled = delivery?.state === "scheduled" ? delivery : undefined;
      const due = reminder !== undefined && reminder.at <= now;

      if (scheduled && scheduled.at <= now.getTime() && !pending.has(id)) {
        // The OS consumed the one-shot alert while JS was suspended.
        ledger[key] = { state: "sent" };
        writeLedger(owner, ledger);
        continue;
      }

      if (pending.has(id)) {
        const matches = reminder && scheduled && scheduled.settings === settings &&
          (due ? scheduled.at <= now.getTime() : scheduled.at === reminder.at.getTime());
        if (matches && canSchedule) continue;
        await LocalNotifications.cancel({ notifications: [{ id }] });
        if (scheduled) {
          delete ledger[key];
          writeLedger(owner, ledger);
        }
        // Re-evaluate after async cancellation before scheduling anything new.
        void reconcileReminders({ owner, active, mayShowToast, show, translate });
        continue;
      }

      if (!reminder || isQuiet(now, prefs[type])) continue;
      const visible = document.visibilityState !== "hidden";
      if (due && visible && mayShowToast()) {
        ledger[key] = { state: "sent" };
        writeLedger(owner, ledger);
        if (!canSchedule) console.info("[wellness] In-app notification dispatched");
        show(type);
      } else if (canSchedule && (!due || !visible)) {
        try {
          const result = await LocalNotifications.schedule({
            notifications: [{
              id, title, body,
              foreground: true,
              isExactNotification: false,
              schedule: due ? undefined : { at: reminder.at, allowWhileIdle: true },
            }],
          });
          if (result.notifications.some((notification) => notification.id === id)) {
            ledger[key] = due ? { state: "sent" } : { state: "scheduled", at: +reminder.at, settings };
            writeLedger(owner, ledger);
          }
        } catch {
          if (due && active() && document.visibilityState !== "hidden" && mayShowToast()) {
            void reconcileReminders({ owner, active, mayShowToast, show, translate });
          }
        }
      }
    }
  });
}
