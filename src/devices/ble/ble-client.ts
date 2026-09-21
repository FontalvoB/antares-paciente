import { BleClient, ScanMode } from '@capacitor-community/bluetooth-le';
import type { BleService, ScanResult } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { classifyDevice } from '../classify';
import { COLMI_SERVICE } from '../colmi/protocol';
import { WearableError, toWearableError } from '../errors';
import { sameUuid, toBytes } from '../util';
import { BLE_ACCESS_SERVICES } from '../ycbt/protocol';
import type { DeviceDescriptor } from '../types';

// Envoltorio fino sobre @capacitor-community/bluetooth-le.
// El resto de la app no depende del plugin: sólo de las funciones de aquí.

let initialized = false;
let scanning = false;
let debugEnabled = false;

/** Servicios que la app puede leer: se declaran a Web Bluetooth al buscar. */
const ACCESS_SERVICES: string[] = [...BLE_ACCESS_SERVICES, COLMI_SERVICE];

/** Registro de tramas para el modo diagnóstico (RX y TX). */
export interface NotificationTap {
  direction: 'rx' | 'tx';
  deviceId: string;
  service: string;
  characteristic: string;
  bytes: Uint8Array;
}

let tap: ((info: NotificationTap) => void) | null = null;

/**
 * El modo diagnóstico se activa desde la UI: además de habilitar el log,
 * incluye en la búsqueda los dispositivos que se anuncian sin nombre.
 */
export function setBleDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function setNotificationTap(
  callback: ((info: NotificationTap) => void) | null,
): void {
  tap = callback;
}

interface WebBluetoothLike {
  requestLEScan?: unknown;
}

export function isWebPlatform(): boolean {
  return Capacitor.getPlatform() === 'web';
}

function webBluetooth(): WebBluetoothLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { bluetooth?: WebBluetoothLike }).bluetooth;
}

/** En web, Chrome estable no expone requestLEScan: se usa el selector nativo. */
function canScanWithList(): boolean {
  return typeof webBluetooth()?.requestLEScan === 'function';
}

/**
 * true cuando el escaneo depende del selector nativo del navegador: la
 * búsqueda queda en manos del usuario (diálogo abierto) y tarda más que una
 * lista continua de resultados.
 */
export function usesDeviceChooser(): boolean {
  return isWebPlatform() && !canScanWithList();
}

/** ¿El anuncio expone alguno de los servicios que sabemos leer? */
function advertisesKnownService(uuids?: string[]): boolean {
  if (!uuids?.length) return false;
  return ACCESS_SERVICES.some((service) =>
    uuids.some((uuid) => sameUuid(uuid, service)),
  );
}

export async function ensureBluetoothReady(): Promise<void> {
  if (isWebPlatform() && typeof webBluetooth() === 'undefined') {
    throw new WearableError(
      'scan-unavailable',
      'Este navegador no soporta Web Bluetooth.',
    );
  }
  try {
    if (!initialized) {
      await BleClient.initialize({ androidNeverForLocation: true });
      initialized = true;
    }
    const enabled = await BleClient.isEnabled();
    if (!enabled) {
      await BleClient.requestEnable();
      const enabled = await BleClient.isEnabled();
      if (!enabled) throw new WearableError('bluetooth-off');
    }
  } catch (err) {
    throw toWearableError(err, 'bluetooth-off');
  }
}

export interface ScanOptions {
  /** Incluye dispositivos sin nombre (modo diagnóstico). */
  includeUnnamed?: boolean;
}

