import { beforeEach, describe, expect, it } from "vitest";
import {
  completeProtocolStep,
  getWellnessHomeData,
  isChestUnlocked,
  localISODate,
  missingForChest,
  saveProtocolHistory,
  type ProtocolStepId,
} from "../state/wellness-home-store";

const TODAY = new Date(2026, 10, 24, 12, 0, 0);
const YESTERDAY = new Date(2026, 10, 23, 12, 0, 0);
const FIRST_FOUR: ProtocolStepId[] = [
  "exercise",
  "diet",
  "vitals",
  "emotional",
];

describe("protocolo diario (KAN-143)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("completa un paso una sola vez y suma puntos al instante", () => {
    const first = completeProtocolStep("exercise", TODAY);
    expect(first.completed).toBe(true);
    expect(first.pointsEarned).toBe(10);
    expect(first.dayComplete).toBe(false);

    const again = completeProtocolStep("exercise", TODAY);
    expect(again.completed).toBe(false);
    expect(again.pointsEarned).toBe(0);
    expect(getWellnessHomeData("", TODAY).protocolDone).toBe(1);
  });

  it("bloquea el cofre hasta completar los pasos 1–4", () => {
    saveProtocolHistory({
      [localISODate(TODAY)]: ["exercise", "diet", "vitals"],
    });
    expect(isChestUnlocked(load(), TODAY)).toBe(false);
    expect(missingForChest(load(), TODAY)).toEqual(["emotional"]);

    const blocked = completeProtocolStep("chest", TODAY);
    expect(blocked.completed).toBe(false);
    expect(blocked.chestUnlocked).toBe(false);
    expect(getWellnessHomeData("", TODAY).protocolDone).toBe(3);
  });

  it("abre el cofre una sola vez al completar los 4 pasos", () => {
    saveProtocolHistory({ [localISODate(TODAY)]: FIRST_FOUR });
    expect(isChestUnlocked(load(), TODAY)).toBe(true);

    const open = completeProtocolStep("chest", TODAY);
    expect(open.completed).toBe(true);
    expect(open.dayComplete).toBe(true);
    expect(open.chestUnlocked).toBe(true);

    const second = completeProtocolStep("chest", TODAY);
    expect(second.completed).toBe(false);
    expect(getWellnessHomeData("", TODAY).protocolDone).toBe(5);
    expect(getWellnessHomeData("", TODAY).points).toBe(70);
  });

  it("no arrastra pasos incompletos al día siguiente", () => {
    completeProtocolStep("exercise", YESTERDAY);
    completeProtocolStep("diet", YESTERDAY);
    const today = getWellnessHomeData("", TODAY);
    expect(today.protocolDone).toBe(0);
    expect(isChestUnlocked(load(), TODAY)).toBe(false);
  });

  it("usa la fecha local: 23:59 y 00:01 son días distintos", () => {
    const before = new Date(2026, 10, 24, 23, 59, 0);
    const after = new Date(2026, 10, 25, 0, 1, 0);
    expect(localISODate(before)).toBe("2026-11-24");
    expect(localISODate(after)).toBe("2026-11-25");

    completeProtocolStep("exercise", before);
    expect(getWellnessHomeData("", before).protocolDone).toBe(1);
    expect(getWellnessHomeData("", after).protocolDone).toBe(0);
  });
});

/** Lee el historial vigente para las aserciones del cofre. */
function load() {
  return JSON.parse(
    window.localStorage.getItem("wellness.protocol.v1") ?? "{}",
  ) as Record<string, ProtocolStepId[]>;
}
