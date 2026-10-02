import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPacket, crc16 } from "../ycbt/protocol";
import type { HealthSample, MeasureOutcome } from "../types";

// Prueba de la medida puntual del driver YCBT de punta a punta: se mockea la
// capa BLE y se inyectan las tramas que el anillo enviaría por C3. Cubre el
// bug real: el SpO2 cierra con la PRIMERA lectura válida (antes exigía 3 y
// agotaba la ventana mostrando un error falso).

type ValueSink = (bytes: Uint8Array) => void;

const sinks = new Map<string, ValueSink>();
const writes: Array<{ characteristic: string; bytes: Uint8Array }> = [];

vi.mock("../ble/ble-client", () => ({
  hasCharacteristic: () => true,
  noteDiagnostic: () => undefined,
  subscribe: async (
    _deviceId: string,
    _service: string,
    characteristic: string,
    onValue: ValueSink,
  ) => {
    sinks.set(characteristic, onValue);
  },
  unsubscribe: async () => undefined,
  writeBytes: async (
    _deviceId: string,
    _service: string,
    characteristic: string,
    bytes: Uint8Array,
  ) => {
    writes.push({ characteristic, bytes });
  },
}));

import { YcbtSession } from "../ycbt/session";
import type { DeviceDescriptor } from "../types";

const YCBT_CHAR_C1 = "be940001-7333-be46-b7ae-689e71722bd5";
const YCBT_CHAR_C3 = "be940003-7333-be46-b7ae-689e71722bd5";

const descriptor: DeviceDescriptor = {
  deviceId: "ring-1",
  name: "R88",
  kind: "ycbt",
};

/** Tramas escritas hacia el anillo, decodificadas a (tipo, payload). */
function sentFrames(): Array<{ type: number; payload: number[] }> {
  return writes
    .filter((write) => write.characteristic === YCBT_CHAR_C1)
    .map((write) => ({
      type: (write.bytes[0] << 8) | write.bytes[1],
      payload: Array.from(write.bytes.slice(4, write.bytes.length - 2)),
    }));
}

function emitOnC3(type: number, payload: number[]): void {
  const sink = sinks.get(YCBT_CHAR_C3);
  if (!sink) throw new Error("C3 no suscrito");
  sink(buildPacket(type, payload));
}

function emitOnC1(type: number, payload: number[]): void {
  const sink = sinks.get(YCBT_CHAR_C1);
  if (!sink) throw new Error("C1 no suscrito");
  sink(buildPacket(type, payload));
}

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32(value: number): number[] {
  return [
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ];
}

/** Una sesión de sueño de 30 min (header de 20 B + un segmento de 8 B). */
function sleepBuffer(): number[] {
  const start = 1000;
  return [
    0,
    0,
    ...u16(28),
    ...u32(start),
    ...u32(start + 1800),
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0x02,
    ...u32(start),
    0x08,
    0x07,
    0x00,
  ];
}

/** Bitmap `02 01` de 14 B con pasos declarados y SUEÑO en falso (como el R88). */
const BITMAP_SIN_SUENO = [0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const collected: HealthSample[] = [];

async function connectedSession(): Promise<YcbtSession> {
  const session = new YcbtSession(descriptor, []);
  const started = session.start(
    (sample) => collected.push(sample),
    () => undefined,
  );
  await vi.advanceTimersByTimeAsync(30_000);
  await started;
  writes.length = 0;
  return session;
}

describe("YcbtSession.measure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sinks.clear();
    writes.length = 0;
    collected.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("el SpO2 cierra con la primera lectura válida y detiene su modo", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(1_000);
    emitOnC3(0x0602, [97]);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(outcomes).toEqual([[true, "completed"]]);
    expect(sentFrames()).toContainEqual({ type: 0x032f, payload: [1, 2] });
    expect(sentFrames()).toContainEqual({ type: 0x032f, payload: [0, 2] });
  });

  it("la FC exige 3 muestras antes de cerrar", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("heart_rate", (ok, reason) => outcomes.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(500);
    emitOnC3(0x0601, [72]);
    await vi.advanceTimersByTimeAsync(500);
    expect(outcomes).toEqual([]);

    emitOnC3(0x0601, [73]);
    emitOnC3(0x0601, [74]);
    await vi.advanceTimersByTimeAsync(500);
    expect(outcomes).toEqual([[true, "completed"]]);
  });

  it("el silencio total agota la ventana como falta de señal (no lentitud)", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));

    // Sin ni siquiera tramas: la ventana (90 s) se agota → no-signal.
    await vi.advanceTimersByTimeAsync(91_000);
    expect(outcomes).toEqual([[false, "no-signal"]]);
  });

  it("con tramas pero sin lecturas agota la ventana como timeout", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));

    // Live-status en ceros: hay radio pero nada decodifica → timeout, no señal.
    for (let second = 0; second < 88; second++) {
      emitOnC3(0x0600, [0, 0, 0, 0, 0, 0]);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    await vi.advanceTimersByTimeAsync(3_000);
    expect(outcomes).toEqual([[false, "timeout"]]);
  });

  it("el push 04 0e con resultado 2 corta la medida como fallida", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(2_000);
    emitOnC3(0x0413, [0x02, 1, 0]);
    await vi.advanceTimersByTimeAsync(500);
    expect(outcomes).toEqual([]);

    // El veredicto del anillo llega por el canal de comandos (C1).
    const sink = sinks.get(YCBT_CHAR_C1);
    if (!sink) throw new Error("C1 no suscrito");
    sink(buildPacket(0x040e, [0x02, 2]));
    await vi.advanceTimersByTimeAsync(500);

    expect(outcomes).toEqual([[false, "failed"]]);
    expect(sentFrames()).toContainEqual({ type: 0x032f, payload: [0, 2] });
  });

  it("un rechazo del firmware cierra la medida como rechazada", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));

    const sink = sinks.get(YCBT_CHAR_C1);
    if (!sink) throw new Error("C1 no suscrito");
    sink(buildPacket(0x032f, [0x01]));
    await vi.advanceTimersByTimeAsync(500);

    expect(outcomes).toEqual([[false, "refused"]]);
  });
});

