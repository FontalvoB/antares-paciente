import { describe, expect, it } from "vitest";
import {
  backgroundLayer,
  compositeLayers,
  parseCssColors,
  relativeLuminance,
  toHex,
  toneForColor,
} from "../statusBarContrast";

describe("statusBarContrast", () => {
  it("lee rgb, rgba y color(srgb) que calcula el navegador", () => {
    expect(parseCssColors("rgb(20, 40, 85)")).toEqual([
      { r: 20, g: 40, b: 85, a: 1 },
    ]);
    expect(parseCssColors("rgba(0, 0, 0, 0)")[0].a).toBe(0);
    expect(parseCssColors("rgb(255 255 255 / 50%)")[0].a).toBe(0.5);
    const [srgb] = parseCssColors("color(srgb 1 0.5 0 / 0.25)");
    expect(srgb.r).toBe(255);
    expect(srgb.g).toBeCloseTo(127.5);
    expect(srgb.a).toBe(0.25);
  });

  it("clasifica la cabecera blanca de Vita como fondo claro (iconos oscuros)", () => {
    expect(toneForColor({ r: 255, g: 255, b: 255, a: 1 })).toBe("light");
    expect(toneForColor({ r: 238, g: 244, b: 249, a: 1 })).toBe("light");
  });

  it("clasifica azul marino y negro como fondo oscuro (iconos claros)", () => {
    expect(toneForColor({ r: 20, g: 40, b: 85, a: 1 })).toBe("dark");
    expect(toneForColor({ r: 6, g: 9, b: 26, a: 1 })).toBe("dark");
  });

  it.each([
    { r: 128, g: 128, b: 128, a: 1 },
    { r: 45, g: 134, b: 143, a: 1 },
  ])("mantiene legible la hora en fondos medios como la cabecera de Perfil: %j", (color) => {
    // En estos fondos el texto blanco queda por debajo de 4.5:1; el negro sí cumple.
    expect(toneForColor(color)).toBe("light");
    expect((relativeLuminance(color) + 0.05) / 0.05).toBeGreaterThanOrEqual(4.5);
  });

  it("la luminancia respeta los extremos WCAG", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1);
  });

  it("un degradado oscuro se trata como fondo opaco aunque background-color sea transparente", () => {
    const layer = backgroundLayer({
      backgroundColor: "rgba(0, 0, 0, 0)",
      backgroundImage:
        "linear-gradient(160deg, rgb(2, 52, 103) 0%, rgb(12, 76, 107) 58%, rgb(61, 123, 114) 100%)",
    });
    expect(layer?.a).toBe(1);
    expect(toneForColor(layer!)).toBe("dark");
  });

  it("sin color ni degradado no hay capa", () => {
    expect(
      backgroundLayer({
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
      }),
    ).toBeNull();
  });

  it("compone una capa translúcida sobre blanco", () => {
    const out = compositeLayers([{ r: 0, g: 0, b: 0, a: 0.5 }]);
    expect(Math.round(out.r)).toBe(128);
    expect(toHex(out)).toBe("#808080");
  });
});
