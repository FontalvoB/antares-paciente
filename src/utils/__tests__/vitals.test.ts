import { describe, expect, it } from "vitest";
import {
  hoursFromMinutes,
  minutesFromHours,
  vitalBar,
  vitalNumber,
  vitalStatus,
} from "../vitals";

// `t` de prueba: identidad con interpolación mínima de {param}.
const t = (source: string, params?: Record<string, string>) => {
  if (!params) return source;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    source,
  );
};

describe("vitalNumber", () => {
  it("acepta coma decimal", () => {
    expect(vitalNumber("36,5")).toBe(36.5);
  });

  it("con presión toma la sistólica", () => {
    expect(vitalNumber("118/76")).toBe(118);
  });

  it("vacío o basura devuelve NaN", () => {
    expect(Number.isNaN(vitalNumber("  "))).toBe(true);
    expect(Number.isNaN(vitalNumber("abc"))).toBe(true);
  });
});

describe("vitalStatus — rango", () => {
  const lo = 50;
  const hi = 100;

  it("sin valor no hay estado", () => {
    expect(vitalStatus(NaN, lo, hi, t)).toEqual({ label: "—", cls: "" });
  });

  it("por debajo y por encima avisan", () => {
    expect(vitalStatus(45, lo, hi, t)).toEqual({
      label: "Bajo",
      cls: "warn",
    });
    expect(vitalStatus(120, lo, hi, t)).toEqual({
      label: "Alto",
      cls: "warn",
    });
  });

  it("dentro del rango queda en verde", () => {
    expect(vitalStatus(72, lo, hi, t)).toEqual({
      label: "En rango",
      cls: "ok",
    });
  });
});

describe("vitalStatus — meta", () => {
  it("por debajo de la meta queda en progreso (sin aviso rojo)", () => {
    expect(vitalStatus(540, 0, 8000, t, 8000)).toEqual({
      label: "En progreso",
      cls: "",
    });
  });

  it("al llegar a la meta la marca", () => {
    expect(vitalStatus(8000, 0, 8000, t, 8000)).toEqual({
      label: "Meta alcanzada",
      cls: "ok",
    });
  });
});

describe("vitalBar — rango con dominio visible", () => {
  // Sueño: rango 420–540 min, dominio 0–720 (12 h).
  const sleep = { lo: 420, hi: 540, min: 0, max: 720 };

  it("414 min queda al 57.5% (no pegado al inicio)", () => {
    const bar = vitalBar(414, sleep);
    expect(bar.pct).toBeCloseTo(57.5, 1);
    expect(bar.bandLeft).toBeCloseTo(58.33, 1);
    expect(bar.bandWidth).toBeCloseTo(16.67, 1);
  });

  it("dentro del rango el puntero cae sobre la banda", () => {
    const bar = vitalBar(480, sleep);
    expect(bar.pct).toBeCloseTo(66.67, 1);
    expect(bar.pct).toBeGreaterThanOrEqual(bar.bandLeft);
    expect(bar.pct).toBeLessThanOrEqual(bar.bandLeft + bar.bandWidth);
  });

  it("apenas bajo el rango sigue visible (fc 45 con dominio 30–180)", () => {
    expect(vitalBar(45, { lo: 50, hi: 100, min: 30, max: 180 }).pct).toBe(10);
  });

  it("fuera del dominio se recorta a los bordes", () => {
    const fc = { lo: 50, hi: 100, min: 30, max: 180 };
    expect(vitalBar(20, fc).pct).toBe(0);
    expect(vitalBar(200, fc).pct).toBe(100);
  });

  it("sin min/max el dominio es el rango saludable", () => {
    expect(vitalBar(45, { lo: 50, hi: 100 })).toEqual({
      pct: 0,
      bandLeft: 0,
      bandWidth: 100,
    });
  });
});

describe("vitalBar — meta", () => {
  const steps = {
    lo: 0,
    hi: 8000,
    min: 0,
    max: 8000,
    kind: "goal" as const,
    goal: 8000,
  };

  it("la banda es el relleno de progreso", () => {
    expect(vitalBar(6240, steps)).toEqual({
      pct: 78,
      bandLeft: 0,
      bandWidth: 78,
    });
  });

  it("sin valor el relleno queda en cero", () => {
    expect(vitalBar(NaN, steps)).toEqual({ pct: 0, bandLeft: 0, bandWidth: 0 });
  });
});

describe("horas y minutos del sueño", () => {
  it("minutos → horas con 2 decimales", () => {
    expect(hoursFromMinutes(414)).toBe(6.9);
    expect(hoursFromMinutes(425)).toBe(7.08);
    expect(hoursFromMinutes(0)).toBe(0);
    expect(hoursFromMinutes(1440)).toBe(24);
  });

  it("el viaje de ida y vuelta no deriva minutos", () => {
    for (const minutes of [414, 425, 393, 420, 1, 1439]) {
      expect(minutesFromHours(hoursFromMinutes(minutes))).toBe(minutes);
    }
  });
});