// El bitmap `02 01` del R88 subdeclara capacidades (no enciende el bit de
// sueño), y filtrar por él dejaba el sueño sin pedir: la tarjeta quedaba vacía
// aunque el anillo sí lo hubiera registrado.
describe("YcbtSession.syncHistory — sueño pese al bitmap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sinks.clear();
    writes.length = 0;
    collected.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pide 05 04 y decodifica la sesión aunque el bitmap no declare sueño", async () => {
    const session = await connectedSession();
    emitOnC1(0x0201, BITMAP_SIN_SUENO);
    await vi.advanceTimersByTimeAsync(100);
    writes.length = 0;

    const syncing = session.syncHistory();
    // El tipo anterior (sport) agota su watchdog de header antes de pasar al
    // siguiente: el catálogo se pide completo, sin filtrar por bitmap.
    await vi.advanceTimersByTimeAsync(6_500);
    expect(sentFrames()).toContainEqual({ type: 0x0504, payload: [] });

    // Formas REALES del R11M: el header llega con el cmd de la consulta
    // (05 04) y las tramas de datos con el ackKey (05 13).
    const buffer = sleepBuffer();
    emitOnC1(0x0504, [...u16(1), ...u32(1), ...u32(buffer.length)]);
    emitOnC1(0x0513, buffer);
    emitOnC1(0x0580, [
      ...u16(1),
      ...u16(buffer.length),
      ...u16(crc16(Uint8Array.from(buffer))),
    ]);
    // Los tipos restantes del catálogo agotan su watchdog antes de cerrar.
    await vi.advanceTimersByTimeAsync(30_000);
    await syncing;

    const sleep = collected.find((sample) => sample.metric === "sleep");
    expect(sleep?.value).toBe(30);
    expect(sleep?.unit).toBe("min");
  });

  it("el volcado por defecto no pide SpO2 (05 1a sin respuesta en capturas)", async () => {
    const session = await connectedSession();
    writes.length = 0;

    const syncing = session.syncHistory();
    // Todos los tipos agotan su watchdog sin responder: el dump completo.
    await vi.advanceTimersByTimeAsync(120_000);
    await syncing;

    const queried = sentFrames().map((f) => f.type);
    expect(queried).toContain(0x0502);
    expect(queried).toContain(0x0504);
    expect(queried).not.toContain(0x051a);
  });
});
describe("YcbtSession.stopMeasure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sinks.clear();
    writes.length = 0;
    collected.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("para el barrido con cancelled y manda el disable de su modo", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("heart_rate", (ok, reason) => outcomes.push([ok, reason]));
    await vi.advanceTimersByTimeAsync(1_000);

    session.stopMeasure();
    await vi.advanceTimersByTimeAsync(100);

    expect(outcomes).toEqual([[false, "cancelled"]]);
    expect(sentFrames()).toContainEqual({ type: 0x032f, payload: [0, 0] });
    // Sin reintento ni cierre tardío después de cancelar.
    await vi.advanceTimersByTimeAsync(31_000);
    expect(outcomes).toHaveLength(1);
  });

  it("sin medida en curso es un no-op silencioso", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.stopMeasure();
    await vi.advanceTimersByTimeAsync(100);
    expect(outcomes).toEqual([]);
    expect(sentFrames()).toEqual([]);
  });
});

