import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "../../../../i18n/I18nContext";
import { YearCalendar } from "../YearCalendar";
import { buildCalendar } from "../year-data";

afterEach(cleanup);

describe("YearCalendar keyboard", () => {
  it("exposes date and status and moves a single tab stop across month boundaries", () => {
    const today = "2026-02-01";
    const months = buildCalendar("2026-01-30", today, {});
    render(<I18nProvider><YearCalendar months={months} today={today} initialDay={2} /></I18nProvider>);
    const grid = screen.getByRole("grid");
    const january = within(grid).getByRole("gridcell", { name: /31 de enero.*Sin datos/ });
    const sunday = within(grid).getByRole("gridcell", { name: /\b1 de febrero.*Sin datos/ });
    const monday = within(grid).getByRole("gridcell", { name: /\b2 de febrero.*Futuro/ });

    expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(january.tabIndex).toBe(0);
    fireEvent.keyDown(january, { key: "ArrowRight" });
    expect(document.activeElement).toBe(sunday);
    expect(sunday.getAttribute("aria-current")).toBe("date");
    expect(january.tabIndex).toBe(-1);
    expect(sunday.tabIndex).toBe(0);

    fireEvent.keyDown(sunday, { key: "ArrowRight" });
    expect(document.activeElement).toBe(monday);
    fireEvent.keyDown(monday, { key: "ArrowDown" });
    expect(document.activeElement).toBe(within(grid).getByRole("gridcell", { name: /\b9 de febrero.*Futuro/ }));
    fireEvent.keyDown(document.activeElement!, { key: "End", ctrlKey: true });
    expect(document.activeElement?.getAttribute("data-plan-day")).toBe("365");
    fireEvent.keyDown(document.activeElement!, { key: "Home", ctrlKey: true });
    expect(document.activeElement?.getAttribute("data-plan-day")).toBe("1");
    expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });
});
