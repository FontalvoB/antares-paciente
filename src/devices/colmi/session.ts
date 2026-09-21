import * as ble from '../ble/ble-client';
import { delay } from '../util';
import {
  CMD,
  COLMI_CHAR_RX,
  COLMI_CHAR_TX,
  COLMI_SERVICE,
  FrameStream,
  MEASURE_TYPE,
  buildFrame,
  makeSetTimePayload,
  parseBattery,
  parseCapabilities,
} from './protocol';
import type { ColmiCapabilities, ColmiFrame, ColmiMeasureType } from './protocol';
import { parseRealtimeFrame } from './realtime';
import type {
  DeviceDescriptor,
  DeviceSession,
  InfoSink,
  MetricKind,
  SampleSink,
} from '../types';

const WRITE_SPACING_MS = 150;
/** Si no llega FC en este tiempo, se re-arma la medida continua. */
const HR_RETRY_MS = 20_000;
const WATCHDOG_INTERVAL_MS = 5_000;
/** Una medida puntual se corta sola: el sensor óptico a veces no engancha. */
const MEASURE_TIMEOUT_MS = 30_000;
/** Muestras válidas suficientes para dar una medida por buena. */
const MEASURE_TARGET = 3;

const MEASURE_TYPE_BY_METRIC: Partial<Record<MetricKind, ColmiMeasureType>> = {
  heart_rate: MEASURE_TYPE.heart_rate,
  blood_pressure: MEASURE_TYPE.blood_pressure,
  spo2: MEASURE_TYPE.spo2,
};

/** Driver de la banda H59 (protocolo Colmi sobre Nordic UART). */
export class ColmiSession implements DeviceSession {
  readonly descriptor: DeviceDescriptor;
  readonly supportsMeasure = true;

  private onSample?: SampleSink;
  private onInfo?: InfoSink;
  private readonly stream = new FrameStream();
  private stopped = false;
  private subscribed = false;
  private queue: Promise<void> = Promise.resolve();
  private watchdogTimer?: number;
  private measureTimer?: number;
  private measureType: ColmiMeasureType | null = null;
  private measureCount = 0;
  private lastHeartRateAt = 0;
  private declaredCapabilities: ColmiCapabilities | null = null;

  constructor(descriptor: DeviceDescriptor) {
    this.descriptor = descriptor;
  }

  /** Bitmap declarado por la banda (null hasta la respuesta del comando 1). */
  get capabilities(): ColmiCapabilities | null {
    return this.declaredCapabilities;
  }

  private get deviceId(): string {
    return this.descriptor.deviceId;
  }

  async start(onSample: SampleSink, onInfo: InfoSink): Promise<void> {
    this.onSample = onSample;
    this.onInfo = onInfo;
    this.onInfo({ name: this.descriptor.name });

    await ble.subscribe(
      this.deviceId,
      COLMI_SERVICE,
      COLMI_CHAR_TX,
      (bytes) => this.handleNotification(bytes),
    );
    this.subscribed = true;
    if (this.stopped) return;

    // La respuesta al comando 1 trae el bitmap de capacidades reales.
    await this.send(CMD.SET_TIME, makeSetTimePayload());
    await this.send(CMD.BATTERY);
    await this.startHeartRate();
    this.startWatchdog();
  }

  async stop(): Promise<void> {
    if (!this.stopped) {
      this.stopWatchdog();
      this.clearMeasureTimer();
      try {
        await this.send(CMD.STOP_REALTIME, [MEASURE_TYPE.heart_rate, 0, 0]);
        if (this.measureType !== null) {
          await this.send(CMD.STOP_REALTIME, [this.measureType, 0, 0]);
        }
      } catch {
        // La banda pudo desconectarse antes.
      }
    }
    this.stopped = true;
    this.measureType = null;
    await this.queue.catch(() => undefined);
    if (this.subscribed) {
      await ble.unsubscribe(this.deviceId, COLMI_SERVICE, COLMI_CHAR_TX);
    }
    this.subscribed = false;
    this.stream.reset();
  }

