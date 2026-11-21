import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  disconnectHealth, getHealthPermission, healthDeviceMetrics, isHealthAvailable,
  openHealthSettings, persistHealthDay, readHealthData, requestHealthPermissions, summarizeHealthData,
} from "../health-service";
import { ApiError } from "../../../utils/apiClient";

const mocks = vi.hoisted(() => ({
  platform: vi.fn(), status: vi.fn(), requestRead: vi.fn(), read: vi.fn(),
  openSettings: vi.fn(), getData: vi.fn(), openHealthConnect: vi.fn(), disconnect: vi.fn(),
  record: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: mocks.platform, isPluginAvailable: () => true, isNativePlatform: () => false },
  registerPlugin: () => ({ status: mocks.status, requestRead: mocks.requestRead, read: mocks.read, openSettings: mocks.openSettings }),
}));
vi.mock("@capacitor/health-fitness", () => ({
  HealthFitness: { getData: mocks.getData, openHealthConnect: mocks.openHealthConnect, disconnectFromHealthConnect: mocks.disconnect },
}));
vi.mock("../../program/metrics-history-service", () => ({ recordDeviceMetrics: mocks.record }));

const from = new Date(2026, 10, 19);
const nextDay = new Date(2026, 10, 20);
const to = new Date(2026, 10, 20, 12);
const minute = 60_000;

beforeEach(() => {
  mocks.platform.mockReturnValue("android");
  mocks.status.mockResolvedValue({ availability: "available", granted: ["steps", "sleep"] });
  mocks.read.mockResolvedValue({ records: [] });
});

describe("Lecturas de bienestar", () => {
  it("distingue web, instalación pendiente, acceso parcial y acceso opaco en iOS", async () => {
    mocks.platform.mockReturnValue("web");
    expect(await isHealthAvailable()).toEqual({ availability: "web" });
    await expect(readHealthData(from, to)).rejects.toMatchObject({ code: "web" });
    expect(mocks.status).not.toHaveBeenCalled();
    mocks.platform.mockReturnValue("android");
    mocks.status.mockResolvedValueOnce({ availability: "not-installed" });
    await expect(requestHealthPermissions()).rejects.toMatchObject({ code: "not-installed" });
    expect(getHealthPermission(await isHealthAvailable(), true)).toBe("partial");
    expect(getHealthPermission({ availability: "available", granted: [] }, true)).toBe("denied");
    mocks.platform.mockReturnValue("ios");
    expect(getHealthPermission(await isHealthAvailable(), true)).toBe("unknown");
  });

  it("usa ajustes nativos cuando el proveedor integrado no tiene launcher", async () => {
    mocks.openHealthConnect.mockRejectedValueOnce({ code: "OS-PLUG-HLFT-0303" });
    await openHealthSettings();
    expect(mocks.openSettings).toHaveBeenCalledOnce();
    await disconnectHealth();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it("lee los seis tipos de iOS solo a través del puente de HealthKit", async () => {
    mocks.platform.mockReturnValue("ios");
    mocks.read.mockImplementation(async ({ metric, start, end }) => ({
      records: metric === "resting_heart_rate" ? [{ start, end, value: 56 }] : [],
    }));
    const samples = await readHealthData(from, nextDay);
    expect(samples).toEqual([expect.objectContaining({
      metric: "resting_heart_rate", value: 56, unit: "bpm", source: "apple-health",
    })]);
    expect(mocks.read).toHaveBeenCalledTimes(6);
    expect(mocks.getData).not.toHaveBeenCalled();
  });

  it("deduplica una ventana, combina sueño solapado y mapea únicamente el payload existente", async () => {
    mocks.read.mockImplementation(async ({ metric, start, end }) => {
      if (metric === "steps") return { records: [{ start, end, value: 42 }, { start, end, value: 42 }] };
      const midnight = +nextDay;
      const night = { start: midnight - 20 * minute, end: midnight + 30 * minute, value: 0, id: "night" };
      return { records: [night, night, { start: midnight + 10 * minute, end: midnight + 45 * minute, value: 0 }] };
    });
    const samples = await readHealthData(from, to);
    expect(samples).toHaveLength(4);
    expect(samples[0]).toMatchObject({ source: "health-connect", metric: "steps", value: 42, unit: "steps" });
    const days = summarizeHealthData(samples, from, to);
    expect(days.map(day => day.values)).toEqual([{ steps: 42 }, { steps: 42, sleep: 65 }]);
    expect(healthDeviceMetrics(days[1])).toEqual({
      steps: 42, sleepMinutes: 65, recordedAt: new Date(2026, 10, 20, 6).toISOString(),
    });
    expect(healthDeviceMetrics({ ...days[0], values: { heart_rate: 72, resting_heart_rate: 55 } })).toBeNull();
  });

  it("incluye la noche previa al inicio de la ventana, las fuentes solapadas y la siesta", async () => {
    const start = new Date(2026, 10, 19);
    const end = new Date(2026, 10, 19, 20);
    const sleepRecord = (start: Date, end: Date, id: string) => ({ start: +start, end: +end, id, value: 0 });
    mocks.status.mockResolvedValue({ availability: "available", granted: ["sleep"] });
    mocks.read.mockResolvedValue({ records: [
      sleepRecord(new Date(2026, 10, 18, 23), new Date(2026, 10, 19, 7), "watch"),
      sleepRecord(new Date(2026, 10, 18, 23, 15), new Date(2026, 10, 19, 6, 55), "ring"),
      sleepRecord(new Date(2026, 10, 19, 13), new Date(2026, 10, 19, 13, 25), "nap"),
      sleepRecord(new Date(2026, 10, 18, 15), new Date(2026, 10, 18, 16), "previous-day"),
    ] });
    const samples = await readHealthData(start, end);
    expect(mocks.read).toHaveBeenCalledWith({ metric: "sleep", start: +start - 18 * 60 * minute, end: +end });
    expect(summarizeHealthData(samples, start, end)).toEqual([
      { date: "2026-11-19", start: +start, end: +end, values: { sleep: 505 } },
    ]);
  });

  it.each([
    [404, "NO_ACTIVE_ENROLLMENT", "save-unavailable"],
    [403, undefined, "save-unavailable"],
    [422, "NO_ACTIVE_ENROLLMENT", "save-unavailable"],
    [422, undefined, "save-rejected"],
    [503, undefined, "save-failed"],
  ])("clasifica HTTP %s y código %s al persistir", async (status, code, expected) => {
    mocks.record.mockRejectedValueOnce(new ApiError({ message: "error", status, code }));
    await expect(persistHealthDay({ steps: 2 }, "a", new AbortController().signal)).rejects.toMatchObject({ code: expected });
  });

  it("devuelve errores diferenciados por vacío y permisos", async () => {
    await expect(readHealthData(from, to)).rejects.toMatchObject({ code: "no-data" });
    mocks.status.mockResolvedValue({ availability: "available", granted: [] });
    await expect(readHealthData(from, to)).rejects.toMatchObject({ code: "permission-denied" });
  });
});
