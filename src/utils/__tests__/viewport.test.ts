import { describe, expect, it } from "vitest";
import {
  isTabletLayout,
  TABLET_SHORT_SIDE_MIN,
  type ViewportProbe,
} from "../viewport";

function probe(overrides: Partial<ViewportProbe>): ViewportProbe {
  return {
    userAgent: "Mozilla/5.0",
    platform: "Win32",
    maxTouchPoints: 0,
    innerWidth: 1280,
    innerHeight: 800,
    isNative: false,
    coarsePointer: false,
    anyCoarsePointer: false,
    hasTouch: false,
    ...overrides,
  };
}

describe("isTabletLayout", () => {
  it("no activa tablet en iPhone portrait", () => {
    expect(
      isTabletLayout(
        probe({
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          platform: "iPhone",
          maxTouchPoints: 5,
          innerWidth: 390,
          innerHeight: 844,
          coarsePointer: true,
        }),
      ),
    ).toBe(false);
  });

  it("no activa tablet en iPhone landscape (lado corto de teléfono)", () => {
    expect(
      isTabletLayout(
        probe({
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          platform: "iPhone",
          maxTouchPoints: 5,
          innerWidth: 844,
          innerHeight: 390,
          coarsePointer: true,
        }),
      ),
    ).toBe(false);
  });

  it("activa tablet por geometría aunque el puntero sea fino (Simulator / Safari RDM)", () => {
    expect(
      isTabletLayout(
        probe({
          innerWidth: 1024,
          innerHeight: 1366,
          coarsePointer: false,
          anyCoarsePointer: false,
          maxTouchPoints: 0,
          hasTouch: false,
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          platform: "MacIntel",
        }),
      ),
    ).toBe(true);
  });

  it("activa tablet en iPad clásico", () => {
    expect(
      isTabletLayout(
        probe({
          userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
          platform: "iPad",
          maxTouchPoints: 5,
          innerWidth: 768,
          innerHeight: 1024,
          coarsePointer: true,
        }),
      ),
    ).toBe(true);
  });

  it("activa tablet en iPadOS que se presenta como Macintosh", () => {
    expect(
      isTabletLayout(
        probe({
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          platform: "MacIntel",
          maxTouchPoints: 5,
          innerWidth: 1024,
          innerHeight: 1366,
          coarsePointer: false,
        }),
      ),
    ).toBe(true);
  });

  it("activa tablet en iPad Pro landscape", () => {
    expect(
      isTabletLayout(
        probe({
          userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
          platform: "iPad",
          maxTouchPoints: 5,
          innerWidth: 1366,
          innerHeight: 1024,
          coarsePointer: true,
        }),
      ),
    ).toBe(true);
  });

  it("activa tablet en Android tablet (UA sin Mobile)", () => {
    expect(
      isTabletLayout(
        probe({
          userAgent: "Mozilla/5.0 (Linux; Android 14; SM-X810) AppleWebKit/537.36",
          platform: "Linux armv8l",
          maxTouchPoints: 5,
          innerWidth: 800,
          innerHeight: 1280,
          coarsePointer: true,
        }),
      ),
    ).toBe(true);
  });

  it(`rechaza viewports con lado corto por debajo de ${TABLET_SHORT_SIDE_MIN}`, () => {
    expect(
      isTabletLayout(
        probe({
          userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
          maxTouchPoints: 5,
          innerWidth: 500,
          innerHeight: 400,
          coarsePointer: true,
        }),
      ),
    ).toBe(false);
  });
});
