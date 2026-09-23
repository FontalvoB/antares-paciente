import type { HealthSample } from "../types";
import { CMD, COLMI_HISTORY_CMDS, fromBcd } from "./protocol";
import type { ColmiFrame } from "./protocol";

// Historial de la banda H59 por el canal UART. Cada tipo se pide con su comando
// y la banda responde con una ráfaga de tramas de 16 B:
//   sub == 0xff → marcador de inicio/fin del volcado
//   sub == 0    → header (conteo/intervalo)
//   sub >= 1    → bloque de datos
// Layouts tomados de la implementación OpenH59 (band.py), verificados contra la
// app oficial: pasos 15 min, FC 5 min, estrés/HRV 30 min.

/** Ventana máxima de escucha de cada petición (la banda responde en ráfaga). */
const REQUEST_WINDOW_MS = 2500;
/**
 * Cierre anticipado: si tras una trama no llega otra en este tiempo, la ráfaga
 * terminó. Con las ventanas fijas de 4 s el volcado tardaba ~20 s.
 */
const IDLE_AFTER_DATA_MS = 800;

/** Intervalo por defecto de las curvas por slot, si el header no lo trae. */
const SLOT_INTERVAL_MIN = 30;
/** Puntos de la curva de FC (288 × 5 min = 24 h). */
const HR_POINTS = 288;

export interface ColmiHistoryEvents {
  onSamples(samples: HealthSample[]): void;
  onNote?(text: string): void;
}

interface HistoryRequest {
  key: string;
  cmd: number;
  payload: number[];
}

/** Peticiones del volcado completo de la banda. */
export interface HistoryRequestOptions {
  /**
   * Incluye la sonda de sueño por UART (cmd 13). Sus segmentos no tienen
   * semántica confirmada —el canal rico bc es el que entrega las fases—, así
   * que solo se pide con `Modo diagnóstico` para dejar los bytes en el
   * Registro BLE si algún día el bc no bastara.
   */
  includeSleepProbe?: boolean;
}

export function buildHistoryRequests(
  day = 0,
  options: HistoryRequestOptions = {},
): HistoryRequest[] {
  const requests: HistoryRequest[] = [
    // Los 4 bytes extra de pasos son los que usa la app oficial (0x0f/0x00/0x5f/0x01).
    { key: "steps", cmd: CMD.STEPS, payload: [day, 0x0f, 0x00, 0x5f, 0x01] },
    { key: "hr", cmd: CMD.HR_HISTORY, payload: [] },
    { key: "stress", cmd: CMD.STRESS_HISTORY, payload: [day] },
    { key: "hrv", cmd: CMD.HRV_HISTORY, payload: [day] },
  ];
  if (options.includeSleepProbe) {
    requests.push({ key: "sleep", cmd: CMD.SLEEP_HISTORY, payload: [] });
  }
  return requests;
}

export class ColmiHistory {
  private readonly deviceId: string;
  private readonly send: (cmd: number, payload: number[]) => Promise<void>;
  private readonly events: ColmiHistoryEvents;

  private queue: HistoryRequest[] = [];
  private current: HistoryRequest | null = null;
  private frames: ColmiFrame[] = [];
  private timer: number | undefined;
  private activeDone: (() => void) | null = null;
  private pending: Array<{ requests: HistoryRequest[]; resolve: () => void }> =
    [];

  constructor(
    deviceId: string,
    send: (cmd: number, payload: number[]) => Promise<void>,
    events: ColmiHistoryEvents,
  ) {
    this.deviceId = deviceId;
    this.send = send;
    this.events = events;
  }

  get busy(): boolean {
    return (
      this.current !== null || this.queue.length > 0 || this.pending.length > 0
    );
  }

