import { describe, expect, it } from 'vitest';
import { toWearableError, WearableError } from '../errors';

describe('wearable error classification', () => {
  it('no convierte un estado transitorio de iOS en Bluetooth apagado', () => {
    const error = Object.assign(new Error('BLE powered off'), { code: 'bluetooth-not-ready' });
    expect(toWearableError(error).code).toBe('bluetooth-not-ready');
  });
  it('no confunde un fallo de autorización del picker ASK con el permiso global', () => {
    const error = Object.assign(new Error('Permission denied'), { code: 'accessory-setup-failed' });
    expect(toWearableError(error).code).toBe('connection-failed');
    expect(toWearableError(error).message).toBe('Permission denied');
  });

  it('conserva el error de permiso real de Core Bluetooth', () => {
    expect(toWearableError(new Error('BLE permission denied')).code).toBe('permission-denied');
  });

  it('conserva errores ya clasificados', () => {
    const error = new WearableError('bluetooth-off');
    expect(toWearableError(error)).toBe(error);
  });
});
