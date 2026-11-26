import type { UserProfile } from "../../../types";
import { localISODate, parseLocalDate } from "../state/wellness-home-store";
import type { DailyCheckin } from "./close-day";
import { ApiError } from "../../../utils/apiClient";
import { MOTOR_CLOSURE_CONFIRMED, cachedMotorPerson, confirmStoredMotorClosure, motorPlanUserId, sendMotorClosure } from "../calendar/motor-plan-api";
import { readWellnessConsent } from "../privacy/privacy-consent-store";

export interface SavedCheckin {
  date: string;
  serverDay?: number;
  personId?: string;
  idempotencyKey: string;
  input: DailyCheckin;
  status: "pending" | "synced" | "conflict";
  confirmedConflict?: boolean;
}

const STORAGE_PREFIX = "wellness.checkins.v1.";
const CHANGE_EVENT = "wellness-checkins-changed";

export function checkinOwner(user: Partial<UserProfile> | undefined): string {
  return user?.id || user?.cedula || user?.email || "local";
}

export function motorCheckinOwner(account: string, personId: string): string {
  return `motor-real:${account}:${personId}`;
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
    Object.values(loadCheckins(owner)).filter(({ serverDay }) => serverDay === undefined)
      .map(({ date, input }) => [date, input]),
  );
}

function withCheckinLock<T>(owner: string, action: () => T | Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request(storageKey(owner), action);
  return Promise.resolve().then(action);
}

export function saveCheckin(owner: string, date: string, input: DailyCheckin, now = new Date(), serverDay?: number,
  personId?: string) {
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
      personId,
      input,
      idempotencyKey: `${storageKey(owner)}:${key}`,
      status: "pending",
    };
    writeCheckin(owner, record);
    return record;
  });
}

type SendCheckin = (record: SavedCheckin) => Promise<void | false | "conflict">;
type ReconcileCheckin = (record: SavedCheckin) => Promise<boolean>;

const syncing = new Map<string, Promise<void>>();

export function syncMotorCheckins(account: string) {
  const personId = cachedMotorPerson(account);
  if (!personId || motorPlanUserId() !== account) return;
  const inScope = (record: SavedCheckin) => record.personId === personId && motorPlanUserId() === account &&
    cachedMotorPerson(account) === personId && Boolean(readWellnessConsent("sensitive-data", account));
  const send: SendCheckin = async (record) => {
    if (!inScope(record) || record.serverDay === undefined) return false;
    try {
      await sendMotorClosure(account, personId, record.serverDay, record.input);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.code === "log_already_recorded") return "conflict";
      throw error;
    }
  };
  const reconcile: ReconcileCheckin = record => inScope(record) && record.serverDay !== undefined
    ? confirmStoredMotorClosure(account, personId, record.serverDay)
    : Promise.resolve(false);
  return syncCheckins(motorCheckinOwner(account, personId), send, reconcile);
}

export function syncCheckins(owner: string, send: SendCheckin = async () => false, reconcile?: ReconcileCheckin): Promise<void> {
  const running = syncing.get(owner);
  if (running) return running;
  const work = withCheckinLock(owner, async () => {
    const queue = Object.values(loadCheckins(owner)).filter(({ status, confirmedConflict }) =>
      status === "pending" || (status === "conflict" && !confirmedConflict && reconcile));
    for (const record of queue) {
      if (!navigator.onLine) break;
      const key = checkinKey(record.date, record.serverDay);
      if (loadCheckins(owner)[key]?.idempotencyKey !== record.idempotencyKey) continue;
      try {
        let conflicted = record.status === "conflict";
        if (!conflicted) {
          const result = await send(record);
          if (result === false || loadCheckins(owner)[key]?.idempotencyKey !== record.idempotencyKey) continue;
          conflicted = result === "conflict";
          writeCheckin(owner, { ...record, status: conflicted ? "conflict" : "synced" });
        }
        if (conflicted) {
          if (!await reconcile?.(record) || loadCheckins(owner)[key]?.idempotencyKey !== record.idempotencyKey) continue;
          writeCheckin(owner, { ...record, status: "conflict", confirmedConflict: true });
        }
        if (record.personId) window.dispatchEvent(new Event(MOTOR_CLOSURE_CONFIRMED));
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
