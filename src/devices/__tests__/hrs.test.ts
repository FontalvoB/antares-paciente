import { describe, expect, it } from 'vitest';
import { parseHrsMeasurement } from '../hrs/hrs';

describe('parseHrsMeasurement', () => {
  it('lee la medida de 8 bits', () => {
    const result = parseHrsMeasurement(new Uint8Array([0x00, 72]));
    expect(result?.heartRate).toBe(72);
    expect(result?.rrIntervals).toBeUndefined();
  });

  it('lee la medida de 16 bits', () => {
    const result = parseHrsMeasurement(new Uint8Array([0x01, 0x50, 0x00]));
    expect(result?.heartRate).toBe(80);
  });

  it('omite el gasto energético cuando está presente', () => {
    const result = parseHrsMeasurement(new Uint8Array([0x08, 65, 0x34, 0x12]));
    expect(result?.heartRate).toBe(65);
  });

  it('extrae los intervalos R-R en milisegundos', () => {
    const result = parseHrsMeasurement(
      new Uint8Array([0x10, 72, 0x00, 0x04, 0x00, 0x08]),
    );
    expect(result?.heartRate).toBe(72);
    expect(result?.rrIntervals).toEqual([1, 2]);
  });

  it('combina 16 bits, energía e intervalos R-R', () => {
    const result = parseHrsMeasurement(
      new Uint8Array([0x19, 0x50, 0x00, 0x34, 0x12, 0x00, 0x04]),
    );
    expect(result?.heartRate).toBe(80);
    expect(result?.rrIntervals).toEqual([1]);
  });

  it('devuelve null para tramas incompletas o sin pulso', () => {
    expect(parseHrsMeasurement(new Uint8Array([0x00]))).toBeNull();
    expect(parseHrsMeasurement(new Uint8Array([]))).toBeNull();
    expect(parseHrsMeasurement(new Uint8Array([0x00, 0]))).toBeNull();
  });
});
