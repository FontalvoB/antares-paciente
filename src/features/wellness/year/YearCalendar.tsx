import { memo, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useI18n } from "../../../i18n/I18nContext";
import { parseLocalDate } from "../state/wellness-home-store";
import type { DayStatus, PlanMonth } from "./year-data";

function useStatuses() {
  const { t } = useI18n();
  return useMemo(() => ({
    complete: t("Completado"),
    partial: t("Parcial"),
    missing: t("Sin datos"),
    future: t("Futuro"),
  }), [t]);
}

const MonthRows = memo(function MonthRows({
  month, focusDay, today, locale, statuses,
}: {
  month: PlanMonth;
  focusDay: number;
  today: string;
  locale: string;
  statuses: Record<DayStatus, string>;
}) {
  const { t } = useI18n();
  const first = parseLocalDate(month.days[0].date)!;
  const offset = (first.getDay() + 6) % 7;
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(first);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const weeks = Math.ceil((offset + month.days.length) / 7);

  return (
    <div role="rowgroup" className="wy-month">
      <div role="row" className="wy-month-title">
        <span role="rowheader" aria-colspan={7}>{title}</span>
      </div>
      {Array.from({ length: weeks }, (_, row) => (
        <div role="row" className="wy-week" key={row}>
          {Array.from({ length: 7 }, (_, col) => {
            const day = month.days[row * 7 + col - offset];
            if (!day) return <span key={col} role="gridcell" aria-disabled="true" />;
            return (
              <span
                key={col}
                role="gridcell"
                className="wy-day"
                data-status={day.status}
                data-plan-day={day.number}
                tabIndex={focusDay === day.number ? 0 : -1}
                aria-current={day.date === today ? "date" : undefined}
                aria-label={t("{date} · {status}", {
                  date: dates.format(parseLocalDate(day.date)!),
                  status: statuses[day.status],
                })}
              >
                {Number(day.date.slice(-2))}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
});

// Cuadrícula de estados del plan con foco itinerante y desplazamiento entre meses.
export const YearCalendar = memo(function YearCalendar({
  months, today, initialDay,
}: {
  months: readonly PlanMonth[];
  today: string;
  initialDay: number;
}) {
  const { t, lang } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const statuses = useStatuses();
  const [focusDay, setFocusDay] = useState(initialDay);
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, index) => format.format(new Date(2024, 0, 1 + index)));
  }, [locale]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLElement) || !event.target.dataset.planDay) return;
    const current = Number(event.target.dataset.planDay);
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const scope = event.ctrlKey ? event.currentTarget : event.target.parentElement;
      const cells = scope?.querySelectorAll<HTMLElement>(".wy-day");
      if (cells?.length) cells[event.key === "Home" ? 0 : cells.length - 1].focus();
      return;
    }
    const nextByKey: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current - 7,
      ArrowDown: current + 7,
    };
    const next = nextByKey[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const cell = event.currentTarget.querySelector<HTMLElement>(`[data-plan-day="${next}"]`);
    cell?.focus();
  }

  return (
    <>
      <ul className="wy-legend">
        {Object.entries(statuses).map(([status, label]) => (
          <li key={status}><span className="wy-swatch" data-status={status} aria-hidden="true" />{label}</li>
        ))}
      </ul>
      <div
        role="grid"
        aria-label={t("Calendario del plan")}
        aria-readonly="true"
        aria-colcount={7}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.target instanceof HTMLElement && event.target.dataset.planDay) {
            setFocusDay(Number(event.target.dataset.planDay));
          }
        }}
      >
        <div role="row" className="wy-week wy-weekdays">
          {weekdays.map((label, index) => <span key={index} role="columnheader">{label}</span>)}
        </div>
        {months.map((month) => (
          <MonthRows
            key={month.id}
            month={month}
            focusDay={focusDay >= month.days[0].number && focusDay <= month.days.at(-1)!.number ? focusDay : 0}
            today={today}
            locale={locale}
            statuses={statuses}
          />
        ))}
      </div>
    </>
  );
});
