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
  private stopped = false;

  constructor(descriptor: DeviceDescriptor) {
    this.descriptor = descriptor;
  }

  async start(onSample: SampleSink, onInfo: InfoSink): Promise<void> {
    this.stopped = false;
    const { deviceId } = this.descriptor;
    onInfo({ name: this.descriptor.name });
    await ble.subscribe(deviceId, HR_SERVICE, HR_CHAR_MEASUREMENT, (bytes) => {
      if (this.stopped) return;
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
    this.stopped = true;
    await ble.unsubscribe(
      this.descriptor.deviceId,
      HR_SERVICE,
      HR_CHAR_MEASUREMENT,
    );
  }

  setAppActive(_active: boolean): void {
    // Standard HRS has no polling loop; stopped still filters late packets.
  }
}
