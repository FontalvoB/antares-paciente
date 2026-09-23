import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canAutoReconnect,
  clearSavedDevice,
  loadSavedDevice,
  saveDevice,
} from "../device-store";
import type { DeviceDescriptor } from "../types";

const KEY = "antares_last_device";

const descriptor: DeviceDescriptor = {
  deviceId: "ABC-123",
  name: "R88 C1BF",
  kind: "ycbt",
  rssi: -62,
};

describe("device-store", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("guarda y recupera el dispositivo con su marca de tiempo", () => {
    saveDevice(descriptor);
    const saved = loadSavedDevice();
    expect(saved).toMatchObject({
      deviceId: "ABC-123",
      name: "R88 C1BF",
      kind: "ycbt",
      paired: true,
    });
    expect(saved?.lastConnectedAt).toBeGreaterThan(0);
  });

  it("sin nada guardado devuelve null", () => {
    expect(loadSavedDevice()).toBeNull();
  });

  it("un JSON corrupto no rompe la carga", () => {
    localStorage.setItem(KEY, "{no-es-json");
    expect(loadSavedDevice()).toBeNull();
  });

  it("un registro sin deviceId se descarta", () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "sin id" }));
    expect(loadSavedDevice()).toBeNull();
  });

  it("clearSavedDevice borra la memoria", () => {
    saveDevice(descriptor);
    clearSavedDevice();
    expect(loadSavedDevice()).toBeNull();
  });

  it("solo auto-reconecta en nativo y con dispositivo guardado", () => {
    const saved = { ...descriptor, paired: true, lastConnectedAt: 1 };
    expect(canAutoReconnect("ios", saved)).toBe(true);
    expect(canAutoReconnect("android", saved)).toBe(true);
    expect(canAutoReconnect("web", saved)).toBe(false);
    expect(canAutoReconnect("ios", null)).toBe(false);
  });
});
