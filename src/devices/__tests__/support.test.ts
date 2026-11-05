import { describe, expect, it } from 'vitest';
import { isSupportedWearable } from '../support';
import { COLMI_SERVICE } from '../colmi/protocol';
import type { DeviceDescriptor } from '../types';

function device(name: string, uuids?: string[]): DeviceDescriptor {
  return { deviceId: 'test', name, kind: 'unknown', uuids };
}
describe('supported wearables', () => {
  it.each(['H59_E206', 'R88 C1BF', 'h59', 'R88'])('admite el modelo %s', name => {
    expect(isSupportedWearable(device(name))).toBe(true);
  });
  it.each(['Living Room TV', 'Headphones', 'Smart Ring', 'Watch', 'H590', 'R880'])('no habilita conectar %s', name => {
    expect(isSupportedWearable(device(name))).toBe(false);
  });
  it('reconoce un accesorio renombrado por su servicio soportado', () => {
    expect(isSupportedWearable(device('Mi banda', [COLMI_SERVICE.toUpperCase()]))).toBe(true);
  });
});
