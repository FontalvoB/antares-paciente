import { Capacitor, registerPlugin } from "@capacitor/core";
import { withNotificationTimestamp } from "./notification-clock";
import type { DeviceDescriptor } from "../types";

export interface StoredNotification {
  id: string;
  sequence?: string;
  deviceId: string;
  service: string;
  characteristic: string;
  value: string;
  receivedAt: number;
}

interface JournalBridge {
  startBackground(options: { deviceId: string; ownerId: string; automatic?: boolean }): Promise<void>;
  stopBackground(options: { deviceId: string; forget?: boolean }): Promise<void>;
  getPendingNotifications(options: {
    deviceId: string;
    ownerId: string;
    limit: number;
    afterSequence?: string;
  }): Promise<{ notifications: StoredNotification[]; droppedCount: number; lastError?: string }>;
  ackNotifications(options: {
    deviceId: string;
    ownerId: string;
    ids: string[];
  }): Promise<void>;
}

/** false conserva también los fragmentos previos hasta completar una trama. */
export type NotificationConsumer = (bytes: Uint8Array) => boolean | void;

interface Consumer {
  callback: NotificationConsumer;
  delivered: Set<string>;
  pending: Set<string>;
}

interface Connection {
  ownerId: string;
  consumers: Map<string, Consumer>;
  acknowledged: Set<string>;
  dirty: boolean;
  running?: Promise<void>;
  dropped: number;
  lastError?: string;
}

export const NOTIFICATION_GAP_EVENT = "wearable:notification-gap";

function channel(service: string, characteristic: string): string {
  return `${service.replaceAll("-", "").toLowerCase()}|${characteristic.replaceAll("-", "").toLowerCase()}`;
}

export class NotificationJournal {
  private readonly connections = new Map<string, Connection>();
  private readonly versions = new Map<string, number>();
  private readonly mutations = new Map<string, Promise<void>>();
  private readonly bridge: JournalBridge;

  constructor(bridge: JournalBridge) { this.bridge = bridge; }

  async start(deviceId: string, ownerId: string, automatic = false): Promise<void> {
    if (this.connections.get(deviceId)?.ownerId !== ownerId) this.connections.delete(deviceId);
    const version = (this.versions.get(deviceId) ?? 0) + 1;
    this.versions.set(deviceId, version);
    await this.mutate(deviceId, () => this.bridge.startBackground({ deviceId, ownerId, ...(automatic ? { automatic } : {}) }));
    if (this.versions.get(deviceId) !== version) return;
    const current = this.connections.get(deviceId);
    if (current?.ownerId === ownerId) return;
    this.connections.set(deviceId, {
      ownerId, consumers: new Map(), acknowledged: new Set(), dirty: false, dropped: 0,
    });
  }

  async stop(deviceId: string, forget = false): Promise<void> {
    this.versions.set(deviceId, (this.versions.get(deviceId) ?? 0) + 1);
    this.connections.delete(deviceId);
    await this.mutate(deviceId, () => this.bridge.stopBackground({ deviceId, forget }));
  }

  private mutate(deviceId: string, action: () => Promise<void>): Promise<void> {
    const operation = (this.mutations.get(deviceId) ?? Promise.resolve()).catch(() => undefined).then(action);
    this.mutations.set(deviceId, operation);
    return operation.finally(() => {
      if (this.mutations.get(deviceId) === operation) this.mutations.delete(deviceId);
    });
  }

  owns(deviceId: string): boolean {
    return this.connections.has(deviceId);
  }

  detach(deviceId: string): void {
    this.connections.get(deviceId)?.consumers.clear();
  }

  register(deviceId: string, service: string, characteristic: string, callback: NotificationConsumer): () => void {
    const connection = this.connections.get(deviceId);
    if (!connection) throw new Error("La recepción BLE requiere un propietario de datos.");
    const key = channel(service, characteristic);
    const consumer: Consumer = { callback, delivered: new Set(), pending: new Set() };
    connection.consumers.set(key, consumer);
    return () => {
      if (connection.consumers.get(key) === consumer) connection.consumers.delete(key);
    };
  }

