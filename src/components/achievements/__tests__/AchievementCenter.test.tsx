import { vi, it, expect } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AchievementCenter } from "../AchievementCenter";
import { getAchievements } from "../../../services/achievements/achievement-store";
import type { ProgramSnapshotDto } from "../../../services/program/types";
vi.mock("@ionic/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ionic/react")>()),
  IonToast: () => null,
}));
const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  notify: vi.fn(),
  owner: "center-patient",
}));
vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ user: { id: mocks.owner }, showToast: vi.fn() }),
}));
const t = (key: string) => key;
vi.mock("../../../i18n/I18nContext", () => ({ useT: () => t }));
vi.mock("../../../services/program/program-service", () => ({
  getSnapshot: () => mocks.snapshot(),
}));
vi.mock("../../../services/achievements/native-notifications", () => ({
  notifyAchievement: (...args: unknown[]) => mocks.notify(...args),
  enableAchievementNotifications: vi.fn(),
}));
vi.mock("../AchievementShare", () => ({ AchievementShare: () => null }));
it("notifies only on network-confirmed progress, never optimistic success or duplicate fetches", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const pending = {
    enrollmentId: "e-center",
    todayTasks: [],
    todayBonusAvailable: true,
    todayLocalDate: "2026-10-13",
    streakChests: [],
  } as unknown as ProgramSnapshotDto;
  mocks.snapshot.mockResolvedValue(pending);
  mocks.notify.mockResolvedValue(undefined);
  const view = render(
    <QueryClientProvider client={client}>
      <AchievementCenter />
    </QueryClientProvider>,
  );
  await act(async () => {
    await client.fetchQuery({
      queryKey: ["program", "snapshot"],
      queryFn: async () => pending,
    });
  });
  await waitFor(() =>
    expect(client.getQueryData(["program", "snapshot"])).toBeTruthy(),
  );
  const done = { ...pending, todayBonusAvailable: false };
  act(() => client.setQueryData(["program", "snapshot"], done));
  expect(getAchievements(mocks.owner)).toEqual([]);
  expect(mocks.notify).not.toHaveBeenCalled();
  await act(async () => {
    await client.fetchQuery({
      queryKey: ["program", "snapshot"],
      queryFn: async () => done,
      staleTime: 0,
    });
  });
  expect(getAchievements(mocks.owner)).toHaveLength(1);
  expect(mocks.notify).toHaveBeenCalledTimes(1);
  await act(async () => {
    await client.fetchQuery({
      queryKey: ["program", "snapshot"],
      queryFn: async () => done,
      staleTime: 0,
    });
  });
  expect(mocks.notify).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});
