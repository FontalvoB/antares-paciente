import { describe, expect, it } from "vitest";
import {
  applySample,
  EMPTY_TOTALS,
  newDayStore,
  totalsOf,
} from "../day-totals";
import type { HealthSample } from "../types";

const DAY = "2026-09-21";

function sample(
  extra: Partial<HealthSample> & { metric: HealthSample["metric"] },
): HealthSample {
  return {
    value: 0,
    unit: "",
    ts: Date.now(),
    deviceId: "dev-1",
    ...extra,
  };
}

describe("day-totals", () => {
  it("un store nuevo devuelve totales vacíos", () => {
    expect(totalsOf(newDayStore(DAY))).toEqual(EMPTY_TOTALS);
  });

  it("los contadores en vivo mandan sobre las cubetas", () => {
    const store = newDayStore(DAY);
    applySample(
      store,
      sample({ metric: "steps", value: 1000, agg: "sum", ts: 1 }),
    );
    applySample(store, sample({ metric: "steps", value: 1500, ts: 2 }));
    expect(totalsOf(store).steps).toBe(1500);
  });

  it("suma cubetas distintas y deduplica por hora de inicio", () => {
    const store = newDayStore(DAY);
    applySample(
      store,
      sample({ metric: "steps", value: 300, agg: "sum", ts: 1 }),
    );
    applySample(
      store,
      sample({ metric: "steps", value: 200, agg: "sum", ts: 2 }),
    );
    // Re-sincronizar la misma cubeta no la duplica.
    applySample(
      store,
      sample({ metric: "steps", value: 300, agg: "sum", ts: 1 }),
    );
    expect(totalsOf(store).steps).toBe(500);
  });

  it("la distancia sigue el mismo criterio que los pasos", () => {
    const store = newDayStore(DAY);
    applySample(
      store,
      sample({ metric: "distance", value: 400, agg: "sum", ts: 1 }),
    );
    applySample(store, sample({ metric: "distance", value: 900, ts: 2 }));
    expect(totalsOf(store).distanceM).toBe(900);
  });

  it("las calorías solo suben", () => {
    const store = newDayStore(DAY);
    applySample(store, sample({ metric: "calories", value: 210 }));
    applySample(store, sample({ metric: "calories", value: 120 }));
    expect(totalsOf(store).activityKcal).toBe(210);
  });

  it("el sueño conserva la sesión más reciente", () => {
    const store = newDayStore(DAY);
    applySample(store, sample({ metric: "sleep", value: 393, ts: 1000 }));
    applySample(store, sample({ metric: "sleep", value: 300, ts: 500 }));
    expect(totalsOf(store).sleepMinutes).toBe(393);
  });

  it("una métrica ajena al día no marca cambios", () => {
    const store = newDayStore(DAY);
    expect(
      applySample(store, sample({ metric: "heart_rate", value: 72 })),
    ).toBe(false);
    expect(totalsOf(store)).toEqual(EMPTY_TOTALS);
  });

  it("al cambiar de dispositivo el store nuevo queda vacío (reset)", () => {
    const store = newDayStore(DAY);
    applySample(store, sample({ metric: "sleep", value: 393, ts: 1000 }));
    expect(totalsOf(store).sleepMinutes).toBe(393);
    // El contexto reemplaza el store al conectar otro wearable.
    expect(totalsOf(newDayStore(DAY))).toEqual(EMPTY_TOTALS);
  });
});
