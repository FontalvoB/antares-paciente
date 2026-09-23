import { describe, expect, it } from "vitest";
import { bleSecondsToMs, buildPacket, parsePacket } from "../ycbt/protocol";
import type { YcbtPacket } from "../ycbt/protocol";
import { parseMeasurementStatus, parseRealtimePacket } from "../ycbt/realtime";
import type { HealthSample, MetricKind } from "../types";

const DEVICE = "ring-1";

function packet(type: number, payload: number[]): YcbtPacket {
  const parsed = parsePacket(buildPacket(type, payload));
  if (!parsed) throw new Error(`trama inválida: ${type.toString(16)}`);
  return parsed;
}

function byMetric(
  samples: HealthSample[],
): Partial<Record<MetricKind, HealthSample>> {
  return Object.fromEntries(samples.map((s) => [s.metric, s]));
}

describe("parseRealtimePacket", () => {
  it("decodifica la frecuencia cardíaca (0x0601)", () => {
    const samples = parseRealtimePacket(packet(0x0601, [72]), DEVICE);
    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("heart_rate");
    expect(samples[0].value).toBe(72);
    expect(samples[0].unit).toBe("bpm");
    expect(samples[0].deviceId).toBe(DEVICE);
    expect(samples[0].ts).toBeGreaterThan(0);
  });

  it("ignora medidas en cero", () => {
    expect(parseRealtimePacket(packet(0x0601, [0]), DEVICE)).toEqual([]);
    expect(parseRealtimePacket(packet(0x0602, [0]), DEVICE)).toEqual([]);
  });

  it("decodifica la saturación de oxígeno (0x0602)", () => {
    const samples = parseRealtimePacket(packet(0x0602, [98]), DEVICE);
    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("spo2");
    expect(samples[0].value).toBe(98);
    expect(samples[0].unit).toBe("%");
  });

  it("decodifica la presión arterial (0x0603) con FC, HRV y SpO2", () => {
    const samples = parseRealtimePacket(
      packet(0x0603, [120, 80, 70, 45, 97]),
      DEVICE,
    );
    const metrics = byMetric(samples);
    expect(metrics.blood_pressure?.value).toBe(120);
    expect(metrics.blood_pressure?.value2).toBe(80);
    expect(metrics.blood_pressure?.unit).toBe("mmHg");
    expect(metrics.heart_rate?.value).toBe(70);
    expect(metrics.hrv?.value).toBe(45);
    expect(metrics.spo2?.value).toBe(97);
  });

  it("descarta la presión si la sistólica es cero", () => {
    expect(parseRealtimePacket(packet(0x0603, [0, 80, 70]), DEVICE)).toEqual(
      [],
    );
  });

  it("decodifica el estado integral (0x060A)", () => {
    const payload = new Array(25).fill(0);
    payload[0] = 0x60;
    payload[1] = 0x18;
    payload[2] = 0x00; // 6.240 pasos
    payload[3] = 0x18;
    payload[4] = 0x10; // 4.120 m
    payload[5] = 0xd2;
    payload[6] = 0x00; // 210 kcal
    payload[7] = 76;
    payload[8] = 118;
    payload[9] = 76;
    payload[10] = 98;
    payload[11] = 16;
    payload[12] = 36;
    payload[13] = 6; // 36,6 °C
    payload[14] = 1; // puesto

    const samples = parseRealtimePacket(packet(0x060a, payload), DEVICE);
    const metrics = byMetric(samples);
    expect(samples).toHaveLength(9);
    expect(metrics.heart_rate?.value).toBe(76);
    expect(metrics.spo2?.value).toBe(98);
    expect(metrics.blood_pressure?.value).toBe(118);
    expect(metrics.blood_pressure?.value2).toBe(76);
    expect(metrics.respiratory_rate?.value).toBe(16);
    expect(metrics.temperature?.value).toBeCloseTo(36.6);
    expect(metrics.steps?.value).toBe(6240);
    expect(metrics.distance?.value).toBe(4120);
    expect(metrics.calories?.value).toBe(210);
    expect(metrics.wearing?.value).toBe(1);
    samples.forEach((s) => expect(s.deviceId).toBe(DEVICE));
  });

  it("descarta las tramas de calentamiento y las demasiado cortas", () => {
    expect(
      parseRealtimePacket(packet(0x060a, new Array(25).fill(0)), DEVICE),
    ).toEqual([]);
    expect(
      parseRealtimePacket(packet(0x060a, new Array(19).fill(1)), DEVICE),
    ).toEqual([]);
  });

  it("decodifica el cambio de contacto (0x0613) con su marca de tiempo", () => {
    const samples = parseRealtimePacket(
      packet(0x0613, [100, 0x00, 0x00, 0x00, 1]),
      DEVICE,
    );
    expect(samples).toHaveLength(1);
    expect(samples[0].metric).toBe("wearing");
    expect(samples[0].value).toBe(1);
    expect(samples[0].ts).toBe(bleSecondsToMs(100));
  });

  it("ignora los paquetes que no son de medida en vivo", () => {
    expect(parseRealtimePacket(packet(0x0610, [1, 2, 3]), DEVICE)).toEqual([]);
    expect(parseRealtimePacket(packet(0x0200, [0x47, 0x43]), DEVICE)).toEqual(
      [],
    );
  });
});

