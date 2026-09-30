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
import { formatMeasureTiming } from "../measure-timing";
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
const MEASURE_POLICY: Record<
  string,
  { target: number; windowMs: number; retryMs?: number }
> = {
  // FC persistente: el sensor a veces queda mudo 30 s o más tras aceptar el
  // START (responde `03 2f 00` pero no emite nada) y necesita ~25 s de
  // calentamiento limpio (BP/SpO2 entregan a los ~26 s). Por eso NO hay
  // re-enganche a mitad de ventana (cortarlo a los 10 s reseteaba el
  // calentamiento y lo dejaba mudo para siempre): al agotarse una ventana
  // vacía se extiende con otro ciclo + re-enganche, hasta HR_MAX_WINDOWS.
  // La FC solo termina con lectura, tope de ventanas, cancelación,
  // desconexión, rechazo o veredicto del anillo.
  heart_rate: { target: 3, windowMs: 30_000 },
  blood_pressure: { target: 1, windowMs: 60_000, retryMs: 15_000 },
  // SpO2: basta la primera lectura, pero este anillo tarda ~50 s en entregar
  // (medido contra su app oficial: 56 s primera / 65 s total; nuestras
  // corridas sin reintento: 43/53/53 s). Ventana de 90 s para contener ese
  // perfil con margen; si la lectura llega tarde, un volcado extra la
  // recupera del historial. SIN retryMs a propósito: el re-arme a los 20 s
  // reiniciaba la medición y regalaba ~15–20 s (60–73 s con retry).
  spo2: { target: 1, windowMs: 90_000 },
};
const DEFAULT_MEASURE_POLICY = { target: 3, windowMs: 30_000 };
/**
 * Pausa entre STOP y START en el re-enganche: un re-arme inmediato sobre un
 * sensor mudo no cambia nada; parar, respirar y volver a pedir sí lo despierta.
 */
const REENGAGE_SETTLE_MS = 3_000;
/**
 * Ventanas vacías máximas de una medida de FC (incluida la primera): 5 × 30 s
 * ≈ 2.5 min de re-enganches antes de cerrar con `timeout`/`no-signal`. Sin
 * tope, un anillo fuera del dedo mediría en segundo plano para siempre.
 */
const HR_MAX_WINDOWS = 5;

