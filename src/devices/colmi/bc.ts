import type { HealthSample } from "../types";
import * as ble from "../ble/ble-client";
import {
  BC_INIT,
  BC_LOGIN,
  BC_MAGIC,
  BC_SLEEP,
  BC_SPO2,
  COLMI_BC_NOTIFY,
  COLMI_BC_SERVICE,
  COLMI_BC_WRITE,
  bcFrame,
} from "./protocol";

// Canal "rico" (bc) de la banda: históricos detallados que NO viajan por el
// UART. Sueño por fases (verificado byte a byte contra la app oficial) y SpO2
// por hora. Exige un login/init en el mismo canal; si la banda lo rechaza se
// degrada en silencio (una nota de diagnóstico y nada más).
//
// Cuenta de login: la app oficial manda el nombre de cuenta del usuario. La
// banda no valida contra ningún servidor, así que se usa una cuenta propia
// (nada de depender de QWatch Pro); si la rechaza, se reintenta con el celular.

const LOGIN_ACCOUNTS = ["coppaddresd"];
const LOGIN_WAIT_MS = 600;
const REQUEST_WAIT_MS = 4000;

/** Fases del sueño del canal bc. */
const SLEEP_STAGES: Record<number, string> = {
  2: "light",
  3: "deep",
  4: "rem",
  5: "awake",
};

export interface BcEvents {
  onSamples(samples: HealthSample[]): void;
  onNote?(text: string): void;
}

export interface BcFrame {
  type: number;
  body: Uint8Array;
}

/**
 * Reensambla las tramas bc de un buffer acumulado. Las notificaciones pueden
 * traer varias tramas o cortar una por la mitad, así que se devuelve el resto
 * sin consumir para la siguiente notificación.
 */
export function parseBcFrames(buffer: Uint8Array): {
  frames: BcFrame[];
  rest: Uint8Array;
} {
  const frames: BcFrame[] = [];
  let data = buffer;

  for (;;) {
    const start = data.indexOf(BC_MAGIC);
    if (start < 0) return { frames, rest: new Uint8Array(0) };
    if (start > 0) data = data.slice(start);
    if (data.length < 6) return { frames, rest: data };
    const length = (data[2] ?? 0) | ((data[3] ?? 0) << 8);
    const total = 6 + length;
    if (data.length < total) return { frames, rest: data };
    frames.push({ type: data[1] ?? 0, body: data.slice(6, total) });
    data = data.slice(total);
  }
}

export class BcChannel {
  private readonly deviceId: string;
  private readonly events: BcEvents;
  private readonly accounts: string[];
  private buffer: Uint8Array = new Uint8Array(0);
  private queue: BcFrame[] = [];
  private waiter: (() => void) | null = null;
  private opened = false;
  private unavailable = false;
  private opening: Promise<boolean> | null = null;

  constructor(
    deviceId: string,
    events: BcEvents,
    extraAccounts: string[] = [],
  ) {
    this.deviceId = deviceId;
    this.events = events;
    this.accounts = [...LOGIN_ACCOUNTS, ...extraAccounts];
  }

  get available(): boolean {
    return this.opened && !this.unavailable;
  }

  /** Suscribe el canal y hace login/init. Devuelve false si no está disponible. */
  async open(): Promise<boolean> {
    if (this.opened || this.unavailable) return this.available;
    if (this.opening) return this.opening;
    this.opening = this.doOpen();
    try {
      return await this.opening;
    } finally {
      this.opening = null;
    }
  }

  private async doOpen(): Promise<boolean> {
    try {
      await ble.subscribe(
        this.deviceId,
        COLMI_BC_SERVICE,
        COLMI_BC_NOTIFY,
        (bytes) => this.handleNotification(bytes),
      );
    } catch {
      this.unavailable = true;
      this.note("canal bc no disponible en este firmware");
      return false;
    }

    for (const account of this.accounts) {
      const ok = await this.login(account);
      if (ok) {
        this.opened = true;
        this.note("bc: login aceptado");
        return true;
      }
    }
    this.unavailable = true;
    this.note("bc: login rechazado, históricos detallados no disponibles");
    return false;
  }

  async close(): Promise<void> {
    if (!this.opened && this.unavailable) return;
    try {
      await ble.unsubscribe(this.deviceId, COLMI_BC_SERVICE, COLMI_BC_NOTIFY);
    } catch {
      // La suscripción pudo caer con la conexión.
    }
    this.opened = false;
    this.buffer = new Uint8Array(0);
  }

  /** Sueño por fases de todas las noches guardadas en la banda. */
  async sleepNights(): Promise<HealthSample[]> {
    if (!this.available) return [];
    // day >= 1 pide el blob completo (la banda ignora el día y manda todo).
    const body = await this.request(BC_SLEEP, [0xff, 0x01]);
    if (!body) {
      this.note("bc sleep: sin respuesta");
      return [];
    }
    const samples = decodeSleepBlob(body, this.deviceId);
    this.note(`bc sleep: ${body.length} B → ${samples.length} noches`);
    return samples;
  }

  /** SpO2 por hora del día (0 = hoy, 1 = ayer…). */
  async spo2History(day = 0): Promise<HealthSample[]> {
    if (!this.available) return [];
    const body = await this.request(BC_SPO2, [-day & 0xff]);
    if (!body) {
      this.note("bc spo2: sin respuesta");
      return [];
    }
    const samples = decodeSpo2Hours(body, this.deviceId, day);
    this.note(`bc spo2: ${body.length} B → ${samples.length} horas`);
    return samples;
  }

  // ─── Interno ───────────────────────────────────────────────────────────

