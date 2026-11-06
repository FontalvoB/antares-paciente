import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceOrb } from "../VoiceOrb";

describe("VoiceOrb: recursos y accesibilidad", () => {
  let frames: Map<number, FrameRequestCallback>;
  let gl: WebGLRenderingContext;
  let media: MediaQueryList;
  let disconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    frames = new Map();
    let next = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => {
      frames.set(++next, cb);
      return next;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
    disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe = vi.fn();
      disconnect = disconnect;
    });
    media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", () => media);
    // Simula recursos GL, manteniendo observables compilación, dibujo y liberación.
    gl = new Proxy({} as WebGLRenderingContext, {
      get(target, key) {
        if (!(key in target)) {
          Reflect.set(target, key, vi.fn(() => {
            if (key === "getShaderParameter" || key === "getProgramParameter") return true;
            return {};
          }));
        }
        return Reflect.get(target, key);
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 200 } as DOMRect);
    vi.stubGlobal("devicePixelRatio", 3);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const tick = (time: number) => act(() => {
    const [id, callback] = [...frames.entries()][0];
    frames.delete(id);
    callback(time);
  });

  it("lee volumen real sin recrear GL al cambiar de fase; limita DPR a 2", () => {
    const input = vi.fn(() => 0.8), output = vi.fn(() => 0.4);
    const { container, rerender, unmount } = render(<VoiceOrb phase="listening" active getVolume={input} />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(400);
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.hasAttribute("tabindex")).toBe(false);
    tick(16);
    expect(input).toHaveBeenCalledOnce();
    rerender(<VoiceOrb phase="speaking" active getVolume={output} />);
    tick(32);
    expect(output).toHaveBeenCalledOnce();
    expect(canvas.getContext).toHaveBeenCalledOnce();
    expect(gl.drawArrays).toHaveBeenCalledTimes(2);
    rerender(<VoiceOrb phase="thinking" active getVolume={output} />);
    tick(48);
    expect(output).toHaveBeenCalledOnce();
    unmount();
    expect(frames.size).toBe(0);
    expect(gl.deleteProgram).toHaveBeenCalledOnce();
    expect(gl.deleteBuffer).toHaveBeenCalledOnce();
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("suspende rAF y listeners al cerrar, y vuelve a arrancar al abrir", () => {
    const { container, rerender } = render(<VoiceOrb phase="connecting" active />);
    expect(frames.size).toBe(1);
    rerender(<VoiceOrb phase="connecting" active={false} />);
    expect(container.querySelector("canvas")).toBeNull();
    expect(frames.size).toBe(0);
    expect(media.removeEventListener).toHaveBeenCalled();
    rerender(<VoiceOrb phase="connecting" active />);
    expect(frames.size).toBe(1);
  });

  it.each(["muted", "unavailable"] as const)("%s no crea canvas ni rAF", (phase) => {
    const { container } = render(<VoiceOrb phase={phase} active />);
    expect(container.childElementCount).toBe(0);
    expect(frames.size).toBe(0);
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it("reduced motion usa gradiente sin WebGL ni rAF y responde al cambio en vivo", () => {
    const { container } = render(<VoiceOrb phase="speaking" active />);
    const update = vi.mocked(media.addEventListener).mock.calls[0][1] as () => void;
    act(() => {
      Object.defineProperty(media, "matches", { value: true });
      update();
    });
    expect(frames.size).toBe(0);
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".voice-orb-static")).not.toBeNull();
  });

  it("respeta reduced motion desde el primer montaje sin pedir contexto", () => {
    Object.defineProperty(media, "matches", { value: true });
    const { container } = render(<VoiceOrb phase="connecting" active />);
    expect(container.querySelector(".voice-orb-static")).not.toBeNull();
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("un fallo de compilación devuelve null y libera los recursos parciales", () => {
    vi.mocked(gl.getShaderParameter).mockReturnValue(false);
    const { container } = render(<VoiceOrb phase="speaking" active />);
    expect(container.childElementCount).toBe(0);
    expect(gl.deleteShader).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
  });

  it("devuelve null cuando WebGL falla o se pierde el contexto", () => {
    const { container } = render(<VoiceOrb phase="listening" active />);
    act(() => container.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost")));
    expect(container.childElementCount).toBe(0);
    expect(frames.size).toBe(0);
    cleanup();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const fallback = render(<VoiceOrb phase="speaking" active />);
    expect(fallback.container.childElementCount).toBe(0);
    expect(frames.size).toBe(0);
  });
});
