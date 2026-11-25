import type { UserProfile } from "../../../types";
import { localISODate, parseLocalDate } from "../state/wellness-home-store";
import type { DailyCheckin } from "./close-day";
import { motorPlanUserId, sendMotorClosure } from "../calendar/motor-plan-api";

export interface SavedCheckin {
  date: string;
  serverDay?: number;
  idempotencyKey: string;
  input: DailyCheckin;
  status: "pending" | "synced";
}

const STORAGE_PREFIX = "wellness.checkins.v1.";
const CHANGE_EVENT = "wellness-checkins-changed";

export function checkinOwner(user: Partial<UserProfile> | undefined): string {
  return user?.id || user?.cedula || user?.email || "local";
}

function storageKey(owner: string): string {
  return STORAGE_PREFIX + encodeURIComponent(owner);
}

export function loadCheckins(owner: string): Record<string, SavedCheckin> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(owner)) ?? "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

export function checkinKey(date: string, serverDay?: number) {
  return serverDay === undefined ? date : `motor:${serverDay}`;
}

function writeCheckin(owner: string, record: SavedCheckin): void {
  const key = storageKey(owner);
  window.localStorage.setItem(key, JSON.stringify({
    ...loadCheckins(owner),
    [checkinKey(record.date, record.serverDay)]: record,
  }));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}

export function checkinHistory(owner: string): Record<string, DailyCheckin> {
  return Object.fromEntries(
    Object.values(loadCheckins(owner)).map(({ date, input }) => [date, input]),
  );
}

function withCheckinLock<T>(owner: string, action: () => T | Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request(storageKey(owner), action);
  return Promise.resolve().then(action);
}

export function saveCheckin(owner: string, date: string, input: DailyCheckin, now = new Date(), serverDay?: number) {
  return withCheckinLock(owner, () => {
    if (!parseLocalDate(date) || (serverDay === undefined && date > localISODate(now)) ||
      (serverDay !== undefined && (!Number.isInteger(serverDay) || serverDay < 1 || serverDay > 365)))
      throw new RangeError("Invalid check-in date");
    const key = checkinKey(date, serverDay);
    const existing = loadCheckins(owner)[key];
    if (existing) return existing;
    const record: SavedCheckin = {
      date,
      serverDay,
      input,
      idempotencyKey: `${storageKey(owner)}:${key}`,
      status: "pending",
    };
    writeCheckin(owner, record);
    return record;
  });
}

type SendCheckin = (record: SavedCheckin) => Promise<void>;

function sendForOwner(owner: string): SendCheckin {
  return async (record) => {
    // Los cierres del flujo legado permanecen locales. Un cierre del motor
    // solo se marca sincronizado cuando la API del mismo usuario lo confirma.
    if (record.serverDay === undefined) return;
    if (motorPlanUserId() !== owner) throw new Error("Motor 365 session changed");
    await sendMotorClosure(owner, record.serverDay, record.input);
  };
}
const syncing = new Map<string, Promise<void>>();

export function syncCheckins(owner: string, send: SendCheckin = sendForOwner(owner)): Promise<void> {
  const running = syncing.get(owner);
  if (running) return running;
  const work = withCheckinLock(owner, async () => {
    const queue = Object.values(loadCheckins(owner)).filter(({ status }) => status === "pending");
    for (const record of queue) {
      if (!navigator.onLine) break;
      const key = checkinKey(record.date, record.serverDay);
      if (loadCheckins(owner)[key]?.idempotencyKey !== record.idempotencyKey) continue;
      try {
        await send(record);
        const current = loadCheckins(owner)[key];
        if (current?.idempotencyKey === record.idempotencyKey) {
          writeCheckin(owner, { ...current, status: "synced" });
        }
      } catch {
        // El registro sigue pendiente y se vuelve a intentar al reconectar.
      }
    }
  }).finally(() => syncing.delete(owner));
  syncing.set(owner, work);
  return work;
}

export function subscribeCheckins(owner: string, refresh: () => void): () => void {
  const key = storageKey(owner);
  const onChange = (event: Event) => {
    if ((event as CustomEvent<string>).detail === key) refresh();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) refresh();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
