import { describe, expect, it } from "vitest";
import {
  decodeSleepBlob,
  decodeSpo2Hours,
  nightHasHrSupport,
  parseBcFrames,
} from "../colmi/bc";
import type { HealthSample } from "../types";
import { BC_MAGIC, BC_SLEEP, bcFrame, crc16Modbus } from "../colmi/protocol";

const DEVICE = "band-1";

describe("bc — framing", () => {
  it("construye la trama con magic, tipo, longitud y CRC del body", () => {
    const body = Uint8Array.from([1, 2, 3, 4]);
    const frame = bcFrame(BC_SLEEP, body);
    expect(frame[0]).toBe(BC_MAGIC);
    expect(frame[1]).toBe(BC_SLEEP);
    expect(frame[2] | (frame[3] << 8)).toBe(4);
    expect(frame[4] | (frame[5] << 8)).toBe(crc16Modbus(body));
    expect(Array.from(frame.slice(6))).toEqual([1, 2, 3, 4]);
  });

  it("reensambla tramas partidas en varias notificaciones", () => {
    const first = bcFrame(0x27, Uint8Array.from([9, 9, 9]));
    const second = bcFrame(0x2a, Uint8Array.from([7, 7]));
    const merged = Uint8Array.from([...first, ...second]);

    const partA = parseBcFrames(merged.slice(0, 5));
    expect(partA.frames).toHaveLength(0);
    const partB = parseBcFrames(
      Uint8Array.from([...partA.rest, ...merged.slice(5, 12)]),
    );
    expect(partB.frames).toHaveLength(1);
    const partC = parseBcFrames(
      Uint8Array.from([...partB.rest, ...merged.slice(12)]),
    );
    expect(partC.frames).toHaveLength(1);
    expect(partC.frames[0]!.type).toBe(0x2a);
    expect(Array.from(partC.frames[0]!.body)).toEqual([7, 7]);
  });
});

describe("bc — blob de sueño (0x27)", () => {
  it("decodifica la noche con sus fases y la hora de despertar", () => {
    // N=1: [idx=0][?][inicio=1380 (23:00)][fin=400 (06:40)] + fases que suman 460.
    const body = Uint8Array.from([
      1, 0, 0, 0x64, 0x05, 0x90, 0x01, 2, 200, 3, 150, 5, 110,
    ]);
    const samples = decodeSleepBlob(body, DEVICE);
    expect(samples).toHaveLength(1);
    expect(samples[0]!.metric).toBe("sleep");
    expect(samples[0]!.value).toBe(460);
    const wake = new Date(samples[0]!.ts);
    expect(wake.getHours()).toBe(6);
    expect(wake.getMinutes()).toBe(40);
  });

  it("ignora un blob vacío o truncado", () => {
    expect(decodeSleepBlob(Uint8Array.from([0]), DEVICE)).toEqual([]);
    expect(decodeSleepBlob(Uint8Array.from([1, 0, 0]), DEVICE)).toEqual([]);
  });

  // La banda responde así mientras no se haya dormido con ella puesta.
  it("sin noches registradas no emite muestras", () => {
    expect(
      decodeSleepBlob(Uint8Array.from(new Array(8).fill(0)), DEVICE),
    ).toEqual([]);
  });
});

describe("bc — SpO2 por hora (0x2A)", () => {
  it("emite el máximo de cada hora y salta las horas sin medida", () => {
    const pairs = new Array(48).fill(0);
    pairs[7 * 2] = 96;
    pairs[7 * 2 + 1] = 99;
    pairs[8 * 2] = 95;
    pairs[8 * 2 + 1] = 97;
    const samples = decodeSpo2Hours(Uint8Array.from([0, ...pairs]), DEVICE);
    expect(samples.map((s) => s.value)).toEqual([99, 97]);
    expect(new Date(samples[0]!.ts).getHours()).toBe(7);
    expect(new Date(samples[1]!.ts).getHours()).toBe(8);
  });
});

describe("nightHasHrSupport — noches fantasma de la banda", () => {
  const wake = new Date(2026, 8, 21, 7, 0).getTime();
  const sleepSample = (minutes: number): HealthSample => ({
    metric: "sleep",
    value: minutes,
    unit: "min",
    ts: wake,
    deviceId: "dev-1",
  });
  const hrSample = (ts: number, value: number): HealthSample => ({
    metric: "heart_rate",
    value,
    unit: "bpm",
    ts,
    deviceId: "dev-1",
  });

  it("conserva la noche cuando hay FC suficiente en su ventana", () => {
    const hr = Array.from({ length: 6 }, (_, i) =>
      hrSample(wake - (i + 1) * 5 * 60_000, 58),
    );
    expect(nightHasHrSupport(sleepSample(420), hr)).toBe(true);
  });

  it("descarta la noche cuando el volcado trae FC pero ninguna en la ventana", () => {
    const hr = [hrSample(wake + 60_000, 70), hrSample(wake - 30 * 60 * 60_000, 65)];
    expect(nightHasHrSupport(sleepSample(420), hr)).toBe(false);
  });

  it("no filtra si el volcado no trajo ninguna FC (log apagado)", () => {
    expect(nightHasHrSupport(sleepSample(420), [])).toBe(true);
  });

  it("ignora lecturas implausibles (fuera de 30–140 lpm)", () => {
    const hr = Array.from({ length: 6 }, (_, i) =>
      hrSample(wake - (i + 1) * 5 * 60_000, 190),
    );
    expect(nightHasHrSupport(sleepSample(420), hr)).toBe(false);
  });
});
