import { beforeEach, describe, expect, it } from "vitest";
import { persistRequestLanguage } from "../../../utils/requestLanguage";
import { DEFAULT_UNITS, loadUnitPrefs, saveUnitPrefs } from "../vitals/unit-prefs";

beforeEach(() => localStorage.clear());

describe("preferencias compartidas de Wellness y Signos Vitales", () => {
  it("aplica el mismo idioma activo cuando Signos Vitales omite el locale", () => {
    persistRequestLanguage("en");
    const expected = { ...DEFAULT_UNITS, weight: "lb", temperature: "°F" };
    expect(loadUnitPrefs("qa")).toEqual(expected);
    expect(loadUnitPrefs("qa", "en-US")).toEqual(expected);

    persistRequestLanguage("es");
    expect(loadUnitPrefs("qa")).toEqual(DEFAULT_UNITS);
  });

  it("conserva la elección métrica explícita de la persona en inglés", () => {
    persistRequestLanguage("en");
    saveUnitPrefs("qa", DEFAULT_UNITS);
    expect(loadUnitPrefs("qa")).toEqual(DEFAULT_UNITS);
    expect(loadUnitPrefs("qa", "en-US")).toEqual(DEFAULT_UNITS);
  });
});
