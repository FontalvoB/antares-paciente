import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { totalsOf } from "../day-totals";
import {
  clearSampleSnapshot,
  createSampleSnapshot,
  loadSampleSnapshot,
  recordSampleSnapshot,
  SAMPLE_HISTORY_LIMIT,
  saveSampleSnapshot,
  updateSampleSnapshot,
} from "../sample-store";
import type { HealthSample } from "../types";

const ACCOUNT = "patient-a";
const DEVICE = "R88 C1BF";
const NOW = new Date(2026, 10, 3, 12).getTime();
const TODAY = "2026-11-03";
const YESTERDAY = "2026-11-02";

function sample(overrides: Partial<HealthSample> = {}): HealthSample {
  return {
    metric: "heart_rate", value: 72, unit: "bpm", ts: NOW,
    deviceId: DEVICE, ...overrides,
  };
}

function storedKey(): string {
  return localStorage.key(0)!;
}

function changeStored(change: (value: Record<string, unknown>) => void): void {
  const key = storedKey();
  const value = JSON.parse(localStorage.getItem(key)!);
  change(value);
  localStorage.setItem(key, JSON.stringify(value));
}

describe("sample-store", () => {
  beforeEach(() => {
    // El proxy Storage de happy-dom no restaura siempre los métodos espiados.
    // Cada caso necesita su instancia, incluido el que simula cuota agotada.
    vi.stubGlobal("localStorage", new Storage());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("rehidrata lecturas, info parcial, sincronización y cubetas sin perder sus claves", () => {
    let state = createSampleSnapshot(ACCOUNT, DEVICE, NOW);
    state = recordSampleSnapshot(state, sample({ metric: "steps", value: 300, agg: "sum" }), NOW);
    state = recordSampleSnapshot(state, sample({ metric: "distance", value: 200, agg: "sum" }), NOW);
    state = updateSampleSnapshot(state, { info: { name: DEVICE, battery: 80 }, lastSyncAt: NOW }, NOW);
    state = updateSampleSnapshot(state, { info: { firmware: "1.0", wearing: false, battery: undefined } }, NOW);

    const restored = loadSampleSnapshot(ACCOUNT, DEVICE, NOW)!;
    expect(restored.info).toEqual({ name: DEVICE, battery: 80, firmware: "1.0", wearing: false });
    expect(restored.lastSyncAt).toBe(NOW);
    expect(restored.latest.steps?.value).toBe(300);
    expect(restored.day).toBe(restored.days[TODAY]);
    expect(restored.day.buckets.get(NOW)).toEqual({ steps: 300, distance: 200 });
    expect(totalsOf(restored.day)).toMatchObject({ steps: 300, distanceM: 200 });
    expect(state.day.buckets).toEqual(restored.day.buckets);
  });

  it("deduplica el replay después de reiniciar y admite correcciones del mismo slot", () => {
    const initial = recordSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, NOW),
      sample({ metric: "steps", value: 300, agg: "sum", source: "history" }), NOW);
    const restored = loadSampleSnapshot(ACCOUNT, DEVICE, NOW)!;
    const replay = recordSampleSnapshot(restored, initial.history[0], NOW);
    expect(replay.history).toHaveLength(1);
    expect(totalsOf(replay.day).steps).toBe(300);
    const correction = recordSampleSnapshot(replay,
      sample({ metric: "steps", value: 350, agg: "sum", source: "history" }), NOW);
    expect(correction.history).toHaveLength(1);
    expect(totalsOf(correction.day).steps).toBe(350);
    expect(totalsOf(initial.day).steps).toBe(300);
  });

  it("un historial viejo no pisa la lectura más reciente", () => {
    let state = recordSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, NOW), sample(), NOW);
    state = recordSampleSnapshot(state, sample({ ts: NOW - 1000, value: 61, source: "history" }), NOW);
    expect(state.latest.heart_rate?.value).toBe(72);
    expect(state.history.map((entry) => entry.value)).toEqual([61, 72]);
  });

  it("aísla la cuenta y el dispositivo incluso con separadores en sus ids", () => {
    recordSampleSnapshot(createSampleSnapshot("patient:a", "ring:b", NOW), sample({ deviceId: "ring:b" }), NOW);
    expect(loadSampleSnapshot("patient", "a:ring:b", NOW)).toBeNull();
    expect(loadSampleSnapshot("other-patient", "ring:b", NOW)).toBeNull();
    expect(loadSampleSnapshot("patient:a", "another-ring", NOW)).toBeNull();
    expect(loadSampleSnapshot("patient:a", "ring:b", NOW)?.latest.heart_rate?.value).toBe(72);
    expect(() => createSampleSnapshot("", DEVICE, NOW)).toThrow();
    expect(() => createSampleSnapshot(ACCOUNT, " ", NOW)).toThrow();
  });

  it("conserva días separados para subir la actividad/sueño con su fecha original", () => {
    let state = createSampleSnapshot(ACCOUNT, DEVICE, NOW);
    const yesterday = new Date(2026, 10, 2, 8).getTime();
    state = recordSampleSnapshot(state, sample({ metric: "steps", value: 7000, ts: yesterday, source: "history" }), NOW);
    state = recordSampleSnapshot(state, sample({ metric: "sleep", value: 420, ts: yesterday, source: "history" }), NOW);
    state = recordSampleSnapshot(state, sample({ metric: "steps", value: 600 }), NOW);
    expect(totalsOf(state.day)).toMatchObject({ steps: 600, sleepMinutes: null });
    const restored = loadSampleSnapshot(ACCOUNT, DEVICE, NOW)!;
    expect(totalsOf(restored.days[YESTERDAY])).toMatchObject({ steps: 7000, sleepMinutes: 420 });
    expect(totalsOf(restored.day).steps).toBe(600);
  });

  it("reinicia hoy al pasar medianoche y retiene ayer para reintentar su ingesta", () => {
    const state = recordSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, NOW),
      sample({ metric: "steps", value: 9000 }), NOW);
    const tomorrow = new Date(2026, 10, 4, 1).getTime();
    const restored = loadSampleSnapshot(ACCOUNT, DEVICE, tomorrow)!;
    expect(restored.day.date).toBe("2026-11-04");
    expect(totalsOf(restored.day).steps).toBeNull();
    expect(totalsOf(restored.days[TODAY]).steps).toBe(9000);
    expect(state.day.date).toBe(TODAY);
  });

  it("limita historial con metadatos sin perder la última métrica rara ni sus totales", () => {
    let state = createSampleSnapshot(ACCOUNT, DEVICE, NOW);
    state = recordSampleSnapshot(state, sample({ metric: "steps", value: 300, agg: "sum", ts: NOW - 60_000 }), NOW);
    state = recordSampleSnapshot(state, sample({ metric: "temperature", value: 36.4, unit: "°C", ts: NOW - 50_000 }), NOW);
    // Se prepara la ráfaga en memoria para no medir el rendimiento de localStorage.
    state.history = [
      ...state.history,
      ...Array.from({ length: SAMPLE_HISTORY_LIMIT - 2 }, (_, index) => sample({ ts: NOW - 10_000 + index })),
    ];
    state = recordSampleSnapshot(state, sample({ ts: NOW + 1 }), NOW + 1);
    state = recordSampleSnapshot(state, sample({ ts: NOW + 2 }), NOW + 2);
    expect(state.history).toHaveLength(SAMPLE_HISTORY_LIMIT);
    expect(state.history.some((entry) => entry.metric === "temperature")).toBe(false);
    expect(state.latest.temperature?.value).toBe(36.4);
    expect(state.retention.droppedSamples).toBe(2);
    expect(state.retention.oldestRetainedAt).toBe(NOW - 10_000);
    expect(totalsOf(loadSampleSnapshot(ACCOUNT, DEVICE, NOW + 2)!.day).steps).toBe(300);
  });

  it("la retención de siete días no elimina el último valor ni el agregado de treinta días", () => {
    const old = NOW - 8 * 86_400_000;
    let state = recordSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, old),
      sample({ metric: "steps", value: 1234, ts: old }), old);
    state = recordSampleSnapshot(state, sample(), NOW);
    expect(state.history).toHaveLength(1);
    expect(state.latest.steps?.value).toBe(1234);
    expect(state.retention.droppedSamples).toBe(1);
    expect(Object.values(state.days).some((day) => totalsOf(day).steps === 1234)).toBe(true);
    const later = new Date(2026, 11, 5, 12).getTime();
    const restored = loadSampleSnapshot(ACCOUNT, DEVICE, later)!;
    expect(Object.keys(restored.days)).toEqual(["2026-12-05"]);
    expect(restored.history).toHaveLength(0);
    expect(restored.retention.droppedDays).toBeGreaterThan(0);
    expect(restored.latest.steps?.value).toBe(1234);
  });

  it("no borra el estado previo ni oculta un fallo de cuota al guardar una lectura", () => {
    const state = recordSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, NOW), sample(), NOW);
    const saved = localStorage.getItem(storedKey());
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => recordSampleSnapshot(state, sample({ value: 84, ts: NOW + 1 }), NOW + 1)).toThrow("quota");
    expect(state.latest.heart_rate?.value).toBe(72);
    expect(state.history).toHaveLength(1);
    expect(localStorage.getItem(storedKey())).toBe(saved);
    expect(() => updateSampleSnapshot(state, { info: { battery: 50 } }, NOW)).toThrow("quota");
    expect(state.info).toEqual({});
  });

  it("propaga fallo de lectura en vez de asumir erróneamente una caché vacía", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("storage unavailable"); });
    expect(() => loadSampleSnapshot(ACCOUNT, DEVICE, NOW)).toThrow("storage unavailable");
  });

  it("rechaza muestras inválidas o de otro dispositivo antes de persistir", () => {
    const state = createSampleSnapshot(ACCOUNT, DEVICE, NOW);
    for (const invalid of [
      sample({ value: Number.NaN }), sample({ value2: Number.POSITIVE_INFINITY }),
      sample({ ts: 0 }), sample({ deviceId: "other" }),
      sample({ metric: "fabricated" as HealthSample["metric"] }),
    ]) expect(() => recordSampleSnapshot(state, invalid, NOW)).toThrow();
    expect(localStorage.length).toBe(0);
  });

  it("ignora JSON corrupto, identidad cruzada y estado de formato inválido", () => {
    saveSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, NOW));
    const key = storedKey();
    const valid = localStorage.getItem(key)!;
    localStorage.setItem(key, "{incompleto");
    expect(loadSampleSnapshot(ACCOUNT, DEVICE, NOW)).toBeNull();
    for (const corrupt of [
      (value: Record<string, unknown>) => { value.accountId = "other"; },
      (value: Record<string, unknown>) => { value.version = 900; },
      (value: Record<string, unknown>) => { value.latest = { heart_rate: sample({ deviceId: "other" }) }; },
      (value: Record<string, unknown>) => { value.history = [{ ...sample(), metric: "fake" }]; },
      (value: Record<string, unknown>) => { value.info = { battery: 200 }; },
      (value: Record<string, unknown>) => { value.days = { [TODAY]: { date: TODAY, counters: {}, buckets: [], sleep: null } }; },
    ]) {
      localStorage.setItem(key, valid);
      changeStored(corrupt);
      expect(loadSampleSnapshot(ACCOUNT, DEVICE, NOW)).toBeNull();
    }
  });

  it("rechaza cubetas guardadas en una fecha ajena al acumulado", () => {
    saveSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, NOW));
    changeStored((value) => {
      const days = value.days as Record<string, Record<string, unknown>>;
      days[TODAY].buckets = [[NOW - 86_400_000, { steps: 300, distance: 0 }]];
    });
    expect(loadSampleSnapshot(ACCOUNT, DEVICE, NOW)).toBeNull();
  });

  it("borra únicamente la caché solicitada", () => {
    saveSampleSnapshot(createSampleSnapshot(ACCOUNT, DEVICE, NOW));
    saveSampleSnapshot(createSampleSnapshot("patient-b", DEVICE, NOW));
    clearSampleSnapshot(ACCOUNT, DEVICE);
    expect(loadSampleSnapshot(ACCOUNT, DEVICE, NOW)).toBeNull();
    expect(loadSampleSnapshot("patient-b", DEVICE, NOW)).not.toBeNull();
  });
});
