import { describe, expect, it } from "vitest";
import {
  FALLBACK_MEASURE_WINDOW_MS,
  measurePhase,
  measurePhaseLabel,
} from "../measure";

// `t` de prueba: identidad con interpolación mínima de {param}.
const t = (source: string, params?: Record<string, string>) => {
  if (!params) return source;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    source,
  );
};

describe("measurePhase", () => {
  const policy = { windowMs: 60_000, retryMs: 15_000 };

  it("al inicio está en fase 'measuring' con toda la cuenta por delante", () => {
    const phase = measurePhase(0, policy);
    expect(phase.phase).toBe("measuring");
    expect(phase.remainingMs).toBe(15_000);
    expect(phase.progress).toBe(0);
    expect(phase.windowMs).toBe(60_000);
  });

  it("cruza a 'adjusting' justo al agotar lo esperado", () => {
    expect(measurePhase(14_999, policy).phase).toBe("measuring");
    const adjusting = measurePhase(15_000, policy);
    expect(adjusting.phase).toBe("adjusting");
    expect(adjusting.remainingMs).toBe(0);
  });

  it("el progreso topa en 99 % si tarda más de lo esperado (el 100 % lo pone la lectura)", () => {
    const phase = measurePhase(90_000, policy);
    expect(phase.progress).toBe(0.99);
    expect(phase.remainingMs).toBe(0);
    expect(phase.phase).toBe("adjusting");
  });

  it("el ritmo sale de la métrica: FC 12 s, SpO2 36 s", () => {
    expect(measurePhase(0, { windowMs: 30_000 }, "heart_rate").expectedMs).toBe(
      12_000,
    );
    expect(measurePhase(0, { windowMs: 90_000 }, "spo2").expectedMs).toBe(
      36_000,
    );
    expect(
      measurePhase(0, { windowMs: 60_000 }, "blood_pressure").expectedMs,
    ).toBe(15_000);
  });

  it("sin política usa los valores de respaldo (umbral al 40 %)", () => {
    const phase = measurePhase(0);
    expect(phase.windowMs).toBe(FALLBACK_MEASURE_WINDOW_MS);
    expect(phase.remainingMs).toBeCloseTo(FALLBACK_MEASURE_WINDOW_MS * 0.4, 0);
    expect(measurePhase(FALLBACK_MEASURE_WINDOW_MS * 0.5).phase).toBe(
      "adjusting",
    );
  });

  it("una política sin umbral propio también usa el 40 %", () => {
    const phase = measurePhase(0, { windowMs: 30_000 });
    expect(phase.remainingMs).toBe(12_000);
  });

  it("ignora tiempos negativos", () => {
    const phase = measurePhase(-500, policy);
    expect(phase.progress).toBe(0);
    expect(phase.remainingMs).toBe(15_000);
  });
});

describe("measurePhaseLabel", () => {
  const policy = { windowMs: 60_000, retryMs: 15_000 };

  it("nombra la métrica durante la fase de medida (sin cifras)", () => {
    const label = measurePhaseLabel(
      "blood_pressure",
      measurePhase(0, policy),
      t,
    );
    expect(label).toBe("Midiendo Presión…");
  });

  it("pasa a 'Ajustando el sensor…' cuando el sensor engancha", () => {
    const label = measurePhaseLabel(
      "blood_pressure",
      measurePhase(20_000, policy),
      t,
    );
    expect(label).toBe("Ajustando el sensor…");
  });
});
