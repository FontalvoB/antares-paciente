import type { WearableErrorCode } from './types';

/** Error de la capa de dispositivos con código traducible en la UI. */
export class WearableError extends Error {
  readonly code: WearableErrorCode;

  constructor(code: WearableErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'WearableError';
    this.code = code;
  }
}

export function toWearableError(
  err: unknown,
  fallback: WearableErrorCode = 'unknown',
): WearableError {
  if (err instanceof WearableError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (err && typeof err === 'object' && 'code' in err && err.code === 'bluetooth-not-ready') {
    return new WearableError('bluetooth-not-ready', message);
  }
  // Un fallo del picker ASK no demuestra que se haya denegado Bluetooth.
  if (err && typeof err === 'object' && 'code' in err && err.code === 'accessory-setup-failed') {
    return new WearableError('connection-failed', message);
  }
  if (/disabled|not enabled|bluetooth.*off|turned off/i.test(message)) {
    return new WearableError('bluetooth-off', message);
  }
  if (/permission|denied|unauthorized|not authorized/i.test(message)) {
    return new WearableError('permission-denied', message);
  }
  if (/not available|not supported|unavailable/i.test(message)) {
    return new WearableError('scan-unavailable', message);
  }
  return new WearableError(fallback, message);
}
