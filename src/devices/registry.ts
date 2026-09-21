import type { BleService } from '@capacitor-community/bluetooth-le';
import * as ble from './ble/ble-client';
import { COLMI_CHAR_RX, COLMI_CHAR_TX, COLMI_SERVICE } from './colmi/protocol';
import { ColmiSession } from './colmi/session';
import { WearableError } from './errors';
import { HrsSession } from './hrs/session';
import {
  HR_CHAR_MEASUREMENT,
  HR_SERVICE,
  YCBT_CHAR_C1,
  YCBT_CHAR_C3,
  YCBT_SERVICE,
} from './ycbt/protocol';
import { YcbtSession } from './ycbt/session';
import type { DeviceDescriptor, DeviceSession } from './types';

export interface DeviceCapabilities {
  ycbt: boolean;
  colmi: boolean;
  hrs: boolean;
}

/** Capacidades reales del dispositivo, según sus servicios GATT. */
export function detectCapabilities(services: BleService[]): DeviceCapabilities {
  return {
    ycbt:
      ble.hasCharacteristic(services, YCBT_SERVICE, YCBT_CHAR_C1) &&
      ble.hasCharacteristic(services, YCBT_SERVICE, YCBT_CHAR_C3),
    colmi:
      ble.hasCharacteristic(services, COLMI_SERVICE, COLMI_CHAR_RX) &&
      ble.hasCharacteristic(services, COLMI_SERVICE, COLMI_CHAR_TX),
    hrs: ble.hasCharacteristic(services, HR_SERVICE, HR_CHAR_MEASUREMENT),
  };
}

/**
 * Abre la sesión adecuada para el dispositivo: primero el protocolo del
 * fabricante (más métricas) y, si no, el servicio estándar de FC.
 */
export async function openSession(
  descriptor: DeviceDescriptor,
): Promise<DeviceSession> {
  const services = await ble.getDeviceServices(descriptor.deviceId);
  const capabilities = detectCapabilities(services);
  if (capabilities.ycbt) return new YcbtSession(descriptor, services);
  if (capabilities.colmi) return new ColmiSession(descriptor);
  if (capabilities.hrs) return new HrsSession(descriptor);
  throw new WearableError('unsupported-device');
}
