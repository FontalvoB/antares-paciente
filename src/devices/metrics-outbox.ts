import type { DeviceMetricsInput } from "../services/program/metrics-history-service";
import { totalsOf } from "./day-totals";
import type { SampleSnapshot } from "./sample-store";

export interface DeviceMetricUpload {
  /** Identidad del slot; no mezcla cuentas, dispositivos ni días. */
  id: string;
  day: string;
  kind: "activity" | "sleep";
  /** Cambia solo si cambia la carga útil de ese slot. */
  key: string;
  input: DeviceMetricsInput;
}

/**
 * Reconstruye la ingesta a partir de los acumulados durables. El llamador
 * confirma `key` solo tras el POST correcto; el backend hace upsert por día.
 */
export function buildDeviceMetricUploads(snapshot: SampleSnapshot): DeviceMetricUpload[] {
  const uploads: DeviceMetricUpload[] = [];
  const append = (day: string, kind: DeviceMetricUpload["kind"], input: DeviceMetricsInput) => {
    uploads.push({
      id: JSON.stringify([snapshot.accountId, snapshot.deviceId, day, kind]),
      day,
      kind,
      key: JSON.stringify(input),
      input,
    });
  };
  for (const day of Object.keys(snapshot.days).sort()) {
    const store = snapshot.days[day];
    const totals = totalsOf(store);
    const activity: DeviceMetricsInput = {
      ...(totals.steps !== null ? { steps: totals.steps } : {}),
      ...(totals.distanceM !== null ? { distanceM: totals.distanceM } : {}),
      ...(totals.activityKcal !== null ? { activityKcal: totals.activityKcal } : {}),
    };
    if (Object.keys(activity).length) {
      append(day, "activity", {
        ...activity,
        recordedAt: new Date(`${day}T12:00:00`).toISOString(),
      });
    }
    if (store.sleep && store.sleep.minutes > 0) {
      append(day, "sleep", {
        sleepMinutes: store.sleep.minutes,
        recordedAt: new Date(store.sleep.ts).toISOString(),
      });
    }
  }
  return uploads;
}
