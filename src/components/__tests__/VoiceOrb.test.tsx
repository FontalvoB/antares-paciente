import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceOrb } from "../VoiceOrb";
const harness = vi.hoisted(() => ({ props: {} as Record<string, any>, frames: new Map<number, FrameRequestCallback>(), noWebGL: false }));
vi.mock("@react-three/fiber", async () => {
  const React = await import("react");
  return {
    useFrame: vi.fn(),
    Canvas: ({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) => {
      const scene = React.Children.toArray(children).at(-1) as React.ReactElement<Record<string, any>>;
      harness.props = scene.props;
      React.useEffect(() => {
        if (harness.noWebGL) return;
        let frame = 0;
        const tick = () => {
          scene.props.getInputVolume?.(); scene.props.getOutputVolume?.();
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      }, [scene.props]);
      return harness.noWebGL ? fallback : <canvas aria-hidden="true" />;
    },
  };
});
vi.mock("@react-three/drei/core/Texture", () => ({ useTexture: vi.fn() }));
vi.mock("@react-three/drei/core/PerformanceMonitor", () => ({ PerformanceMonitor: () => null }));
describe("VoiceOrb oficial: fases, volumen y ciclo de vida", () => {
  let media: MediaQueryList;
  beforeEach(() => {
    harness.frames.clear(); harness.noWebGL = false;
    let id = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { harness.frames.set(++id, cb); return id; });
    vi.stubGlobal("cancelAnimationFrame", (key: number) => harness.frames.delete(key));
    media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", () => media);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("mapea las cuatro fases y usa manual con fuentes reales separadas", async () => {
    const input = vi.fn(() => .4), output = vi.fn(() => .7);
    const { container, rerender } = render(<VoiceOrb active phase="connecting" getInputVolume={input} getOutputVolume={output} />);
    await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
    expect(harness.props.agentState).toBeNull();
    for (const [phase, state] of [["listening", "listening"], ["thinking", "thinking"], ["speaking", "talking"]] as const) {
      rerender(<VoiceOrb active phase={phase} getInputVolume={input} getOutputVolume={output} />);
      expect(harness.props.agentState).toBe(state);
      expect(harness.props.volumeMode).toBe("manual");
      expect(harness.props.getInputVolume()).toBe(phase === "listening" ? .4 : 0);
      expect(harness.props.getOutputVolume()).toBe(phase === "speaking" ? .7 : 0);
    }
  });
  it.each(["muted", "unavailable"] as const)("%s usa fallback sin canvas ni frames", (phase) => {
    const { container } = render(<VoiceOrb active phase={phase} />);
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".voice-orb-static")).not.toBeNull();
    expect(harness.frames.size).toBe(0);
  });
  it("cierra sin frames y retira listeners; reabre", async () => {
    const { container, rerender } = render(<VoiceOrb active phase="listening" />);
    await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
    expect(harness.frames.size).toBe(1);
    rerender(<VoiceOrb active={false} phase="listening" />);
    expect(harness.frames.size).toBe(0);
    expect(media.removeEventListener).toHaveBeenCalled();
    rerender(<VoiceOrb active phase="listening" />);
    await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
  });
  it("reduced motion inicial y cambio en vivo sin canvas", async () => {
    const { container } = render(<VoiceOrb active phase="speaking" />);
    await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
    act(() => {
      Object.defineProperty(media, "matches", { value: true });
      (vi.mocked(media.addEventListener).mock.calls[0][1] as () => void)();
    });
    expect(container.querySelector("canvas")).toBeNull();
    expect(harness.frames.size).toBe(0);
    cleanup();
    const initial = render(<VoiceOrb active phase="speaking" />);
    expect(initial.container.querySelector(".voice-orb-static")).not.toBeNull();
  });
  it("fallback sin WebGL", async () => {
    harness.noWebGL = true;
    const { container } = render(<VoiceOrb active phase="speaking" />);
    await waitFor(() => expect(container.querySelector(".voice-orb-static")).not.toBeNull());
    expect(container.querySelector("canvas")).toBeNull();
  });
  it("normaliza NaN y errores de sesi?n terminada", async () => {
    const { container, rerender } = render(<VoiceOrb active phase="speaking" getOutputVolume={() => NaN} />);
    await waitFor(() => expect(container.querySelector("canvas")).not.toBeNull());
    expect(harness.props.getOutputVolume()).toBe(0);
    rerender(<VoiceOrb active phase="speaking" getOutputVolume={() => { throw Error(); }} />);
    expect(harness.props.getOutputVolume()).toBe(0);
  });
});
