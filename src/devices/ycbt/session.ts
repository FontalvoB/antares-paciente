import type { BleService } from "@capacitor-community/bluetooth-le";
import * as ble from "../ble/ble-client";
import { delay } from "../util";
import { HistorySync } from "./history";
import {
  DEV_MEASUREMENT_RESULT,
  DEV_MEASUREMENT_STATUS,
  HISTORY_TYPES,
  JL_CHAR_NOTIFY,
  LIVE_STATUS_OFF,
  LIVE_STATUS_ON,
  MEASURE_DISABLE,
  MEASURE_ENABLE,
  MEASURE_MODE,
  OP,
  PacketStream,
  YCBT_CHAR_C1,
  YCBT_CHAR_C3,
  YCBT_SERVICE,
  buildPacket,
  decodeErrorPayload,
  deviceAckType,
  makeBleTime,
  parseCapabilities,
} from "./protocol";
import type { YcbtHistoryType, YcbtPacket } from "./protocol";
import { parseMeasurementStatus, parseRealtimePacket } from "./realtime";
import type {
  DeviceDescriptor,
  DeviceInfo,
  DeviceSession,
  HealthSample,
  InfoSink,
  MeasureCallback,
  MeasureOutcome,
  MeasurePolicy,
  MetricKind,
  SampleSink,
} from "../types";

// Espaciado entre escrituras recomendado por la implementación de referencia.
const WRITE_SPACING_MS = 400;
// El chip JieLi (RCSP) autentica en segundo plano: hay que esperar antes de seguir.
const AUTH_WAIT_MS = 3000;
const SETTLE_AFTER_HANDSHAKE_MS = 1000;
/** Re-sincronización periódica (misma cadencia que la app oficial). */
const REFRESH_INTERVAL_MS = 30 * 60_000;

/**
 * Política de medida puntual por métrica. La FC emite ~1 muestra/s y basta con
 * 3; la presión y el SpO2 son barridos largos (LED propio, la lectura se fija
 * al final), así que esperan más y el SpO2 termina con la PRIMERA lectura
 * válida — exigirle 3 era lo que agotaba la ventana y mostraba un error falso
 * aunque el anillo sí hubiera medido.
 */
const MEASURE_POLICY: Record<string, { target: number; windowMs: number }> = {
  heart_rate: { target: 3, windowMs: 30_000 },
  blood_pressure: { target: 3, windowMs: 60_000 },
  spo2: { target: 1, windowMs: 60_000 },
};
const DEFAULT_MEASURE_POLICY = { target: 3, windowMs: 30_000 };

/** Política de la medida puntual de una métrica (objetivo y ventana). */
export function measurePolicyFor(kind: MetricKind): {
  target: number;
  windowMs: number;
} {
  return MEASURE_POLICY[kind] ?? DEFAULT_MEASURE_POLICY;
}

/**
 * Traduce el `result` del push `04 0e` al motivo de fin: 2 = la medida falló
 * (contacto/movimiento); cualquier otro valor = el anillo la canceló.
 */
export function outcomeForResult(result: number | undefined): MeasureOutcome {
  return result === 2 ? "failed" : "cancelled";
}

/** Driver del anillo R88 (protocolo YCBT de Yucheng). */
export class YcbtSession implements DeviceSession {
  readonly descriptor: DeviceDescriptor;
  readonly supportsMeasure = true;

  private readonly services: BleService[];
  private readonly streamC1 = new PacketStream();
  private readonly streamC3 = new PacketStream();
  private readonly history: HistorySync;
  private onSample?: SampleSink;
  private onInfo?: InfoSink;
  private stopped = false;
  private appActive = true;
  private refreshTimer?: number;
  private queue: Promise<void> = Promise.resolve();
  private subscribed: { service: string; characteristic: string }[] = [];
  // Medida puntual: un modo a la vez (el anillo tiene un solo sensor activo).
  private measureMode: number | null = null;
  private measureMetric: MetricKind | null = null;
  private measureCount = 0;
  private measureTarget = 1;
  private measureDone?: MeasureCallback;
  private measureTimer?: number;
  private historyBusy = false;
  private historyPromise: Promise<void> | null = null;

