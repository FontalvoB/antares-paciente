import { describe, expect, it } from "vitest";
import { putNewestSample } from "../samples";
import type { HealthSample } from "../../devices/types";

const sample = (ts: number, value: number): HealthSample => ({
  metric: "spo2",
  value,
  unit: "%",
  ts,
  deviceId: "ring-1",
});

describe("putNewestSample", () => {
  it("acepta la primera lectura de una métrica", () => {
    const next = putNewestSample({}, sample(1_000, 97));
    expect(next.spo2?.value).toBe(97);
  });

  it("una lectura nueva reemplaza a la anterior", () => {
    const prev = { spo2: sample(1_000, 97) };
    const next = putNewestSample(prev, sample(2_000, 98));
    expect(next.spo2?.value).toBe(98);
    expect(next.spo2?.ts).toBe(2_000);
  });

  it("una lectura vieja del historial NO pisa la recién medida", () => {
    const prev = { spo2: sample(2_000, 98) };
    const next = putNewestSample(prev, sample(1_000, 95));
    expect(next).toBe(prev);
    expect(next.spo2?.value).toBe(98);
  });

  it("con la misma marca gana la última (valor definitivo)", () => {
    const prev = { spo2: sample(1_000, 95) };
    const next = putNewestSample(prev, sample(1_000, 98));
    expect(next.spo2?.value).toBe(98);
  });

  it("no toca otras métricas", () => {
    const prev = {
      spo2: sample(1_000, 97),
      heart_rate: {
        metric: "heart_rate" as const,
        value: 72,
        unit: "bpm",
        ts: 500,
        deviceId: "ring-1",
      },
    };
    const next = putNewestSample(prev, sample(2_000, 98));
    expect(next.heart_rate?.value).toBe(72);
  });
});
