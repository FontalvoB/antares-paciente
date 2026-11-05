import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationJournal,
  type StoredNotification,
} from "../ble/notification-journal";
import { notificationReceivedAt } from "../ble/notification-clock";

const NOW = new Date("2026-11-03T15:00:00Z").getTime();
const DEVICE = "band-a";
const OWNER = "patient-a";
const SERVICE = "FFFF-0001";
const CHANNEL = "FFFF-0002";
let nextSequence = 0;

type Batch = { notifications: StoredNotification[]; droppedCount: number };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function entry(id: string, overrides: Partial<StoredNotification> = {}): StoredNotification {
  return {
    id,
    sequence: String(++nextSequence),
    deviceId: DEVICE,
    service: SERVICE,
    characteristic: CHANNEL,
    value: "48",
    receivedAt: NOW - 60_000,
    ...overrides,
  };
}

/** Cola nativa no destructiva: solo un ACK correcto elimina sus filas. */
function setup() {
  const rows = new Map<string, StoredNotification[]>();
  const scope = (deviceId: string, ownerId: string) => JSON.stringify([deviceId, ownerId]);
  const enqueue = (deviceId: string, ownerId: string, ...notifications: StoredNotification[]) => {
    const key = scope(deviceId, ownerId);
    rows.set(key, [...(rows.get(key) ?? []), ...notifications]);
  };
  const pending = (deviceId = DEVICE, ownerId = OWNER) => rows.get(scope(deviceId, ownerId)) ?? [];
  const bridge = {
    startBackground: vi.fn(async (_options: { deviceId: string; ownerId: string }): Promise<void> => undefined),
    stopBackground: vi.fn(async (_options: { deviceId: string; forget?: boolean }): Promise<void> => undefined),
    getPendingNotifications: vi.fn(async (options: {
      deviceId: string; ownerId: string; limit: number; afterSequence?: string;
    }): Promise<Batch> => {
      const notifications = pending(options.deviceId, options.ownerId);
      const after = options.afterSequence === undefined ? notifications :
        notifications.filter((notification) => BigInt(notification.sequence!) > BigInt(options.afterSequence!));
      return { notifications: after.slice(0, options.limit), droppedCount: 0 };
    }),
    ackNotifications: vi.fn(async (options: { deviceId: string; ownerId: string; ids: string[] }) => {
      const acknowledged = new Set(options.ids);
      rows.set(scope(options.deviceId, options.ownerId),
        pending(options.deviceId, options.ownerId).filter((notification) => !acknowledged.has(notification.id)));
    }),
  };
  return { bridge, journal: new NotificationJournal(bridge), enqueue, pending };
}

