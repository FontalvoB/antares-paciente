import { COLMI_SERVICE } from './colmi/protocol';
import { HR_SERVICE, YCBT_SERVICE } from './ycbt/protocol';
import type { DeviceKind } from './types';

// Pistas de clasificación a partir del anuncio BLE. El tipo definitivo se
// decide al conectar, inspeccionando los servicios GATT reales.
const YCBT_NAME_HINT = /ycbt|smart ?health|r88|c1bf|ring|anillo/i;
const COLMI_NAME_HINT = /h59|colmi|qwatch/i;

export function classifyDevice(name: string, uuids?: string[]): DeviceKind {
  const normalized = (uuids ?? []).map((uuid) => uuid.toLowerCase());
  if (normalized.some((uuid) => uuid.startsWith(prefix(YCBT_SERVICE)))) {
    return 'ycbt';
  }
  if (normalized.some((uuid) => uuid.startsWith(prefix(COLMI_SERVICE)))) {
    return 'colmi';
  }
  if (normalized.some((uuid) => uuid.startsWith(prefix(HR_SERVICE)))) {
    return 'hrs';
  }
  if (YCBT_NAME_HINT.test(name)) return 'ycbt';
  if (COLMI_NAME_HINT.test(name)) return 'colmi';
  return 'unknown';
}

function prefix(uuid: string): string {
  return uuid.toLowerCase().slice(0, 8);
}
