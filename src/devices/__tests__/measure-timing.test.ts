import { describe, expect, it } from "vitest";
import { formatMeasureTiming } from "../measure-timing";

describe("formatMeasureTiming", () => {
  it("marca el inicio sin tiempos", () => {
    expect(
      formatMeasureTiming({
        device: "colmi",
        kind: "heart_rate",
        event: "start",
      }),
    ).toBe("[colmi] medida heart_rate: inicio");
  });

  it("registra el primer dato con segundos", () => {
    expect(
      formatMeasureTiming({
        device: "ycbt",
        kind: "heart_rate",
        event: "first",
        elapsedMs: 12_340,
      }),
    ).toBe("[ycbt] medida heart_rate: primer dato en 12.3 s");
  });

  it("cierra con resultado y lecturas", () => {
    expect(
      formatMeasureTiming({
        device: "colmi",
        kind: "blood_pressure",
        event: "done",
        elapsedMs: 30_000,
        readings: 3,
        outcome: "completada",
      }),
    ).toBe(
      "[colmi] medida blood_pressure: cierre completada en 30.0 s (3 lectura(s))",
    );
  });

  it("cierra sin lecturas cuando expira la ventana", () => {
    expect(
      formatMeasureTiming({
        device: "ycbt",
        kind: "spo2",
        event: "done",
        elapsedMs: 60_000,
        readings: 0,
        outcome: "timeout",
      }),
    ).toBe("[ycbt] medida spo2: cierre timeout en 60.0 s (0 lectura(s))");
  });

  it("acepta el modo crudo como nombre cuando no hay métrica", () => {
    expect(
      formatMeasureTiming({ device: "ycbt", kind: "3", event: "start" }),
    ).toBe("[ycbt] medida 3: inicio");
  });
});
