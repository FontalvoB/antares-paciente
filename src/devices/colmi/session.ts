import * as ble from "../ble/ble-client";
import { delay } from "../util";
import { BcChannel, nightHasHrSupport } from "./bc";
import { ColmiHistory, buildHistoryRequests } from "./history";
import {
  CMD,
  COLMI_CHAR_RX,
  COLMI_CHAR_TX,
  COLMI_HISTORY_CMDS,
  COLMI_SERVICE,
  FrameStream,
  MEASURE_TYPE,
  buildFrame,
  makeSetTimePayload,
  parseBattery,
  parseCapabilities,
} from "./protocol";
import type {
  ColmiCapabilities,
  ColmiFrame,
  ColmiMeasureType,
} from "./protocol";
import { heartRateFromPayload, parseRealtimeFrame } from "./realtime";
import type {
  DeviceDescriptor,
  DeviceSession,
  HealthSample,
  InfoSink,
  MeasureCallback,
  MeasureOutcome,
  MeasurePolicy,
  MetricKind,
  SampleSink,
} from "../types";

const WRITE_SPACING_MS = 150;
/** Si no llega FC en este tiempo, se re-arma la medida continua. */
const HR_RETRY_MS = 20_000;
const WATCHDOG_INTERVAL_MS = 5_000;
/** Una medida puntual se corta sola: el sensor óptico a veces no engancha. */
const MEASURE_TIMEOUT_MS = 30_000;
/** Muestras válidas suficientes para dar una medida por buena. */
const MEASURE_TARGET = 3;

/**
 * Política por métrica. La presión es un barrido lento cuyo primer intento se
 * va en "enganchar" (por eso antes había que pulsar dos veces): se le da más
 * ventana y un reintento automático. FC y SpO2 mantienen 30 s.
 */
const MEASURE_POLICY: Partial<Record<MetricKind, MeasurePolicy>> = {
  blood_pressure: { windowMs: 60_000, retryMs: 15_000 },
};
const DEFAULT_MEASURE_POLICY: MeasurePolicy = { windowMs: MEASURE_TIMEOUT_MS };

/** Relectura de la batería en sesiones largas (el anillo hace lo mismo). */
const BATTERY_REFRESH_MS = 30 * 60_000;

