import { memo, useId, useMemo } from "react";
import { IonIcon } from "@ionic/react";
import { analyticsOutline } from "ionicons/icons";
import { useI18n } from "../../../i18n/I18nContext";
import { parseLocalDate } from "../state/wellness-home-store";
import { bodyMeasurementFormatter } from "../vitals/unit-prefs";
import type { UnitPrefs } from "../vitals/unit-prefs";
import { readings } from "./year-data";
import type { Measurement, PlanDay, planMilestones } from "./year-data";

interface Props {
  days: readonly PlanDay[];
  milestones: ReturnType<typeof planMilestones>;
  metric: Measurement;
  units: UnitPrefs;
}

export const MeasurementCurve = memo(function MeasurementCurve({ days, milestones, metric, units }: Props) {
  const { t, lang } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const titleId = useId();
  const descId = useId();
  const areaId = useId();
  const points = useMemo(() => readings(days, metric), [days, metric]);
  const title = metric === "weightKg" ? t("Peso") : t("Cintura");
  if (!points.length) {
    return (
      <figure className="wy-curve">
        <figcaption>{title}</figcaption>
        <div className="wy-curve-empty">
          <IonIcon icon={analyticsOutline} aria-hidden="true" />
          <p>{t("Sin mediciones en este período.")}</p>
        </div>
      </figure>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const from = days[0];
  const to = days[days.length - 1];
  const width = 320;
  const height = 104;
  const values = points.map(({ value }) => value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const x = (day: number) => from.number === to.number ? width / 2 :
    8 + (day - from.number) * (width - 16) / (to.number - from.number);
  const y = (value: number) => low === high ? height / 2 :
    12 + (high - value) * (height - 24) / (high - low);
  const format = bodyMeasurementFormatter(metric === "weightKg" ? "weight" : "waist", units, locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const datesByNumber = new Map(days.map(({ date, number }) => [date, number]));
  const markers = [...new Set(milestones.map(({ date }) => datesByNumber.get(date)))]
    .filter((day) => day !== undefined);
  const line = points.map(({ number, value }) => `${x(number)},${y(value)}`).join(" ");
  const area = `M ${x(first.number)},${height - 8} L ${line} L ${x(last.number)},${height - 8} Z`;

  return (
    <figure className="wy-curve">
      <figcaption>{title}<strong>{format(last.value)}</strong></figcaption>
      <div className="wy-chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId} aria-describedby={descId}>
          <title id={titleId}>{t("Curva de {metric}", { metric: title })}</title>
          <desc id={descId}>
            {t("Mediciones: {count}. Primera: {first}. Última: {last}. Mínima: {min}. Máxima: {max}.", {
              count: new Intl.NumberFormat(locale).format(points.length),
              first: format(first.value),
              last: format(last.value),
              min: format(low),
              max: format(high),
            })}
          </desc>
          <defs>
            <linearGradient id={areaId} x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--teal)" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {[12, height / 2, height - 12].map((guide) => (
            <line key={guide} className="wy-guide" x1={8} x2={width - 8} y1={guide} y2={guide} />
          ))}
          {points.length > 1 && <path className="wy-area" d={area} fill={`url(#${areaId})`} />}
          {markers.map((number) => (
            <g key={number} className="wy-marker">
              <line x1={x(number)} x2={x(number)} y1={8} y2={height} />
              <circle cx={x(number)} cy={8} r={4} />
            </g>
          ))}
          <polyline className={`wy-line wy-${metric}`} points={line} />
          {points.map(({ number, value, date }) => (
            <circle key={date} className={`wy-point wy-${metric}`} cx={x(number)} cy={y(value)} r={3.5}>
              <title>{dateFormat.format(parseLocalDate(date)!)} · {format(value)}</title>
            </circle>
          ))}
        </svg>
        <span className="wy-plot-max">{format(high)}</span>
        {low !== high && <span className="wy-plot-min">{format(low)}</span>}
        <div className="wy-axis" aria-hidden="true">
          <time dateTime={from.date}>{dateFormat.format(parseLocalDate(from.date)!)}</time>
          {to.date !== from.date && <time dateTime={to.date}>{dateFormat.format(parseLocalDate(to.date)!)}</time>}
        </div>
      </div>
    </figure>
  );
});
