import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColmiHistory, buildHistoryRequests } from "../colmi/history";
import { CMD, buildFrame, parseFrame } from "../colmi/protocol";
import type { ColmiFrame } from "../colmi/protocol";
import type { HealthSample } from "../types";

const DEVICE = "band-1";

/** Trama válida de 16 B a partir de su payload de 14. */
function frame(cmd: number, payload: number[]): ColmiFrame {
  const parsed = parseFrame(buildFrame(cmd, payload));
  if (!parsed) throw new Error(`trama inválida: ${cmd}`);
  return parsed;
}

function setup() {
  const requests: Array<{ cmd: number; payload: number[] }> = [];
  const samples: HealthSample[] = [];
  const notes: string[] = [];
  const send = vi.fn(async (cmd: number, payload: number[]) => {
    requests.push({ cmd, payload });
  });
  const history = new ColmiHistory(DEVICE, send, {
    onSamples: (incoming) => samples.push(...incoming),
    onNote: (text) => notes.push(text),
  });
  return { history, requests, samples, notes };
}

// Tramas reales de una captura de la H59 (pasos del 2026-09-21, slots 12:00→21:00).
const STEPS_FRAMES: number[][] = [
  [
    0x26, 0x09, 0x21, 0x30, 0x00, 0x0a, 0x50, 0x03, 0x28, 0x01, 0xc8, 0x00,
    0x00, 0x00,
  ],
  [
    0x26, 0x09, 0x21, 0x34, 0x01, 0x0a, 0xa6, 0x10, 0xd6, 0x05, 0xf4, 0x03,
    0x00, 0x00,
  ],
  [
    0x26, 0x09, 0x21, 0x38, 0x02, 0x0a, 0x26, 0x01, 0x6d, 0x00, 0x45, 0x00,
    0x00, 0x00,
  ],
  [
    0x26, 0x09, 0x21, 0x54, 0x09, 0x0a, 0x68, 0x00, 0x22, 0x00, 0x19, 0x00,
    0x00, 0x00,
  ],
];

describe("buildHistoryRequests — sonda de sueño", () => {
  it("por defecto NO pide la sonda de sueño (sync normal más corto)", () => {
    const keys = buildHistoryRequests(0).map((request) => request.key);
    expect(keys).toEqual(["steps", "hr", "stress", "hrv"]);
  });

  it("con diagnóstico activo añade la sonda cmd 13", () => {
    const requests = buildHistoryRequests(0, { includeSleepProbe: true });
    expect(requests.map((request) => request.key)).toContain("sleep");
    expect(requests.at(-1)?.cmd).toBe(CMD.SLEEP_HISTORY);
  });
});

describe("ColmiHistory — pasos (cmd 67)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("decodifica los slots reales y cierra con el marcador de fin", async () => {
    const { history, requests, samples, notes } = setup();
    const done = history.start(buildHistoryRequests(0));

    expect(requests[0]).toEqual({
      cmd: CMD.STEPS,
      payload: [0, 0x0f, 0x00, 0x5f, 0x01],
    });

    // Marcador de inicio, datos, marcador de fin.
    history.handle(
      frame(CMD.STEPS, [0xff, 0x00, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    for (const payload of STEPS_FRAMES) {
      history.handle(frame(CMD.STEPS, payload));
    }
    history.handle(
      frame(CMD.STEPS, [0xff, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );

    // El volcado completo encadena 4 peticiones, cada una con su ventana.
    await vi.advanceTimersByTimeAsync(20_000);
    await done;

    const first = samples.find((s) => s.metric === "steps");
    const at = new Date(first!.ts);
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(8);
    expect(at.getDate()).toBe(21);
    expect(at.getHours()).toBe(12);
    expect(first?.value).toBe(296);
    expect(first?.agg).toBe("sum");

    const distance = samples.find((s) => s.metric === "distance");
    expect(distance?.value).toBe(200);
    const calories = samples.find((s) => s.metric === "calories");
    expect(calories?.value).toBe(848);
    expect(notes.some((line) => line.includes("steps:"))).toBe(true);
  });

  it("cierra la petición por ventana cuando la banda no manda marcador", async () => {
    const { history, samples } = setup();
    const done = history.start([buildHistoryRequests(0)[0]!]);
    history.handle(frame(CMD.STEPS, STEPS_FRAMES[0]!));
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(samples.filter((s) => s.metric === "steps")).toHaveLength(1);
  });
});

describe("ColmiHistory — curva de FC (cmd 21)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("arma los 288 puntos a partir del header y los bloques", async () => {
    const { history, samples } = setup();
    const done = history.start([buildHistoryRequests(0)[1]!]);

    // Header: count = 3 bloques de 13 valores.
    history.handle(
      frame(CMD.HR_HISTORY, [0x00, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    // Primer bloque: 9 valores desde el byte 6 del payload.
    history.handle(
      frame(CMD.HR_HISTORY, [0x01, 0, 0, 0, 0, 72, 73, 74, 0, 0, 0, 0, 0, 0]),
    );
    // Segundo bloque: 13 valores desde el byte 2.
    history.handle(
      frame(CMD.HR_HISTORY, [0x02, 80, 81, 82, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await done;

    const hrs = samples.filter((s) => s.metric === "heart_rate");
    expect(hrs.map((s) => s.value)).toEqual([72, 73, 74, 80, 81, 82]);
    const first = new Date(hrs[0]!.ts);
    expect(first.getHours()).toBe(0);
    expect(first.getMinutes()).toBe(0);
    // El segundo punto cae 5 minutos después (curva de 5 min).
    expect(hrs[1]!.ts - hrs[0]!.ts).toBe(5 * 60_000);
  });
});

describe("ColmiHistory — slots de estrés/HRV (cmd 55/57)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("decodifica los valores por slot con su intervalo", async () => {
    const { history, samples } = setup();
    const done = history.start([buildHistoryRequests(0)[2]!]);

    history.handle(
      frame(CMD.STRESS_HISTORY, [0x00, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    history.handle(
      frame(CMD.STRESS_HISTORY, [0x01, 42, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await done;

    const stress = samples.filter((s) => s.metric === "stress");
    expect(stress).toHaveLength(1);
    expect(stress[0]!.value).toBe(42);
    expect(new Date(stress[0]!.ts).getHours()).toBe(0);
  });
});
