import { BleClient, ScanMode } from "@capacitor-community/bluetooth-le";
import type {
  BleDevice,
  BleService,
  ScanResult,
} from "@capacitor-community/bluetooth-le";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { classifyDevice } from "../classify";
import { COLMI_SERVICE } from "../colmi/protocol";
import { WearableError, toWearableError } from "../errors";
import { sameUuid, toBytes } from "../util";
import { BLE_ACCESS_SERVICES } from "../ycbt/protocol";
import type { DeviceDescriptor } from "../types";

// Envoltorio fino sobre @capacitor-community/bluetooth-le.
// El resto de la app no depende del plugin: sólo de las funciones de aquí.

let initialized = false;
let scanning = false;
let debugEnabled = false;

/** Servicios que la app puede leer: se declaran a Web Bluetooth al buscar. */
const ACCESS_SERVICES: string[] = [...BLE_ACCESS_SERVICES, COLMI_SERVICE];

/** Timeout del intento de conexión manual. */
const CONNECT_TIMEOUT_MS = 15_000;
/** Presupuesto del escaneo de rescate para re-registrar un dispositivo. */
const RESCUE_SCAN_MS = 4_000;

export interface ConnectOptions {
  /** Intento automático: sin diálogos del sistema ni avisos. */
  silent?: boolean;
  /** Timeout del handshake BLE (los intentos automáticos esperan más). */
  timeoutMs?: number;
}

/**
 * Método nativo `getDevices` del plugin (no expuesto por el envoltorio
 * `BleClient`): re-registra en su mapa interno ids conocidos por el sistema.
 */
interface RawBluetoothLePlugin {
  getDevices(options: {
    deviceIds: string[];
  }): Promise<{ devices: BleDevice[] }>;
}

const rawPlugin = registerPlugin<RawBluetoothLePlugin>("BluetoothLe");

/** Registro de tramas para el modo diagnóstico (RX y TX). */
export interface NotificationTap {
  direction: "rx" | "tx";
  deviceId: string;
  service: string;
  characteristic: string;
  bytes: Uint8Array;
  /** Línea de texto libre (resúmenes del driver) en vez de una trama. */
  note?: string;
}

let tap: ((info: NotificationTap) => void) | null = null;

/**
 * El modo diagnóstico se activa desde la UI: además de habilitar el log,
 * incluye en la búsqueda los dispositivos que se anuncian sin nombre.
 */
export function setBleDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

/** true si el modo diagnóstico está activo (lo enciende `setBleDebug`). */
export function isBleDebugEnabled(): boolean {
  return debugEnabled;
}

/** Añade una línea de texto al registro BLE (solo con diagnóstico activo). */
export function noteDiagnostic(text: string): void {
  tap?.({
    direction: "rx",
    deviceId: "",
    service: "",
    characteristic: "",
    bytes: new Uint8Array(),
    note: text,
  });
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
  return Capacitor.getPlatform() === "web";
}

function webBluetooth(): WebBluetoothLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { bluetooth?: WebBluetoothLike }).bluetooth;
}

/** En web, Chrome estable no expone requestLEScan: se usa el selector nativo. */
function canScanWithList(): boolean {
  return typeof webBluetooth()?.requestLEScan === "function";
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
  if (isWebPlatform() && typeof webBluetooth() === "undefined") {
    throw new WearableError(
      "scan-unavailable",
      "Este navegador no soporta Web Bluetooth.",
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
      if (!enabled) throw new WearableError("bluetooth-off");
    }
  } catch (err) {
    throw toWearableError(err, "bluetooth-off");
  }
}

/**
 * Igual que `ensureBluetoothReady` pero sin `requestEnable`: para intentos
 * automáticos, donde un diálogo del sistema sin que el usuario lo pida es
 * desconcertante. Si el Bluetooth está apagado, el intento simplemente falla.
 */
