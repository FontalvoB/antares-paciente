import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFrame, CMD, CMD_REALTIME_RESPONSE } from "../colmi/protocol";
import type { HealthSample, MeasureOutcome } from "../types";

// Prueba de punta a punta del driver Colmi con la capa BLE mockeada: inyecta
// las tramas reales del H59 y verifica que la FC en vivo llegue a la app.
// Cubre el bug real: las tramas de respuesta (cmd 105) se tragaban como "ack"
// del comando de medida y nunca se decodificaban.

const hoisted = vi.hoisted(() => ({
  notes: [] as string[],
  sink: null as null | ((bytes: Uint8Array) => void),
  debug: false,
  writes: [] as number[][],
}));

vi.mock("../ble/ble-client", () => ({
  hasCharacteristic: () => true,
  noteDiagnostic: (text: string) => hoisted.notes.push(text),
  subscribe: async (
    _deviceId: string,
    _service: string,
    _characteristic: string,
    onValue: (bytes: Uint8Array) => void,
  ) => {
    hoisted.sink = onValue;
  },
  unsubscribe: async () => undefined,
  isBleDebugEnabled: () => hoisted.debug,
  writeBytes: async (
    _deviceId: string,
    _service: string,
    _characteristic: string,
    bytes: Uint8Array,
  ) => {
    hoisted.writes.push(Array.from(bytes));
  },
}));

import { ColmiSession } from "../colmi/session";

const descriptor = { deviceId: "band-1", name: "H59", kind: "colmi" as const };

function emitFrame(cmd: number, payload: number[]): void {
  if (!hoisted.sink) throw new Error("canal de notificaciones no suscrito");
  hoisted.sink(buildFrame(cmd, payload));
}

function emit(payload: number[]): void {
  emitFrame(CMD_REALTIME_RESPONSE, payload);
}

const zeros = (count: number) => new Array(count).fill(0);