  drain(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) return Promise.resolve();
    connection.dirty = true;
    if (connection.running) return connection.running;
    const run = async () => {
      while (connection.dirty && this.connections.get(deviceId) === connection) {
        connection.dirty = false;
        // Un ACK fallido se reintenta sin alimentar dos veces al decodificador.
        await this.ack(deviceId, connection);
        let afterSequence: string | undefined;
        for (;;) {
          const batch = await this.bridge.getPendingNotifications({ deviceId, ownerId: connection.ownerId, limit: 1000, ...(afterSequence ? { afterSequence } : {}) });
          if (this.connections.get(deviceId) !== connection) return;
          if (batch.droppedCount > connection.dropped || (batch.lastError && batch.lastError !== connection.lastError)) {
            connection.dropped = batch.droppedCount;
            connection.lastError = batch.lastError;
            console.warn(`[ble] Recepción nativa incompleta (${batch.droppedCount} descartes); recuperar historial del dispositivo.`, batch.lastError ?? "");
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NOTIFICATION_GAP_EVENT, {
              detail: { deviceId, ownerId: connection.ownerId, droppedCount: batch.droppedCount, lastError: batch.lastError },
            }));
          }
          for (const entry of batch.notifications) {
            if (this.connections.get(deviceId) !== connection) return;
            if (entry.deviceId.toLowerCase() !== deviceId.toLowerCase()) continue;
            const consumer = connection.consumers.get(channel(entry.service, entry.characteristic));
            if (!consumer || consumer.delivered.has(entry.id)) continue;
            const hex = entry.value.replace(/\s/g, "");
            if (!/^(?:[a-f\d]{2})*$/i.test(hex)) throw new Error("Notificación BLE persistida inválida.");
            const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
            try {
              const complete = withNotificationTimestamp(entry.receivedAt, () => consumer.callback(bytes)) !== false;
              consumer.delivered.add(entry.id);
              consumer.pending.add(entry.id);
              if (complete) {
                for (const id of consumer.pending) connection.acknowledged.add(id);
                consumer.pending.clear();
              }
            } catch (error) {
              // El driver restablece su reensamblador cuando el almacenamiento
              // falla. La próxima pasada reproduce la trama completa sin ACK.
              consumer.delivered.clear();
              consumer.pending.clear();
              throw error;
            }
          }
          if (batch.notifications.length < 1000) break;
          const cursor = batch.notifications.at(-1)?.sequence;
          if (!cursor || cursor === afterSequence) throw new Error("El diario BLE requiere un cursor de paginación válido.");
          afterSequence = cursor;
        }
        // Recorrer todos los canales antes del ACK: un canal incompleto no
        // puede esconder otras lecturas detrás de la primera página.
        await this.ack(deviceId, connection);
      }
    };
    connection.running = run().finally(() => { connection.running = undefined; });
    return connection.running;
  }

  private async ack(deviceId: string, connection: Connection): Promise<void> {
    if (!connection.acknowledged.size) return;
    while (connection.acknowledged.size > 0) {
      const ids = [...connection.acknowledged].slice(0, 1000);
      await this.bridge.ackNotifications({ deviceId, ownerId: connection.ownerId, ids });
      for (const id of ids) {
        connection.acknowledged.delete(id);
        for (const consumer of connection.consumers.values()) consumer.delivered.delete(id);
      }
    }
  }
}

let nativeBridge: JournalBridge | undefined;
function bridge(): JournalBridge {
  return nativeBridge ??= registerPlugin<JournalBridge>("BluetoothLe");
}

export async function authorizeAccessory(device: DeviceDescriptor): Promise<{ supported: boolean; authorized: boolean }> {
  if (Capacitor.getPlatform() !== "ios" || (device.kind !== "colmi" && device.kind !== "ycbt")) {
    return { supported: false, authorized: false };
  }
  const accessoryBridge = bridge() as JournalBridge & {
    setupAccessory(options: { deviceId: string; name: string; kind: string }): Promise<{ supported: boolean; authorized: boolean }>;
  };
  return accessoryBridge.setupAccessory({ deviceId: device.deviceId, name: device.name, kind: device.kind });
}
export const notificationJournal = new NotificationJournal({
  startBackground: (options) => bridge().startBackground(options),
  stopBackground: (options) => bridge().stopBackground(options),
  getPendingNotifications: (options) => bridge().getPendingNotifications(options),
  ackNotifications: (options) => bridge().ackNotifications(options),
});

export async function startPersistentConnection(deviceId: string, ownerId: string, automatic = false): Promise<void> {
  if (Capacitor.isNativePlatform()) await notificationJournal.start(deviceId, ownerId, automatic);
}

export async function stopPersistentConnection(deviceId: string, forget = false): Promise<void> {
  if (Capacitor.isNativePlatform()) await notificationJournal.stop(deviceId, forget);
}

export function drainPendingNotifications(deviceId: string): Promise<void> {
  return notificationJournal.drain(deviceId);
}

/** Desmontar el WebView no apaga GATT; el diario nativo conserva la captura. */
export function detachPendingNotifications(deviceId: string): void {
  notificationJournal.detach(deviceId);
}