async function ensureBluetoothReadyQuiet(): Promise<void> {
  if (isWebPlatform() && typeof webBluetooth() === "undefined") {
    throw new WearableError(
      "scan-unavailable",
      "Este navegador no soporta Web Bluetooth.",
    );
  }
  try {
    if (!initialized) {
      await BleClient.initialize({ androidNeverForLocation: true });
      initialized = true;
    }
    if (!(await BleClient.isEnabled())) {
      throw new WearableError("bluetooth-off", "Bluetooth está apagado.");
    }
  } catch (err) {
    throw toWearableError(err, "bluetooth-off");
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
    const name = (result.localName ?? result.device.name ?? "").trim();
    const uuids = result.uuids ?? result.device.uuids;
    const kind = classifyDevice(name, uuids);
    if (debugEnabled || import.meta.env.DEV) {
      console.debug("[ble] anuncio", {
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
    throw toWearableError(err, "scan-unavailable");
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

/**
 * Dispositivos ya conocidos por el sistema operativo: emparejados en los
 * Ajustes del teléfono (Android) o conectados con alguno de nuestros
 * servicios (iOS/macOS, `retrieveConnectedDevices`). No anuncian, así que un
 * escaneo normal no los ve; se listan aparte para poder reconectar sin pasar
 * por los ajustes. En web se usa la lista de dispositivos ya autorizados.
 */
export async function listPairedDevices(): Promise<DeviceDescriptor[]> {
  try {
    await ensureBluetoothReady();
  } catch {
    // Sin permiso/Bluetooth apagado el escaneo mostrará el error que toque.
    return [];
  }

  const found: DeviceDescriptor[] = [];
  const push = (device: {
    deviceId: string;
    name?: string;
    uuids?: string[];
  }) => {
    const name = (device.name ?? "").trim();
    found.push({
      deviceId: device.deviceId,
      name,
      uuids: device.uuids,
      kind: classifyDevice(name, device.uuids),
      paired: true,
    });
  };

  try {
    if (Capacitor.getPlatform() === "android") {
      for (const device of await BleClient.getBondedDevices()) push(device);
    } else {
      for (const device of await BleClient.getConnectedDevices(
        ACCESS_SERVICES,
      )) {
        push(device);
      }
    }
  } catch {
    // Permiso denegado o plataforma sin soporte: la lista queda vacía.
  }
  return found;
}

export async function connectDevice(
  deviceId: string,
  onDisconnect: () => void,
  options: ConnectOptions = {},
): Promise<void> {
  if (options.silent) {
    // Reconexión automática: si el Bluetooth está apagado no se lanza el
    // diálogo del sistema sin contexto, simplemente se aborta el intento.
    await ensureBluetoothReadyQuiet();
  } else {
    await ensureBluetoothReady();
  }
  try {
    await BleClient.connect(deviceId, onDisconnect, {
      timeout: options.timeoutMs ?? CONNECT_TIMEOUT_MS,
    });
  } catch (err) {
    throw toWearableError(err, "connection-failed");
  }
}

/**
 * Devuelve el id canónico del dispositivo tal como lo registra el plugin, o
 * `null` si el sistema no lo conoce todavía.
 *
 * En iOS `connect` solo resuelve ids presentes en el mapa interno del plugin
 * (`deviceMap`), que se llena al escanear, con `requestDevice` o con
 * `getDevices`. Tras reiniciar la app ese mapa está vacío, así que reconectar
 * con el id guardado fallaba con "Device not found" — este paso lo re-registra
 * (y si el sistema ya no lo recuerda, un escaneo corto lo recupera).
 */
export async function resolveDeviceId(
  deviceId: string,
): Promise<string | null> {
  const platform = Capacitor.getPlatform();
  // Android resuelve la MAC directamente y `getDevices` es un eco: no hace
  // falta hidratar nada (y un escaneo de rescate allí sería tiempo perdido).
  if (platform !== "ios" && platform !== "macos") return deviceId;
  try {
    const { devices } = await rawPlugin.getDevices({ deviceIds: [deviceId] });
    const match = (devices ?? []).find(
      (device) => device.deviceId?.toLowerCase() === deviceId.toLowerCase(),
    );
    if (match?.deviceId) return match.deviceId;
  } catch {
    // Versión del plugin sin `getDevices` accesible: se intenta el escaneo.
  }
  return rescueScan(deviceId);
}

/** Escaneo corto y silencioso para re-registrar un dispositivo guardado. */
function rescueScan(deviceId: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (id: string | null) => {
      if (settled) return;
      settled = true;
      void stopScan();
      resolve(id);
    };
    window.setTimeout(() => finish(null), RESCUE_SCAN_MS);
    startScan((device) => {
      if (device.deviceId.toLowerCase() === deviceId.toLowerCase()) {
        finish(device.deviceId);
      }
    }).catch(() => finish(null));
  });
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
    throw toWearableError(err, "connection-failed");
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
        tap?.({ direction: "rx", deviceId, service, characteristic, bytes });
        onValue(bytes);
      },
    );
  } catch (err) {
    throw toWearableError(err, "connection-failed");
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
  tap?.({ direction: "tx", deviceId, service, characteristic, bytes });
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
    throw toWearableError(err, "connection-failed");
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