  constructor(descriptor: DeviceDescriptor, services: BleService[]) {
    this.descriptor = descriptor;
    this.services = services;
    this.history = new HistorySync(
      descriptor.deviceId,
      (type, payload) => this.send(type, payload),
      {
        onSamples: (samples) => samples.forEach((sample) => this.emit(sample)),
        onNote: (text) => ble.noteDiagnostic(text),
      },
    );
  }

  private get deviceId(): string {
    return this.descriptor.deviceId;
  }

  /**
   * Métricas medibles bajo demanda. El bitmap `02 01` del R88 no siempre
   * declara los bits de medida manual, así que se ofrecen las tres y el
   * anillo rechaza (status ≠ 0) la que no pueda: el rechazo se muestra como
   * error de medición, nunca como un botón muerto.
   */
  get measureKinds(): MetricKind[] {
    return ["heart_rate", "spo2", "blood_pressure"];
  }

  async start(onSample: SampleSink, onInfo: InfoSink): Promise<void> {
    this.stopped = false;
    this.appActive = true;
    this.onSample = onSample;
    this.onInfo = onInfo;
    this.onInfo({ name: this.descriptor.name });

    await this.subscribeIfPresent(YCBT_SERVICE, YCBT_CHAR_C1, (bytes) =>
      this.handleControl(bytes),
    );
    await this.subscribeIfPresent(YCBT_SERVICE, YCBT_CHAR_C3, (bytes) =>
      this.handleNotification(bytes),
    );
    // Autenticación JieLi: sin esta suscripción el anillo permanece mudo.
    await this.subscribeIfPresent(
      YCBT_SERVICE,
      JL_CHAR_NOTIFY,
      () => undefined,
    );

    await this.handshake();
    if (this.stopped) return;
    this.startRefresh();
  }

  async stop(): Promise<void> {
    this.appActive = false;
    if (!this.stopped) {
      this.stopRefresh();
      this.cancelMeasure(false, "disconnected");
      this.history.abort();
      try {
        await this.send(OP.LIVE_STATUS_PUSH, LIVE_STATUS_OFF);
      } catch {
        // El dispositivo pudo desconectarse antes.
      }
    }
    this.stopped = true;
    await this.queue.catch(() => undefined);
    for (const { service, characteristic } of this.subscribed) {
      await ble.unsubscribe(this.deviceId, service, characteristic);
    }
    this.subscribed = [];
    this.streamC1.reset();
    this.streamC3.reset();
  }

  /** Medida puntual: `03 2f 01 <modo>`; el anillo responde por el stream 0x06. */
  measure(kind: MetricKind, onDone?: MeasureCallback): void {
    const mode = MEASURE_MODE[kind as keyof typeof MEASURE_MODE];
    if (mode === undefined || this.stopped || !this.appActive) {
      onDone?.(false, "refused");
      return;
    }
    if (this.measureMode !== null) this.cancelMeasure(false, "replaced");
    const policy = measurePolicyFor(kind);
    this.measureMode = mode;
    this.measureMetric = kind;
    this.measureCount = 0;
    this.measureTarget = policy.target;
    this.measureDone = onDone;
    this.measureTimer = window.setTimeout(
      // Ventana agotada: si llegó al menos una lectura, la medida vale.
      () =>
        this.cancelMeasure(
          this.measureCount > 0,
          this.measureCount > 0 ? "completed" : "timeout",
        ),
      policy.windowMs,
    );
    void this.send(OP.LIVE_MEASUREMENT, [MEASURE_ENABLE, mode]).catch(
      () => undefined,
    );
  }

