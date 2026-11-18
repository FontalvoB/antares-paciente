import { describe, expect, it } from "vitest";
import { matchesMedicationLabel } from "../medication-label";

const selected = { id: "selected", name: "Metformina 850 mg" };

describe("medication package label matching", () => {
  it("matches the scheduled label across wrapping, punctuation, and spacing", () => {
    expect(matchesMedicationLabel("METFORMÍNA\n850mg. 30 tabletas", selected, [selected])).toBe(true);
  });

  it.each(["Metformina 500mg", "Metformina 8500 mg", "Metformina", "850 mg", ""])(
    "rejects an incomplete or different label: %s",
    text => expect(matchesMedicationLabel(text, selected, [selected])).toBe(false),
  );

  it("does not use a strength alone as a medication name", () => {
    expect(matchesMedicationLabel("850 mg", { id: "x", name: "850 mg" }, [])).toBe(false);
  });

  it("rejects a photo containing another name from the patient's list", () => {
    expect(matchesMedicationLabel("Metformina 850 mg\nLosartán 50 mg", selected, [
      selected,
      { id: "other", name: "Losartán 50 mg" },
    ])).toBe(false);
  });

  it("does not accept a short name that overlaps a different treatment", () => {
    const short = { id: "short", name: "Metformina" };
    expect(matchesMedicationLabel("Metformina 850 mg", short, [short, selected])).toBe(false);
  });
});
