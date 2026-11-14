import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setStyle, detect } = vi.hoisted(() => ({
  setStyle: vi.fn(() => Promise.resolve()),
  detect: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock("@capacitor/status-bar", () => ({
  StatusBar: { setStyle },
  Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
}));
vi.mock("../../utils/statusBarContrast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/statusBarContrast")>()),
  detectStatusBarBackground: detect,
}));

import { useStatusBarContrast } from "../useStatusBarContrast";

function Probe() {
  useStatusBarContrast();
  return null;
}

describe("useStatusBarContrast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setStyle.mockClear();
    detect.mockReset();
    document.head.innerHTML = '<meta name="theme-color" content="#102a50" />';
  });
  afterEach(() => vi.useRealTimers());

  it("fondo claro → iconos oscuros (Style.Light) y theme-color igual al fondo", async () => {
    detect.mockReturnValue({ r: 255, g: 255, b: 255, a: 1 });
    render(<Probe />);
    await vi.advanceTimersByTimeAsync(700);
    expect(setStyle).toHaveBeenCalledTimes(1);
    expect(setStyle).toHaveBeenCalledWith({ style: "LIGHT" });
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe("#ffffff");
  });

  it("fondo oscuro → iconos claros (Style.Dark)", async () => {
    detect.mockReturnValue({ r: 20, g: 40, b: 85, a: 1 });
    render(<Probe />);
    await vi.advanceTimersByTimeAsync(700);
    expect(setStyle).toHaveBeenCalledWith({ style: "DARK" });
  });

  it("no repite la llamada nativa si el tono no cambia y reacciona cuando cambia", async () => {
    detect.mockReturnValue({ r: 255, g: 255, b: 255, a: 1 });
    render(<Probe />);
    await vi.advanceTimersByTimeAsync(700);
    document.body.appendChild(document.createElement("div"));
    await vi.advanceTimersByTimeAsync(300);
    expect(setStyle).toHaveBeenCalledTimes(1);
    detect.mockReturnValue({ r: 6, g: 9, b: 26, a: 1 });
    document.body.appendChild(document.createElement("div"));
    await vi.advanceTimersByTimeAsync(300);
    expect(setStyle).toHaveBeenCalledTimes(2);
    expect(setStyle).toHaveBeenLastCalledWith({ style: "DARK" });
  });

  it("sin DOM medible no cambia nada", async () => {
    detect.mockReturnValue(null);
    render(<Probe />);
    await vi.advanceTimersByTimeAsync(700);
    expect(setStyle).not.toHaveBeenCalled();
  });
});
