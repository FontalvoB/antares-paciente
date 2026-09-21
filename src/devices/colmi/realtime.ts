import { CMD_REALTIME_RESPONSE, MEASURE_TYPE } from './protocol';
import type { ColmiFrame } from './protocol';
import type { HealthSample, MetricKind } from '../types';

// Respuesta en vivo: 69 <tipo> <err> <b3> <b4> <b5> …
// - FC (1) y SpO2 (3): valor en b3.
// - Presión (2): b4 = sistólica, b5 = diastólica, b3 = FC.
// - Stress (8) y HRV (10) quedan fuera del alcance actual (HRV sin decodificar).
export function parseRealtimeFrame(
  frame: ColmiFrame,
  deviceId: string,
): HealthSample[] {
  if (frame.cmd !== CMD_REALTIME_RESPONSE || frame.error) return [];
  const type = frame.payload[0] ?? 0;
  const err = frame.payload[1] ?? 0;
  if (err !== 0) return [];
  const b3 = frame.payload[2] ?? 0;
  const b4 = frame.payload[3] ?? 0;
  const b5 = frame.payload[4] ?? 0;

  const sample = (
    metric: MetricKind,
    value: number,
    unit: string,
    value2?: number,
  ): HealthSample => ({
    metric,
    value,
    ...(value2 === undefined ? {} : { value2 }),
    unit,
    ts: Date.now(),
    deviceId,
  });

  switch (type) {
    case MEASURE_TYPE.heart_rate:
      return b3 ? [sample('heart_rate', b3, 'bpm')] : [];
    case MEASURE_TYPE.spo2:
      return b3 ? [sample('spo2', b3, '%')] : [];
    case MEASURE_TYPE.blood_pressure: {
      if (!b4 || !b5) return [];
      const samples = [sample('blood_pressure', b4, 'mmHg', b5)];
      if (b3) samples.push(sample('heart_rate', b3, 'bpm'));
      return samples;
    }
    default:
      return [];
  }
}