describe("parseRealtimePacket — estado en vivo (0x0600)", () => {
  it("decodifica pasos, distancia y calorías del día", () => {
    const samples = parseRealtimePacket(
      packet(0x0600, [0x60, 0x18, 0x18, 0x10, 0xd2, 0x00]),
      DEVICE,
    );
    const metrics = byMetric(samples);
    expect(samples).toHaveLength(3);
    expect(metrics.steps?.value).toBe(6240);
    expect(metrics.steps?.unit).toBe("count");
    expect(metrics.distance?.value).toBe(4120);
    expect(metrics.calories?.value).toBe(210);
  });

  it("descarta la trama incompleta", () => {
    expect(
      parseRealtimePacket(packet(0x0600, [0x60, 0x18, 0x00]), DEVICE),
    ).toEqual([]);
  });
});

describe("parseMeasurementStatus (04 13)", () => {
  it("decodifica FC, presión y SpO2 del push de medida", () => {
    expect(
      parseMeasurementStatus(new Uint8Array([0x00, 1, 74]), DEVICE)[0],
    ).toMatchObject({ metric: "heart_rate", value: 74 });

    const blood = parseMeasurementStatus(
      new Uint8Array([0x01, 1, 118, 76]),
      DEVICE,
    )[0];
    expect(blood.metric).toBe("blood_pressure");
    expect(blood.value).toBe(118);
    expect(blood.value2).toBe(76);

    expect(
      parseMeasurementStatus(new Uint8Array([0x02, 1, 97]), DEVICE)[0],
    ).toMatchObject({ metric: "spo2", value: 97 });
  });

  it("ignora modos sin equivalente en la app", () => {
    expect(
      parseMeasurementStatus(new Uint8Array([0x0c, 1, 50]), DEVICE),
    ).toEqual([]);
  });
});

// El barrido de SpO2 emite 0 o valores basura durante el calentamiento; el
// SDK del fabricante gatea con su `spo2Range` y la app debe igual.
describe("gate de plausibilidad de SpO2", () => {
  it("descarta el calentamiento (0) y valores imposibles", () => {
    expect(parseRealtimePacket(packet(0x0602, [0]), DEVICE)).toEqual([]);
    expect(parseRealtimePacket(packet(0x0602, [60]), DEVICE)).toEqual([]);
    expect(parseRealtimePacket(packet(0x0602, [101]), DEVICE)).toEqual([]);
  });

  it("acepta una lectura en rango", () => {
    expect(parseRealtimePacket(packet(0x0602, [97]), DEVICE)[0]).toMatchObject({
      metric: "spo2",
      value: 97,
    });
  });

  it("aplica el mismo gate al campo de SpO2 de las tramas compuestas", () => {
    const blood = new Array(5).fill(0);
    blood[0] = 120;
    blood[1] = 80;
    blood[4] = 40; // fuera de rango
    expect(parseRealtimePacket(packet(0x0603, blood), DEVICE)).toHaveLength(1);

    blood[4] = 96;
    const samples = parseRealtimePacket(packet(0x0603, blood), DEVICE);
    expect(samples.some((s) => s.metric === "spo2" && s.value === 96)).toBe(
      true,
    );
  });
});
