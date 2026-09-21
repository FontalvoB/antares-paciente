import * as ble from '../ble/ble-client';
import { parseHrsMeasurement } from './hrs';
import { HR_CHAR_MEASUREMENT, HR_SERVICE } from '../ycbt/protocol';
import type {
  DeviceDescriptor,
  DeviceSession,
  InfoSink,
  SampleSink,
} from '../types';

/** Sesión para dispositivos que sólo exponen el servicio estándar 0x180D. */
export class HrsSession implements DeviceSession {
  readonly descriptor: DeviceDescriptor;

  constructor(descriptor: DeviceDescriptor) {
    this.descriptor = descriptor;
  }

  async start(onSample: SampleSink, onInfo: InfoSink): Promise<void> {
    const { deviceId } = this.descriptor;
    onInfo({ name: this.descriptor.name });
    await ble.subscribe(deviceId, HR_SERVICE, HR_CHAR_MEASUREMENT, (bytes) => {
      const measurement = parseHrsMeasurement(bytes);
      if (!measurement) return;
      onSample({
        metric: 'heart_rate',
        value: measurement.heartRate,
        unit: 'bpm',
        ts: Date.now(),
        deviceId,
      });
    });
  }

  async stop(): Promise<void> {
    await ble.unsubscribe(
      this.descriptor.deviceId,
      HR_SERVICE,
      HR_CHAR_MEASUREMENT,
    );
  }
}