describe("YcbtSession.measure — re-enganche persistente de la FC", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sinks.clear();
    writes.length = 0;
    collected.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("el SpO2 sin reintento espera la lectura hasta la ventana y luego cierra", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    const done = new Promise<void>((resolve) => {
      session.measure("spo2", (ok, reason) => {
        outcomes.push([ok, reason]);
        resolve();
      });
    });

    await vi.advanceTimersByTimeAsync(21_000);
    // Solo el enable inicial: sin re-arme a los 20 s.
    expect(
      sentFrames().filter((f) => f.type === 0x032f && f.payload[0] === 1)
        .length,
    ).toBe(1);
    expect(outcomes).toEqual([]);

    emitOnC3(0x0602, [97]);
    await done;
    await vi.advanceTimersByTimeAsync(1);
    expect(outcomes).toEqual([[true, "completed"]]);
    // El disable llega tras cerrar la medida.
    expect(sentFrames()).toContainEqual({ type: 0x032f, payload: [0, 2] });
  });

  it("con una lectura previa no reintenta", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("spo2", (ok, reason) => outcomes.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(1_000);
    emitOnC3(0x0602, [98]);
    await vi.advanceTimersByTimeAsync(21_000);

    expect(outcomes).toEqual([[true, "completed"]]);
    expect(
      sentFrames().filter((f) => f.type === 0x032f && f.payload[0] === 1)
        .length,
    ).toBe(1);
  });

  it("la FC no se toca a mitad de ventana: re-enganche solo en el borde", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    const done = new Promise<void>((resolve) => {
      session.measure("heart_rate", (ok, reason) => {
        outcomes.push([ok, reason]);
        resolve();
      });
    });
    const enables = () =>
      sentFrames().filter((f) => f.type === 0x032f && f.payload[0] === 1)
        .length;
    const disables = () =>
      sentFrames().filter((f) => f.type === 0x032f && f.payload[0] === 0)
        .length;

    // A los 10 s (y 20 s) sin nada: el sensor sigue calentando, ni un STOP.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(enables()).toBe(1);
    expect(disables()).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(enables()).toBe(1);
    expect(disables()).toBe(0);
    expect(outcomes).toEqual([]);
    // Al agotarse la ventana (30 s): STOP primero…
    await vi.advanceTimersByTimeAsync(10_000);
    expect(enables()).toBe(1);
    expect(disables()).toBe(1);
    expect(outcomes).toEqual([]);
    // …pausa de 3 s sin re-arme todavía…
    await vi.advanceTimersByTimeAsync(2_000);
    expect(enables()).toBe(1);
    // …y luego el START de nuevo (una sola vez, sin duplicados).
    await vi.advanceTimersByTimeAsync(1_500);
    expect(enables()).toBe(2);
    expect(disables()).toBe(1);
    expect(outcomes).toEqual([]);

    // Con lecturas cierra normal y no hay más re-enganches.
    emitOnC3(0x0601, [72]);
    emitOnC3(0x0601, [73]);
    emitOnC3(0x0601, [74]);
    await done;
    expect(outcomes).toEqual([[true, "completed"]]);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(enables()).toBe(2);
    // El segundo STOP es el cierre de la propia medida, no otro re-enganche.
    expect(disables()).toBe(2);
  });

  it("la FC extiende ventanas mudas y completa al medir en la segunda", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("heart_rate", (ok, reason) => outcomes.push([ok, reason]));

    // Más allá de la ventana de 30 s sin nada: sigue midiendo, sin cierre.
    await vi.advanceTimersByTimeAsync(34_000);
    expect(outcomes).toEqual([]);

    emitOnC3(0x0601, [72]);
    emitOnC3(0x0601, [73]);
    emitOnC3(0x0601, [74]);
    await vi.advanceTimersByTimeAsync(500);
    expect(outcomes).toEqual([[true, "completed"]]);
  });

  it("la FC muda 5 ventanas cierra con falta de señal (sin tramas)", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("heart_rate", (ok, reason) => outcomes.push([ok, reason]));

    // 4 ventanas extendidas sin nada: sigue abierta…
    await vi.advanceTimersByTimeAsync(149_000);
    expect(outcomes).toEqual([]);
    // …y al agotarse la quinta cierra honesto, con su STOP.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(outcomes).toEqual([[false, "no-signal"]]);
    expect(
      sentFrames().filter((f) => f.type === 0x032f && f.payload[0] === 0)
        .length,
    ).toBeGreaterThan(0);
  });

  it("la FC con tramas pero sin lecturas cierra como timeout al tope", async () => {
    const session = await connectedSession();
    const outcomes: Array<[boolean, MeasureOutcome]> = [];
    session.measure("heart_rate", (ok, reason) => outcomes.push([ok, reason]));

    // Live-status en ceros: hay radio pero nada decodifica a FC.
    for (let second = 0; second < 151; second++) {
      emitOnC3(0x0600, [0, 0, 0, 0, 0, 0]);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(outcomes).toEqual([[false, "timeout"]]);
  });
});
