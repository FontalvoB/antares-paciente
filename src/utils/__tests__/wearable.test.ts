import { describe, expect, it } from "vitest";
import { agoLabel, formatSleep } from "../wearable";

// `t` de prueba: identidad con interpolación mínima de {param}.
const t = (source: string, params?: Record<string, string>) => {
  if (!params) return source;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    source,
  );
};

describe("agoLabel", () => {
  it("sin marca devuelve 'Sin datos aún'", () => {
    expect(agoLabel(undefined, t)).toBe("Sin datos aún");
  });

  it("una lectura reciente es 'En vivo'", () => {
    expect(agoLabel(Date.now() - 30_000, t)).toBe("En vivo");
  });

  it("minutos y horas se muestran en su unidad", () => {
    expect(agoLabel(Date.now() - 12 * 60_000, t)).toBe("Hace 12 min");
    expect(agoLabel(Date.now() - 3 * 60 * 60_000, t)).toBe("Hace 3 h");
  });
});

describe("formatSleep", () => {
  it("menos de una hora usa minutos", () => {
    expect(formatSleep(45, t)).toBe("45 min");
  });

  it("horas y minutos se combinan", () => {
    expect(formatSleep(393, t)).toBe("6 h 33 min");
    expect(formatSleep(414, t)).toBe("6 h 54 min");
  });

  it("horas exactas van sin '0 min'", () => {
    expect(formatSleep(420, t)).toBe("7 h");
  });
});
