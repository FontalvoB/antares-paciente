import { Capacitor, registerPlugin } from '@capacitor/core';
import { classifyDevice } from '../classify';
import { isSupportedWearable } from '../support';
import type { DeviceDescriptor } from '../types';

interface AccessoryResult {
  supported: boolean;
  devices: Array<{ deviceId: string; name: string; uuids?: string[] }>;
}
interface AccessoryBridge {
  accessoryCapabilities(): Promise<{ supported: boolean }>;
  selectAccessory(): Promise<AccessoryResult>;
  authorizedAccessories(): Promise<AccessoryResult>;
}
let nativeBridge: AccessoryBridge | undefined;
let listing: Promise<DeviceDescriptor[] | null> | undefined;
function bridge(): AccessoryBridge {
  return nativeBridge ??= registerPlugin<AccessoryBridge>('BluetoothLe');
}

export async function supportsAccessoryDiscovery(): Promise<boolean> {
  return Capacitor.getPlatform() === 'ios' && (await bridge().accessoryCapabilities()).supported;
}

function descriptors(result: AccessoryResult): DeviceDescriptor[] {
  return result.devices
    .filter(device => typeof device.deviceId === 'string' && !!device.deviceId && typeof device.name === 'string')
    .map(device => ({ ...device, kind: classifyDevice(device.name, device.uuids), paired: true }))
    .filter(isSupportedWearable);
}

/** null indica plataforma antigua. Cancelar conserva los accesorios autorizados. */
export async function searchWearableAccessories(): Promise<DeviceDescriptor[] | null> {
  if (Capacitor.getPlatform() !== 'ios') return null;
  const result = await bridge().selectAccessory();
  return result.supported ? descriptors(result) : null;
}

/** Consulta autorización persistida sin escanear ni conectar GATT. */
export async function listAuthorizedAccessories(): Promise<DeviceDescriptor[] | null> {
  if (Capacitor.getPlatform() !== 'ios') return null;
  return listing ??= bridge().authorizedAccessories()
    .then(result => result.supported ? descriptors(result) : null)
    .finally(() => { listing = undefined; });
}
