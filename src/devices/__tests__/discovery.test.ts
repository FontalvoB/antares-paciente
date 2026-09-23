import { describe, expect, it } from "vitest";
import { mergeDiscovered } from "../discovery";
import type { DeviceDescriptor } from "../types";

function device(
  deviceId: string,
  extra: Partial<DeviceDescriptor> = {},
): DeviceDescriptor {
  return {
    deviceId,
    name: `dev-${deviceId}`,
    kind: "ycbt",
    ...extra,
  };
}

describe("mergeDiscovered", () => {
  it("agrega un dispositivo nuevo al final de los existentes", () => {
    const current = [device("a", { rssi: -60 })];
    const merged = mergeDiscovered(current, device("b", { rssi: -70 }));
    expect(merged.map((d) => d.deviceId)).toEqual(["a", "b"]);
  });

  it("no duplica por deviceId y conserva el RSSI del anuncio", () => {
    const current = [device("a", { rssi: -60 })];
    const merged = mergeDiscovered(current, device("a", { rssi: -40 }));
    expect(merged).toHaveLength(1);
    expect(merged[0].rssi).toBe(-40);
  });

  it("mantiene la marca paired al reencontrarlo en el escaneo", () => {
    const current = [device("a", { paired: true })];
    const merged = mergeDiscovered(current, device("a", { rssi: -50 }));
    expect(merged[0].paired).toBe(true);
    expect(merged[0].rssi).toBe(-50);
  });

  it("marca paired si el emparejado llega después", () => {
    const current = [device("a", { rssi: -50 })];
    const merged = mergeDiscovered(current, device("a", { paired: true }));
    expect(merged[0].paired).toBe(true);
  });

  it("ordena los emparejados primero y luego por señal", () => {
    const current = [
      device("a", { rssi: -80 }),
      device("b", { paired: true }),
      device("c", { rssi: -50 }),
    ];
    const merged = mergeDiscovered(current, device("d", { paired: true }));
    expect(merged.map((d) => d.deviceId)).toEqual(["b", "d", "c", "a"]);
  });
});