  private async login(account: string): Promise<boolean> {
    // `\x01\x01\x00` + cuenta en UTF-16 (incluye BOM), como la app oficial.
    const encoded = new Uint8Array(3 + account.length * 2 + 2);
    encoded.set([0x01, 0x01, 0x00], 0);
    encoded[3] = 0xff;
    encoded[4] = 0xfe;
    for (let i = 0; i < account.length; i++) {
      const code = account.charCodeAt(i);
      encoded[5 + i * 2] = code & 0xff;
      encoded[6 + i * 2] = (code >> 8) & 0xff;
    }
    await this.write(BC_LOGIN, encoded);
    await delay(LOGIN_WAIT_MS);
    await this.write(BC_INIT, new Uint8Array(0));
    await delay(LOGIN_WAIT_MS);
    // Sin respuesta de datos no se puede confirmar; se asume aceptado y las
    // peticiones reales lo verificarán (si no hay datos, no hay muestras).
    return true;
  }

  private async write(type: number, body: Uint8Array): Promise<void> {
    try {
      await ble.writeBytes(
        this.deviceId,
        COLMI_BC_SERVICE,
        COLMI_BC_WRITE,
        bcFrame(type, body),
        true,
      );
    } catch {
      this.unavailable = true;
    }
  }

  /** Envía una petición y devuelve el body más largo recibido en la ventana. */
  private async request(
    type: number,
    body: number[],
  ): Promise<Uint8Array | null> {
    this.queue = [];
    await this.write(type, Uint8Array.from(body));
    const deadline = Date.now() + REQUEST_WAIT_MS;
    let best: Uint8Array | null = null;
    while (Date.now() < deadline) {
      const frame = await this.nextFrame(deadline - Date.now());
      if (!frame) continue;
      if (frame.type !== type) continue;
      if (!best || frame.body.length > best.length) best = frame.body;
      // Un body con datos reales cierra la espera; los ack son de 1-3 bytes.
      if (frame.body.length > 3) break;
    }
    return best;
  }

  private nextFrame(timeoutMs: number): Promise<BcFrame | null> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => {
      const timer = window.setTimeout(
        () => {
          this.waiter = null;
          resolve(null);
        },
        Math.max(0, timeoutMs),
      );
      this.waiter = () => {
        window.clearTimeout(timer);
        resolve(this.queue.shift() ?? null);
      };
    });
  }

  /** Reensambla las tramas bc (pueden venir partidas en varias notificaciones). */
  private handleNotification(bytes: Uint8Array): void {
    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer);
    merged.set(bytes, this.buffer.length);
    const { frames, rest } = parseBcFrames(merged);
    this.buffer = rest;
    for (const frame of frames) {
      this.queue.push(frame);
      this.waiter?.();
    }
  }

  private note(text: string): void {
    const line = `[colmi] ${text}`;
    console.debug(line);
    this.events.onNote?.(line);
  }
}

/**
 * Blob de sueño (bc 0x27): `[N]` noches, cada una `[idx][?][inicio u16][fin u16]`
 * seguida de pares `(fase, duración_min)` que suman exactamente la duración de
 * la noche (`(fin - inicio) mod 1440`). `idx` cuenta hacia atrás desde la noche
 * más reciente (0 = la última). Fases: 2 ligero, 3 profundo, 4 REM, 5 despierto.
 */
export function decodeSleepBlob(
  body: Uint8Array,
  deviceId: string,
): HealthSample[] {
  const out: HealthSample[] = [];
  if (body.length < 8) return out;
  const nights = body[0] ?? 0;
  let cursor = 1;

  for (let night = 0; night < nights; night++) {
    if (cursor + 6 > body.length) break;
    const index = body[cursor] ?? 0;
    const startMin = (body[cursor + 2] ?? 0) | ((body[cursor + 3] ?? 0) << 8);
    const endMin = (body[cursor + 4] ?? 0) | ((body[cursor + 5] ?? 0) << 8);
    const duration = (endMin - startMin + 1440) % 1440;
    cursor += 6;

    let total = 0;
    while (cursor + 2 <= body.length && total < duration) {
      const stage = body[cursor] ?? 0;
      const minutes = body[cursor + 1] ?? 0;
      if (!(stage in SLEEP_STAGES)) break;
      total += minutes;
      cursor += 2;
    }
    if (total <= 0) continue;

    const wake = midnightMinus(index, endMin);
    out.push({
      metric: "sleep",
      value: total,
      unit: "min",
      ts: wake,
      deviceId,
    });
  }
  return out;
}

/**
 * SpO2 por hora (bc 0x2A): `[día]` + 24 pares `(min, max)`; `00 00` = hora sin
 * medidas. Se emite el máximo de cada hora (lo que muestra la app oficial).
 */
export function decodeSpo2Hours(
  body: Uint8Array,
  deviceId: string,
  day = 0,
): HealthSample[] {
  const out: HealthSample[] = [];
  const pairs = body.slice(1);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const base = midnight.getTime() - day * 24 * 60 * 60_000;

  for (
    let hour = 0;
    hour < Math.min(24, Math.floor(pairs.length / 2));
    hour++
  ) {
    const max = pairs[hour * 2 + 1] ?? 0;
    if (!max) continue;
    out.push({
      metric: "spo2",
      value: max,
      unit: "%",
      ts: base + hour * 60 * 60_000,
      deviceId,
    });
  }
  return out;
}

/** Medianoche local menos `days` días, más `minutes` (hora de despertar). */
function midnightMinus(days: number, minutes: number): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - days * 24 * 60 * 60_000 + minutes * 60_000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
