import { describe, expect, it } from "vitest";
import { staleMeasureKinds } from "../measure";
import type { HealthSample, MetricKind } from "../types";

const KINDS: MetricKind[] = ["heart_rate", "spo2", "blood_pressure"];

function sample(ts: number): HealthSample {
  return { metric: "heart_rate", value: 72, unit: "bpm", ts, deviceId: "d" };
}

describe("staleMeasureKinds", () => {
  it("sin lecturas, todas están pendientes", () => {
    expect(staleMeasureKinds(KINDS, {}, 1_000_000, 600_000)).toEqual(KINDS);
  });

  it("descarta las lecturas dentro de la ventana", () => {
    const samples = { heart_rate: sample(1_000_000 - 60_000) };
    expect(staleMeasureKinds(KINDS, samples, 1_000_000, 600_000)).toEqual([
      "spo2",
      "blood_pressure",
    ]);
  });

  it("una lectura justo en el límite ya cuenta como vencida", () => {
    const samples = { spo2: sample(1_000_000 - 600_001) };
    expect(staleMeasureKinds(KINDS, samples, 1_000_000, 600_000)).toContain(
      "spo2",
    );
  });

  it("mantiene el orden de las métricas pedidas", () => {
    const samples = { spo2: sample(1_000_000) };
    expect(staleMeasureKinds(KINDS, samples, 1_000_000, 600_000)).toEqual([
      "heart_rate",
      "blood_pressure",
    ]);
  });
});
