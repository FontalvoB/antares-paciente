import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useKeyboardInset } from "../useKeyboardInset";

const mocks = vi.hoisted(() => ({
  native: false,
  platform: "web",
  setScroll: vi.fn(() => Promise.resolve()),
  addListener: vi.fn(() =>
    Promise.resolve({ remove: () => Promise.resolve() }),
  ),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
    getPlatform: () => mocks.platform,
  },
}));

vi.mock("@capacitor/keyboard", () => ({
  Keyboard: { setScroll: mocks.setScroll, addListener: mocks.addListener },
}));

function Probe() {
  useKeyboardInset();
  return null;
}

describe("useKeyboardInset · scroll nativo de iOS", () => {
  beforeEach(() => {
    mocks.setScroll.mockClear();
    mocks.addListener.mockClear();
  });
  afterEach(() => cleanup());

  it("en iOS nativo bloquea el scroll del WKWebView para que el teclado no desplace la app", () => {
    mocks.native = true;
    mocks.platform = "ios";
    render(<Probe />);
    expect(mocks.setScroll).toHaveBeenCalledExactlyOnceWith({
      isDisabled: true,
    });
  });

  it("en Android y web no toca el scroll nativo", () => {
    mocks.native = true;
    mocks.platform = "android";
    render(<Probe />);
    cleanup();
    mocks.native = false;
    mocks.platform = "web";
    render(<Probe />);
    expect(mocks.setScroll).not.toHaveBeenCalled();
  });

  it("restablece el desplazamiento del shell cuando iOS lo mueve", () => {
    mocks.native = true;
    mocks.platform = "ios";
    const shell = document.createElement("div");
    shell.className = "app-shell";
    let top = 72;
    let left = 20;
    Object.defineProperty(shell, "scrollTop", {
      get: () => top,
      set: (value) => {
        top = value;
      },
      configurable: true,
    });
    Object.defineProperty(shell, "scrollLeft", {
      get: () => left,
      set: (value) => {
        left = value;
      },
      configurable: true,
    });
    document.body.appendChild(shell);
    render(<Probe />);
    window.dispatchEvent(new Event("resize"));
    expect({ top, left }).toEqual({ top: 0, left: 0 });
    shell.remove();
  });
});