/** Política de la medida puntual de una métrica (objetivo y ventana). */
export function measurePolicyFor(kind: MetricKind): {
  target: number;
  windowMs: number;
  retryMs?: number;
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
  private measureRetryTimer?: number;
  /** Re-enganche stop+pausa+start en vuelo (evita STOP/START solapados). */
  private reengaging = false;
  /** Re-enganches emitidos en la medida en curso (diagnóstico). */
  private measureReengages = 0;
  /** Ventanas vacías extendidas en la medida en curso (solo FC persistente). */
  private measureWindows = 0;
  /**
   * Tramas `06 xx` vistas durante la medida (decodifiquen o no): distinguen un
   * sensor lento (hay radio → `timeout`) de uno mudo (nada → `no-signal`).
   */
  private measureFrames = 0;
  /** Instrumentación de tiempos (Registro BLE): inicio y primer dato. */
  private measureStartedAt = 0;
  private measureFirstAt = 0;
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
    this.measureReengages = 0;
    this.measureWindows = 0;
    this.reengaging = false;
    this.measureFrames = 0;
    this.measureStartedAt = Date.now();
    this.measureFirstAt = 0;
    ble.noteDiagnostic(
      formatMeasureTiming({ device: "ycbt", kind, event: "start" }),
    );
    this.measureTimer = window.setTimeout(
      () => this.onMeasureWindow(kind, mode),
      policy.windowMs,
    );
    if (policy.retryMs && kind !== "heart_rate") {
      // Re-enganche repetido (presión): si el barrido no emite nada, se para,
      // se respira y se vuelve a pedir cada `retryMs`. La FC no usa esta
      // cadena: su re-enganche vive en el borde de ventana (onMeasureWindow)
      // para no cortarle el calentamiento a mitad de ciclo ni solaparse con
      // la extensión (doble STOP/START visto en el Registro BLE).
      this.scheduleReengage(mode, kind, policy.retryMs);
    }
    void this.send(OP.LIVE_MEASUREMENT, [MEASURE_ENABLE, mode]).catch(
      () => undefined,
    );
  }

  /**
   * Ventana agotada. Si llegó al menos una lectura, la medida vale; si no
   * hubo ni siquiera tramas, es falta de señal (contacto), no lentitud. La
   * FC es la excepción: mientras queden ventanas, persiste con otra ventana
   * + UN re-enganche en vez de cerrar (el sensor queda mudo decenas de
   * segundos aunque acepte el comando y necesita su calentamiento limpio).
   */
  private onMeasureWindow(kind: MetricKind, mode: number): void {
    if (this.measureMode !== mode) return;
    if (this.measureCount > 0) {
      this.cancelMeasure(true, "completed");
      return;
    }
    if (kind === "heart_rate" && this.measureWindows + 1 < HR_MAX_WINDOWS) {
      this.measureWindows += 1;
      ble.noteDiagnostic(
        `[ycbt] medida heart_rate: sin lecturas, ventana ${this.measureWindows + 1} (stop+pausa+start)`,
      );
      const policy = measurePolicyFor(kind);
      this.measureTimer = window.setTimeout(
        () => this.onMeasureWindow(kind, mode),
        policy.windowMs,
      );
      this.reengage(mode, kind);
      return;
    }
    this.cancelMeasure(false, this.measureFrames > 0 ? "timeout" : "no-signal");
  }

  /** Re-enganche periódico mientras la medida siga sin lecturas. */
  private scheduleReengage(
    mode: number,
    kind: MetricKind,
    retryMs: number,
  ): void {
    this.measureRetryTimer = window.setTimeout(() => {
      if (this.measureMode !== mode || this.stopped || !this.appActive) return;
      if (this.measureCount > 0) return;
      this.reengage(mode, kind);
      // Sigue mudo: se reintenta de nuevo en `retryMs` (la cadena muere sola
      // al llegar la primera lectura o al cerrar la medida).
      this.scheduleReengage(mode, kind, retryMs);
    }, retryMs);
  }

  /**
   * Para el barrido, respira y lo vuelve a pedir: lo único que despierta al
   * sensor cuando acepta el START pero se queda mudo. Single-flight: si ya
   * hay uno en vuelo se ignora (evita el doble STOP/START solapado).
   */
  private reengage(mode: number, kind: MetricKind): void {
    if (this.reengaging) return;
    this.reengaging = true;
    this.measureReengages += 1;
    ble.noteDiagnostic(`[ycbt] medida ${kind}: re-enganche (stop+pausa+start)`);
    void (async () => {
      try {
        await this.send(OP.LIVE_MEASUREMENT, [MEASURE_DISABLE, mode]);
      } catch {
        // Sin conexión: nada que re-enganchar.
      }
      await delay(REENGAGE_SETTLE_MS);
      this.reengaging = false;
      if (
        this.measureMode !== mode ||
        this.measureCount > 0 ||
        this.stopped ||
        !this.appActive
      ) {
        return;
      }
      void this.send(OP.LIVE_MEASUREMENT, [MEASURE_ENABLE, mode]).catch(
        () => undefined,
      );
    })();
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
   * Detiene la medida en curso: equivale a cancelarla por decisión del
   * usuario (avisa `onDone(false, "cancelled")` una sola vez).
   */
  stopMeasure(): void {
    if (this.measureMode !== null) this.cancelMeasure(false, "cancelled");
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
   *
   * Excepción: SpO2 (`05 1a`) NO se pide — el firmware jamás lo responde (cero
   * respuestas en todas las capturas) y cada intento quema ~6 s de watchdog
   * por sync. El tipo sigue definido en el catálogo por si otro firmware sí
   * lo implementa.
   */
  private historyTypes(): YcbtHistoryType[] {
    return HISTORY_TYPES.filter((t) => t.key !== "spo2");
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
    // Cualquier trama `06 xx` durante la medida cuenta como radio (aunque no
    // decodifique): distingue sensor lento de sensor mudo al cerrar.
    if (this.measureMode !== null) this.measureFrames += 1;
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
      if (this.measureCount === 1) {
        // Cuánto tardó el sensor en entregar el primer dato de esta medida.
        this.measureFirstAt = Date.now();
        ble.noteDiagnostic(
          formatMeasureTiming({
            device: "ycbt",
            kind: sample.metric,
            event: "first",
            elapsedMs: this.measureFirstAt - this.measureStartedAt,
          }),
        );
      }
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
    const metric = this.measureMetric;
    const readings = this.measureCount;
    const elapsedMs = Date.now() - this.measureStartedAt;
    const done = this.measureDone;
    this.measureMode = null;
    this.measureMetric = null;
    this.measureFirstAt = 0;
    this.measureCount = 0;
    this.measureFrames = 0;
    this.reengaging = false;
    this.measureDone = undefined;
    if (this.measureTimer !== undefined) {
      window.clearTimeout(this.measureTimer);
      this.measureTimer = undefined;
    }
    if (this.measureRetryTimer !== undefined) {
      window.clearTimeout(this.measureRetryTimer);
      this.measureRetryTimer = undefined;
    }
    if (mode !== null && !this.stopped) {
      // El stop repite su propio modo: no es un comodín.
      void this.send(OP.LIVE_MEASUREMENT, [MEASURE_DISABLE, mode]).catch(
        () => undefined,
      );
      // Diagnóstico en el Registro BLE: qué medida cerró, en cuánto y con
      // cuántas lecturas (la ventana completa vs el primer dato real).
      ble.noteDiagnostic(
        formatMeasureTiming({
          device: "ycbt",
          kind: metric ?? String(mode),
          event: "done",
          elapsedMs,
          readings,
          outcome: ok ? "completada" : reason,
        }),
      );
    }
    done?.(ok, reason);
  }
}
