import { describe, expect, it } from "vitest";
import { decodeHistory } from "../ycbt/records";

const DEVICE = "ring-1";

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u24(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}

function u32(value: number): number[] {
  return [
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ];
}

describe("decodeHistory — sport", () => {
  it("emite pasos y distancia como cubetas aditivas", () => {
    const record = [
      ...u32(1000),
      ...u32(2000),
      ...u16(1200),
      ...u16(850),
      ...u16(40),
    ];
    const samples = decodeHistory("sport", Uint8Array.from(record), DEVICE);
    expect(samples).toHaveLength(2);
    expect(samples[0].metric).toBe("steps");
    expect(samples[0].value).toBe(1200);
    expect(samples[0].agg).toBe("sum");
    expect(samples[1].metric).toBe("distance");
    expect(samples[1].value).toBe(850);
  });

  it("ignora cubetas vacías", () => {
    const record = [
      ...u32(1000),
      ...u32(2000),
      ...u16(0),
      ...u16(0),
      ...u16(0),
    ];
    expect(decodeHistory("sport", Uint8Array.from(record), DEVICE)).toEqual([]);
  });
});

describe("decodeHistory — sueño", () => {
  function sleepSession(
    start: number,
    segments: Array<{ tag: number; at: number; seconds: number }>,
  ): number[] {
    const ends = segments.reduce(
      (max, seg) => Math.max(max, seg.at + seg.seconds),
      start,
    );
    const header = [
      0,
      0,
      ...u16(20 + segments.length * 8),
      ...u32(start),
      ...u32(ends),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ];
    const body = segments.flatMap((seg) => [
      seg.tag,
      ...u32(seg.at),
      ...u24(seg.seconds),
    ]);
    return [...header, ...body];
  }

  it("suma la duración de los segmentos válidos", () => {
    const buffer = Uint8Array.from(
      sleepSession(1000, [
        { tag: 0x02, at: 1000, seconds: 1800 },
        { tag: 0x01, at: 2800, seconds: 900 },
      ]),
    );
    const samples = decodeHistory("sleep", buffer, DEVICE);
    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("sleep");
    expect(samples[0].value).toBe(45);
    expect(samples[0].unit).toBe("min");
    expect(samples[0].ts).toBeGreaterThan(0);
  });

  it("ignora tags desconocidos sin cortar la sesión", () => {
    const buffer = Uint8Array.from(
      sleepSession(1000, [
        { tag: 0x02, at: 1000, seconds: 1800 },
        { tag: 0xf6, at: 2800, seconds: 3600 },
        { tag: 0x01, at: 6400, seconds: 900 },
      ]),
    );
    const samples = decodeHistory("sleep", buffer, DEVICE);
    expect(samples).toHaveLength(1);
    expect(samples[0].value).toBe(45);
  });

  it("deduplica segmentos repetidos por hora de inicio", () => {
    const buffer = Uint8Array.from(
      sleepSession(1000, [
        { tag: 0x02, at: 1000, seconds: 1800 },
        { tag: 0x02, at: 1000, seconds: 1800 },
      ]),
    );
    expect(decodeHistory("sleep", buffer, DEVICE)[0].value).toBe(30);
  });

  it("decodifica dos sesiones consecutivas", () => {
    const buffer = Uint8Array.from([
      ...sleepSession(1000, [{ tag: 0x02, at: 1000, seconds: 600 }]),
      ...sleepSession(5000, [{ tag: 0x01, at: 5000, seconds: 1200 }]),
    ]);
    const samples = decodeHistory("sleep", buffer, DEVICE);
    expect(samples.map((s) => s.value)).toEqual([10, 20]);
  });

  it("usa fallback para segmentos válidos con header/longitud de firmware variante", () => {
    const ringNow = Math.floor(Date.now() / 1000) - 946684800 - 3 * 60 * 60;
    const buffer = Uint8Array.from([
      0x10,
      ...u32(ringNow),
      ...u24(1800),
      0x20,
      ...u32(ringNow + 1800),
      ...u24(900),
    ]);
    const samples = decodeHistory("sleep", buffer, DEVICE);
    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("sleep");
    expect(samples[0].value).toBe(45);
  });
});

describe("decodeHistory — vitales", () => {
  it("decodifica FC del historial", () => {
    const record = [...u32(1000), 0, 72];
    const samples = decodeHistory("heart", Uint8Array.from(record), DEVICE);
    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("heart_rate");
    expect(samples[0].value).toBe(72);
    // El volcado se marca como historial: no debe presentarse como "En vivo".
    expect(samples[0].source).toBe("history");
  });

  it("descarta FC fuera de rango", () => {
    expect(
      decodeHistory("heart", Uint8Array.from([...u32(1000), 0, 0]), DEVICE),
    ).toEqual([]);
    expect(
      decodeHistory("heart", Uint8Array.from([...u32(1000), 0, 255]), DEVICE),
    ).toEqual([]);
  });

  it("decodifica presión con FC", () => {
    const record = [...u32(1000), 0, 118, 76, 70];
    const samples = decodeHistory("blood", Uint8Array.from(record), DEVICE);
    expect(samples).toHaveLength(2);
    expect(samples[0].metric).toBe("blood_pressure");
    expect(samples[0].value).toBe(118);
    expect(samples[0].value2).toBe(76);
    expect(samples[1].metric).toBe("heart_rate");
  });

  it("decodifica el registro combinado", () => {
    const record = new Array(20).fill(0);
    record[0] = 0xe8;
    record[1] = 0x03;
    record[7] = 120;
    record[8] = 80;
    record[9] = 97;
    record[10] = 16;
    record[11] = 45;
    record[13] = 36;
    record[14] = 6;
    const samples = decodeHistory("all", Uint8Array.from(record), DEVICE);
    const byMetric = Object.fromEntries(
      samples.map((s) => [s.metric, s.value]),
    );
    expect(byMetric.blood_pressure).toBe(120);
    expect(byMetric.spo2).toBe(97);
    expect(byMetric.respiratory_rate).toBe(16);
    expect(byMetric.hrv).toBe(45);
    expect(byMetric.temperature).toBeCloseTo(36.6);
  });

  it("decodifica SpO2 y descarta ceros", () => {
    expect(
      decodeHistory("spo2", Uint8Array.from([...u32(1000), 0, 98]), DEVICE)[0]
        .value,
    ).toBe(98);
    expect(
      decodeHistory("spo2", Uint8Array.from([...u32(1000), 0, 0]), DEVICE),
    ).toEqual([]);
  });
});
