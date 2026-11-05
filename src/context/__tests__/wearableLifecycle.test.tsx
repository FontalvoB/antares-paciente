import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@capacitor/app";
import * as ble from "../../devices/ble/ble-client";
import { searchWearableAccessories, supportsAccessoryDiscovery } from "../../devices/ble/accessory-discovery";
import {
  drainPendingNotifications,
  detachPendingNotifications,
  authorizeAccessory,
  startPersistentConnection,
  stopPersistentConnection,
} from "../../devices/ble/notification-journal";
import { loadSavedDevice, saveDevice } from "../../devices/device-store";
import { openSession } from "../../devices/registry";
import {
  createSampleSnapshot,
  loadSampleSnapshot,
  recordSampleSnapshot,
  updateSampleSnapshot,
} from "../../devices/sample-store";
import type { DeviceDescriptor, HealthSample, InfoSink, SampleSink } from "../../devices/types";
import { WearableProvider, useWearable } from "../WearableContext";
import type { WearableState } from "../WearableContext";

const native = vi.hoisted(() => ({
  platform: "android",
  listener: null as null | ((event: { isActive: boolean }) => void),
  radioListener: null as null | ((on: boolean, state?: "on" | "off" | "unknown") => void),
  app: {
    flow: "app",
    authLoading: false,
    user: { id: "patient-a", cedula: "", email: "" },
    connectWearable: vi.fn(),
    disconnectWearable: vi.fn(),
    showToast: vi.fn(),
  },
  translate: (key: string) => key,
}));

vi.mock("../AppContext", () => ({ useApp: () => native.app }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => native.translate }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => native.platform, isNativePlatform: () => true },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(async (_event: string, callback: typeof native.listener) => {
      native.listener = callback;
      return { remove: vi.fn(async () => undefined) };
    }),
    getState: vi.fn(async () => ({ isActive: true })),
  },
}));
vi.mock("../../devices/ble/ble-client", () => ({
  stopScan: vi.fn(async () => undefined),
  startScan: vi.fn(async () => undefined),
  listPairedDevices: vi.fn(async () => []),
  usesDeviceChooser: vi.fn(() => false),
  resolveDeviceId: vi.fn(async (deviceId: string) => deviceId),
  connectDevice: vi.fn(async () => undefined),
  disconnectDevice: vi.fn(async () => undefined),
  getDeviceServices: vi.fn(async () => []),
  watchBluetoothState: vi.fn(async () => async () => undefined),
  getBluetoothState: vi.fn(async () => "on"),
  getDeviceConnectionState: vi.fn(async (): Promise<boolean | null> => null),
  setNotificationFailureHandler: vi.fn(),
  setNotificationTap: vi.fn(),
  setBleDebug: vi.fn(),
}));
vi.mock("../../devices/ble/notification-journal", () => ({
  NOTIFICATION_GAP_EVENT: "wearable:journal-gap",
  authorizeAccessory: vi.fn(async () => ({ supported: true, authorized: true })),
  startPersistentConnection: vi.fn(async () => undefined),
  stopPersistentConnection: vi.fn(async () => undefined),
  drainPendingNotifications: vi.fn(async () => undefined),
  detachPendingNotifications: vi.fn(),
}));
vi.mock("../../devices/registry", () => ({ openSession: vi.fn() }));
vi.mock("../../devices/ble/accessory-discovery", () => ({
  supportsAccessoryDiscovery: vi.fn(async () => false),
  searchWearableAccessories: vi.fn(async (): Promise<DeviceDescriptor[]> => []),
}));
vi.mock("../../services/program/metrics-history-service", () => ({
  recordDeviceMetrics: vi.fn(async () => ({ date: "2026-11-03", codes: [], observedAt: "" })),
}));

const ACCOUNT = "patient-a";
const DEVICE: DeviceDescriptor = { deviceId: "ring-1", name: "R88 C1BF", kind: "ycbt" };
let wearable: WearableState;
const clients: QueryClient[] = [];

