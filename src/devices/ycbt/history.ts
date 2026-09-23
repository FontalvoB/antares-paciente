import type { HealthSample } from "../types";
import { readUint16LE } from "../util";
import {
  HISTORY_ACK_CRC,
  HISTORY_ACK_OK,
  HISTORY_HEADER_MIN,
  HISTORY_TERMINAL_KEY,
  crc16,
  decodeErrorPayload,
} from "./protocol";
import type { YcbtHistoryType, YcbtPacket } from "./protocol";
import { decodeHistory } from "./records";

// Máquina de estados del volcado de historial (grupo Health 0x05):
//   `05 <query>` → header → tramas de datos → bloque terminal `05 80` → ACK
// obligatorio → siguiente tipo. Sin el ACK el anillo no libera el tipo
// siguiente. El terminal es lo que cierra cada tipo, nunca un temporizador
// sobre eventos decodificados.

/** Presupuesto por tipo: sin terminal a tiempo se pasa al siguiente. */
const TYPE_TIMEOUT_MS = 12_000;
/**
 * Espera del header. Un tipo que el firmware no implementa no responde nada,
 * así que este presupuesto corto evita que el catálogo completo (que se pide
 * sin filtrar por bitmap) cueste 12 s por cada tipo ausente.
 */
const HEADER_TIMEOUT_MS = 6_000;

export interface HistorySyncEvents {
  onSamples(samples: HealthSample[]): void;
  /** Línea de diagnóstico (registro BLE): qué pasó con cada tipo. */
  onNote?(text: string): void;
}

export class HistorySync {
  private readonly deviceId: string;
  private readonly send: (type: number, payload: number[]) => Promise<void>;
  private readonly events: HistorySyncEvents;

  private queue: YcbtHistoryType[] = [];
  private current: YcbtHistoryType | null = null;
  private phase: "header" | "data" = "header";
  private chunks: number[] = [];
  private timer: number | undefined;
  private activeDone: (() => void) | null = null;
  private pendingRequests: Array<{
    types: readonly YcbtHistoryType[];
    resolve: () => void;
  }> = [];
  /** Tipos que el firmware ya rechazó (0xFC): no se vuelven a pedir. */
  private readonly blocked = new Set<number>();

  constructor(
    deviceId: string,
    send: (type: number, payload: number[]) => Promise<void>,
    events: HistorySyncEvents,
  ) {
    this.deviceId = deviceId;
    this.send = send;
    this.events = events;
  }

  get busy(): boolean {
    return (
      this.current !== null ||
      this.queue.length > 0 ||
      this.pendingRequests.length > 0
    );
  }

  /** Encola un volcado completo y espera si ya hay otro en curso. */
  start(types: readonly YcbtHistoryType[]): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.busy) {
        this.pendingRequests.push({ types, resolve });
        return;
      }
      this.begin(types, resolve);
    });
  }

  /** Aborta el volcado en curso (desconexión). */
  abort(): void {
    this.clearTimer();
    this.queue = [];
    this.current = null;
    this.chunks = [];
    this.phase = "header";
    this.activeDone?.();
    this.activeDone = null;
    for (const pending of this.pendingRequests) pending.resolve();
    this.pendingRequests = [];
  }

  /** Procesa una trama del grupo Health; el resto se ignora. */
  handle(packet: YcbtPacket): void {
    if (this.current === null || packet.group !== 0x05) return;

    const error = decodeErrorPayload(packet.payload);
    if (error) {
      this.note(`${this.current.key}: ${error}`);
      if (error === "unsupported-command" || error === "unsupported-key") {
        this.blocked.add(this.current.query);
      }
      this.advance();
      return;
    }

    if (packet.key === HISTORY_TERMINAL_KEY) {
      this.completeTransfer(packet.payload);
      return;
    }

    // El header llega con el cmd de la CONSULTA (`05 06` para FC), NO con el
    // de datos: el R88 responde `05 04`/`05 06`/`05 08`/`05 09` con
    // `[count u16][packets u32][bytes u32]`, y solo las tramas de datos usan
    // el ackKey (`05 15`, `05 17`, `05 18`…). Aceptar únicamente el ackKey
    // descartaba el header real, tomaba la primera trama de datos por header y
    // terminaba con 0 bytes y CRC roto (el anillo reenviaba en bucle).
    const isHeaderKey =
      packet.key === this.current.query || packet.key === this.current.ack;
    if (!isHeaderKey) return;

    if (this.phase === "header") {
      this.readHeader(packet.payload);
      return;
    }
    // En fase de datos solo cuentan las tramas del ackKey (un header repetido
    // con el cmd de la consulta se ignora).
    if (packet.key !== this.current.ack) return;
    for (const byte of packet.payload) this.chunks.push(byte);
  }

  // ─── Interno ───────────────────────────────────────────────────────────

  private begin(types: readonly YcbtHistoryType[], resolve: () => void): void {
    this.queue = types.filter((type) => !this.blocked.has(type.query));
    this.activeDone = resolve;
    if (this.queue.length === 0) {
      this.finish();
      return;
    }
    this.next();
  }

  private next(): void {
    if (this.current !== null) return;
    const type = this.queue.shift();
    if (!type) {
      this.finish();
      return;
    }
    this.current = type;
    this.phase = "header";
    this.chunks = [];
    this.armTimer();
    void this.send((0x05 << 8) | type.query, []).catch(() => undefined);
  }

  /** Header: payload corto = tipo sin datos; largo = conteos + total de bytes. */
  private readHeader(payload: Uint8Array): void {
    if (payload.length < HISTORY_HEADER_MIN) {
      this.note(`${this.current?.key ?? "?"}: sin datos`);
      this.advance();
      return;
    }
    this.phase = "data";
    this.armTimer();
  }

  private completeTransfer(payload: Uint8Array): void {
    const current = this.current;
    this.clearTimer();
    if (current) {
      const bytes = Uint8Array.from(this.chunks);
      const expected = payload.length >= 6 ? readUint16LE(payload, 4) : null;
      const ok = expected === null || crc16(bytes) === expected;
      this.send((0x05 << 8) | HISTORY_TERMINAL_KEY, [
        ok ? HISTORY_ACK_OK : HISTORY_ACK_CRC,
      ]).catch(() => undefined);
      // Con CRC roto se ACKea el fallo (el anillo puede reenviar) pero el
      // buffer se decodifica igual: descartarlo perdía tipos enteros —el
      // sueño— mientras los pasos seguían llegando por el stream en vivo.
      const samples =
        bytes.length > 0
          ? decodeHistory(current.key, bytes, this.deviceId)
          : [];
      this.note(
        `${current.key}: ${bytes.length} B → ${samples.length} muestras${ok ? "" : " (CRC roto)"}`,
      );
      if (samples.length) this.events.onSamples(samples);
    }
    this.advance();
  }

  private advance(): void {
    this.clearTimer();
    this.current = null;
    this.chunks = [];
    this.phase = "header";
    this.next();
  }

  /** El presupuesto depende de la fase: header corto, volcado largo. */
  private armTimer(): void {
    this.clearTimer();
    this.timer = window.setTimeout(
      () => this.advance(),
      this.phase === "header" ? HEADER_TIMEOUT_MS : TYPE_TIMEOUT_MS,
    );
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

    const pending = this.pendingRequests.shift();
    if (pending) {
      this.begin(pending.types, pending.resolve);
    }
  }

  /** Línea de diagnóstico: consola (dev) y registro BLE en la app. */
  private note(text: string): void {
    const line = `[ycbt] historial ${text}`;
    console.debug(line);
    this.events.onNote?.(line);
  }
}
