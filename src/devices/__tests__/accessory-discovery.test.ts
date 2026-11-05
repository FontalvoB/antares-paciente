import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  platform: 'ios',
  bridge: { accessoryCapabilities: vi.fn(), selectAccessory: vi.fn(), authorizedAccessories: vi.fn() },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => native.platform },
  registerPlugin: () => native.bridge,
}));
import { listAuthorizedAccessories, searchWearableAccessories, supportsAccessoryDiscovery } from '../ble/accessory-discovery';

describe('iOS accessory discovery', () => {
  beforeEach(() => { vi.resetAllMocks(); native.platform = 'ios'; });
  it('distingue el soporte de iOS antiguo de una cancelación', async () => {
    native.bridge.selectAccessory.mockResolvedValueOnce({ supported: false, devices: [] });
    expect(await searchWearableAccessories()).toBeNull();
    native.bridge.selectAccessory.mockResolvedValueOnce({ supported: true, devices: [] });
    expect(await searchWearableAccessories()).toEqual([]);
  });
  it('incorpora un R88 nuevo y excluye dispositivos desconocidos', async () => {
    native.bridge.selectAccessory.mockResolvedValue({ supported: true, devices: [
      { deviceId: 'ring', name: 'R88 C1BF' }, { deviceId: 'tv', name: 'TV' },
    ] });
    expect(await searchWearableAccessories()).toEqual([{ deviceId: 'ring', name: 'R88 C1BF', kind: 'ycbt', paired: true }]);
  });
  it('recupera accesorios autorizados aunque no estén conectados', async () => {
    native.bridge.authorizedAccessories.mockResolvedValue({ supported: true, devices: [{ deviceId: 'band', name: 'H59_E206' }] });
    expect(await listAuthorizedAccessories()).toMatchObject([{ deviceId: 'band', kind: 'colmi' }]);
    expect(native.bridge.selectAccessory).not.toHaveBeenCalled();
  });
  it('conserva Android sin invocar AccessorySetupKit', async () => {
    native.platform = 'android';
    expect(await supportsAccessoryDiscovery()).toBe(false);
    expect(await searchWearableAccessories()).toBeNull();
    expect(await listAuthorizedAccessories()).toBeNull();
    expect(native.bridge.selectAccessory).not.toHaveBeenCalled();
    expect(native.bridge.authorizedAccessories).not.toHaveBeenCalled();
  });
});
