import { describe, expect, it } from "vitest";
import {
  applySample,
  EMPTY_TOTALS,
  newDayStore,
  totalsOf,
} from "../day-totals";
import type { HealthSample } from "../types";

const DAY = "2026-09-21";
/** Marca de tiempo dentro de DAY (cualquier hora del día 21). */
const tsOnDay = (hour: number, minute = 0) =>
  new Date(2026, 8, 21, hour, minute).getTime();
const wakeOnDay = tsOnDay;
const wakeOnDayMinus = (days: number, hour = 7) =>
  new Date(2026, 8, 21 - days, hour).getTime();

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
      sample({ metric: "steps", value: 1000, agg: "sum", ts: tsOnDay(9) }),
    );
    applySample(store, sample({ metric: "steps", value: 1500, ts: tsOnDay(10) }));
    expect(totalsOf(store).steps).toBe(1500);
  });

  it("suma cubetas distintas y deduplica por hora de inicio", () => {
    const store = newDayStore(DAY);
    applySample(
      store,
      sample({ metric: "steps", value: 300, agg: "sum", ts: tsOnDay(9) }),
    );
    applySample(
      store,
      sample({ metric: "steps", value: 200, agg: "sum", ts: tsOnDay(10) }),
    );
    // Re-sincronizar la misma cubeta no la duplica.
    applySample(
      store,
      sample({ metric: "steps", value: 300, agg: "sum", ts: tsOnDay(9) }),
    );
    expect(totalsOf(store).steps).toBe(500);
  });

  it("la distancia sigue el mismo criterio que los pasos", () => {
    const store = newDayStore(DAY);
    applySample(
      store,
      sample({ metric: "distance", value: 400, agg: "sum", ts: tsOnDay(9) }),
    );
    applySample(store, sample({ metric: "distance", value: 900, ts: tsOnDay(10) }));
    expect(totalsOf(store).distanceM).toBe(900);
  });

  it("las calorías solo suben", () => {
    const store = newDayStore(DAY);
    applySample(store, sample({ metric: "calories", value: 210 }));
    applySample(store, sample({ metric: "calories", value: 120 }));
    expect(totalsOf(store).activityKcal).toBe(210);
  });

  it("el sueño conserva la sesión más reciente del mismo día", () => {
    const store = newDayStore(DAY);
    applySample(
      store,
      sample({ metric: "sleep", value: 393, ts: wakeOnDay(7) }),
    );
    applySample(
      store,
      sample({ metric: "sleep", value: 300, ts: wakeOnDay(5) }),
    );
    expect(totalsOf(store).sleepMinutes).toBe(393);
  });

  it("una noche que terminó otro día no entra al acumulado de hoy", () => {
    const store = newDayStore(DAY);
    // La banda no se usó anoche: su última noche (hace 3 días) no es "la de hoy".
    expect(
      applySample(
        store,
        sample({ metric: "sleep", value: 454, ts: wakeOnDayMinus(3) }),
      ),
    ).toBe(false);
    expect(totalsOf(store).sleepMinutes).toBeNull();
  });

  it("acepta la noche aunque el despertar sea de madrugada o de tarde", () => {
    const early = newDayStore(DAY);
    applySample(
      early,
      sample({ metric: "sleep", value: 420, ts: wakeOnDay(1, 30) }),
    );
    expect(totalsOf(early).sleepMinutes).toBe(420);
    const late = newDayStore(DAY);
    applySample(
      late,
      sample({ metric: "sleep", value: 60, ts: wakeOnDay(15, 10) }),
    );
    expect(totalsOf(late).sleepMinutes).toBe(60);
  });

  it("un volcado de días anteriores no suma pasos a hoy", () => {
    const store = newDayStore(DAY);
    // Cubetas de ayer y anteayer (el anillo guarda días previos).
    expect(
      applySample(
        store,
        sample({
          metric: "steps",
          value: 3000,
          agg: "sum",
          ts: wakeOnDayMinus(1, 10),
        }),
      ),
    ).toBe(false);
    expect(
      applySample(
        store,
        sample({
          metric: "steps",
          value: 2000,
          agg: "sum",
          ts: wakeOnDayMinus(2, 10),
        }),
      ),
    ).toBe(false);
    expect(totalsOf(store).steps).toBeNull();
  });

  it("las cubetas de hoy sí suman y siguen deduplicando por hora", () => {
    const store = newDayStore(DAY);
    applySample(
      store,
      sample({ metric: "steps", value: 300, agg: "sum", ts: wakeOnDay(9) }),
    );
    applySample(
      store,
      sample({ metric: "steps", value: 200, agg: "sum", ts: wakeOnDay(10) }),
    );
    // Re-sincronizar la misma cubeta de hoy no la duplica.
    applySample(
      store,
      sample({ metric: "steps", value: 300, agg: "sum", ts: wakeOnDay(9) }),
    );
    expect(totalsOf(store).steps).toBe(500);
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
    applySample(
      store,
      sample({ metric: "sleep", value: 393, ts: wakeOnDay(7) }),
    );
    expect(totalsOf(store).sleepMinutes).toBe(393);
    // El contexto reemplaza el store al conectar otro wearable.
    expect(totalsOf(newDayStore(DAY))).toEqual(EMPTY_TOTALS);
  });
});
