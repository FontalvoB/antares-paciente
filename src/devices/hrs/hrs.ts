import { readUint16LE } from '../util';

// Servicio estándar de frecuencia cardíaca (GATT 0x180D / 0x2A37).
// Cualquier banda, reloj o pulsómetro compatible lo expone.

export interface HrsMeasurement {
  heartRate: number;
  /** Intervalos R-R en ms, cuando el dispositivo los publica. */
  rrIntervals?: number[];
}

export function parseHrsMeasurement(bytes: Uint8Array): HrsMeasurement | null {
  if (bytes.length < 2) return null;
  const flags = bytes[0];
  const is16Bit = (flags & 0x01) === 0x01;
  const hasEnergyExpended = (flags & 0x08) === 0x08;
  const hasRrIntervals = (flags & 0x10) === 0x10;

  let offset = 1;
  const heartRate = is16Bit
    ? readUint16LE(bytes, offset)
    : (bytes[offset] ?? 0);
  offset += is16Bit ? 2 : 1;
  if (hasEnergyExpended) offset += 2;

  const rrIntervals: number[] = [];
  if (hasRrIntervals) {
    while (offset + 1 < bytes.length) {
      rrIntervals.push(readUint16LE(bytes, offset) / 1024);
      offset += 2;
    }
  }

  if (!heartRate) return null;
  return {
    heartRate,
    rrIntervals: rrIntervals.length ? rrIntervals : undefined,
  };
}