  /** Encola un volcado; si ya hay uno en curso, espera a que termine. */
  start(requests: readonly HistoryRequest[]): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.busy) {
        this.pending.push({ requests: [...requests], resolve });
        return;
      }
      this.begin([...requests], resolve);
    });
  }

  abort(): void {
    this.clearTimer();
    this.queue = [];
    this.current = null;
    this.frames = [];
    const done = this.activeDone;
    this.activeDone = null;
    done?.();
    for (const waiting of this.pending) waiting.resolve();
    this.pending = [];
  }

  /** Recoge las tramas de la petición en curso. */
  handle(frame: ColmiFrame): boolean {
    if (this.current === null) return false;
    if (!COLMI_HISTORY_CMDS.includes(frame.cmd)) return false;
    if (frame.cmd !== this.current.cmd) return false;
    this.frames.push(frame);
    // El marcador de fin (`ff 00 00`) cierra la ráfaga antes de la ventana; el
    // de inicio (`ff 00 01`) solo abre el volcado.
    const sub = frame.payload[0] ?? 0;
    const flag = frame.payload[2] ?? 0;
    if (sub === 0xff && flag === 0) {
      this.finishRequest();
      return true;
    }
    // Cada trama nueva corre la fecha de cierre: si la banda calla, la
    // petición termina sin esperar la ventana completa.
    this.armTimer(IDLE_AFTER_DATA_MS);
    return true;
  }

  // ─── Interno ───────────────────────────────────────────────────────────

  private begin(requests: HistoryRequest[], resolve: () => void): void {
    this.queue = requests;
    this.activeDone = resolve;
    this.next();
  }

  private next(): void {
    if (this.current !== null) return;
    const request = this.queue.shift();
    if (!request) {
      this.finish();
      return;
    }
    this.current = request;
    this.frames = [];
    this.armTimer();
    void this.send(request.cmd, request.payload).catch(() => undefined);
  }

  private finishRequest(): void {
    const request = this.current;
    if (!request) return;
    this.clearTimer();
    this.current = null;
    const frames = this.frames;
    this.frames = [];
    const samples = this.decode(request.key, frames);
    this.note(
      `${request.key}: ${frames.length} tramas → ${samples.length} muestras`,
    );
    if (samples.length) this.events.onSamples(samples);
    this.next();
  }

  private armTimer(delayMs = REQUEST_WINDOW_MS): void {
    this.clearTimer();
    this.timer = window.setTimeout(() => this.finishRequest(), delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private finish(): void {
    const done = this.activeDone;
    this.activeDone = null;
    done?.();
    const waiting = this.pending.shift();
    if (waiting) this.begin(waiting.requests, waiting.resolve);
  }

  private note(text: string): void {
    const line = `[colmi] ${text}`;
    console.debug(line);
    this.events.onNote?.(line);
  }

  private decode(key: string, frames: ColmiFrame[]): HealthSample[] {
    switch (key) {
      case "steps":
        return decodeSteps(frames, this.deviceId);
      case "hr":
        return decodeHeartCurve(frames, this.deviceId);
      case "stress":
        return decodeSlots(frames, this.deviceId, "stress");
      case "hrv":
        return decodeSlots(frames, this.deviceId, "hrv");
      case "sleep": {
        const bytes = frames.reduce(
          (total, frame) => total + frame.payload.length,
          0,
        );
        this.note(
          `sleep(uart): ${frames.length} tramas, ${bytes} B sin decodificar`,
        );
        return [];
      }
      default:
        return [];
    }
  }
}

function sample(
  deviceId: string,
  metric: HealthSample["metric"],
  value: number,
  unit: string,
  ts: number,
  agg?: "sum",
): HealthSample {
  return { metric, value, unit, ts, deviceId, ...(agg ? { agg } : {}) };
}

/**
 * Pasos (cmd 67): `[año bcd][mes bcd][día bcd][slot][?][?][cal u16@7]
 * [pasos u16@9][distancia u16@11]`. `slot` indexa slots de 15 min.
 * Se emiten como cubetas aditivas (agg sum) para que el acumulado del día sume
 * slots distintos y sea idempotente al re-sincronizar.
 */
function decodeSteps(frames: ColmiFrame[], deviceId: string): HealthSample[] {
  const out: HealthSample[] = [];
  for (const frame of frames) {
    const p = frame.payload;
    const sub = p[0] ?? 0;
    if (sub === 0xff || sub === 0xf0) continue; // marcadores de inicio/fin
    const year = fromBcd(p[0] ?? 0) + 2000;
    const month = fromBcd(p[1] ?? 0);
    const day = fromBcd(p[2] ?? 0);
    const slot = p[3] ?? 0;
    const calories = (p[6] ?? 0) | ((p[7] ?? 0) << 8);
    const steps = (p[8] ?? 0) | ((p[9] ?? 0) << 8);
    const distance = (p[10] ?? 0) | ((p[11] ?? 0) << 8);
    const ts = slotTime(year, month, day, slot);
    if (ts === null) continue;
    if (steps) out.push(sample(deviceId, "steps", steps, "count", ts, "sum"));
    if (distance) {
      out.push(sample(deviceId, "distance", distance, "m", ts, "sum"));
    }
    if (calories) {
      out.push(sample(deviceId, "calories", calories, "kcal", ts, "sum"));
    }
  }
  return out;
}

/** `slot` = cuartos de hora desde medianoche (0..95). */
function slotTime(
  year: number,
  month: number,
  day: number,
  slot: number,
): number | null {
  const date = new Date(
    year,
    month - 1,
    day,
    Math.floor(slot / 4),
    (slot % 4) * 15,
    0,
    0,
  );
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Curva de FC (cmd 21): header `sub 0` con `count`; el primer bloque trae 9
 * valores desde `p[6]` y los siguientes 13 por bloque desde `p[2]`.
 * Un punto cada 5 minutos; 0 = sin medida.
 */
function decodeHeartCurve(
  frames: ColmiFrame[],
  deviceId: string,
): HealthSample[] {
  const values: number[] = [];
  for (const frame of frames) {
    const p = frame.payload;
    const sub = p[0] ?? 0;
    if (sub === 0xff) continue;
    if (sub === 0) {
      // Header: `count` = bloques de 13 valores (bytes) que siguen.
      const size = p[1] ?? 0;
      values.length = Math.min(size * 13, HR_POINTS);
      values.fill(0);
      continue;
    }
    const chunk = sub === 1 ? p.slice(5, 14) : p.slice(1, 14);
    for (let i = 0; i < chunk.length; i++) {
      const index = sub === 1 ? i : 9 + (sub - 2) * 13 + i;
      if (index < HR_POINTS) values[index] = chunk[i] ?? 0;
    }
  }
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const base = midnight.getTime();
  const out: HealthSample[] = [];
  for (let i = 0; i < values.length; i++) {
    const hr = values[i] ?? 0;
    if (hr > 0) {
      out.push(
        sample(deviceId, "heart_rate", hr, "bpm", base + i * 5 * 60_000),
      );
    }
  }
  return out;
}

/**
 * Curvas por slot (cmd 55 estrés / 57 HRV): header `sub 0` con el intervalo
 * (min, por defecto 30); cada bloque trae 13 valores desde `p[2]`, indexados
 * como `(sub - 1) * 13 + i`. 0 = sin medida en ese slot.
 */
function decodeSlots(
  frames: ColmiFrame[],
  deviceId: string,
  metric: "stress" | "hrv",
): HealthSample[] {
  const unit = metric === "stress" ? "score" : "ms";
  let interval = SLOT_INTERVAL_MIN;
  const values = new Map<number, number>();
  for (const frame of frames) {
    const p = frame.payload;
    const sub = p[0] ?? 0;
    if (sub === 0xff) continue;
    if (sub === 0) {
      interval = p[2] ?? SLOT_INTERVAL_MIN;
      continue;
    }
    for (let i = 0; i < 13; i++) {
      const value = p[1 + i] ?? 0;
      if (value) values.set((sub - 1) * 13 + i, value);
    }
  }
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const base = midnight.getTime();
  return [...values.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slot, value]) =>
      sample(deviceId, metric, value, unit, base + slot * interval * 60_000),
    );
}
