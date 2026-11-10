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

describe("vitalStatus — registro neutral", () => {
  it.each([45, 72, 120, 250, 88, 39.2, 200])("el valor %s no produce una conclusión clínica", (value) => {
    expect(vitalStatus(value, t)).toEqual({ label: "Valor ingresado", cls: "" });
  });
  it.each([NaN, Infinity, -Infinity])("sin número finito no hay estado", (value) => {
    expect(vitalStatus(value, t)).toEqual({ label: "—", cls: "" });
  });
  it("conserva el progreso de una meta explícita de actividad", () => {
    expect(vitalStatus(540, t, 8000)).toEqual({ label: "En progreso", cls: "" });
    expect(vitalStatus(8000, t, 8000)).toEqual({ label: "Meta alcanzada", cls: "ok" });
  });
});

describe("vitalBar — sin bandas clínicas locales", () => {
  it("conserva la posición del dato sin marcar una banda saludable", () => {
    const sleep = vitalBar(414, { lo: 420, hi: 540, min: 0, max: 720 });
    expect(sleep.pct).toBeCloseTo(57.5);
    expect([sleep.bandLeft, sleep.bandWidth]).toEqual([0, 0]);
    expect(vitalBar(45, { lo: 50, hi: 100, min: 30, max: 180 })).toEqual({ pct: 10, bandLeft: 0, bandWidth: 0 });
  });
  it("no utiliza lo/hi como un dominio clínico implícito", () => {
    expect(vitalBar(45, { lo: 50, hi: 100 })).toEqual({ pct: 0, bandLeft: 0, bandWidth: 0 });
  });
  it("limita solo la geometría al dominio visible explícito", () => {
    expect(vitalBar(250, { lo: 50, hi: 100, min: 30, max: 180 })).toEqual({ pct: 100, bandLeft: 0, bandWidth: 0 });
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
