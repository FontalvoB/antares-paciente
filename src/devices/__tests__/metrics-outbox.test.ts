import { beforeEach, describe, expect, it } from "vitest";
import { buildDeviceMetricUploads } from "../metrics-outbox";
import { createSampleSnapshot, recordSampleSnapshot } from "../sample-store";
import type { HealthSample } from "../types";

const NOW = new Date(2026, 10, 3, 12).getTime();
const YESTERDAY = new Date(2026, 10, 2, 8).getTime();

function sample(overrides: Partial<HealthSample>): HealthSample {
  return { metric: "steps", value: 600, unit: "steps", ts: NOW, deviceId: "ring-1", ...overrides };
}

describe("metrics-outbox", () => {
  beforeEach(() => localStorage.clear());

  it("no sube un día vacío ni métricas fuera del contrato de ingesta", () => {
    const snapshot = recordSampleSnapshot(createSampleSnapshot("patient-a", "ring-1", NOW),
      sample({ metric: "heart_rate", value: 72, unit: "bpm" }), NOW);
    expect(buildDeviceMetricUploads(snapshot)).toEqual([]);
  });

  it("separa actividad y sueño, con la fecha original de cada acumulado", () => {
    let snapshot = createSampleSnapshot("patient-a", "ring-1", NOW);
    for (const row of [
      sample({ ts: YESTERDAY, value: 3000 }),
      sample({ ts: YESTERDAY, metric: "distance", value: 2000 }),
      sample({ ts: YESTERDAY, metric: "calories", value: 140 }),
      sample({ ts: YESTERDAY, metric: "sleep", value: 420 }),
      sample({ value: 600 }),
    ]) snapshot = recordSampleSnapshot(snapshot, row, NOW);
    const jobs = buildDeviceMetricUploads(snapshot);
    expect(jobs.map((job) => [job.day, job.kind])).toEqual([
      ["2026-11-02", "activity"], ["2026-11-02", "sleep"], ["2026-11-03", "activity"],
    ]);
    expect(jobs[0].input).toEqual({
      steps: 3000, distanceM: 2000, activityKcal: 140,
      recordedAt: new Date(2026, 10, 2, 12).toISOString(),
    });
    expect(jobs[1].input).toEqual({ sleepMinutes: 420, recordedAt: new Date(YESTERDAY).toISOString() });
    expect(jobs[2].input.steps).toBe(600);
  });

  it("una clave confirmada sigue estable en el replay y cambia al crecer los totales", () => {
    let snapshot = recordSampleSnapshot(createSampleSnapshot("patient-a", "ring-1", NOW), sample({}), NOW);
    const first = buildDeviceMetricUploads(snapshot)[0];
    snapshot = recordSampleSnapshot(snapshot, sample({}), NOW + 1000);
    expect(buildDeviceMetricUploads(snapshot)[0]).toEqual(first);
    snapshot = recordSampleSnapshot(snapshot, sample({ value: 700, ts: NOW + 2000 }), NOW + 2000);
    const next = buildDeviceMetricUploads(snapshot)[0];
    expect(next.id).toBe(first.id);
    expect(next.key).not.toBe(first.key);
  });

  it("los ids de confirmación no se comparten entre cuentas o wearables", () => {
    const first = recordSampleSnapshot(createSampleSnapshot("patient-a", "ring-1", NOW), sample({}), NOW);
    const otherPatient = recordSampleSnapshot(createSampleSnapshot("patient-b", "ring-1", NOW), sample({}), NOW);
    const otherDevice = recordSampleSnapshot(createSampleSnapshot("patient-a", "band-1", NOW), sample({ deviceId: "band-1" }), NOW);
    expect(new Set([first, otherPatient, otherDevice].map((state) => buildDeviceMetricUploads(state)[0].id)).size).toBe(3);
  });
});
