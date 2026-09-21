import type { BleService } from '@capacitor-community/bluetooth-le';
import * as ble from '../ble/ble-client';
import { delay } from '../util';
import { parseHrsMeasurement } from '../hrs/hrs';
import {
  HR_CHAR_MEASUREMENT,
  HR_SERVICE,
  JL_CHAR_NOTIFY,
  OP,
  PacketStream,
  YCBT_CHAR_C1,
  YCBT_CHAR_C3,
  YCBT_SERVICE,
  buildPacket,
  decodeErrorPayload,
  makeBleTime,
} from './protocol';
import { parseRealtimePacket } from './realtime';
import type {
  DeviceDescriptor,
  DeviceInfo,
  DeviceSession,
  InfoSink,
  SampleSink,
} from '../types';

// Espaciado entre escrituras recomendado por la implementación de referencia.
const WRITE_SPACING_MS = 400;
// El chip JieLi (RCSP) autentica en segundo plano: hay que esperar antes de seguir.
const AUTH_WAIT_MS = 3000;
const SETTLE_AFTER_KEEPALIVE_MS = 1000;
const KEEPALIVE_INTERVAL_MS = 30_000;

const STOP_PAYLOAD = [0x00, 0x00, 0x02, 0x90];
const START_PAYLOAD = [0x01, 0x00, 0x02, 0xa0];

/** Driver del anillo R88 (protocolo YCBT de Yucheng). */
export class YcbtSession implements DeviceSession {
  readonly descriptor: DeviceDescriptor;

  private readonly services: BleService[];
  private readonly streamC1 = new PacketStream();
  private readonly streamC3 = new PacketStream();
  private onSample?: SampleSink;
  private onInfo?: InfoSink;
  private stopped = false;
  private keepaliveTimer?: number;
  private keepaliveCounter = 0;
  private queue: Promise<void> = Promise.resolve();
  private subscribed: { service: string; characteristic: string }[] = [];

  constructor(descriptor: DeviceDescriptor, services: BleService[]) {
    this.descriptor = descriptor;
    this.services = services;
  }

  private get deviceId(): string {
    return this.descriptor.deviceId;
  }

  async start(onSample: SampleSink, onInfo: InfoSink): Promise<void> {
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
    await this.subscribeIfPresent(YCBT_SERVICE, JL_CHAR_NOTIFY, () => undefined);
    await this.subscribeHeartRateService();

    await this.handshake();
    if (this.stopped) return;
    await this.send(OP.APP_CONTROL_START, START_PAYLOAD);
    this.startKeepalive();
  }

  async stop(): Promise<void> {
    if (!this.stopped) {
      this.stopKeepalive();
      try {
        await this.send(OP.APP_CONTROL_STOP, STOP_PAYLOAD);
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

  // ─── Sesión YCBT ───────────────────────────────────────────────────────

  private async handshake(): Promise<void> {
    await this.send(OP.GET_SUPPORT_FUNCTION, [0x47, 0x46]);
    await this.send(OP.SET_TIME, makeBleTime());
    await this.send(OP.GET_CHIP_SCHEME);
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);

    await delay(AUTH_WAIT_MS);

    await this.send(OP.GET_CHIP_SCHEME);
    await this.send(OP.GET_DEVICE_NAME, [0x47, 0x50]);
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);
    await this.send(OP.APP_CONTROL_STOP, STOP_PAYLOAD);
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);
    await this.send(OP.SET_UNKNOWN_0109, [0x00, 0x00, 0x31, 0x37]);
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);
    // Monitor en segundo plano: FC y SpO2 cada 5 minutos.
    await this.send(OP.SET_HEART_MONITOR, [0x01, 0x05]);
    await this.send(OP.SET_SPO2_MONITOR, [0x01, 0x05]);
    await this.send(OP.GET_DEVICE_INFO, [0x47, 0x43]);
    await this.send(OP.GET_NOW_STEP);
    await this.send(OP.GET_POWER_STATS);
    await this.send(OP.KEEPALIVE, [0x01, 0x00]);

    await delay(SETTLE_AFTER_KEEPALIVE_MS);
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = window.setInterval(() => {
      const counter = this.keepaliveCounter++ & 0xff;
      void this.send(OP.KEEPALIVE, [0x01, counter]).catch(() => undefined);
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer !== undefined) {
      window.clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = undefined;
    }
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

  /** El anillo publica además la FC en el servicio estándar 0x180D. */
  private async subscribeHeartRateService(): Promise<void> {
    if (!ble.hasCharacteristic(this.services, HR_SERVICE, HR_CHAR_MEASUREMENT)) {
      return;
    }
    await ble.subscribe(
      this.deviceId,
      HR_SERVICE,
      HR_CHAR_MEASUREMENT,
      (bytes) => {
        const measurement = parseHrsMeasurement(bytes);
        if (!measurement) return;
        this.onSample?.({
          metric: 'heart_rate',
          value: measurement.heartRate,
          unit: 'bpm',
          ts: Date.now(),
          deviceId: this.deviceId,
        });
      },
    );
    this.subscribed.push({
      service: HR_SERVICE,
      characteristic: HR_CHAR_MEASUREMENT,
    });
  }

  private send(type: number, payload: number[] = []): Promise<void> {
    const next = this.queue.catch(() => undefined).then(async () => {
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

  private handleControl(bytes: Uint8Array): void {
    for (const packet of this.streamC1.push(bytes)) {
      const error = decodeErrorPayload(packet.payload);
      if (error) {
        console.warn(`[ycbt] error del dispositivo: ${error}`, packet.type);
        continue;
      }
      if (packet.type === OP.GET_DEVICE_INFO && packet.payload.length >= 6) {
        const info: DeviceInfo = {
          firmware: `${packet.payload[3]}.${packet.payload[2]}`,
          battery: packet.payload[5],
        };
        this.onInfo?.(info);
      }
    }
  }

  private handleNotification(bytes: Uint8Array): void {
    for (const packet of this.streamC3.push(bytes)) {
      if (packet.group !== 0x06) continue;
      for (const sample of parseRealtimePacket(packet, this.deviceId)) {
        this.onSample?.(sample);
      }
    }
  }
}
