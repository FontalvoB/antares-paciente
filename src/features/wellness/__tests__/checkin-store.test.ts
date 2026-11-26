import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkinHistory, loadCheckins, motorCheckinOwner, saveCheckin, syncCheckins } from "../checkin/checkin-store";
import type { DailyCheckin } from "../checkin/close-day";
import { deleteWellnessData } from "../privacy/privacy-consent-store";

const owner = "test-patient";
const date = "2026-11-24";
const beforeMidnight = new Date(2026, 10, 24, 23, 59);
const afterMidnight = new Date(2026, 10, 25, 0, 1);
const input: DailyCheckin = {
  adherence: 70, sleepHours: 7, energy: 4, pain: 0, symptoms: [],
  exercised: true, weightKg: null, waistCm: null,
};

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

describe("check-in por fecha local", () => {
  it("conserva el primer cierre incluso con dos envíos simultáneos", async () => {
    const [first, second] = await Promise.all([
      saveCheckin(owner, date, input, beforeMidnight),
      saveCheckin(owner, date, { ...input, pain: 5 }, beforeMidnight),
    ]);
    expect(first).toEqual(second);
    expect(loadCheckins(owner)).toEqual({ [date]: first });
    expect(loadCheckins("another-patient")).toEqual({});
  });

  it("persiste offline y solo envía una vez al volver online", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const send = vi.fn().mockResolvedValue(undefined);
    const record = await saveCheckin(owner, date, input, beforeMidnight);
    await syncCheckins(owner, send);
    expect(loadCheckins(owner)[date]).toEqual(record);
    expect(record.status).toBe("pending");
    expect(send).not.toHaveBeenCalled();

    online.mockReturnValue(true);
    await Promise.all([syncCheckins(owner, send), syncCheckins(owner, send)]);
    await syncCheckins(owner, send);
    expect(send).toHaveBeenCalledExactlyOnceWith(record);
    expect(loadCheckins(owner)[date]).toEqual({ ...record, status: "synced" });
    expect(await saveCheckin(owner, date, input, beforeMidnight)).toEqual(loadCheckins(owner)[date]);
  });

  it("reintenta un fallo con la misma clave", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const record = await saveCheckin(owner, date, input, beforeMidnight);
    await syncCheckins(owner, send);
    expect(loadCheckins(owner)[date].status).toBe("pending");
    await syncCheckins(owner, send);
    expect(send.mock.calls).toEqual([[record], [record]]);
    expect(loadCheckins(owner)[date].status).toBe("synced");
  });

  it("no recupera ni envía los cierres borrados durante una sincronización", async () => {
    await saveCheckin(owner, date, input, beforeMidnight);
    await saveCheckin(owner, "2026-11-25", input, afterMidnight);
    const send = vi.fn(async () => { deleteWellnessData(owner); });
    await syncCheckins(owner, send);
    expect(send).toHaveBeenCalledOnce();
    expect(loadCheckins(owner)).toEqual({});
  });

  it("rechaza fechas futuras y fechas inexistentes", async () => {
    await expect(saveCheckin(owner, "2026-11-25", input, beforeMidnight)).rejects.toThrow(RangeError);
    await expect(saveCheckin(owner, "2026-02-29", input, beforeMidnight)).rejects.toThrow(RangeError);
    expect(loadCheckins(owner)).toEqual({});
  });

  it("permite cierres distintos a las 23:59 y 00:01 locales", async () => {
    await saveCheckin(owner, date, input, beforeMidnight);
    await saveCheckin(owner, "2026-11-25", input, afterMidnight);
    expect(Object.keys(loadCheckins(owner))).toEqual([date, "2026-11-25"]);
  });

  it("retries the read of a conflict without sending the closure again", async () => {
    const personId = "linked-person";
    const scope = motorCheckinOwner(owner, personId);
    const record = await saveCheckin(scope, date, input, beforeMidnight, 7, personId);
    const send = vi.fn().mockResolvedValue("conflict");
    const reconcile = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    await syncCheckins(scope, send, reconcile);
    expect(loadCheckins(scope)["motor:7"]).toEqual({ ...record, status: "conflict" });
    await syncCheckins(scope, send, reconcile);
    await syncCheckins(scope, send, reconcile);
    expect(send).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(loadCheckins(scope)["motor:7"]).toMatchObject({ status: "conflict", confirmedConflict: true });
  });

  it("preserves unbound records and separates demo and real histories", async () => {
    const scope = motorCheckinOwner(owner, "linked-person");
    await saveCheckin(owner, date, input, beforeMidnight, 7);
    await saveCheckin(owner, date, { ...input, pain: 3 }, beforeMidnight);
    await saveCheckin(scope, date, { ...input, pain: 8 }, beforeMidnight, 7, "linked-person");
    expect(checkinHistory(owner)[date].pain).toBe(3);
    expect(loadCheckins(owner)["motor:7"].status).toBe("pending");
    expect(loadCheckins(scope)["motor:7"].input.pain).toBe(8);
  });
});
