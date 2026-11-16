/**
 * Contraste de la barra de estado (hora, cobertura, batería).
 *
 * La WebView se dibuja bajo la barra de estado (`viewport-fit=cover`), así que
 * el color de los iconos nativos debe elegirse según lo que la app pinta debajo.
 * Con cabecera clara los iconos deben ser oscuros y con fondo oscuro, claros;
 * si no, la hora y la batería «desaparecen». Estas funciones son puras salvo
 * `detectStatusBarTone`, que lee el DOM.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** `light`: fondo claro bajo la barra (iconos oscuros). `dark`: fondo oscuro (iconos claros). */
export type StatusBarTone = "light" | "dark";

const NUMBER = "-?\\d*\\.?\\d+";
const RGB_RE = new RegExp(
  `rgba?\\(\\s*(${NUMBER})[\\s,]+(${NUMBER})[\\s,]+(${NUMBER})(?:[\\s,/]+(${NUMBER})(%?))?\\s*\\)`,
  "gi",
);
const SRGB_RE = new RegExp(
  `color\\(\\s*srgb\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})(?:\\s*/\\s*(${NUMBER})(%?))?\\s*\\)`,
  "gi",
);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Extrae todos los colores `rgb()/rgba()/color(srgb …)` que el navegador calcula. */
export function parseCssColors(value: string): Rgba[] {
  const colors: Rgba[] = [];
  const alpha = (raw: string | undefined, percent: string | undefined) =>
    raw === undefined ? 1 : clamp01(percent ? Number(raw) / 100 : Number(raw));
  for (const m of value.matchAll(RGB_RE)) {
    colors.push({
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: alpha(m[4], m[5]),
    });
  }
  for (const m of value.matchAll(SRGB_RE)) {
    colors.push({
      r: clamp01(Number(m[1])) * 255,
      g: clamp01(Number(m[2])) * 255,
      b: clamp01(Number(m[3])) * 255,
      a: alpha(m[4], m[5]),
    });
  }
  return colors;
}

/** Luminancia relativa WCAG 2.x (0 negro … 1 blanco). */
export function relativeLuminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const s = clamp01(v / 255);
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Capa de fondo de un elemento. Un degradado cuenta como opaco con el color
 * medio de sus paradas; sin él se usa `background-color`.
 */
export function backgroundLayer(style: {
  backgroundColor: string;
  backgroundImage: string;
}): Rgba | null {
  if (style.backgroundImage.includes("gradient(")) {
    const stops = parseCssColors(style.backgroundImage).filter(
      (c) => c.a > 0.05,
    );
    if (stops.length) {
      const n = stops.length;
      return {
        r: stops.reduce((sum, c) => sum + c.r, 0) / n,
        g: stops.reduce((sum, c) => sum + c.g, 0) / n,
        b: stops.reduce((sum, c) => sum + c.b, 0) / n,
        a: 1,
      };
    }
  }
  const [color] = parseCssColors(style.backgroundColor);
  return color && color.a > 0 ? color : null;
}

/** Compone capas (de arriba hacia abajo) sobre blanco, como las pinta el navegador. */
export function compositeLayers(layersTopFirst: Rgba[]): Rgba {
  let out: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  for (const layer of [...layersTopFirst].reverse()) {
    out = {
      r: layer.r * layer.a + out.r * (1 - layer.a),
      g: layer.g * layer.a + out.g * (1 - layer.a),
      b: layer.b * layer.a + out.b * (1 - layer.a),
      a: 1,
    };
  }
  return out;
}

/** Elige iconos negros o blancos según cuál tenga mayor contraste WCAG. */
export function toneForColor(color: Rgba): StatusBarTone {
  const luminance = relativeLuminance(color);
  const darkIconsContrast = (luminance + 0.05) / 0.05;
  const lightIconsContrast = 1.05 / (luminance + 0.05);
  return darkIconsContrast >= lightIconsContrast ? "light" : "dark";
}

export function toHex({ r, g, b }: Rgba): string {
  const part = (v: number) =>
    Math.round(clamp01(v / 255) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Color efectivo bajo un elemento: recorre ancestros hasta una capa opaca. */
export function effectiveBackground(element: Element | null): Rgba {
  const layers: Rgba[] = [];
  for (let el = element; el; el = el.parentElement) {
    const layer = backgroundLayer(getComputedStyle(el));
    if (!layer) continue;
    layers.push(layer);
    if (layer.a >= 0.99) break;
  }
  return compositeLayers(layers);
}

/** Fondo que la app pinta bajo la barra de estado, o `null` si aún no hay DOM medible. */
export function detectStatusBarBackground(): Rgba | null {
  if (
    typeof document === "undefined" ||
    typeof document.elementFromPoint !== "function"
  )
    return null;
  const top = document.elementFromPoint(Math.max(1, window.innerWidth / 2), 2);
  return top ? effectiveBackground(top) : null;
}