describe("ColmiSession — FC en vivo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.notes = [];
    hoisted.sink = null;
    hoisted.debug = false;
    hoisted.writes = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emite la FC del layout u16 en décimas y anota el layout", async () => {
    const session = new ColmiSession(descriptor);
    const samples: HealthSample[] = [];
    const started = session.start(
      (sample) => samples.push(sample),
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    await started;

    // Captura real: `69 01 00 00 00 00 bd 03 …` → u16 0x03bd = 957 → 95.7 lpm.
    emit([1, 0, 0, 0, 0, 0xbd, 0x03, ...zeros(7)]);
    await vi.advanceTimersByTimeAsync(100);

    const hr = samples.find((sample) => sample.metric === "heart_rate");
    expect(hr?.value).toBe(96);
    expect(
      hoisted.notes.some((line) => line.includes("fc: layout u16×0.1")),
    ).toBe(true);
    // stop() encola un último write con su delay: hay que avanzar el reloj.
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("publica la batería que responde la banda al conectar", async () => {
    const session = new ColmiSession(descriptor);
    const infos: Array<{ battery?: number; name?: string }> = [];
    const started = session.start(
      () => undefined,
      (delta) => infos.push(delta),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    await started;

    // Respuesta real de la banda al comando 3: nivel 100%, sin carga.
    emitFrame(CMD.BATTERY, [0x64, 0x00, ...zeros(12)]);
    await vi.advanceTimersByTimeAsync(100);

    expect(infos.some((delta) => delta.battery === 100)).toBe(true);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("requestInfo vuelve a pedir la batería", async () => {
    const session = new ColmiSession(descriptor);
    const started = session.start(
      () => undefined,
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    await started;
    hoisted.writes = [];

    session.requestInfo();
    await vi.advanceTimersByTimeAsync(500);

    expect(hoisted.writes.some((bytes) => bytes[0] === 0x03)).toBe(true);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("solo pide la sonda de sueño con Modo diagnóstico activo", async () => {
    hoisted.debug = true;
    const session = new ColmiSession(descriptor);
    const started = session.start(
      () => undefined,
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await started;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(hoisted.writes.some((bytes) => bytes[0] === 0x0d)).toBe(true);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("sin diagnóstico no pide la sonda de sueño", async () => {
    const session = new ColmiSession(descriptor);
    const started = session.start(
      () => undefined,
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await started;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(hoisted.writes.some((bytes) => bytes[0] === 0x0d)).toBe(false);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("ignora los ack sin lectura y acepta el layout clásico", async () => {
    const session = new ColmiSession(descriptor);
    const samples: HealthSample[] = [];
    const started = session.start(
      (sample) => samples.push(sample),
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    await started;

    emit([1, 0, ...zeros(12)]);
    emit([1, 0, 66, ...zeros(11)]);
    await vi.advanceTimersByTimeAsync(100);

    const hrs = samples.filter((sample) => sample.metric === "heart_rate");
    expect(hrs.map((sample) => sample.value)).toEqual([66]);
    // stop() encola un último write con su delay: hay que avanzar el reloj.
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });
});

// El bug real: `measure()` ignoraba el callback, así que la pantalla quedaba
// "midiendo" para siempre y bloqueaba el resto de botones.
describe("ColmiSession.measure — contrato de fin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.notes = [];
    hoisted.sink = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function startedSession(): Promise<{
    session: ColmiSession;
    outcomes: Array<[boolean, MeasureOutcome]>;
  }> {
    const session = new ColmiSession(descriptor);
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    const started = session.start(
      () => undefined,
      () => undefined,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    await started;
    return { session, outcomes };
  }

  it("cierra con completed al reunir 3 muestras del tipo pedido", async () => {
    const { session, outcomes } = await startedSession();
    session.measure("heart_rate", (ok, reason) => outcomes.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(100);
    emit([1, 0, 66, ...zeros(11)]);
    emit([1, 0, 67, ...zeros(11)]);
    emit([1, 0, 68, ...zeros(11)]);
    await vi.advanceTimersByTimeAsync(100);

    expect(outcomes).toEqual([[true, "completed"]]);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("cierra con timeout si la banda no manda muestras", async () => {
    const { session, outcomes } = await startedSession();
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(31_000);
    expect(outcomes).toEqual([[false, "timeout"]]);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("avisa al reemplazar una medida en curso (una sola vez por medida)", async () => {
    const { session, outcomes } = await startedSession();
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));
    await vi.advanceTimersByTimeAsync(100);
    session.measure("blood_pressure", (ok, reason) =>
      outcomes.push([ok, reason]),
    );
    await vi.advanceTimersByTimeAsync(100);

    expect(outcomes).toEqual([[false, "replaced"]]);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("al reemplazar una medida NO re-arma la FC encima del barrido nuevo", async () => {
    const { session } = await startedSession();
    hoisted.writes = [];
    session.measure("spo2", () => undefined);
    await vi.advanceTimersByTimeAsync(100);
    session.measure("blood_pressure", () => undefined);
    await vi.advanceTimersByTimeAsync(1_000);

    // Arranques de FC (payload [1,1]) solo el del connect: ninguno después del
    // START de presión, que era lo que cancelaba su barrido.
    expect(
      hoisted.writes.filter(
        (bytes) => bytes[0] === 0x69 && bytes[1] === 1 && bytes[2] === 1,
      ),
    ).toHaveLength(0);
    const bpStart = hoisted.writes.findIndex(
      (bytes) => bytes[0] === 0x69 && bytes[1] === 2 && bytes[2] === 1,
    );
    expect(bpStart).toBeGreaterThan(-1);
    expect(
      hoisted.writes
        .slice(bpStart + 1)
        .some((bytes) => bytes[0] === 0x69 && bytes[1] === 1 && bytes[2] === 1),
    ).toBe(false);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("la presión reintenta el barrido una vez si no llega ninguna muestra", async () => {
    const { session, outcomes } = await startedSession();
    hoisted.writes = [];
    session.measure("blood_pressure", (ok, reason) => outcomes.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(16_000);
    expect(
      hoisted.writes.filter(
        (bytes) => bytes[0] === 0x69 && bytes[1] === 2 && bytes[2] === 1,
      ),
    ).toHaveLength(2);
    expect(
      hoisted.writes.filter((bytes) => bytes[0] === 0x6a && bytes[1] === 2),
    ).toHaveLength(1);
    expect(
      hoisted.notes.some((line) => line.includes("bp: reintento de barrido")),
    ).toBe(true);
    // Sigue en curso: la ventana de presión es de 60 s.
    expect(outcomes).toEqual([]);

    await vi.advanceTimersByTimeAsync(50_000);
    expect(outcomes).toEqual([[false, "timeout"]]);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it("no reintenta si el barrido ya entregó muestras", async () => {
    const { session, outcomes } = await startedSession();
    hoisted.writes = [];
    session.measure("blood_pressure", (ok, reason) => outcomes.push([ok, reason]));

    emit([2, 0, 66, 125, 76, ...zeros(9)]);
    emit([2, 0, 67, 124, 75, ...zeros(9)]);
    emit([2, 0, 66, 126, 77, ...zeros(9)]);
    await vi.advanceTimersByTimeAsync(100);
    expect(outcomes).toEqual([[true, "completed"]]);

    await vi.advanceTimersByTimeAsync(16_000);
    expect(
      hoisted.writes.filter((bytes) => bytes[0] === 0x69 && bytes[1] === 2),
    ).toHaveLength(1);
    const stopping = session.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });
});