function reading(overrides: Partial<HealthSample> = {}): HealthSample {
  return { metric: "heart_rate", value: 72, unit: "bpm", ts: Date.now(), deviceId: DEVICE.deviceId, ...overrides };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function fakeSession(onStart?: (sample: SampleSink, info: InfoSink) => void) {
  const callbacks: { sample?: SampleSink; info?: InfoSink } = {};
  return {
    descriptor: DEVICE,
    callbacks,
    supportsMeasure: true,
    measureKinds: ["heart_rate" as const],
    start: vi.fn(async (sample: SampleSink, info: InfoSink) => {
      callbacks.sample = sample;
      callbacks.info = info;
      onStart?.(sample, info);
    }),
    stop: vi.fn(async (): Promise<void> => undefined),
    setAppActive: vi.fn(),
    syncHistory: vi.fn(async (): Promise<void> => undefined),
  };
}

function Harness() {
  wearable = useWearable();
  return <output>{wearable.phase}</output>;
}

function renderWearable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(queryClient);
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <WearableProvider><Harness /></WearableProvider>
    </QueryClientProvider>
  );
  const result = render(tree());
  return { ...result, rerenderApp: () => result.rerender(tree()) };
}

async function connect() {
  await act(async () => { await Promise.resolve(wearable.connect(DEVICE)); });
}

