import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResult } from "@capacitor-community/bluetooth-le";

const mock = vi.hoisted(() => ({
  platform: "ios",
  client: {
    initialize: vi.fn(),
    isEnabled: vi.fn(),
    requestEnable: vi.fn(),
    requestLEScan: vi.fn(),
    stopLEScan: vi.fn(),
    requestDevice: vi.fn(),
    getDevices: vi.fn(),
    getBondedDevices: vi.fn(),
    getConnectedDevices: vi.fn(),
    connect: vi.fn(),
    startEnabledNotifications: vi.fn(),
    stopEnabledNotifications: vi.fn(),
  },
}));

vi.mock("@capacitor-community/bluetooth-le", () => ({
  BleClient: mock.client,
  ScanMode: { SCAN_MODE_LOW_LATENCY: 2 },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => mock.platform,
    isNativePlatform: () => mock.platform !== "web",
  },
}));

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const band: ScanResult = {
  device: { deviceId: "saved-id", name: "H59_E206" },
  rssi: -55,
};

describe("BLE — inicialización y cancelación", () => {
  let ble: typeof import("../ble/ble-client");

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.resetAllMocks();
    mock.platform = "ios";
    mock.client.initialize.mockResolvedValue(undefined);
    mock.client.isEnabled.mockResolvedValue(true);
    mock.client.requestEnable.mockResolvedValue(undefined);
    mock.client.requestLEScan.mockResolvedValue(undefined);
    mock.client.stopLEScan.mockResolvedValue(undefined);
    mock.client.getDevices.mockResolvedValue([]);
    mock.client.getBondedDevices.mockResolvedValue([]);
    mock.client.getConnectedDevices.mockResolvedValue([]);
    mock.client.connect.mockResolvedValue(undefined);
    mock.client.startEnabledNotifications.mockResolvedValue(undefined);
    mock.client.stopEnabledNotifications.mockResolvedValue(undefined);
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    ble = await import("../ble/ble-client");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("comparte una sola inicialización entre escaneo y dispositivos conocidos", async () => {
    const initializing = deferred();
    mock.client.initialize.mockReturnValue(initializing.promise);
    const scanning = ble.startScan(vi.fn());
    const paired = ble.listPairedDevices();
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.client.initialize).toHaveBeenCalledTimes(1);
    expect(mock.client.requestLEScan).not.toHaveBeenCalled();

    initializing.resolve();
    await Promise.all([scanning, paired]);
    expect(mock.client.initialize).toHaveBeenCalledTimes(1);
    expect(mock.client.requestLEScan).toHaveBeenCalledTimes(1);
  });

  it("permite reintentar la inicialización después de un permiso denegado", async () => {
    mock.client.initialize.mockRejectedValueOnce(new Error("permission denied"));
    await expect(ble.ensureBluetoothReady()).rejects.toMatchObject({
      code: "permission-denied",
    });
    await ble.ensureBluetoothReady();
    expect(mock.client.initialize).toHaveBeenCalledTimes(2);
  });

  it("cancelar durante el permiso evita que el escaneo empiece después", async () => {
    const initializing = deferred();
    mock.client.initialize.mockReturnValue(initializing.promise);
    const found = vi.fn();
    const scanning = ble.startScan(found);
    await vi.advanceTimersByTimeAsync(0);
    await ble.stopScan();
    initializing.resolve();
    await scanning;

    expect(mock.client.requestLEScan).not.toHaveBeenCalled();
    expect(found).not.toHaveBeenCalled();
  });

  it("ignora callbacks y fallos de un START que ya fue cancelado", async () => {
    const starting = deferred();
    mock.client.requestLEScan.mockReturnValueOnce(starting.promise);
    const oldFound = vi.fn();
    const oldScan = ble.startScan(oldFound);
    await vi.advanceTimersByTimeAsync(0);
    const oldCallback = mock.client.requestLEScan.mock.calls[0][1] as (
      result: ScanResult,
    ) => void;

    await ble.stopScan();
    const newFound = vi.fn();
    await ble.startScan(newFound);
    oldCallback(band);
    starting.reject(new Error("old scan failed"));
    await expect(oldScan).resolves.toBeUndefined();
    const newCallback = mock.client.requestLEScan.mock.calls[1][1] as (
      result: ScanResult,
    ) => void;
    newCallback(band);

    expect(oldFound).not.toHaveBeenCalled();
    expect(newFound).toHaveBeenCalledTimes(1);
    expect(mock.client.stopLEScan).toHaveBeenCalledTimes(1);
  });

  it("coalesces búsquedas simultáneas mientras se inicializa el adaptador", async () => {
    const initializing = deferred();
    mock.client.initialize.mockReturnValue(initializing.promise);
    const first = ble.startScan(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    const second = ble.startScan(vi.fn());
    initializing.resolve();
    await Promise.all([first, second]);

    expect(mock.client.requestLEScan).toHaveBeenCalledTimes(1);
  });

  it("un fallo viejo no se propaga después de limpiar y empezar otro escaneo", async () => {
    const stopping = deferred();
    mock.client.requestLEScan.mockRejectedValueOnce(new Error("scan failed"));
    mock.client.stopLEScan.mockReturnValueOnce(stopping.promise);
    const oldScan = ble.startScan(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    await ble.startScan(vi.fn());
    stopping.resolve();

    await expect(oldScan).resolves.toBeUndefined();
    expect(mock.client.requestLEScan).toHaveBeenCalledTimes(2);
  });

  it("hidrata un id iOS solo después de inicializar, mediante la cola pública", async () => {
    const initializing = deferred();
    mock.client.initialize.mockReturnValue(initializing.promise);
    mock.client.getDevices.mockResolvedValue([
      { deviceId: "SAVED-ID", name: "R88 C1BF" },
    ]);
    const resolving = ble.resolveDeviceId("saved-id");
    expect(mock.client.getDevices).not.toHaveBeenCalled();
    initializing.resolve();
    await expect(resolving).resolves.toBe("SAVED-ID");
    expect(mock.client.getDevices).toHaveBeenCalledWith(["saved-id"]);
    expect(mock.client.requestLEScan).not.toHaveBeenCalled();
  });

  it("el rescate limpia su timeout y no detiene una búsqueda posterior", async () => {
    const resolving = ble.resolveDeviceId("saved-id");
    await vi.advanceTimersByTimeAsync(0);
    const callback = mock.client.requestLEScan.mock.calls[0][1] as (
      result: ScanResult,
    ) => void;
    callback(band);
    await expect(resolving).resolves.toBe("saved-id");
    expect(mock.client.stopLEScan).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    await ble.startScan(vi.fn());
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mock.client.stopLEScan).toHaveBeenCalledTimes(1);
  });

  it("el timeout de un rescate reemplazado no cancela el escaneo nuevo", async () => {
    const resolving = ble.resolveDeviceId("saved-id");
    await vi.advanceTimersByTimeAsync(0);
    await ble.startScan(vi.fn());
    expect(mock.client.stopLEScan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(resolving).resolves.toBeNull();
    expect(mock.client.stopLEScan).toHaveBeenCalledTimes(1);
  });

  it("el rescate silencioso nunca pide encender Bluetooth si se apaga", async () => {
    mock.client.isEnabled
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    await expect(ble.resolveDeviceId("saved-id")).resolves.toBeNull();
    expect(mock.client.requestEnable).not.toHaveBeenCalled();
    expect(mock.client.requestLEScan).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("en iOS apagado informa bluetooth-off sin llamar requestEnable", async () => {
    mock.client.isEnabled.mockResolvedValue(false);
    await expect(ble.ensureBluetoothReady()).rejects.toMatchObject({
      code: "bluetooth-off",
    });
    expect(mock.client.requestEnable).not.toHaveBeenCalled();
  });

  it("comparte el diálogo Android de encendido entre llamadas concurrentes", async () => {
    mock.platform = "android";
    mock.client.isEnabled.mockResolvedValue(false);
    const enabling = deferred();
    mock.client.requestEnable.mockReturnValue(enabling.promise);
    const first = ble.ensureBluetoothReady();
    const second = ble.ensureBluetoothReady();
    await vi.advanceTimersByTimeAsync(0);
    expect(mock.client.requestEnable).toHaveBeenCalledTimes(1);
    mock.client.isEnabled.mockResolvedValue(true);
    enabling.resolve();
    await Promise.all([first, second]);
  });

  it("detiene el escaneo antes de conectar y reconecta sin diálogo", async () => {
    mock.platform = "android";
    await ble.startScan(vi.fn());
    await ble.connectDevice("saved-id", vi.fn(), { silent: true });

    expect(mock.client.stopLEScan).toHaveBeenCalledTimes(1);
    expect(mock.client.stopLEScan.mock.invocationCallOrder[0]).toBeLessThan(
      mock.client.connect.mock.invocationCallOrder[0],
    );
    expect(mock.client.requestEnable).not.toHaveBeenCalled();
    expect(mock.client.connect).toHaveBeenCalledWith(
      "saved-id",
      expect.any(Function),
      { timeout: 15_000 },
    );
  });
});
