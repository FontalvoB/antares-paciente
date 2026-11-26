import { IonButton, IonIcon, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from "@ionic/react";
import { arrowBackOutline, calendarOutline } from "ionicons/icons";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { useMotorDay } from "../calendar/useMotorDay";
import { checkinHistory, checkinOwner, subscribeCheckins } from "../checkin/checkin-store";
import { loadPlanSnapshot, loadPlanVersions, localISODate, parseLocalDate, planDay } from "../state/wellness-home-store";
import { bodyMeasurementFormatter, loadUnitPrefs } from "../vitals/unit-prefs";
import { MeasurementCurve } from "./MeasurementCurve";
import { YearCalendar } from "./YearCalendar";
import { buildCalendar, planMilestones, selectRange, summarizeMonth } from "./year-data";
import type { CalendarHistory, Period } from "./year-data";
import "./wellness-year.css";
import { VitaEntry } from "../vita";

const EMPTY_HISTORY: CalendarHistory = {};

export function WellnessYearPage() {
  const { user, navigate } = useApp();
  const { t, lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const owner = checkinOwner(user);
  const motor = useMotorDay(365);
  const remote = motor.kind === "ready" ? motor.day : undefined;
  const legacy = motor.kind === "legacy";
  const [plan] = useState(loadPlanSnapshot);
  const [versions] = useState(loadPlanVersions);
  const units = useMemo(() => loadUnitPrefs(owner), [owner]);
  const [checkins, setCheckins] = useState(() => ({ owner, history: checkinHistory(owner) }));
  const [period, setPeriod] = useState<Period>("30");
  const [month, setMonth] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const calendar = useRef<HTMLElement>(null);
  const snapshot = remote?.sync;
  const start = legacy ? plan?.startDate ?? "" : snapshot ? remote?.startDate ?? "" : "";
  const today = remote?.todayLocalDate ?? localISODate(new Date());
  const realHistory: CalendarHistory = useMemo(() => snapshot
    ? Object.fromEntries(snapshot.logs.map(log => [log.date, { ...log, adherence: log.adherence * 100 }]))
    : EMPTY_HISTORY, [snapshot]);
  const history = legacy && checkins.owner === owner ? checkins.history : realHistory;

  useEffect(() => {
    const refresh = () => setCheckins({ owner, history: checkinHistory(owner) });
    const unsubscribe = subscribeCheckins(owner, refresh);
    refresh();
    return unsubscribe;
  }, [owner]);

  useEffect(() => title.current?.focus(), []);

  const months = useMemo(() => buildCalendar(start, today, history), [start, today, history]);
  const days = useMemo(() => months.flatMap((item) => item.days), [months]);
  const selectedMonth = months.find(({ id }) => id === month)
    ?? months.find(({ id }) => id === today.slice(0, 7))
    ?? (today < start ? months[0] : months.at(-1));
  const monthId = selectedMonth?.id ?? "";
  const summary = useMemo(() => selectedMonth && summarizeMonth(selectedMonth.days), [selectedMonth]);
  const range = useMemo(() => selectRange(days, period, monthId, today), [days, period, monthId, today]);
  const milestones = useMemo(() => {
    if (!range.length) return [];
    if (snapshot) {
      const dateByDay = new Map(range.map(({ number, date }) => [number, date]));
      return snapshot.events.flatMap((event, index) => {
        const date = dateByDay.get(event.d);
        return date ? [{ date, time: `${date}-${index}`, label: event[lang] }] : [];
      });
    }
    if (!legacy) return [];
    return planMilestones(versions, start, today)
      .filter(({ date }) => date >= range[0].date && date <= range[range.length - 1].date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [versions, start, today, range, snapshot, legacy, lang]);
  const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const emptyValue = t("Sin datos");

  return (
    <Screen className="wy-screen">
      <Scroll className="wy-scroll">
        <header className="wy-header">
          <IonButton className="wy-back" fill="clear" aria-label={t("Volver a Inicio")} onClick={() => navigate("home")}>
            <IonIcon slot="icon-only" icon={arrowBackOutline} aria-hidden="true" />
          </IonButton>
          <h1 ref={title} tabIndex={-1}>{t("Año 365")}</h1>
          {selectedMonth && (
            <IonButton
              className="wy-calendar-link"
              fill="clear"
              aria-label={t("Ver calendario")}
              onClick={() => {
                const selectedDay = selectedMonth.days.find(({ date }) => date === today) ?? selectedMonth.days[0];
                calendar.current?.querySelector<HTMLElement>(`[data-plan-day="${selectedDay.number}"]`)?.focus();
              }}
            >
              <IonIcon slot="icon-only" icon={calendarOutline} aria-hidden="true" />
            </IonButton>
          )}
        </header>

        {summary ? (
          <div className="wy-content">
            <section className="wy-card" aria-labelledby="wy-summary">
              <h2 id="wy-summary">{t("Resumen mensual")}</h2>
              <IonSelect
                className="wy-month-select"
                label={t("Mes del plan")}
                interface="popover"
                interfaceOptions={{ animated: !reducedMotion }}
                value={monthId}
                onIonChange={(event) => {
                  setMonth(event.detail.value);
                  setPeriod("month");
                }}
              >
                {months.map(({ id, days: monthDays }) => (
                  <IonSelectOption key={id} value={id}>
                    {monthFormat.format(parseLocalDate(monthDays[0].date)!)}
                  </IonSelectOption>
                ))}
              </IonSelect>
              {summary.count ? (
                <>
                  <dl className="wy-metrics" aria-live="polite">
                    <div><dt>{t("Adherencia media")}</dt><dd>{summary.adherence === null ? emptyValue :
                      new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(summary.adherence / 100)}</dd></div>
                    <div><dt>{t("Variación de peso")}</dt><dd>{summary.weight === null ? emptyValue :
                      bodyMeasurementFormatter("weight", units, locale, true)(summary.weight)}</dd></div>
                    <div><dt>{t("Variación de cintura")}</dt><dd>{summary.waist === null ? emptyValue :
                      bodyMeasurementFormatter("waist", units, locale, true)(summary.waist)}</dd></div>
                    <div><dt>{t("Racha más larga")}</dt><dd>{summary.longestStreak === 1 ? t("1 día") :
                      t("{count} días", { count: numberFormat.format(summary.longestStreak) })}</dd></div>
                  </dl>
                  <p className="wy-note">{t("La racha cuenta días consecutivos con al menos 60 % de adherencia.")}</p>
                </>
              ) : <p role="status">{t("Aún no hay cierres registrados en este mes.")}</p>}
            </section>

            <section className="wy-card" aria-labelledby="wy-curves">
              <h2 id="wy-curves">{t("Curvas de peso y cintura")}</h2>
              <IonSegment
                className="wy-period"
                aria-label={t("Período de las curvas")}
                value={period}
                onIonChange={(event) => {
                  const value = event.detail.value;
                  if (value === "7" || value === "30" || value === "90" || value === "month") setPeriod(value);
                }}
              >
                <IonSegmentButton value="7">{t("{count} días", { count: "7" })}</IonSegmentButton>
                <IonSegmentButton value="30">{t("{count} días", { count: "30" })}</IonSegmentButton>
                <IonSegmentButton value="90">{t("{count} días", { count: "90" })}</IonSegmentButton>
                <IonSegmentButton value="month">{t("Mes")}</IonSegmentButton>
              </IonSegment>
              <MeasurementCurve days={range} milestones={milestones} metric="weightKg" units={units} />
              <MeasurementCurve days={range} milestones={milestones} metric="waistCm" units={units} />
              {!range.some(({ checkin }) => checkin?.weightKg != null || checkin?.waistCm != null) && (
                <p>{t("Registra tus mediciones al cerrar el día o selecciona otro período.")}</p>
              )}
              {milestones.length > 0 && (
                <ul className="wy-milestones" aria-label={t("Hitos del plan")}>
                  {milestones.map((milestone, index) => (
                    <li key={`${milestone.time}-${index}`}>
                      <span aria-hidden="true" />
                      {"label" in milestone
                        ? `${dateFormat.format(parseLocalDate(milestone.date)!)} · ${milestone.label}`
                        : t("Cambio de plan · {date}", { date: dateFormat.format(parseLocalDate(milestone.date)!) })}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section ref={calendar} className="wy-card" aria-labelledby="wy-calendar">
              <h2 id="wy-calendar">{t("Calendario del plan")}</h2>
              <YearCalendar months={months} today={today} initialDay={remote?.today ?? planDay(start)} />
            </section>
          </div>
        ) : (
          <p className="wy-card wy-empty" role="status">{t(motor.kind === "loading" ? "Consultando el plan…" :
            legacy || motor.kind === "unlinked" ? "Tu calendario estará disponible cuando tengas un plan." : "Día del plan no disponible")}</p>
        )}
      </Scroll>
      <VitaEntry module="year" />
    </Screen>
  );
}
