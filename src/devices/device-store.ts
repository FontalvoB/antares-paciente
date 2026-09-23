import { Capacitor } from "@capacitor/core";
import type { DeviceDescriptor } from "./types";

/**
 * Persistencia del último dispositivo conectado (device-metrics): permite
 * reconectar sin volver a emparejar. Una sesión BLE no se puede restaurar
 * entre arranques, así que se guarda la identidad y se re-establece la sesión.
 *
 * En iOS el `deviceId` es un UUID estable mientras la app esté instalada; en
 * Android es la MAC. En web el id lo genera el navegador en cada permiso y
 * conectar exige un gesto del usuario, por eso allí no se auto-reconecta.
 */
const STORAGE_KEY = "antares_last_device";

export interface SavedDevice extends DeviceDescriptor {
  /** Epoch ms de la última conexión correcta. */
  lastConnectedAt: number;
}

export function loadSavedDevice(): SavedDevice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedDevice>;
    if (!parsed || typeof parsed.deviceId !== "string" || !parsed.deviceId) {
      return null;
    }
    return {
      deviceId: parsed.deviceId,
      name: typeof parsed.name === "string" ? parsed.name : "",
      kind: parsed.kind ?? "unknown",
      rssi: parsed.rssi,
      uuids: parsed.uuids,
      paired: true,
      lastConnectedAt:
        typeof parsed.lastConnectedAt === "number"
          ? parsed.lastConnectedAt
          : Date.now(),
    };
  } catch {
    // Almacenamiento no disponible o JSON corrupto: se empieza sin memoria.
    return null;
  }
}

export function saveDevice(device: DeviceDescriptor): void {
  try {
    const saved: SavedDevice = {
      deviceId: device.deviceId,
      name: device.name,
      kind: device.kind,
      rssi: device.rssi,
      uuids: device.uuids,
      paired: true,
      lastConnectedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Sin almacenamiento la app sigue funcionando, solo no recuerda.
  }
}

export function clearSavedDevice(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}

/**
 * Solo se auto-reconecta en plataforma nativa y con un dispositivo guardado:
 * en web el `deviceId` no es estable y el navegador exige un gesto del usuario
 * para conectar, así que allí se ofrece el botón "Reconectar".
 */
export function canAutoReconnect(
  platform: string,
  saved: SavedDevice | null,
): boolean {
  return platform !== "web" && saved !== null;
}

/** Atajo con la plataforma real de Capacitor. */
export function canAutoReconnectHere(saved: SavedDevice | null): boolean {
  return canAutoReconnect(Capacitor.getPlatform(), saved);
}
