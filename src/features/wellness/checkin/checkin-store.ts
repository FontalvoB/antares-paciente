import type { UserProfile } from "../../../types";
import { localISODate, parseLocalDate } from "../state/wellness-home-store";
import type { DailyCheckin } from "./close-day";

export interface SavedCheckin {
  date: string;
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

function writeCheckin(owner: string, record: SavedCheckin): void {
  const key = storageKey(owner);
  window.localStorage.setItem(key, JSON.stringify({
    ...loadCheckins(owner),
    [record.date]: record,
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

export function saveCheckin(owner: string, date: string, input: DailyCheckin, now = new Date()) {
  return withCheckinLock(owner, () => {
    if (!parseLocalDate(date) || date > localISODate(now)) throw new RangeError("Invalid check-in date");
    const existing = loadCheckins(owner)[date];
    if (existing) return existing;
    const record: SavedCheckin = {
      date,
      input,
      idempotencyKey: `${storageKey(owner)}:${date}`,
      status: "pending",
    };
    writeCheckin(owner, record);
    return record;
  });
}

type SendCheckin = (record: SavedCheckin) => Promise<void>;

// Transporte mock hasta KAN-130. La clave estable acompaña cada reintento.
const sendMock: SendCheckin = () => Promise.resolve();
const syncing = new Map<string, Promise<void>>();

export function syncCheckins(owner: string, send: SendCheckin = sendMock): Promise<void> {
  const running = syncing.get(owner);
  if (running) return running;
  const work = withCheckinLock(owner, async () => {
    const queue = Object.values(loadCheckins(owner)).filter(({ status }) => status === "pending");
    for (const record of queue) {
      if (!navigator.onLine) break;
      if (loadCheckins(owner)[record.date]?.idempotencyKey !== record.idempotencyKey) continue;
      try {
        await send(record);
        const current = loadCheckins(owner)[record.date];
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
