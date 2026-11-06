import { afterEach, describe, expect, it, vi } from "vitest";
import { createVoiceMicLevel } from "../voiceMicLevel";
afterEach(() => vi.unstubAllGlobals());
describe("medidor real de microfono", () => {
  it("calcula RMS, silencia y libera el grafo y tracks", async () => {
    const track = { enabled: true, stop: vi.fn() };
    const analyser = { fftSize: 0, getFloatTimeDomainData: (data: Float32Array) => data.fill(.1), disconnect: vi.fn() };
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) } });
    vi.stubGlobal("AudioContext", class { state = "running"; createAnalyser = () => analyser; createMediaStreamSource = () => source; close = close; });
    const meter = createVoiceMicLevel();
    await meter.request();
    expect(meter.getVolume()).toBeCloseTo(.46);
    meter.setMuted(true);
    expect(track.enabled).toBe(false); expect(meter.getVolume()).toBe(0);
    meter.release();
    expect(track.stop).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledOnce(); expect(analyser.disconnect).toHaveBeenCalledOnce();
    expect(meter.getVolume()).toBe(0);
  });
  it("un permiso tardio tras cerrar detiene el stream sin crear WebAudio", async () => {
    let resolve!: (stream: unknown) => void;
    const stop = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(r => { resolve = r; }) } });
    const context = vi.fn(); vi.stubGlobal("AudioContext", context);
    const meter = createVoiceMicLevel(); const pending = meter.request();
    meter.release(); resolve({ getTracks: () => [{ stop }] }); await pending;
    expect(stop).toHaveBeenCalledOnce(); expect(context).not.toHaveBeenCalled();
  });
});