describe("NotificationJournal — entrega durable", () => {
  beforeEach(() => {
    nextSequence = 0;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("las señales paralelas comparten un consumidor y no duplican la notificación", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    const fetched = deferred<Batch>();
    bridge.getPendingNotifications.mockReturnValueOnce(fetched.promise);
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, entry("1"));

    const first = journal.drain(DEVICE);
    const second = journal.drain(DEVICE);
    expect(second).toBe(first);
    fetched.resolve({ notifications: [...pending()], droppedCount: 0 });
    await Promise.all([first, second]);

    expect(received).toHaveBeenCalledExactlyOnceWith(Uint8Array.of(0x48));
    expect(bridge.ackNotifications).toHaveBeenCalledTimes(1);
    expect(pending()).toEqual([]);
  });

  it("mantiene los fragmentos sin ACK y no los repite hasta completar su trama", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn((bytes: Uint8Array) => bytes[0] === 2);
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, entry("first", { value: "01" }));
    await journal.drain(DEVICE);
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledTimes(1);
    expect(bridge.ackNotifications).not.toHaveBeenCalled();
    expect(pending().map((notification) => notification.id)).toEqual(["first"]);

    enqueue(DEVICE, OWNER, entry("last", { value: "02" }));
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledTimes(2);
    expect(bridge.ackNotifications).toHaveBeenCalledExactlyOnceWith({
      deviceId: DEVICE, ownerId: OWNER, ids: ["first", "last"],
    });
    expect(pending()).toEqual([]);
  });

  it("el ACK de otro canal no descarta una trama todavía incompleta", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const fragmented = vi.fn((bytes: Uint8Array) => bytes[0] === 2);
    const complete = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, fragmented);
    journal.register(DEVICE, SERVICE, "other-channel", complete);
    enqueue(DEVICE, OWNER,
      entry("partial", { value: "01" }),
      entry("other", { characteristic: "other-channel", value: "03" }));
    await journal.drain(DEVICE);
    expect(bridge.ackNotifications).toHaveBeenLastCalledWith({
      deviceId: DEVICE, ownerId: OWNER, ids: ["other"],
    });
    expect(pending().map((notification) => notification.id)).toEqual(["partial"]);

    enqueue(DEVICE, OWNER, entry("tail", { value: "02" }));
    await journal.drain(DEVICE);
    expect(fragmented).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(bridge.ackNotifications).toHaveBeenLastCalledWith({
      deviceId: DEVICE, ownerId: OWNER, ids: ["partial", "tail"],
    });
  });

  it("expone la hora original solo durante el callback y normaliza UUID/hex", async () => {
    const { journal, enqueue } = setup();
    await journal.start(DEVICE, OWNER);
    const times: number[] = [];
    const bytes: number[][] = [];
    journal.register(DEVICE, "ffff0001", "ffff0002", (value) => {
      times.push(notificationReceivedAt());
      bytes.push([...value]);
    });
    enqueue(DEVICE, OWNER,
      entry("1", { value: "0a FF", receivedAt: NOW - 120_000 }),
      entry("2", { value: "48", receivedAt: NOW - 60_000 }));
    expect(notificationReceivedAt()).toBe(NOW);
    await journal.drain(DEVICE);
    expect(times).toEqual([NOW - 120_000, NOW - 60_000]);
    expect(bytes).toEqual([[0x0a, 0xff], [0x48]]);
    expect(notificationReceivedAt()).toBe(NOW);
  });

  it("si persistir falla, conserva toda la trama para el replay y restaura el reloj", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    let fail = true;
    const received = vi.fn((bytes: Uint8Array) => {
      if (bytes[0] === 1) return false;
      if (fail) throw new Error("disk full");
      return true;
    });
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, entry("first", { value: "01" }), entry("last", { value: "02" }));
    await expect(journal.drain(DEVICE)).rejects.toThrow("disk full");
    expect(notificationReceivedAt()).toBe(NOW);
    expect(bridge.ackNotifications).not.toHaveBeenCalled();
    expect(pending()).toHaveLength(2);

    fail = false;
    await journal.drain(DEVICE);
    expect(received.mock.calls.map(([bytes]) => [...bytes])).toEqual([[1], [2], [1], [2]]);
    expect(bridge.ackNotifications).toHaveBeenCalledExactlyOnceWith({
      deviceId: DEVICE, ownerId: OWNER, ids: ["first", "last"],
    });
    expect(pending()).toEqual([]);
  });

  it("reintenta un ACK nativo fallido sin alimentar de nuevo el decodificador", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, entry("1"));
    bridge.ackNotifications.mockRejectedValueOnce(new Error("native write failed"));
    await expect(journal.drain(DEVICE)).rejects.toThrow("native write failed");
    expect(pending()).toHaveLength(1);
    expect(received).toHaveBeenCalledTimes(1);

    await journal.drain(DEVICE);
    expect(bridge.ackNotifications).toHaveBeenCalledTimes(2);
    expect(received).toHaveBeenCalledTimes(1);
    expect(pending()).toEqual([]);
  });

  it("un canal sin consumidor permanece pendiente hasta que se suscriba su driver", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    enqueue(DEVICE, OWNER, entry("1"));
    await journal.drain(DEVICE);
    expect(bridge.ackNotifications).not.toHaveBeenCalled();
    expect(pending()).toHaveLength(1);

    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledTimes(1);
    expect(pending()).toEqual([]);
  });

  it("un inicio nativo tardío no recupera la propiedad después de detener la captura", async () => {
    const { bridge, journal } = setup();
    const started = deferred<void>();
    bridge.startBackground.mockReturnValueOnce(started.promise);
    const starting = journal.start(DEVICE, OWNER);
    await Promise.resolve();
    const stopping = journal.stop(DEVICE, true);
    expect(journal.owns(DEVICE)).toBe(false);

    started.resolve(undefined);
    await Promise.all([starting, stopping]);
    expect(journal.owns(DEVICE)).toBe(false);
    expect(bridge.stopBackground).toHaveBeenCalledExactlyOnceWith({ deviceId: DEVICE, forget: true });
    expect(() => journal.register(DEVICE, SERVICE, CHANNEL, vi.fn())).toThrow();
  });

  it("ordena los cambios de dueño aunque el inicio del propietario anterior tarde", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    const ownerB = "patient-b";
    const firstStarted = deferred<void>();
    bridge.startBackground.mockReturnValueOnce(firstStarted.promise);
    const first = journal.start(DEVICE, OWNER);
    await Promise.resolve();
    const second = journal.start(DEVICE, ownerB);
    await Promise.resolve();
    await Promise.resolve();
    firstStarted.resolve(undefined);
    await Promise.all([first, second]);

    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, entry("old", { value: "01" }));
    enqueue(DEVICE, ownerB, entry("new", { value: "02" }));
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledExactlyOnceWith(Uint8Array.of(2));
    expect(pending(DEVICE, OWNER)).toHaveLength(1);
    expect(bridge.getPendingNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ ownerId: ownerB }));
  });

  it("invalida la entrega anterior desde que comienza un cambio de propietario", async () => {
    const { bridge, journal } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    const fetched = deferred<Batch>();
    bridge.getPendingNotifications.mockReturnValueOnce(fetched.promise);
    const draining = journal.drain(DEVICE);
    await Promise.resolve();
    const started = deferred<void>();
    bridge.startBackground.mockReturnValueOnce(started.promise);
    const changingOwner = journal.start(DEVICE, "patient-b");

    fetched.resolve({ notifications: [entry("old")], droppedCount: 0 });
    await draining;
    started.resolve(undefined);
    await changingOwner;
    expect(received).not.toHaveBeenCalled();
    expect(bridge.ackNotifications).not.toHaveBeenCalled();
  });

  it.each([OWNER, "patient-b"])("una respuesta vieja después de stop/start no llega al propietario %s", async (nextOwner) => {
    const { bridge, journal, enqueue } = setup();
    const fetched = deferred<Batch>();
    bridge.getPendingNotifications.mockReturnValueOnce(fetched.promise);
    await journal.start(DEVICE, OWNER);
    const oldReceived = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, oldReceived);
    const draining = journal.drain(DEVICE);
    await Promise.resolve();
    expect(bridge.getPendingNotifications).toHaveBeenCalledTimes(1);

    await journal.stop(DEVICE);
    await journal.start(DEVICE, nextOwner);
    const newReceived = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, newReceived);
    fetched.resolve({ notifications: [entry("old")], droppedCount: 0 });
    await draining;
    expect(oldReceived).not.toHaveBeenCalled();
    expect(newReceived).not.toHaveBeenCalled();
    expect(bridge.ackNotifications).not.toHaveBeenCalled();

    enqueue(DEVICE, nextOwner, entry("new", { value: "49" }));
    await journal.drain(DEVICE);
    expect(newReceived).toHaveBeenCalledExactlyOnceWith(Uint8Array.of(0x49));
  });

  it("aísla cuentas y dispositivos aunque reutilicen ids de notificación", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    const deviceB = "ring-b";
    const ownerB = "patient-b";
    enqueue(DEVICE, OWNER, entry("1", { value: "01" }));
    enqueue(DEVICE, ownerB, entry("1", { value: "02" }));
    enqueue(deviceB, OWNER, entry("1", { deviceId: deviceB, value: "03" }));
    await journal.start(DEVICE, OWNER);
    await journal.start(deviceB, OWNER);
    const bandReceived = vi.fn();
    const ringReceived = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, bandReceived);
    journal.register(deviceB, SERVICE, CHANNEL, ringReceived);
    await Promise.all([journal.drain(DEVICE), journal.drain(deviceB)]);
    expect(bandReceived).toHaveBeenCalledExactlyOnceWith(Uint8Array.of(1));
    expect(ringReceived).toHaveBeenCalledExactlyOnceWith(Uint8Array.of(3));
    expect(pending(DEVICE, ownerB)).toHaveLength(1);

    await journal.stop(DEVICE);
    await journal.start(DEVICE, ownerB);
    const nextAccountReceived = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, nextAccountReceived);
    await journal.drain(DEVICE);
    expect(nextAccountReceived).toHaveBeenCalledExactlyOnceWith(Uint8Array.of(2));
    expect(bridge.ackNotifications).toHaveBeenLastCalledWith({
      deviceId: DEVICE, ownerId: ownerB, ids: ["1"],
    });
    expect(bandReceived).toHaveBeenCalledTimes(1);
  });

  it("descarta de la entrega una fila que pertenece a otro dispositivo sin darle ACK", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER,
      entry("wrong", { deviceId: "other-device" }),
      entry("right"));
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledTimes(1);
    expect(bridge.ackNotifications).toHaveBeenCalledExactlyOnceWith({
      deviceId: DEVICE, ownerId: OWNER, ids: ["right"],
    });
    expect(pending().map((notification) => notification.id)).toEqual(["wrong"]);
  });

  it("vacía más de 1000 notificaciones con páginas sucesivas sin duplicarlas", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, ...Array.from({ length: 1_505 }, (_, index) => entry(String(index))));
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledTimes(1_505);
    expect(bridge.getPendingNotifications).toHaveBeenCalledTimes(2);
    const acknowledged = bridge.ackNotifications.mock.calls.flatMap(([options]) => options.ids);
    expect(acknowledged).toHaveLength(1_505);
    expect(new Set(acknowledged).size).toBe(1_505);
    expect(bridge.ackNotifications.mock.calls.every(([options]) => options.ids.length <= 1_000)).toBe(true);
    expect(pending()).toEqual([]);
  });

  it("un fallo en el segundo bloque de ACK no repite lecturas ya persistidas", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, ...Array.from({ length: 1_505 }, (_, index) => entry(String(index))));
    const acknowledge = bridge.ackNotifications.getMockImplementation()!;
    let attempts = 0;
    bridge.ackNotifications.mockImplementation(async (options) => {
      attempts += 1;
      if (attempts === 2) throw new Error("native second ACK failed");
      return acknowledge(options);
    });

    await expect(journal.drain(DEVICE)).rejects.toThrow("native second ACK failed");
    expect(received).toHaveBeenCalledTimes(1_505);
    expect(pending()).toHaveLength(505);
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledTimes(1_505);
    expect(pending()).toEqual([]);
    expect(bridge.ackNotifications.mock.calls.map(([options]) => options.ids.length)).toEqual([1_000, 505, 505]);
  });

  it("una página de canales pendientes no oculta las lecturas posteriores", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER,
      ...Array.from({ length: 1_000 }, (_, index) => entry(`unknown-${index}`, { characteristic: "not-subscribed" })),
      entry("live", { value: "49" }));
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledExactlyOnceWith(Uint8Array.of(0x49));
    expect(bridge.getPendingNotifications).toHaveBeenCalledTimes(2);
    expect(pending()).toHaveLength(1_000);
    expect(pending().every((notification) => notification.characteristic === "not-subscribed")).toBe(true);
  });

  it("busca el final de una trama en la página siguiente antes de confirmar fragmentos", async () => {
    const { bridge, journal, enqueue, pending } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn((bytes: Uint8Array) => bytes[0] === 2);
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER,
      ...Array.from({ length: 1_000 }, (_, index) => entry(`part-${index}`, { value: "01" })),
      entry("tail", { value: "02" }));
    await journal.drain(DEVICE);
    expect(received).toHaveBeenCalledTimes(1_001);
    const acknowledged = bridge.ackNotifications.mock.calls.flatMap(([options]) => options.ids);
    expect(acknowledged).toHaveLength(1_001);
    expect(new Set(acknowledged).size).toBe(1_001);
    expect(pending()).toEqual([]);
  });

  it("rechaza hex inválido sin ACK para que el origen pueda investigarse", async () => {
    const { bridge, journal, enqueue } = setup();
    await journal.start(DEVICE, OWNER);
    const received = vi.fn();
    journal.register(DEVICE, SERVICE, CHANNEL, received);
    enqueue(DEVICE, OWNER, entry("bad", { value: "0GG" }));
    await expect(journal.drain(DEVICE)).rejects.toThrow("Notificación BLE persistida inválida");
    expect(received).not.toHaveBeenCalled();
    expect(bridge.ackNotifications).not.toHaveBeenCalled();
  });
});
