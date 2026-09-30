import { describe, expect, it } from "vitest";
import { wearingInfoUpdate } from "../wearing";
import type { HealthSample } from "../../devices/types";

const wearingSample = (value: number, ts: number): HealthSample => ({
  metric: "wearing",
  value,
  unit: "bool",
  ts,
  deviceId: "ring-1",
});

describe("wearingInfoUpdate", () => {
  it("ignora lo que no sea contacto", () => {
    const hr: HealthSample = {
      metric: "heart_rate",
      value: 72,
      unit: "bpm",
      ts: Date.now(),
      deviceId: "ring-1",
    };
    expect(wearingInfoUpdate(hr, {})).toBeNull();
  });

  it("enciende el flag con una muestra fresca de puesto", () => {
    expect(wearingInfoUpdate(wearingSample(1, Date.now()), {})).toEqual({
      wearing: true,
    });
  });

  it("apaga el flag con una muestra fresca de fuera", () => {
    expect(
      wearingInfoUpdate(wearingSample(0, Date.now()), { wearing: true }),
    ).toEqual({ wearing: false });
  });

  it("no toca nada si el flag ya coincide", () => {
    expect(
      wearingInfoUpdate(wearingSample(1, Date.now()), { wearing: true }),
    ).toBeNull();
  });

  it("ignora el wearing viejo del volcado de historial", () => {
    const yesterday = Date.now() - 24 * 60 * 60_000;
    expect(wearingInfoUpdate(wearingSample(0, yesterday), {})).toBeNull();
    expect(
      wearingInfoUpdate(wearingSample(1, yesterday), { wearing: false }),
    ).toBeNull();
  });
});
