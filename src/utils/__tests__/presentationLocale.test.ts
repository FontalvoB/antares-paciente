import { describe, expect, it } from "vitest";
import { formatLongDate, formatLongDateEs, monthTitle, monthTitleEs } from "../dates";
import { CLUB_CATEGORIES, formatDateTime } from "../clubs-helpers";
import { formatCount } from "../../components/community/CommunityProfile";
import english from "../../i18n/en.json";

describe("Presentación según el idioma", () => {
  it("formatea fechas de calendario sin desplazar el día ISO por zona horaria", () => {
    expect(formatLongDate("2026-11-05", "en-US")).toBe("Thursday, November 5");
    expect(formatLongDate("2026-01-01", "en-US")).toBe("Thursday, January 1");
    expect(monthTitle(2026, 11, "en-US")).toBe("November 2026");
    expect(formatLongDateEs("2026-11-05")).toBe(formatLongDate("2026-11-05", "es-ES"));
    expect(monthTitleEs(2026, 11)).toBe(monthTitle(2026, 11, "es-ES"));
  });

  it("usa conteos compactos en inglés y conserva los españoles", () => {
    expect(formatCount(1700, "en")).toBe("1.7K");
    expect(formatCount(1200000, "en")).toBe("1.2M");
    expect(formatCount(1700, "es")).toBe("1,7 mil");
  });

  it("localiza la fecha de lives y cubre todas las categorías de clubes", () => {
    const iso = "2026-11-05T12:00:00-05:00";
    const englishDate = formatDateTime(iso, "en");
    const spanishDate = formatDateTime(iso, "es");
    expect(englishDate).toContain("Nov");
    expect(englishDate).not.toBe(spanishDate);
    expect(englishDate).toMatch(/AM|PM/);
    expect(CLUB_CATEGORIES.filter(category => !(category in english))).toEqual([]);
  });
});
