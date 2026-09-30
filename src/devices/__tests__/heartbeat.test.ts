import { describe, expect, it } from "vitest";
import { HEARTBEAT_MAX_MISSES, nextHeartbeatDecision } from "../heartbeat";

const STALE_MS = 120_000;

describe("nextHeartbeatDecision", () => {
  it("tráfico reciente: ok y resetea los misses", () => {
    expect(nextHeartbeatDecision(1_000, STALE_MS, 1)).toEqual({
      action: "ok",
      misses: 0,
    });
  });

  it("en el umbral exacto todavía es ok", () => {
    expect(nextHeartbeatDecision(STALE_MS, STALE_MS, 1)).toEqual({
      action: "ok",
      misses: 0,
    });
  });

  it("quietud más allá del umbral: ping y acumula", () => {
    expect(nextHeartbeatDecision(STALE_MS + 1, STALE_MS, 0)).toEqual({
      action: "ping",
      misses: 1,
    });
  });

  it(`tras ${HEARTBEAT_MAX_MISSES} pings sin respuesta: dead y resetea`, () => {
    expect(
      nextHeartbeatDecision(STALE_MS + 1, STALE_MS, HEARTBEAT_MAX_MISSES - 1),
    ).toEqual({ action: "dead", misses: 0 });
  });
});
