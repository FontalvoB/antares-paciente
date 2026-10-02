import { describe, expect, it, vi } from "vitest";
import { HistorySync } from "../ycbt/history";
import {
  HISTORY_TYPES,
  buildPacket,
  crc16,
  parsePacket,
} from "../ycbt/protocol";
import type { YcbtHistoryType, YcbtPacket } from "../ycbt/protocol";
import type { HealthSample } from "../types";

const DEVICE = "ring-1";
const SLEEP = HISTORY_TYPES.find((t) => t.key === "sleep")! as YcbtHistoryType;
const SPO2 = HISTORY_TYPES.find((t) => t.key === "spo2")! as YcbtHistoryType;
const HEART = HISTORY_TYPES.find((t) => t.key === "heart")! as YcbtHistoryType;

function packet(type: number, payload: number[]): YcbtPacket {
  const parsed = parsePacket(buildPacket(type, payload));
  if (!parsed) throw new Error(`trama inválida: ${type.toString(16)}`);
  return parsed;
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

function setup() {
  // Aísla cada test: HistorySync persiste los tipos bloqueados (0xFC) por
  // dispositivo en localStorage, así que un test no debe ver lo del anterior.
  // El constructor de HistorySync hidrata `blocked` desde localStorage: sin
  // limpiar, el test 0xFC contamina a los siguientes (deuda preexistente
  // ycbt-history: SLEEP bloqueado → sends[0] era SPO2 en vez de SLEEP).
  localStorage.clear();
  const sends: Array<{ type: number; payload: number[] }> = [];
  const samples: HealthSample[] = [];
  const notes: string[] = [];
  const send = vi.fn(async (type: number, payload: number[]) => {
    sends.push({ type, payload });
  });
  const sync = new HistorySync(DEVICE, send, {
    onSamples: (incoming) => samples.push(...incoming),
    onNote: (text) => notes.push(text),
  });
  return { sync, sends, samples, notes };
}

/** Header de un tipo con datos: conteos + total de bytes. */
function header(totalBytes: number): number[] {
  return [...u16(1), ...u32(1), ...u32(totalBytes)];
}

function terminal(buffer: number[]): number[] {
  return [
    ...u16(1),
    ...u16(buffer.length),
    ...u16(crc16(Uint8Array.from(buffer))),
  ];
}

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

describe("HistorySync", () => {
  // Tramas reales del R88 (captura del registro BLE): el header llega con el
  // cmd de la CONSULTA (05 06), los datos con el ackKey (05 15) y el terminal
  // con el CRC del buffer. Aceptar solo el ackKey para el header descartaba
  // todo el historial (FC, presión, vitales) y dejaba el CRC roto.
  it("acepta el header con el cmd de la consulta (R88)", async () => {
    const { sync, sends, samples, notes } = setup();
    const heart = [
      0xb4, 0x11, 0x45, 0x32, 0x00, 0x52, 0xe9, 0x12, 0x45, 0x32, 0x00, 0x53,
    ];
    const done = sync.start([HEART]);

    expect(sends[0]).toEqual({ type: 0x0506, payload: [] });

    sync.handle(packet(0x0506, [...u16(2), ...u32(1), ...u32(heart.length)]));
    sync.handle(packet(0x0515, heart));
    sync.handle(packet(0x0580, [...u16(1), ...u16(heart.length), 0xfa, 0x6f]));
    await done;

    expect(samples.map((s) => s.value)).toEqual([82, 83]);
    expect(sends.at(-1)).toEqual({ type: 0x0580, payload: [0x00] });
    expect(
      notes.some((line) => line.includes("heart: 12 B → 2 muestras")),
    ).toBe(true);
  });

  it("pide cada tipo, ACKea el terminal y emite las muestras", async () => {
    const { sync, sends, samples } = setup();
    const buffer = sleepBuffer();
    const done = sync.start([SLEEP]);

    expect(sends[0]).toEqual({ type: 0x0504, payload: [] });

    sync.handle(packet(0x0513, header(buffer.length)));
    sync.handle(packet(0x0513, buffer));
    sync.handle(packet(0x0580, terminal(buffer)));
    await done;

    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("sleep");
    expect(samples[0].value).toBe(30);
    expect(sends.at(-1)).toEqual({ type: 0x0580, payload: [0x00] });
  });

  it("con un header de conteo cero (00 00) marca el tipo sin datos", async () => {
    const { sync, notes } = setup();
    const done = sync.start([SLEEP]);
    // El R88 responde así cuando no tiene registros de ese tipo.
    sync.handle(packet(0x0504, [0x00, 0x00]));
    await done;
    expect(notes.some((line) => line.includes("sleep: sin datos"))).toBe(true);
  });

  it("con CRC roto responde 0x04 y decodifica igual (no se pierde el tipo)", async () => {
    const { sync, sends, samples } = setup();
    const buffer = sleepBuffer();
    const done = sync.start([SLEEP]);

    sync.handle(packet(0x0513, header(buffer.length)));
    sync.handle(packet(0x0513, buffer));
    const bad = terminal(buffer);
    bad[bad.length - 1] ^= 0xff;
    sync.handle(packet(0x0580, bad));
    await done;

    // El ACK avisa del CRC roto (el anillo puede reenviar) pero el buffer
    // decodificado NO se descarta: hacerlo perdía tipos enteros como el sueño.
    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("sleep");
    expect(sends.at(-1)).toEqual({ type: 0x0580, payload: [0x04] });
  });

  it("un header corto significa 'sin datos' y pasa al siguiente tipo", async () => {
    const { sync, sends, notes } = setup();
    const done = sync.start([SLEEP, SPO2]);

    sync.handle(packet(0x0513, [0, 0, 0, 0]));
    await Promise.resolve();

    expect(sends.map((s) => s.type)).toEqual([0x0504, 0x051a]);
    expect(notes.some((line) => line.includes("sleep: sin datos"))).toBe(true);
    sync.handle(packet(0x0522, [0, 0, 0, 0]));
    await done;
  });

  it("un 0xFC marca el tipo como no soportado y no lo repite", async () => {
    const { sync, sends } = setup();
    const done = sync.start([SLEEP]);
    sync.handle(packet(0x0513, [0xfc]));
    await done;

    const second = sync.start([SLEEP]);
    await second;
    expect(sends.filter((s) => s.type === 0x0504)).toHaveLength(1);
  });

  it("espera una segunda sincronización en vez de resolverla mientras otra sigue", async () => {
    const { sync, sends } = setup();
    const first = sync.start([SLEEP]);
    const second = sync.start([SPO2]);

    expect(sends[0]).toEqual({ type: 0x0504, payload: [] });
    sync.handle(packet(0x0513, [0, 0, 0, 0]));
    await Promise.resolve();
    expect(sends.at(-1)).toEqual({ type: 0x051a, payload: [] });
    sync.handle(packet(0x0522, [0, 0, 0, 0]));
    await Promise.all([first, second]);
  });

  it("abort() cierra el volcado en curso", async () => {
    const { sync } = setup();
    const done = sync.start([SLEEP]);
    sync.abort();
    await done;
  });
});