export async function startScan(
  onFound: (device: DeviceDescriptor) => void,
  options: ScanOptions = {},
): Promise<void> {
  await ensureBluetoothReady();
  scanning = true;
  const seen = new Set<string>();
  const handle = (result: ScanResult, force = false) => {
    if (seen.has(result.device.deviceId)) return;
    const name = (result.localName ?? result.device.name ?? '').trim();
    const uuids = result.uuids ?? result.device.uuids;
    const kind = classifyDevice(name, uuids);
    if (debugEnabled || import.meta.env.DEV) {
      console.debug('[ble] anuncio', {
        deviceId: result.device.deviceId,
        name,
        rssi: result.rssi,
        uuids,
      });
    }
    // Los dispositivos sin nombre solo se listan si exponen un servicio
    // conocido (p. ej. el anillo, que puede anunciarse sin nombre) o si el
    // modo diagnóstico pidió ver todo. En el selector nativo se acepta
    // siempre lo que el usuario eligió.
    if (
      !force &&
      !name &&
      !options.includeUnnamed &&
      !advertisesKnownService(uuids)
    ) {
      return;
    }
    seen.add(result.device.deviceId);
    onFound({
      deviceId: result.device.deviceId,
      name,
      rssi: result.rssi,
      uuids,
      kind,
    });
  };

  try {
    if (usesDeviceChooser()) {
      const device = await BleClient.requestDevice({
          optionalServices: ACCESS_SERVICES,
      });
      handle({ device } as ScanResult, true);
    } else {
      await BleClient.requestLEScan(
        {
          allowDuplicates: false,
          scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
        optionalServices: ACCESS_SERVICES,
        },
        handle,
      );
    }
  } catch (err) {
    scanning = false;
    throw toWearableError(err, 'scan-unavailable');
  }
}

export async function stopScan(): Promise<void> {
  if (!scanning) return;
  scanning = false;
  try {
    await BleClient.stopLEScan();
  } catch {
    // El escaneo ya había terminado.
  }
}

export async function connectDevice(
  deviceId: string,
  onDisconnect: () => void,
): Promise<void> {
  await ensureBluetoothReady();
  try {
    await BleClient.connect(deviceId, onDisconnect, { timeout: 15000 });
  } catch (err) {
    throw toWearableError(err, 'connection-failed');
  }
}

export async function disconnectDevice(deviceId: string): Promise<void> {
  try {
    await BleClient.disconnect(deviceId);
  } catch {
    // Puede haberse desconectado ya.
  }
}

export async function getDeviceServices(
  deviceId: string,
): Promise<BleService[]> {
  try {
    return await BleClient.getServices(deviceId);
  } catch (err) {
    throw toWearableError(err, 'connection-failed');
  }
}

export function hasService(services: BleService[], uuid: string): boolean {
  return services.some((service) => sameUuid(service.uuid, uuid));
}

export function hasCharacteristic(
  services: BleService[],
  serviceUuid: string,
  charUuid: string,
): boolean {
  return services.some(
    (service) =>
      sameUuid(service.uuid, serviceUuid) &&
      service.characteristics.some((char) => sameUuid(char.uuid, charUuid)),
  );
}

export async function subscribe(
  deviceId: string,
  service: string,
  characteristic: string,
  onValue: (bytes: Uint8Array) => void,
): Promise<void> {
  try {
    await BleClient.startNotifications(
      deviceId,
      service,
      characteristic,
      (value) => {
        const bytes = toBytes(value);
        tap?.({ direction: 'rx', deviceId, service, characteristic, bytes });
        onValue(bytes);
      },
    );
  } catch (err) {
    throw toWearableError(err, 'connection-failed');
  }
}

export async function unsubscribe(
  deviceId: string,
  service: string,
  characteristic: string,
): Promise<void> {
  try {
    await BleClient.stopNotifications(deviceId, service, characteristic);
  } catch {
    // La suscripción pudo caer con la conexión.
  }
}

export async function writeBytes(
  deviceId: string,
  service: string,
  characteristic: string,
  bytes: Uint8Array,
  withoutResponse = false,
): Promise<void> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  tap?.({ direction: 'tx', deviceId, service, characteristic, bytes });
  try {
    if (withoutResponse) {
      await BleClient.writeWithoutResponse(
        deviceId,
        service,
        characteristic,
        view,
      );
    } else {
      await BleClient.write(deviceId, service, characteristic, view);
    }
  } catch (err) {
    throw toWearableError(err, 'connection-failed');
  }
}

export async function readBytes(
  deviceId: string,
  service: string,
  characteristic: string,
): Promise<Uint8Array | null> {
  try {
    const value = await BleClient.read(deviceId, service, characteristic);
    return value.byteLength ? toBytes(value) : null;
  } catch {
    return null;
  }
}
