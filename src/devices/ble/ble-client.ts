import { BleClient, ScanMode } from "@capacitor-community/bluetooth-le";
import type {
  BleService,
  ScanResult,
} from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import { classifyDevice } from "../classify";
import { COLMI_SERVICE } from "../colmi/protocol";
import { WearableError, toWearableError } from "../errors";
import { sameUuid, toBytes } from "../util";
import { BLE_ACCESS_SERVICES } from "../ycbt/protocol";
import type { DeviceDescriptor } from "../types";
import { notificationJournal } from "./notification-journal";
import type { NotificationConsumer } from "./notification-journal";

// Envoltorio fino sobre @capacitor-community/bluetooth-le.
// El resto de la app no depende del plugin: sólo de las funciones de aquí.

let initialized = false;
let initialization: Promise<void> | null = null;
let enabling: Promise<void> | null = null;
let scanning = false;
let nativeScan = false;
let scanGeneration = 0;
let debugEnabled = false;
const notificationRemovers = new Map<string, () => void>();
let notificationFailure: ((error: unknown) => void) | null = null;

export function setNotificationFailureHandler(handler: ((error: unknown) => void) | null): void {
  notificationFailure = handler;
}

function reportNotificationFailure(error: unknown): void {
  console.error("[ble] No se confirmó la recepción; las tramas siguen en almacenamiento nativo.", error);
  notificationFailure?.(error);
}

function notificationKey(deviceId: string, service: string, characteristic: string): string {
  return `${deviceId}|${service}|${characteristic}`.toLowerCase();
}

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

/** Una sola inicialización: recrear el manager nativo pierde enlaces y listeners. */
async function initializeBluetooth(): Promise<void> {
  if (isWebPlatform() && typeof webBluetooth() === "undefined") {
    throw new WearableError(
      "scan-unavailable",
      "Este navegador no soporta Web Bluetooth.",
    );
  }
  if (initialized) return;
  if (!initialization) {
    initialization = BleClient.initialize({ androidNeverForLocation: true })
      .then(() => {
        initialized = true;
      })
      .finally(() => {
        // Un permiso denegado no deja la inicialización bloqueada para siempre.
        initialization = null;
      });
  }
  await initialization;
}

export async function ensureBluetoothReady(): Promise<void> {
  try {
    await initializeBluetooth();
    const enabled = await BleClient.isEnabled();
    if (!enabled) {
      // iOS no ofrece requestEnable: devolver el error correcto, no convertirlo
      // en "escaneo no disponible" por llamar a un método no implementado.
      if (Capacitor.getPlatform() !== "android") {
        throw new WearableError("bluetooth-off");
      }
      if (!enabling) {
        enabling = BleClient.requestEnable().finally(() => {
          enabling = null;
        });
      }
      await enabling;
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
  try {
    await initializeBluetooth();
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
  /** Rescate automático: nunca mostrar el diálogo para encender Bluetooth. */
  silent?: boolean;
}

/** Se ejecuta antes de un nuevo escaneo para no solapar START/STOP nativos. */
async function stopNativeScan(): Promise<void> {
  if (!nativeScan) return;
  nativeScan = false;
  try {
    await BleClient.stopLEScan();
  } catch {
    // El escaneo ya había terminado.
  }
}

export async function startScan(
  onFound: (device: DeviceDescriptor) => void,
  options: ScanOptions = {},
): Promise<void> {
  // La generación se reclama ANTES de permisos/inicialización: Cancelar debe
  // invalidar también una búsqueda cuyo diálogo todavía está abierto.
  const generation = ++scanGeneration;
  scanning = false;
  const stopping = stopNativeScan();
  const seen = new Set<string>();
  const handle = (result: ScanResult, force = false) => {
    if (generation !== scanGeneration || !scanning) return;
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
    await stopping;
    if (generation !== scanGeneration) return;
    if (options.silent) await ensureBluetoothReadyQuiet();
    else await ensureBluetoothReady();
    if (generation !== scanGeneration) return;
    scanning = true;
    if (usesDeviceChooser()) {
      const device = await BleClient.requestDevice({
        optionalServices: ACCESS_SERVICES,
      });
      handle({ device } as ScanResult, true);
    } else {
      // Se marca antes del await: STOP puede encolarse aunque el START nativo
      // siga en vuelo. El plugin ya serializa todas las operaciones GATT.
      nativeScan = true;
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
    // Un permiso o START viejo que termine tarde no debe romper la búsqueda
    // nueva ni cambiar su pantalla a error después de haberla cancelado.
    if (generation !== scanGeneration) return;
    scanning = false;
    await stopNativeScan();
    if (generation !== scanGeneration) return;
    throw toWearableError(err, "scan-unavailable");
  }
}

export async function stopScan(): Promise<void> {
  scanGeneration += 1;
  scanning = false;
  await stopNativeScan();
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
  await stopScan();
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
  await ensureBluetoothReadyQuiet();
  try {
    // 8.3 expone getDevices en BleClient: pasar por su cola evita consultar el
    // mapa mientras la inicialización o una operación GATT siguen en vuelo.
    const devices = await BleClient.getDevices([deviceId]);
    const match = devices.find(
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
    const generation = scanGeneration + 1;
    const finish = async (id: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      // El timeout de un rescate viejo nunca debe detener un escaneo nuevo.
      if (generation === scanGeneration) await stopScan();
      resolve(id);
    };
    const timer = window.setTimeout(() => void finish(null), RESCUE_SCAN_MS);
    startScan((device) => {
      if (device.deviceId.toLowerCase() === deviceId.toLowerCase()) {
        void finish(device.deviceId);
      }
    }, { silent: true })
      .then(() => {
        if (generation !== scanGeneration) void finish(null);
      })
      .catch(() => void finish(null));
  });
}

/** Escucha cambios del adaptador sin volver a inicializarlo ni encenderlo. */
export async function watchBluetoothState(
  onEnabled: (enabled: boolean) => void,
): Promise<() => Promise<void>> {
  await initializeBluetooth();
  await BleClient.startEnabledNotifications(onEnabled);
  return async () => {
    await BleClient.stopEnabledNotifications().catch(() => undefined);
  };
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
  onValue: NotificationConsumer,
): Promise<void> {
  const key = notificationKey(deviceId, service, characteristic);
  notificationRemovers.get(key)?.();
  const journaled = notificationJournal.owns(deviceId);
  if (journaled) {
    notificationRemovers.set(key, notificationJournal.register(deviceId, service, characteristic, (bytes) => {
      tap?.({ direction: "rx", deviceId, service, characteristic, bytes });
      return onValue(bytes);
    }));
  }
  try {
    await BleClient.startNotifications(
      deviceId,
      service,
      characteristic,
      (value) => {
        if (journaled) {
          void notificationJournal.drain(deviceId).catch(reportNotificationFailure);
          return;
        }
        const bytes = toBytes(value);
        tap?.({ direction: "rx", deviceId, service, characteristic, bytes });
        onValue(bytes);
      },
    );
    if (journaled) await notificationJournal.drain(deviceId);
  } catch (err) {
    notificationRemovers.get(key)?.();
    notificationRemovers.delete(key);
    throw toWearableError(err, "connection-failed");
  }
}

export async function unsubscribe(
  deviceId: string,
  service: string,
  characteristic: string,
): Promise<void> {
  const key = notificationKey(deviceId, service, characteristic);
  notificationRemovers.get(key)?.();
  notificationRemovers.delete(key);
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
