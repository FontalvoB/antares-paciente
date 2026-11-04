import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withNotificationTimestamp } from "../ble/notification-clock";
import { BcChannel } from "../colmi/bc";
import { ColmiHistory } from "../colmi/history";
import {
  BC_SLEEP,
  CMD_REALTIME_RESPONSE,
  COLMI_BC_NOTIFY,
  COLMI_CHAR_TX,
  MEASURE_TYPE,
  bcFrame,
  buildFrame,
} from "../colmi/protocol";
import { ColmiSession } from "../colmi/session";
import { HrsSession } from "../hrs/session";
import type { HealthSample, SampleSink } from "../types";
import {
  HR_CHAR_MEASUREMENT,
  OP,
  YCBT_CHAR_C1,
  YCBT_CHAR_C3,
  bleSecondsToMs,
  buildPacket,
  parsePacket,
} from "../ycbt/protocol";
import { parseRealtimePacket } from "../ycbt/realtime";
import { YcbtSession } from "../ycbt/session";

type NotificationSink = (bytes: Uint8Array) => boolean | void;

const mock = vi.hoisted(() => ({
  sinks: new Map<string, NotificationSink>(),
  unsubscribe: vi.fn(async () => undefined),
}));

vi.mock("../ble/ble-client", () => ({
  hasCharacteristic: () => true,
  isBleDebugEnabled: () => false,
  noteDiagnostic: () => undefined,
  subscribe: async (
    _deviceId: string,
    _service: string,
    characteristic: string,
    callback: NotificationSink,
  ) => {
    mock.sinks.set(characteristic, callback);
  },
  unsubscribe: mock.unsubscribe,
  writeBytes: async () => undefined,
}));

const band = { deviceId: "band", name: "H59_E206", kind: "colmi" as const };
const ring = { deviceId: "ring", name: "R88 C1BF", kind: "ycbt" as const };

function sink(characteristic: string): NotificationSink {
  const callback = mock.sinks.get(characteristic);
  if (!callback) throw new Error(`Canal sin suscripción: ${characteristic}`);
  return callback;
}

async function startBand(onSample: SampleSink): Promise<ColmiSession> {
  const session = new ColmiSession(band);
  const starting = session.start(onSample, () => undefined);
  await vi.advanceTimersByTimeAsync(1_000);
  await starting;
  return session;
}