describe("WearableContext — reconexión y datos durables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    native.listener = null;
    vi.mocked(App.getState).mockResolvedValue({ isActive: true });
    native.radioListener = null;
    vi.mocked(ble.getBluetoothState).mockResolvedValue("on");
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(null);
    vi.mocked(ble.watchBluetoothState).mockImplementation(async (listener) => {
      native.radioListener = listener;
      return async () => undefined;
    });
    native.platform = "android";
    vi.mocked(supportsAccessoryDiscovery).mockResolvedValue(false);
    vi.mocked(searchWearableAccessories).mockResolvedValue([]);
    vi.mocked(ble.listPairedDevices).mockResolvedValue([]);
    vi.mocked(authorizeAccessory).mockResolvedValue({ supported: true, authorized: true });
    native.app = {
      flow: "app", authLoading: false,
      user: { id: ACCOUNT, cedula: "", email: "" },
      connectWearable: vi.fn(), disconnectWearable: vi.fn(), showToast: vi.fn(),
    };
    vi.mocked(ble.resolveDeviceId).mockImplementation(async (deviceId) => deviceId);
    vi.mocked(ble.connectDevice).mockResolvedValue(undefined);
    vi.mocked(startPersistentConnection).mockResolvedValue(undefined);
    vi.mocked(stopPersistentConnection).mockResolvedValue(undefined);
    vi.mocked(drainPendingNotifications).mockResolvedValue(undefined);
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
  });

  afterEach(async () => {
    cleanup();
    await act(async () => undefined);
    for (const client of clients.splice(0)) client.clear();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("apagar Bluetooth interrumpe el escaneo y bloquea búsqueda/conexión hasta encenderlo", async () => {
    renderWearable();
    await waitFor(() => expect(native.radioListener).toBeTruthy());
    await act(async () => { await wearable.scan(); });
    expect(wearable.phase).toBe("scanning");
    await act(async () => { native.radioListener?.(false, "off"); });
    expect(wearable.phase).toBe("error");
    expect(wearable.error).toBe("bluetooth-off");
    vi.mocked(ble.startScan).mockClear();
    await act(async () => { await wearable.scan(); await wearable.connect(DEVICE); });
    expect(ble.startScan).not.toHaveBeenCalled();
    expect(ble.connectDevice).not.toHaveBeenCalled();
    await act(async () => { native.radioListener?.(true, "on"); });
    expect(wearable.error).toBeNull();
    await act(async () => { await wearable.scan(); });
    expect(ble.startScan).toHaveBeenCalledOnce();
  });

  it("volver a la app con Bluetooth apagado muestra Activa Bluetooth y no reintenta GATT", async () => {
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    renderWearable();
    await connect();
    vi.mocked(ble.connectDevice).mockClear();
    vi.mocked(ble.getBluetoothState).mockResolvedValue("off");
    await act(async () => { native.listener?.({ isActive: false }); native.listener?.({ isActive: true }); });
    expect(wearable.error).toBe("bluetooth-off");
    expect(wearable.phase).toBe("error");
    expect(ble.connectDevice).not.toHaveBeenCalled();
    expect(loadSavedDevice(ACCOUNT)?.deviceId).toBe(DEVICE.deviceId);
    vi.useFakeTimers();
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
      expect(ble.connectDevice).not.toHaveBeenCalled();
      vi.mocked(ble.getBluetoothState).mockResolvedValue("on");
      await act(async () => { native.radioListener?.(true, "on"); await vi.advanceTimersByTimeAsync(0); });
      expect(ble.connectDevice).toHaveBeenCalledOnce();
      expect(wearable.phase).toBe("connected");
      expect(wearable.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("un toque sin cuenta identificada muestra un error y no abre captura sin dueño", async () => {
    native.app.user = { id: "", cedula: "", email: "" };
    renderWearable();
    await connect();
    expect(wearable.phase).toBe("error");
    expect(wearable.error).toBe("session-unavailable");
    expect(ble.connectDevice).not.toHaveBeenCalled();
    expect(startPersistentConnection).not.toHaveBeenCalled();
  });

  it("agrega un R88 autorizado sin abrir GATT ni iniciar captura", async () => {
    vi.mocked(supportsAccessoryDiscovery).mockResolvedValue(true);
    vi.mocked(searchWearableAccessories).mockResolvedValue([DEVICE]);
    renderWearable();
    await waitFor(() => expect(wearable.accessoryDiscoverySupported).toBe(true));
    await act(async () => { await wearable.scan(); });
    expect(wearable.devices).toContainEqual(DEVICE);
    expect(wearable.addingAccessory).toBe(false);
    expect(ble.connectDevice).not.toHaveBeenCalled();
    expect(startPersistentConnection).not.toHaveBeenCalled();
  });

  it("cancelar el alta deja disponibles el selector y la conexión", async () => {
    vi.mocked(supportsAccessoryDiscovery).mockResolvedValue(true);
    renderWearable();
    await waitFor(() => expect(wearable.accessoryDiscoverySupported).toBe(true));
    await act(async () => { await wearable.scan(); });
    expect(wearable.phase).toBe("idle");
    expect(wearable.addingAccessory).toBe(false);
    expect(wearable.error).toBeNull();
    expect(ble.connectDevice).not.toHaveBeenCalled();
  });

  it("buscar conserva el H59 autorizado al cerrar el selector sin otro wearable", async () => {
    vi.mocked(supportsAccessoryDiscovery).mockResolvedValue(true);
    const band: DeviceDescriptor = { deviceId: "band-1", name: "H59_E206", kind: "colmi", paired: true };
    vi.mocked(ble.listPairedDevices).mockResolvedValue([band]);
    renderWearable();
    await waitFor(() => expect(wearable.accessoryDiscoverySupported).toBe(true));
    await act(async () => { await wearable.scan(); });
    expect(wearable.devices).toContainEqual(band);
    expect(wearable.hasScanned).toBe(true);
    expect(wearable.phase).toBe("idle");
    expect(wearable.error).toBeNull();
    expect(ble.startScan).not.toHaveBeenCalled();
    expect(ble.connectDevice).not.toHaveBeenCalled();
  });

  it("la búsqueda Android conserva el escaneo BLE existente", async () => {
    renderWearable();
    await act(async () => { await wearable.scan(); });
    expect(ble.startScan).toHaveBeenCalledOnce();
    expect(ble.startScan).toHaveBeenCalledWith(expect.any(Function), { includeUnnamed: true });
    expect(searchWearableAccessories).not.toHaveBeenCalled();
  });

  it("no incorpora una autorización que termina en otra cuenta", async () => {
    vi.mocked(supportsAccessoryDiscovery).mockResolvedValue(true);
    let finish!: (devices: DeviceDescriptor[]) => void;
    vi.mocked(searchWearableAccessories).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = renderWearable();
    await waitFor(() => expect(wearable.accessoryDiscoverySupported).toBe(true));
    let pending!: Promise<void>;
    await act(async () => { pending = wearable.scan(); });
    native.app.user = { id: "other-patient", cedula: "", email: "" };
    view.rerenderApp();
    await act(async () => { finish([DEVICE]); await pending; });
    expect(wearable.devices).not.toContainEqual(DEVICE);
    expect(ble.connectDevice).not.toHaveBeenCalled();
  });

  it("rechaza televisores y auriculares antes de cualquier autorización o GATT", async () => {
    renderWearable();
    for (const name of ["Living Room TV", "Headphones", "Smart Ring"]) {
      await act(async () => { await Promise.resolve(wearable.connect({ deviceId: name, name, kind: "unknown" })); });
    }
    expect(wearable.error).toBe("unsupported-device");
    expect(authorizeAccessory).not.toHaveBeenCalled();
    expect(startPersistentConnection).not.toHaveBeenCalled();
    expect(ble.connectDevice).not.toHaveBeenCalled();
  });

  it("muestra la caché guardada antes de intentar reconectar", async () => {
    saveDevice(DEVICE, ACCOUNT);
    let snapshot = recordSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE.deviceId), reading());
    snapshot = updateSampleSnapshot(snapshot, { info: { battery: 80 }, lastSyncAt: Date.now() - 5000 });
    const pending = deferred();
    vi.mocked(ble.connectDevice).mockReturnValue(pending.promise);
    renderWearable();
    expect(wearable.samples.heart_rate?.value).toBe(72);
    expect(wearable.info.battery).toBe(80);
    expect(wearable.lastSyncAt).toBe(snapshot.lastSyncAt);
    expect(ble.connectDevice).not.toHaveBeenCalled();
    await waitFor(() => expect(ble.connectDevice).toHaveBeenCalledOnce());
    expect(wearable.samples.heart_rate?.value).toBe(72);
    await act(async () => { pending.resolve(); });
  });

  it("la conexión manual en iOS autoriza el accesorio antes de iniciar captura", async () => {
    native.platform = "ios";
    renderWearable();
    await connect();
    expect(authorizeAccessory).toHaveBeenCalledExactlyOnceWith(DEVICE);
    expect(vi.mocked(authorizeAccessory).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(startPersistentConnection).mock.invocationCallOrder[0],
    );
    expect(wearable.phase).toBe("connected");
  });

  it("cancelar el permiso del accesorio no abre GATT ni comienza a capturar", async () => {
    native.platform = "ios";
    vi.mocked(authorizeAccessory).mockResolvedValue({ supported: true, authorized: false });
    renderWearable();
    await connect();
    expect(startPersistentConnection).not.toHaveBeenCalled();
    expect(ble.connectDevice).not.toHaveBeenCalled();
    expect(wearable.phase).toBe("idle");
    expect(wearable.error).toBeNull();
  });

  it("reconectar automáticamente en iOS no abre el diálogo de autorización", async () => {
    native.platform = "ios";
    saveDevice(DEVICE, ACCOUNT);
    renderWearable();
    await waitFor(() => expect(wearable.phase).toBe("connected"));
    expect(authorizeAccessory).not.toHaveBeenCalled();
    expect(startPersistentConnection).toHaveBeenCalledWith(DEVICE.deviceId, ACCOUNT, true);
  });

  it("las lecturas emitidas durante start sobreviven al estado conectado", async () => {
    const sample = reading();
    const session = fakeSession((emit, info) => { emit(sample); info({ battery: 90 }); });
    vi.mocked(openSession).mockResolvedValue(session);
    renderWearable();
    await connect();
    expect(wearable.phase).toBe("connected");
    expect(wearable.samples.heart_rate).toEqual(sample);
    expect(wearable.info.battery).toBe(90);
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.latest.heart_rate).toEqual(sample);
    expect(startPersistentConnection).toHaveBeenCalledWith(DEVICE.deviceId, ACCOUNT, false);
  });

  it("un doble toque comparte un único handshake GATT", async () => {
    const pending = deferred();
    vi.mocked(ble.connectDevice).mockReturnValue(pending.promise);
    renderWearable();
    let first: unknown;
    let second: unknown;
    await act(async () => {
      first = wearable.connect(DEVICE);
      second = wearable.connect(DEVICE);
    });
    expect(first).toBe(second);
    expect(ble.connectDevice).toHaveBeenCalledOnce();
    expect(startPersistentConnection).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve(); await Promise.resolve(first); });
    expect(openSession).toHaveBeenCalledOnce();
    expect(wearable.phase).toBe("connected");
  });

  it("una caída inesperada conserva tarjetas, muestras persistidas e identidad guardada", async () => {
    const sample = reading();
    const session = fakeSession((emit) => emit(sample));
    vi.mocked(openSession).mockResolvedValue(session);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    const pending = deferred();
    vi.mocked(ble.connectDevice).mockReturnValue(pending.promise);
    await act(async () => { disconnected(); });
    expect(wearable.samples.heart_rate).toEqual(sample);
    expect(wearable.savedDevice?.deviceId).toBe(DEVICE.deviceId);
    expect(loadSavedDevice(ACCOUNT)?.deviceId).toBe(DEVICE.deviceId);
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.latest.heart_rate).toEqual(sample);
    expect(session.stop).toHaveBeenCalled();
    await act(async () => { pending.resolve(); });
  });

  it("un fallo transitorio al reconectar no olvida el dispositivo ni su lectura", async () => {
    const sample = reading();
    saveDevice(DEVICE, ACCOUNT);
    recordSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE.deviceId), sample);
    vi.mocked(ble.connectDevice).mockRejectedValue(new Error("temporarily out of range"));
    renderWearable();
    await act(async () => { wearable.reconnect(); });
    await waitFor(() => expect(wearable.phase).toBe("idle"));
    expect(ble.connectDevice).toHaveBeenCalled();
    expect(wearable.savedDevice?.deviceId).toBe(DEVICE.deviceId);
    expect(loadSavedDevice(ACCOUNT)?.deviceId).toBe(DEVICE.deviceId);
    expect(wearable.samples.heart_rate).toEqual(sample);
    expect(wearable.error).toBeNull();
  });

  it.each(["logout", "switch"] as const)("%s limpia los datos visibles, corta captura e ignora callbacks tardíos", async (action) => {
    const sample = reading();
    const session = fakeSession((emit) => emit(sample));
    vi.mocked(openSession).mockResolvedValue(session);
    const view = renderWearable();
    await connect();
    expect(wearable.samples.heart_rate).toEqual(sample);
    native.app = {
      ...native.app,
      flow: action === "logout" ? "login" : "app",
      user: { id: action === "logout" ? "" : "patient-b", cedula: "", email: "" },
    };
    await act(async () => { view.rerenderApp(); });
    await waitFor(() => expect(stopPersistentConnection).toHaveBeenCalledWith(DEVICE.deviceId, true));
    expect(session.stop).toHaveBeenCalled();
    expect(wearable.samples).toEqual({});
    expect(wearable.info).toEqual({});
    expect(wearable.savedDevice).toBeNull();
    expect(wearable.device).toBeNull();
    await act(async () => {
      session.callbacks.sample?.(reading({ value: 99, ts: Date.now() + 1 }));
      session.callbacks.info?.({ battery: 4 });
    });
    expect(wearable.samples).toEqual({});
    expect(wearable.info).toEqual({});
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.latest.heart_rate).toEqual(sample);
    expect(loadSampleSnapshot("patient-b", DEVICE.deviceId)).toBeNull();
  });

  it("no arrastra un ping fallido previo al bloqueo como fallo al despertar", async () => {
    const session = { ...fakeSession(), requestInfo: vi.fn() };
    vi.mocked(openSession).mockResolvedValue(session);
    vi.useFakeTimers();
    try {
      renderWearable();
      await connect();
      await act(async () => { await vi.advanceTimersByTimeAsync(150_000); });
      expect(session.requestInfo).toHaveBeenCalledTimes(1);
      await act(async () => { native.listener?.({ isActive: false }); });
      await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
      await act(async () => { native.listener?.({ isActive: true }); });
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(session.stop).not.toHaveBeenCalled();
      expect(session.requestInfo).toHaveBeenCalledTimes(2);
      expect(wearable.phase).toBe("connected");
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(session.stop).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it("un GATT iOS conectado no impide recuperar un protocolo que no responde", async () => {
    native.platform = "ios";
    const session = { ...fakeSession(), requestInfo: vi.fn() };
    vi.mocked(openSession).mockResolvedValue(session);
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(true);
    vi.useFakeTimers();
    try {
      renderWearable();
      await connect();
      await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
      expect(session.requestInfo).toHaveBeenCalledTimes(1);
      expect(session.stop).toHaveBeenCalledTimes(1);
      expect(ble.getDeviceConnectionState).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("conserva la sesión iOS si llega una caída antigua después de la recuperación nativa", async () => {
    native.platform = "ios";
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(true);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { native.listener?.({ isActive: false }); });
    await act(async () => { disconnected(); });
    expect(ble.getDeviceConnectionState).toHaveBeenCalledWith(DEVICE.deviceId);
    expect(wearable.phase).toBe("connected");
    expect(session.stop).not.toHaveBeenCalled();
    expect(ble.disconnectDevice).not.toHaveBeenCalled();
    await act(async () => { native.listener?.({ isActive: true }); });
    expect(openSession).toHaveBeenCalledTimes(1);
    expect(session.start).toHaveBeenCalledTimes(1);
    expect(wearable.phase).toBe("connected");
  });

  it("una respuesta inicial tardía no revierte el estado de bloqueo más reciente", async () => {
    let resolve!: (value: { isActive: boolean }) => void;
    vi.mocked(App.getState).mockReturnValue(new Promise<{ isActive: boolean }>((done) => { resolve = done; }));
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    renderWearable();
    await connect();
    await act(async () => { native.listener?.({ isActive: false }); });
    await act(async () => { resolve({ isActive: true }); });
    expect(session.setAppActive).toHaveBeenLastCalledWith(false);
  });

  it("apagar Bluetooth cancela una recuperación nativa pendiente", async () => {
    native.platform = "ios";
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(false);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { native.listener?.({ isActive: false }); });
    await act(async () => { disconnected(); });
    await act(async () => { native.radioListener?.(false, "off"); });
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(wearable.phase).toBe("error");
    expect(wearable.error).toBe("bluetooth-off");
    expect(ble.connectDevice).toHaveBeenCalledTimes(1);
  });

  it("conserva el driver mientras iOS recupera el enlace en background y lo adopta al volver", async () => {
    native.platform = "ios";
    const session = { ...fakeSession(), requestInfo: vi.fn() };
    vi.mocked(openSession).mockResolvedValue(session);
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(false);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { native.listener?.({ isActive: false }); });
    await act(async () => { disconnected(); });
    expect(wearable.phase).toBe("connecting");
    expect(session.stop).not.toHaveBeenCalled();
    expect(ble.disconnectDevice).not.toHaveBeenCalled();
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(true);
    await act(async () => { native.listener?.({ isActive: true }); });
    expect(wearable.phase).toBe("connected");
    expect(openSession).toHaveBeenCalledTimes(1);
    expect(session.start).toHaveBeenCalledTimes(1);
    expect(session.requestInfo).toHaveBeenCalled();
    expect(session.setAppActive).toHaveBeenLastCalledWith(true);
  });

  it.each([false, null])("si iOS no recuperó el enlace en background (%s), reconecta al volver", async (connected) => {
    native.platform = "ios";
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(false);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { native.listener?.({ isActive: false }); });
    await act(async () => { disconnected(); });
    expect(session.stop).not.toHaveBeenCalled();
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(connected);
    await act(async () => { native.listener?.({ isActive: true }); });
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(ble.disconnectDevice).toHaveBeenCalledWith(DEVICE.deviceId);
  });

  it("una recuperación nativa pendiente no puede revertir Desconectar del usuario", async () => {
    native.platform = "ios";
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(false);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { native.listener?.({ isActive: false }); });
    await act(async () => { disconnected(); });
    let resolve!: (value: boolean) => void;
    vi.mocked(ble.getDeviceConnectionState).mockReturnValue(new Promise<boolean>((done) => { resolve = done; }));
    await act(async () => { native.listener?.({ isActive: true }); });
    await act(async () => { wearable.disconnect(); });
    await act(async () => { resolve(true); });
    expect(wearable.phase).toBe("idle");
    expect(wearable.savedDevice).toBeNull();
    expect(session.start).toHaveBeenCalledTimes(1);
  });

  it.each([false, null])("una caída iOS sin vínculo nativo confirmado (%s) conserva la recuperación habitual", async (connected) => {
    native.platform = "ios";
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    vi.mocked(ble.getDeviceConnectionState).mockResolvedValue(connected);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { disconnected(); });
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(ble.disconnectDevice).toHaveBeenCalledWith(DEVICE.deviceId);
    expect(native.app.disconnectWearable).toHaveBeenCalledTimes(1);
  });

  it("una comprobación nativa tardía no restaura una sesión desconectada por el usuario", async () => {
    native.platform = "ios";
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    let resolve!: (value: boolean) => void;
    vi.mocked(ble.getDeviceConnectionState).mockReturnValue(new Promise<boolean>((done) => { resolve = done; }));
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { disconnected(); });
    await act(async () => { wearable.disconnect(); });
    await act(async () => { resolve(true); });
    expect(wearable.phase).toBe("idle");
    expect(wearable.savedDevice).toBeNull();
    expect(session.start).toHaveBeenCalledTimes(1);
    expect(native.app.connectWearable).toHaveBeenCalledTimes(1);
  });

  it("al volver al foreground drena el journal antes del volcado de historial", async () => {
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    renderWearable();
    await connect();
    await act(async () => undefined);
    session.syncHistory.mockClear();
    const pending = deferred();
    const events: string[] = [];
    vi.mocked(drainPendingNotifications).mockImplementation(async () => {
      events.push("drain");
      await pending.promise;
      events.push("drained");
    });
    session.syncHistory.mockImplementation(async () => { events.push("sync"); });
    await act(async () => { native.listener?.({ isActive: false }); });
    expect(session.setAppActive).toHaveBeenLastCalledWith(false);
    await act(async () => { native.listener?.({ isActive: true }); });
    expect(drainPendingNotifications).toHaveBeenCalledWith(DEVICE.deviceId);
    expect(session.syncHistory).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(); });
    expect(events).toEqual(["drain", "drained", "sync"]);
    expect(session.setAppActive).toHaveBeenLastCalledWith(true);
  });

  it("conserva los registros al desmontar y reabrir el provider sin esperar BLE", async () => {
    const sample = reading({ metric: "steps", value: 345, unit: "steps", agg: "sum" });
    const session = fakeSession((emit) => emit(sample));
    vi.mocked(openSession).mockResolvedValue(session);
    const first = renderWearable();
    await connect();
    expect(wearable.today.steps).toBe(345);
    await act(async () => { first.unmount(); });
    expect(session.stop).not.toHaveBeenCalled();
    expect(stopPersistentConnection).not.toHaveBeenCalled();
    expect(detachPendingNotifications).toHaveBeenCalledWith(DEVICE.deviceId);
    const pending = deferred();
    vi.mocked(ble.connectDevice).mockReturnValue(pending.promise);
    renderWearable();
    expect(wearable.samples.steps).toEqual(sample);
    expect(wearable.today.steps).toBe(345);
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.history).toContainEqual(sample);
    await act(async () => { pending.resolve(); });
  });

  it("pasar a segundo plano conserva el enlace y persiste nuevas notificaciones", async () => {
    const session = fakeSession();
    vi.mocked(openSession).mockResolvedValue(session);
    renderWearable();
    await connect();
    vi.mocked(ble.disconnectDevice).mockClear();
    vi.mocked(stopPersistentConnection).mockClear();
    await act(async () => { native.listener?.({ isActive: false }); });
    const sample = reading({ value: 81 });
    await act(async () => { session.callbacks.sample?.(sample); });
    expect(wearable.phase).toBe("connected");
    expect(session.stop).not.toHaveBeenCalled();
    expect(ble.disconnectDevice).not.toHaveBeenCalled();
    expect(stopPersistentConnection).not.toHaveBeenCalled();
    expect(wearable.samples.heart_rate).toEqual(sample);
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.latest.heart_rate).toEqual(sample);
  });

  it("volver después de medianoche no muestra los pasos de ayer como los de hoy", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 3, 23, 50));
      const session = fakeSession((emit) => emit(reading({ metric: "steps", value: 1200, unit: "count" })));
      vi.mocked(openSession).mockResolvedValue(session);
      renderWearable();
      await connect();
      expect(wearable.today.steps).toBe(1200);
      await act(async () => { native.listener?.({ isActive: false }); });
      vi.setSystemTime(new Date(2026, 10, 4, 0, 10));
      await act(async () => { native.listener?.({ isActive: true }); });
      expect(wearable.today.steps).toBeNull();
      const snapshot = loadSampleSnapshot(ACCOUNT, DEVICE.deviceId);
      expect(snapshot?.days["2026-11-03"].counters.steps).toBe(1200);
      expect(snapshot?.day.date).toBe("2026-11-04");
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("un fallo de almacenamiento no confirma ni reemplaza la última lectura durable", async () => {
    const previous = reading();
    const session = fakeSession((emit) => emit(previous));
    vi.mocked(openSession).mockResolvedValue(session);
    renderWearable();
    await connect();
    const failingWrite = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage quota exhausted");
    });
    const incoming = reading({ value: 99, ts: previous.ts + 1 });
    expect(() => session.callbacks.sample?.(incoming)).toThrow("storage quota exhausted");
    expect(wearable.samples.heart_rate).toEqual(previous);
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.latest.heart_rate).toEqual(previous);
    failingWrite.mockRestore();
    await act(async () => { session.callbacks.sample?.(incoming); });
    expect(wearable.samples.heart_rate).toEqual(incoming);
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.latest.heart_rate).toEqual(incoming);
  });

  it("cerrar sesión durante el handshake impide publicar datos o conexión tardíos", async () => {
    const pending = deferred();
    const session = fakeSession();
    session.start.mockImplementation(async (emit, info) => {
      session.callbacks.sample = emit;
      session.callbacks.info = info;
      await pending.promise;
      emit(reading({ value: 98 }));
      info({ battery: 10 });
    });
    vi.mocked(openSession).mockResolvedValue(session);
    const view = renderWearable();
    let attempt: unknown;
    await act(async () => { attempt = wearable.connect(DEVICE); });
    expect(wearable.phase).toBe("connecting");
    expect(session.start).toHaveBeenCalledOnce();
    native.app = { ...native.app, flow: "login", user: { id: "", cedula: "", email: "" } };
    await act(async () => { view.rerenderApp(); });
    await waitFor(() => expect(stopPersistentConnection).toHaveBeenCalledWith(DEVICE.deviceId, true));
    await act(async () => { pending.resolve(); await Promise.resolve(attempt); });
    expect(native.app.connectWearable).not.toHaveBeenCalled();
    expect(wearable.samples).toEqual({});
    expect(wearable.info).toEqual({});
    expect(wearable.phase).toBe("idle");
    expect(loadSavedDevice(ACCOUNT)).toBeNull();
    expect(loadSampleSnapshot(ACCOUNT, DEVICE.deviceId)?.latest.heart_rate).toBeUndefined();
  });

  it("desconectar durante connect cancela el intento aunque el GATT termine después", async () => {
    const pending = deferred();
    vi.mocked(ble.connectDevice).mockReturnValue(pending.promise);
    renderWearable();
    let attempt: unknown;
    await act(async () => { attempt = wearable.connect(DEVICE); });
    expect(ble.connectDevice).toHaveBeenCalledOnce();
    await act(async () => { wearable.disconnect(); });
    await waitFor(() => expect(stopPersistentConnection).toHaveBeenCalledWith(DEVICE.deviceId, true));
    await act(async () => { pending.resolve(); await Promise.resolve(attempt); });
    expect(openSession).not.toHaveBeenCalled();
    expect(native.app.connectWearable).not.toHaveBeenCalled();
    expect(wearable.phase).toBe("idle");
    expect(wearable.savedDevice).toBeNull();
    expect(loadSavedDevice(ACCOUNT)).toBeNull();
  });

  it("un sync de una sesión anterior no libera el sync que comenzó después de reconectar", async () => {
    const firstPending = deferred();
    const secondPending = deferred();
    const firstSession = fakeSession();
    const secondSession = fakeSession();
    firstSession.syncHistory.mockReturnValue(firstPending.promise);
    secondSession.syncHistory.mockReturnValue(secondPending.promise);
    vi.mocked(openSession).mockResolvedValueOnce(firstSession).mockResolvedValue(secondSession);
    renderWearable();
    await connect();
    expect(wearable.syncing).toBe(true);
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    await act(async () => { disconnected(); });
    await connect();
    expect(secondSession.syncHistory).toHaveBeenCalledOnce();
    expect(wearable.syncing).toBe(true);
    await act(async () => { firstPending.resolve(); });
    const syncingAfterOldCompletion = wearable.syncing;
    await act(async () => { secondPending.resolve(); });
    expect(syncingAfterOldCompletion).toBe(true);
    expect(wearable.syncing).toBe(false);
  });

  it("espera a cerrar la sesión anterior antes de abrir otro GATT", async () => {
    const closing = deferred();
    const oldSession = fakeSession();
    const newSession = fakeSession();
    oldSession.stop.mockReturnValue(closing.promise);
    vi.mocked(openSession).mockResolvedValueOnce(oldSession).mockResolvedValue(newSession);
    renderWearable();
    await connect();
    const disconnected = vi.mocked(ble.connectDevice).mock.calls[0][1];
    let reconnecting: unknown;
    await act(async () => {
      disconnected();
      reconnecting = wearable.connect(DEVICE);
    });
    expect(oldSession.stop).toHaveBeenCalledOnce();
    expect(ble.connectDevice).toHaveBeenCalledOnce();
    expect(newSession.start).not.toHaveBeenCalled();
    await act(async () => { closing.resolve(); await Promise.resolve(reconnecting); });
    expect(ble.connectDevice).toHaveBeenCalledTimes(2);
    expect(newSession.start).toHaveBeenCalledOnce();
    expect(wearable.phase).toBe("connected");
  });
});