  /**
   * Pide de nuevo la información del dispositivo (`02 00`): batería y
   * firmware. La respuesta llega por el canal C1 y se publica vía onInfo.
   */
  requestInfo(): void {
    if (this.stopped || !this.appActive || this.measureMode !== null) return;
    void this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]).catch(() => undefined);
  }

  /** Ventana/umbral de la medida (la UI muestra el cronómetro con esto). */
  measurePolicy(kind: MetricKind): MeasurePolicy | undefined {
    return measurePolicyFor(kind);
  }

  /**
   * Volcado del historial del anillo (sueño, pasos, FC, SpO2…). Al terminar
   * se re-afirma el estado en vivo: algunos firmwares no publican el stream
   * 0x0600 hasta que termina el dump.
   */
  syncHistory(): Promise<void> {
    if (this.stopped || !this.appActive || this.measureMode !== null) {
      return Promise.resolve();
    }
    if (this.historyBusy) return this.historyPromise ?? Promise.resolve();
    this.historyBusy = true;
    const promise = this.history
      .start(this.historyTypes())
      .then(() => {
        if (this.measureMode === null && this.appActive) {
          this.refreshLiveStatus();
        }
      })
      .finally(() => {
        this.historyBusy = false;
        this.historyPromise = null;
      });
    this.historyPromise = promise;
    return promise;
  }

  setAppActive(active: boolean): void {
    if (this.stopped) return;
    this.appActive = active;
    if (active) this.startRefresh();
    else this.stopRefresh();
  }

  // ─── Sesión YCBT ───────────────────────────────────────────────────────

  private async handshake(): Promise<void> {
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);
    await this.send(OP.GET_SUPPORT_FUNCTION, [0x47, 0x46]);
    await this.send(OP.SET_TIME, makeBleTime());
    await this.send(OP.GET_CHIP_SCHEME);
    await this.send(OP.GET_DEVICE_NAME, [0x47, 0x50]);

    await delay(AUTH_WAIT_MS);

    // Segunda petición tras la autenticación JieLi: el primer `02 00` puede
    // caer antes de que el anillo esté listo y quedarse sin respuesta (era el
    // motivo de que la batería no apareciera al conectar).
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);

    // Monitores all-day (FC y SpO2 cada 5 min): hacen que el anillo registre
    // entre sincronizaciones.
    await this.send(OP.SET_HEART_MONITOR, [0x01, 0x05]);
    await this.send(OP.SET_SPO2_MONITOR, [0x01, 0x05]);
    // Estado en vivo (pasos/distancia/kcal del día).
    await this.send(OP.LIVE_STATUS_PUSH, LIVE_STATUS_ON);

    await delay(SETTLE_AFTER_HANDSHAKE_MS);
  }

  private startRefresh(): void {
    this.stopRefresh();
    this.refreshTimer = window.setInterval(() => {
      if (this.stopped || !this.appActive || this.measureMode !== null) return;
      if (this.historyBusy) return;
      this.refreshLiveStatus();
      this.requestInfo();
      void this.syncHistory();
    }, REFRESH_INTERVAL_MS);
  }

  private stopRefresh(): void {
    if (this.refreshTimer !== undefined) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private refreshLiveStatus(): void {
    if (this.stopped) return;
    void this.send(OP.LIVE_STATUS_PUSH, LIVE_STATUS_ON).catch(() => undefined);
  }

  /**
   * Tipos de historial a pedir. Se pide el catálogo completo y NO se filtra por
   * el bitmap `02 01`: en este firmware el bitmap subdeclara capacidades (el
   * R88 registra sueño pero no enciende su bit, igual que los bits de medida
   * manual), y filtrar por él dejaba el sueño sin pedir nunca. Un tipo que el
   * anillo no implemente cuesta solo su watchdog corto: responde header sin
   * datos o `0xFC`, y `history.ts` recuerda el `0xFC` para no repetirlo.
   */
  private historyTypes(): YcbtHistoryType[] {
    return [...HISTORY_TYPES];
  }

  private async subscribeIfPresent(
    service: string,
    characteristic: string,
    onValue: (bytes: Uint8Array) => void,
  ): Promise<boolean> {
    if (!ble.hasCharacteristic(this.services, service, characteristic)) {
      return false;
    }
    await ble.subscribe(this.deviceId, service, characteristic, onValue);
    this.subscribed.push({ service, characteristic });
    return true;
  }

  private send(type: number, payload: number[] = []): Promise<void> {
    const next = this.queue
      .catch(() => undefined)
      .then(async () => {
        if (this.stopped) return;
        await ble.writeBytes(
          this.deviceId,
          YCBT_SERVICE,
          YCBT_CHAR_C1,
          buildPacket(type, payload),
        );
        await delay(WRITE_SPACING_MS);
      });
    this.queue = next;
    return next;
  }

  /** Los dos canales comparten el enrutado: el historial usa cualquiera. */
  private handleControl(bytes: Uint8Array): void {
    for (const packet of this.streamC1.push(bytes)) this.route(packet);
  }

  private handleNotification(bytes: Uint8Array): void {
    for (const packet of this.streamC3.push(bytes)) this.route(packet);
  }

  private route(packet: YcbtPacket): void {
    if (packet.group === 0x05) {
      this.history.handle(packet);
      return;
    }
    const error = decodeErrorPayload(packet.payload);
    if (error) {
      console.warn(`[ycbt] error del dispositivo: ${error}`, packet.type);
      return;
    }
    switch (packet.group) {
      case 0x02:
        this.handleGetReply(packet);
        return;
      case 0x03:
        // 0x00 = aceptada; cualquier otro = el firmware la rechaza.
        if (
          packet.type === OP.LIVE_MEASUREMENT &&
          packet.payload.length === 1 &&
          packet.payload[0] !== 0
        ) {
          this.cancelMeasure(false, "refused");
        }
        return;
      case 0x04:
        this.handleDevControl(packet);
        return;
      case 0x06:
        this.handleRealtime(packet);
        return;
      default:
        return;
    }
  }

  private handleGetReply(packet: YcbtPacket): void {
    if (packet.type === OP.GET_DEVICE_INFO && packet.payload.length >= 6) {
      const info: DeviceInfo = {
        firmware: `${packet.payload[3]}.${packet.payload[2]}`,
        battery: packet.payload[5],
      };
      this.onInfo?.(info);
      return;
    }
    if (packet.type === OP.GET_SUPPORT_FUNCTION) {
      // El bitmap se registra pero NO gobierna qué se pide: en este firmware
      // subdeclara capacidades (ver historyTypes).
      const caps = parseCapabilities(packet.payload);
      const line = `[ycbt] bitmap 02 01 (${packet.payload.length} B): pasos=${caps.steps} sueño=${caps.sleep} fc=${caps.heartRate} presión=${caps.bloodPressure} spo2=${caps.spo2}`;
      console.debug(line);
      ble.noteDiagnostic(line);
    }
  }

  private handleRealtime(packet: YcbtPacket): void {
    if (packet.type === OP.LIVE_BATTERY) {
      const battery = packet.payload[1];
      if (battery !== undefined) this.onInfo?.({ battery });
      return;
    }
    for (const sample of parseRealtimePacket(packet, this.deviceId)) {
      this.emit(sample);
    }
  }

  private handleDevControl(packet: YcbtPacket): void {
    // Sin ACK el anillo reintenta el push indefinidamente.
    void this.send(deviceAckType(packet.key), [0x00]).catch(() => undefined);
    if (packet.type === deviceAckType(DEV_MEASUREMENT_RESULT)) {
      // `04 0e [modo][resultado]`: el veredicto del propio anillo. 2 = la
      // medida falló (contacto/movimiento); el resto = cancelada. Cortar aquí
      // evita esperar la ventana completa por algo que ya no va a llegar.
      if (this.measureMode !== null) {
        const result = packet.payload[1];
        this.cancelMeasure(false, outcomeForResult(result));
      }
      return;
    }
    if (packet.type === deviceAckType(DEV_MEASUREMENT_STATUS)) {
      for (const sample of parseMeasurementStatus(
        packet.payload,
        this.deviceId,
      )) {
        this.emit(sample);
      }
    }
  }

  private emit(sample: HealthSample): void {
    if (this.measureMode !== null && sample.metric === this.measureMetric) {
      this.measureCount += 1;
      if (this.measureCount >= this.measureTarget) {
        // La muestra que cierra la medida también se publica: es la lectura
        // que el usuario debe ver en la tarjeta.
        this.cancelMeasure(true, "completed");
      }
    }
    this.onSample?.(sample);
  }

  private cancelMeasure(ok: boolean, reason: MeasureOutcome): void {
    const mode = this.measureMode;
    const done = this.measureDone;
    this.measureMode = null;
    this.measureMetric = null;
    this.measureCount = 0;
    this.measureDone = undefined;
    if (this.measureTimer !== undefined) {
      window.clearTimeout(this.measureTimer);
      this.measureTimer = undefined;
    }
    if (mode !== null && !this.stopped) {
      // El stop repite su propio modo: no es un comodín.
      void this.send(OP.LIVE_MEASUREMENT, [MEASURE_DISABLE, mode]).catch(
        () => undefined,
      );
    }
    done?.(ok, reason);
  }
}