  /** Medida puntual (SpO2, presión). La FC ya va en continuo. */
  measure(kind: MetricKind): void {
    const type = MEASURE_TYPE_BY_METRIC[kind];
    if (type === undefined || this.stopped || this.measureType === type) return;
    void (async () => {
      if (this.measureType !== null) {
        await this.send(CMD.STOP_REALTIME, [this.measureType, 0, 0]);
      }
      this.measureType = type;
      this.measureCount = 0;
      await this.send(CMD.START_REALTIME, [type, 1]);
      this.clearMeasureTimer();
      this.measureTimer = window.setTimeout(
        () => void this.stopMeasure(),
        MEASURE_TIMEOUT_MS,
      );
    })();
  }

  // ─── Sesión Colmi ──────────────────────────────────────────────────────

  private async startHeartRate(): Promise<void> {
    this.lastHeartRateAt = Date.now();
    await this.send(CMD.START_REALTIME, [MEASURE_TYPE.heart_rate, 1]);
  }

  private async stopMeasure(): Promise<void> {
    const type = this.measureType;
    if (type === null) return;
    this.measureType = null;
    this.clearMeasureTimer();
    try {
      await this.send(CMD.STOP_REALTIME, [type, 0, 0]);
      // La medida puntual puede haber pausado el pulso continuo.
      if (!this.stopped) await this.startHeartRate();
    } catch {
      // Sin conexión: nada que detener.
    }
  }

  private clearMeasureTimer(): void {
    if (this.measureTimer !== undefined) {
      window.clearTimeout(this.measureTimer);
      this.measureTimer = undefined;
    }
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogTimer = window.setInterval(() => {
      if (this.stopped || this.measureType !== null) return;
      if (Date.now() - this.lastHeartRateAt < HR_RETRY_MS) return;
      void this.startHeartRate().catch(() => undefined);
    }, WATCHDOG_INTERVAL_MS);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer !== undefined) {
      window.clearInterval(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
  }

  private send(cmd: number, payload: number[] = []): Promise<void> {
    const next = this.queue.catch(() => undefined).then(async () => {
      if (this.stopped) return;
      await ble.writeBytes(
        this.deviceId,
        COLMI_SERVICE,
        COLMI_CHAR_RX,
        buildFrame(cmd, payload),
      );
      await delay(WRITE_SPACING_MS);
    });
    this.queue = next;
    return next;
  }

  private handleNotification(bytes: Uint8Array): void {
    for (const frame of this.stream.push(bytes)) {
      this.handleFrame(frame);
    }
  }

  private handleFrame(frame: ColmiFrame): void {
    if (frame.error) {
      console.warn(`[colmi] comando no soportado: ${frame.cmd}`);
      return;
    }
    switch (frame.cmd) {
      case CMD.SET_TIME:
        this.declaredCapabilities = parseCapabilities(frame.payload);
        break;
      case CMD.BATTERY: {
        const battery = parseBattery(frame.payload);
        if (battery) this.onInfo?.({ battery: battery.level });
        break;
      }
      case CMD.START_REALTIME:
      case CMD.STOP_REALTIME: {
        // ACK del dispositivo: no aporta datos.
        break;
      }
      default: {
        this.handleRealtime(frame);
      }
    }
  }

  private handleRealtime(frame: ColmiFrame): void {
    const samples = parseRealtimeFrame(frame, this.deviceId);
    if (!samples.length) return;
    const type = frame.payload[0];
    for (const sample of samples) {
      if (sample.metric === 'heart_rate') this.lastHeartRateAt = Date.now();
      this.onSample?.(sample);
    }
    if (this.measureType !== null && type === this.measureType) {
      this.measureCount += 1;
      if (this.measureCount >= MEASURE_TARGET) void this.stopMeasure();
    }
  }
}

/** Capacidades declaradas por la banda (para el modo diagnóstico). */
export type { ColmiCapabilities };
