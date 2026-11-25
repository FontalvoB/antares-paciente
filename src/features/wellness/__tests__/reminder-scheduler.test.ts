import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileReminders } from "../notifications/reminder-scheduler";
import { updateReminderPreference } from "../notifications/reminder-preferences";
import { completeProtocolStep } from "../state/wellness-home-store";

const mock = vi.hoisted(() => ({
  native: false,
  getPending: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mock.native, isPluginAvailable: () => true },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    getPending: mock.getPending,
    schedule: mock.schedule,
    cancel: mock.cancel,
    checkPermissions: async () => ({ display: "granted" }),
  },
}));

const session = {
  owner: "patient",
  active: () => true,
  mayShowToast: () => true,
  show: vi.fn(),
  translate: (source: string) => source,
};
const time = (hour: number, minute = 0) => new Date(2026, 10, 25, hour, minute);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(time(7));
  vi.resetAllMocks();
  mock.native = false;
  localStorage.clear();
  localStorage.setItem("wellness.plan.v1", JSON.stringify({ startDate: "2026-11-25" }));
  for (const type of ["chest", "streak", "ai"] as const) {
    updateReminderPreference(session.owner, type, { enabled: false });
  }
});
afterEach(() => vi.useRealTimers());

describe("reminder delivery", () => {
  it("shows each web notification once, including across concurrent refreshes", async () => {
    vi.setSystemTime(time(8));
    await Promise.all([reconcileReminders(session), reconcileReminders(session)]);
    expect(session.show).toHaveBeenCalledTimes(1);
    expect(session.show).toHaveBeenCalledWith("protocol");
    expect(mock.schedule).not.toHaveBeenCalled();
  });

  it("uses generic native copy and cancels a pending protocol reminder when a step completes", async () => {
    mock.native = true;
    mock.getPending.mockResolvedValue({ notifications: [] });
    mock.schedule.mockImplementation(async ({ notifications }) => ({
      notifications: notifications.map(({ id }: { id: number }) => ({ id })),
    }));
    await reconcileReminders(session);
    const [{ notifications: [notification] }] = mock.schedule.mock.calls[0];
    expect(notification).toMatchObject({
      title: "Tienes un aviso", body: "Abre la app para verlo.", schedule: { at: time(8) },
    });
    expect(notification).not.toHaveProperty("extra");
    mock.getPending.mockResolvedValue({ notifications: [{ id: notification.id }] });
    mock.cancel.mockImplementation(async () => {
      mock.getPending.mockResolvedValue({ notifications: [] });
    });
    completeProtocolStep("exercise");
    await reconcileReminders(session);
    expect(mock.cancel).toHaveBeenCalledWith({ notifications: [{ id: notification.id }] });
    vi.setSystemTime(time(8));
    await reconcileReminders(session);
    expect(mock.schedule).toHaveBeenCalledTimes(1);
    expect(session.show).not.toHaveBeenCalled();
  });

  it("does not schedule native alerts from inside quiet hours", async () => {
    mock.native = true;
    mock.getPending.mockResolvedValue({ notifications: [] });
    vi.setSystemTime(time(6));
    await reconcileReminders(session);
    expect(mock.schedule).not.toHaveBeenCalled();
    expect(session.show).not.toHaveBeenCalled();
  });

  it("does not show an in-app duplicate after the OS consumed a scheduled alert", async () => {
    mock.native = true;
    mock.getPending.mockResolvedValue({ notifications: [] });
    mock.schedule.mockImplementation(async ({ notifications }) => ({ notifications }));
    await reconcileReminders(session);
    vi.setSystemTime(time(8, 1));
    await reconcileReminders(session);
    expect(mock.schedule).toHaveBeenCalledTimes(1);
    expect(session.show).not.toHaveBeenCalled();
  });
});