async function startRing(onSample: SampleSink): Promise<YcbtSession> {
  const session = new YcbtSession(ring, []);
  const starting = session.start(onSample, () => undefined);
  await vi.advanceTimersByTimeAsync(15_000);
  await starting;
  return session;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("recepción BLE persistida — drivers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T15:00:00Z"));
    mock.sinks.clear();
    mock.unsubscribe.mockClear();
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Colmi conserva fragmentos sin ACK y fecha la lectura al recibirla", async () => {
    const samples: HealthSample[] = [];
    const session = await startBand((sample) => samples.push(sample));
    session.setAppActive(false);
    const frame = buildFrame(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.heart_rate, 0, 72]);
    const receivedAt = Date.now() - 3_600_000;
    const callback = sink(COLMI_CHAR_TX);

    expect(withNotificationTimestamp(receivedAt, () => callback(frame.slice(0, 5)))).toBe(false);
    expect(samples).toEqual([]);
    expect(withNotificationTimestamp(receivedAt, () => callback(frame.slice(5)))).toBe(true);
    expect(samples).toMatchObject([{ metric: "heart_rate", value: 72, ts: receivedAt }]);
    expect(Date.now()).toBeGreaterThan(receivedAt);
  });

  it("Colmi reinicia el reensamblador si falla persistir y admite el replay completo", async () => {
    const samples: HealthSample[] = [];
    let fail = true;
    const session = await startBand((sample) => {
      if (fail) throw new Error("disk full");
      samples.push(sample);
    });
    session.setAppActive(false);
    const callback = sink(COLMI_CHAR_TX);
    const frame = buildFrame(CMD_REALTIME_RESPONSE, [MEASURE_TYPE.heart_rate, 0, 72]);
    expect(callback(frame.slice(0, 7))).toBe(false);
    expect(() => callback(frame.slice(7))).toThrow("disk full");

    fail = false;
    expect(callback(frame.slice(0, 7))).toBe(false);
    expect(callback(frame.slice(7))).toBe(true);
    expect(samples.map((sample) => sample.value)).toEqual([72]);
  });

  it.each([YCBT_CHAR_C1, YCBT_CHAR_C3])("YCBT conserva fragmentos y hora real en %s", async (characteristic) => {
    const samples: HealthSample[] = [];
    const session = await startRing((sample) => samples.push(sample));
    session.setAppActive(false);
    const callback = sink(characteristic);
    const frame = buildPacket(OP.UPLOAD_HEART, [74]);
    const receivedAt = Date.now() - 3_600_000;

    expect(withNotificationTimestamp(receivedAt, () => callback(frame.slice(0, 4)))).toBe(false);
    expect(samples).toEqual([]);
    expect(withNotificationTimestamp(receivedAt, () => callback(frame.slice(4)))).toBe(true);
    expect(samples).toMatchObject([{ metric: "heart_rate", value: 74, ts: receivedAt }]);
  });

  it.each([YCBT_CHAR_C1, YCBT_CHAR_C3])("YCBT admite replay tras un fallo de almacenamiento en %s", async (characteristic) => {
    const samples: HealthSample[] = [];
    let fail = true;
    const session = await startRing((sample) => {
      if (fail) throw new Error("disk full");
      samples.push(sample);
    });
    session.setAppActive(false);
    const callback = sink(characteristic);
    const frame = buildPacket(OP.UPLOAD_HEART, [74]);
    expect(callback(frame.slice(0, 4))).toBe(false);
    expect(() => callback(frame.slice(4))).toThrow("disk full");

    fail = false;
    expect(callback(frame.slice(0, 4))).toBe(false);
    expect(callback(frame.slice(4))).toBe(true);
    expect(samples.map((sample) => sample.value)).toEqual([74]);
  });

  it("HRS conserva la hora de recepción al abrir la app más tarde", async () => {
    const samples: HealthSample[] = [];
    const session = new HrsSession({ deviceId: "hrs", name: "HRS", kind: "hrs" });
    await session.start((sample) => samples.push(sample), () => undefined);
    const receivedAt = Date.now() - 3_600_000;
    withNotificationTimestamp(receivedAt, () => sink(HR_CHAR_MEASUREMENT)(Uint8Array.from([0, 68])));
    expect(samples).toMatchObject([{ metric: "heart_rate", value: 68, ts: receivedAt }]);
  });

  it("respeta un timestamp embebido del anillo aunque el replay tenga otra hora", () => {
    const packet = parsePacket(buildPacket(OP.UPLOAD_WEARING, [0xe8, 3, 0, 0, 1]));
    if (!packet) throw new Error("Trama inválida");
    const samples = withNotificationTimestamp(Date.now() - 3_600_000, () => parseRealtimePacket(packet, ring.deviceId));
    expect(samples[0]?.ts).toBe(bleSecondsToMs(1000));
  });

  it("el canal bc no confirma un fragmento hasta completar su trama", async () => {
    const channel = new BcChannel(band.deviceId, { onSamples: () => undefined });
    const opening = channel.open();
    await vi.advanceTimersByTimeAsync(1_500);
    await opening;
    const callback = sink(COLMI_BC_NOTIFY);
    const frame = bcFrame(BC_SLEEP, [1, 2, 3, 4]);
    expect(callback(frame.slice(0, 4))).toBe(false);
    expect(callback(frame.slice(4))).toBe(true);
  });

  it("pasar a segundo plano conserva la suscripción del canal bc", async () => {
    const close = vi.spyOn(BcChannel.prototype, "close");
    const session = await startBand(() => undefined);
    session.setAppActive(false);
    expect(close).not.toHaveBeenCalled();
    expect(mock.unsubscribe).not.toHaveBeenCalled();
    const done = vi.fn();
    session.measure("spo2", done);
    expect(done).toHaveBeenCalledWith(false, "refused");
  });

  it("reanudar inmediatamente repite el historial abortado sin continuar su secuencia vieja", async () => {
    const first = deferred();
    const second = deferred();
    const start = vi.spyOn(ColmiHistory.prototype, "start")
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const open = vi.spyOn(BcChannel.prototype, "open").mockResolvedValue(false);
    const session = await startBand(() => undefined);
    expect(start).toHaveBeenCalledTimes(1);
    session.setAppActive(false);
    session.setAppActive(true);
    const resuming = session.syncHistory();
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(start).toHaveBeenCalledTimes(2);
    expect(open).not.toHaveBeenCalled();
    second.resolve();
    await resuming;
    expect(open).toHaveBeenCalledTimes(1);
  });
});