/** Nombre corto por tipo, para las notas de diagnóstico. */
const MEASURE_NOTE: Partial<Record<ColmiMeasureType, string>> = {
  [MEASURE_TYPE.heart_rate]: "fc",
  [MEASURE_TYPE.blood_pressure]: "bp",
  [MEASURE_TYPE.spo2]: "spo2",
};

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
  private appActive = true;
  private subscribed = false;
  private queue: Promise<void> = Promise.resolve();
  private watchdogTimer?: number;
  private batteryTimer?: number;
  private measureTimer?: number;
  private measureRetryTimer?: number;
  private measureType: ColmiMeasureType | null = null;
  private measureCount = 0;
  private measureDone?: MeasureCallback;
  private lastHeartRateAt = 0;
  private declaredCapabilities: ColmiCapabilities | null = null;
  private readonly history: ColmiHistory;
  private readonly bc: BcChannel;
  private historyBusy = false;
  /** FC del volcado en curso: corrobora las noches que devuelve el canal bc. */
  private syncHrSamples: HealthSample[] = [];
  private historyPromise: Promise<void> | null = null;
  /** Ya se anotó qué layout de FC usa este firmware (evita spam en el log). */
  private hrLayoutNoted = false;
  /** Ya se volcó una trama de presión sin lectura plausible. */
  private bpRawNoted = false;

  constructor(descriptor: DeviceDescriptor) {
    this.descriptor = descriptor;
    this.history = new ColmiHistory(
      descriptor.deviceId,
      (cmd, payload) => this.send(cmd, payload),
      {
        onSamples: (samples) =>
          samples.forEach((sample) => {
            if (sample.metric === "heart_rate") this.syncHrSamples.push(sample);
            this.emit(sample);
          }),
        onNote: (text) => ble.noteDiagnostic(text),
      },
    );
    this.bc = new BcChannel(descriptor.deviceId, {
      onSamples: (samples) => samples.forEach((sample) => this.emit(sample)),
      onNote: (text) => ble.noteDiagnostic(text),
    });
  }

  /** Bitmap declarado por la banda (null hasta la respuesta del comando 1). */
  get capabilities(): ColmiCapabilities | null {
    return this.declaredCapabilities;
  }

  private get deviceId(): string {
    return this.descriptor.deviceId;
  }

  async start(onSample: SampleSink, onInfo: InfoSink): Promise<void> {
    this.stopped = false;
    this.appActive = true;
    this.onSample = onSample;
    this.onInfo = onInfo;
    this.onInfo({ name: this.descriptor.name });

    await ble.subscribe(this.deviceId, COLMI_SERVICE, COLMI_CHAR_TX, (bytes) =>
      this.handleNotification(bytes),
    );
    this.subscribed = true;
    if (this.stopped) return;

    // La respuesta al comando 1 trae el bitmap de capacidades reales.
    await this.send(CMD.SET_TIME, makeSetTimePayload());
    await this.send(CMD.BATTERY);
    // Log de FC 24/7: sin esto la curva de 5 min del historial se queda vacía.
    await this.send(CMD.HR_LOG, [2, 1, 5]);
    await this.startHeartRate();
    this.startWatchdog();
    this.startBatteryRefresh();
    // Primer volcado (incluye el canal rico: sueño por fases y SpO2 por hora).
    void this.syncHistory();
  }

  /** Vuelve a pedir la batería (la pantalla la refresca al abrirse). */
  requestInfo(): void {
    if (
      this.stopped ||
      !this.appActive ||
      this.measureType !== null
    )
      return;
    void this.send(CMD.BATTERY).catch(() => undefined);
  }

  /** Ventana/umbral de la medida (la UI muestra el cronómetro con esto). */
  measurePolicy(kind: MetricKind): MeasurePolicy | undefined {
    return MEASURE_POLICY[kind] ?? DEFAULT_MEASURE_POLICY;
  }

  /** Volcado del historial de la banda (pasos, FC, estrés/HRV, sueño, SpO2). */
  async syncHistory(): Promise<void> {
    if (this.stopped || !this.appActive || this.measureType !== null) return;
    if (this.historyBusy) return this.historyPromise ?? Promise.resolve();
    this.historyBusy = true;
    const promise = (async () => {
      this.syncHrSamples = [];
      await this.history.start(
        buildHistoryRequests(0, {
          includeSleepProbe: ble.isBleDebugEnabled(),
        }),
      );
      if (!this.appActive || this.stopped) return;
      const ready = await this.bc.open();
      if (!ready || !this.appActive || this.stopped) return;
      for (const sample of await this.bc.sleepNights()) {
        if (nightHasHrSupport(sample, this.syncHrSamples)) {
          this.emit(sample);
        } else {
          // Banda sin puesto: guardó una "noche" sin FC. Mejor no mostrarla.
          this.note(
            `[colmi] bc sleep: noche descartada sin FC (${Math.round(sample.value)} min)`,
          );
        }
      }
      for (const sample of await this.bc.spo2History(0)) this.emit(sample);
    })().finally(() => {
      this.historyBusy = false;
      this.historyPromise = null;
    });
    this.historyPromise = promise;
    return promise;
  }

  setAppActive(active: boolean): void {
    if (this.stopped) return;
    this.appActive = active;
    if (!active) {
      this.stopWatchdog();
      this.stopBatteryRefresh();
      this.history.abort();
      void this.bc.close();
      return;
    }
    this.startWatchdog();
    this.startBatteryRefresh();
  }

  async stop(): Promise<void> {
    this.appActive = false;
    if (!this.stopped) {
      this.stopWatchdog();
      this.stopBatteryRefresh();
      this.clearMeasureTimer();
      this.history.abort();
      void this.bc.close();
      const pendingDone = this.measureDone;
      const pendingType = this.measureType;
      this.measureDone = undefined;
      this.measureType = null;
      pendingDone?.(false, "disconnected");
      try {
        await this.send(CMD.STOP_REALTIME, [MEASURE_TYPE.heart_rate, 0, 0]);
        if (pendingType !== null) {
          await this.send(CMD.STOP_REALTIME, [pendingType, 0, 0]);
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

  /**
   * Medida puntual (FC, SpO2, presión). `onDone` SIEMPRE se llama una vez:
   * sin él la pantalla se queda "midiendo" para siempre y bloquea los demás
   * botones (era el bug: esta implementación ignoraba el callback).
   */
  measure(kind: MetricKind, onDone?: MeasureCallback): void {
    const type = MEASURE_TYPE_BY_METRIC[kind];
    if (type === undefined || this.stopped || !this.appActive) {
      onDone?.(false, "refused");
      return;
    }
    // Otra medida en curso: se cierra avisando, para no dejarla colgada.
    if (this.measureType !== null) this.finishMeasure(false, "replaced");
    const policy = MEASURE_POLICY[kind] ?? DEFAULT_MEASURE_POLICY;
    this.measureType = type;
    this.measureCount = 0;
    this.measureDone = onDone;
    this.clearMeasureTimer();
    this.measureTimer = window.setTimeout(
      () => this.finishMeasure(false, "timeout"),
      policy.windowMs,
    );
    if (policy.retryMs) {
      this.measureRetryTimer = window.setTimeout(
        () => this.retryMeasure(),
        policy.retryMs,
      );
    }
    void this.send(CMD.START_REALTIME, [type, 1]).catch(() => undefined);
  }

  // ─── Sesión Colmi ──────────────────────────────────────────────────────

  private async startHeartRate(): Promise<void> {
    this.lastHeartRateAt = Date.now();
    await this.send(CMD.START_REALTIME, [MEASURE_TYPE.heart_rate, 1]);
  }

  /**
   * Cierra la medida en curso: para el sensor, avisa a la UI (una sola vez) y
   * re-arma el pulso continuo, que la medida puntual pausa.
   */
  private finishMeasure(ok: boolean, reason: MeasureOutcome): void {
    const type = this.measureType;
    const done = this.measureDone;
    this.measureType = null;
    this.measureDone = undefined;
    this.measureCount = 0;
    this.clearMeasureTimer();
    done?.(ok, reason);
    if (type === null || this.stopped || !this.appActive) return;
    void (async () => {
      try {
        await this.send(CMD.STOP_REALTIME, [type, 0, 0]);
        // El re-arme de la FC SOLO si no hay otra medida en curso: si se cuela
        // después del START nuevo, cancela su barrido (era el bug de presión).
        if (
          !this.stopped &&
          this.appActive &&
          this.measureType === null
        ) {
          await this.startHeartRate();
        }
      } catch {
        // Sin conexión: nada que detener.
      }
    })();
  }

  /**
   * Reintento del barrido: la presión (y a veces el SpO2) se va en enganchar en
   * el primer intento. Si a mitad de la ventana no llegó ninguna muestra, se
   * repite STOP+START una sola vez sin que el usuario pulse de nuevo.
   */
  private retryMeasure(): void {
    const type = this.measureType;
    if (
      type === null ||
      this.measureCount > 0 ||
      this.stopped ||
      !this.appActive
    ) return;
    this.note(`[colmi] ${MEASURE_NOTE[type] ?? type}: reintento de barrido`);
    void (async () => {
      try {
        await this.send(CMD.STOP_REALTIME, [type, 0, 0]);
        if (this.stopped || !this.appActive || this.measureType !== type) return;
        await this.send(CMD.START_REALTIME, [type, 1]);
      } catch {
        // Sin conexión: nada que reintentar.
      }
    })();
  }

  private note(text: string): void {
    console.debug(text);
    ble.noteDiagnostic(text);
  }

  private clearMeasureTimer(): void {
    if (this.measureTimer !== undefined) {
      window.clearTimeout(this.measureTimer);
      this.measureTimer = undefined;
    }
    if (this.measureRetryTimer !== undefined) {
      window.clearTimeout(this.measureRetryTimer);
      this.measureRetryTimer = undefined;
    }
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogTimer = window.setInterval(() => {
      if (this.stopped || !this.appActive || this.measureType !== null) return;
      if (Date.now() - this.lastHeartRateAt < HR_RETRY_MS) return;
      void this.startHeartRate().catch(() => undefined);
    }, WATCHDOG_INTERVAL_MS);
  }

  private startBatteryRefresh(): void {
    this.stopBatteryRefresh();
    this.batteryTimer = window.setInterval(
      () => this.requestInfo(),
      BATTERY_REFRESH_MS,
    );
  }

  private stopBatteryRefresh(): void {
    if (this.batteryTimer !== undefined) {
      window.clearInterval(this.batteryTimer);
      this.batteryTimer = undefined;
    }
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer !== undefined) {
      window.clearInterval(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
  }

  private send(cmd: number, payload: number[] = []): Promise<void> {
    const next = this.queue
      .catch(() => undefined)
      .then(async () => {
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
      default: {
        if (COLMI_HISTORY_CMDS.includes(frame.cmd)) {
          if (this.history.handle(frame)) break;
        }
        this.handleRealtime(frame);
      }
    }
  }

  private emit(sample: HealthSample): void {
    this.onSample?.(sample);
  }

  /** Deja constancia del layout de FC detectado (una vez por sesión). */
  private noteHrLayout(payload: Uint8Array): void {
    if (this.hrLayoutNoted) return;
    const reading = heartRateFromPayload(payload);
    if (reading?.layout !== "u16") return;
    this.hrLayoutNoted = true;
    ble.noteDiagnostic("[colmi] fc: layout u16×0.1 (décimas de lpm)");
  }

  private handleRealtime(frame: ColmiFrame): void {
    const samples = parseRealtimeFrame(frame, this.deviceId);
    if (!samples.length) {
      // Presión sin lectura plausible: se vuelca la trama cruda una vez para
      // poder ajustar el layout sin otra captura completa.
      if (frame.payload[0] === MEASURE_TYPE.blood_pressure) {
        this.noteBloodPressureRaw(frame);
      }
      return;
    }
    const type = frame.payload[0];
    for (const sample of samples) {
      if (sample.metric === "heart_rate") {
        this.lastHeartRateAt = Date.now();
        this.noteHrLayout(frame.payload);
      }
      this.onSample?.(sample);
    }
    if (this.measureType !== null && type === this.measureType) {
      this.measureCount += 1;
      if (this.measureCount >= MEASURE_TARGET) {
        this.finishMeasure(true, "completed");
      }
    }
  }

  /** Trama de presión sin lectura plausible: deja los bytes para decodificar. */
  private noteBloodPressureRaw(frame: ColmiFrame): void {
    if (this.bpRawNoted) return;
    this.bpRawNoted = true;
    const hex = Array.from(frame.raw)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ");
    ble.noteDiagnostic(`[colmi] bp crudo: ${hex}`);
  }
}

/** Capacidades declaradas por la banda (para el modo diagnóstico). */
export type { ColmiCapabilities };
