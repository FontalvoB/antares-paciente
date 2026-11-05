import { COLMI_SERVICE } from './colmi/protocol';
import { YCBT_SERVICE } from './ycbt/protocol';
import type { DeviceDescriptor } from './types';

/** Los nombres genéricos («ring», «watch») no acreditan compatibilidad. */
export function isSupportedWearable(device: DeviceDescriptor): boolean {
  if (/(?:^|[^a-z0-9])(?:h59|r88)(?=$|[^a-z0-9])/i.test(device.name)) return true;
  const services = device.uuids?.map(value => value.replaceAll('-', '').toLowerCase()) ?? [];
  return [COLMI_SERVICE, YCBT_SERVICE].some(service => services.includes(service.replaceAll('-', '').toLowerCase()));
}
