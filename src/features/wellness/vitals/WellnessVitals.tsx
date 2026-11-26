import { WellnessGuidance } from "../WellnessGuidance";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  IonBadge, IonButton, IonIcon, IonInput, IonSegment, IonSegmentButton,
  IonSelect, IonSelectOption,
} from "@ionic/react";
import { arrowBackOutline } from "ionicons/icons";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { formatDateForDisplay } from "../../../utils/dates";
import { checkinOwner } from "../checkin/checkin-store";
import { parseNumberInput } from "../domain/draft";
import {
  displayUnit, hasUnitPrefs, loadUnitPrefs, saveUnitPrefs, toDisplayValue, UNIT_OPTIONS,
} from "./unit-prefs";
import {
  loadVitals, saveVital, validVitalValue, VITAL_METRIC_IDS, VITAL_METRICS, VITAL_SOURCES,
} from "./vitals-store";
import type { VitalDay, VitalMetric, VitalReading, Vitals, VitalSource, VitalValue } from "./vitals-store";
import { calendarDays, TREND_LABELS, VITAL_WINDOWS, vitalHistory, vitalSeries, vitalTrend } from "./vitals-trend";
import type { VitalWindow } from "./vitals-trend";
import "../protocol/wellness-protocol.css";
import "./wellness-vitals.css";
import { VitaEntry } from "../vita";

function latestDay(vitals: Vitals, metric: VitalMetric) {
  const days = vitals[metric] ?? {};
  return days[Object.keys(days).sort().at(-1) ?? ""];
}

export function WellnessVitals() {
  const { user, navigate, vitalsReturnTo } = useApp();
  const { t } = useI18n();
  const owner = checkinOwner(user);
  const back = vitalsReturnTo ?? "protocol";
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  return (
    <Screen>
      <div className="wv-notice">
        <WellnessGuidance kind="vitals" />
      </div>
      <Scroll className="wp-scroll wv-scroll">
        <header className="wp-hero wp-hero-top wv-hero">
          <IonButton fill="clear" className="wv-back" onClick={() => navigate(back)}
            aria-label={t(back === "prof" ? "Volver al perfil" : "Volver al protocolo")}>
            <IonIcon slot="icon-only" icon={arrowBackOutline} aria-hidden="true" />
          </IonButton>
          <h1 className="wp-title" ref={title} tabIndex={-1}>{t("Signos vitales")}</h1>
        </header>
        <VitalsContent key={owner} owner={owner} />
      </Scroll>
      <VitaEntry module="vitals" />
    </Screen>
  );
}

function VitalsContent({ owner }: { owner: string }) {
  const { t, lang } = useI18n();
  const [ledger, setLedger] = useState(() => readLedger(owner));
  const [prefs, setPrefs] = useState(() => loadUnitPrefs(owner));
  const [metric, setMetric] = useState<VitalMetric>("heartRate");
  const [windowDays, setWindowDays] = useState<VitalWindow>(7);
  const [now, setNow] = useState(() => new Date());
  const [source, setSource] = useState<VitalSource>("manual");
  const [raw, setRaw] = useState("");
  const [secondRaw, setSecondRaw] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const saveInProgress = useRef(false);
  const formTitle = useRef<HTMLHeadingElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const primaryInput = useRef<HTMLIonInputElement>(null);
  const secondaryInput = useRef<HTMLIonInputElement>(null);

  useEffect(() => {
    const refresh = () => {
      setLedger(readLedger(owner));
      setNow(new Date());
    };
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(refresh, Math.max(1, midnight.getTime() - Date.now()));
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [owner, now]);

  const number = new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CO", {
    maximumFractionDigits: 2,
  });
  const time = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "es-CO", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC",
  });
  const showUnit = (unit: string) => unit === "pasos" ? t("pasos") : unit === "lpm" ? t("lpm") : unit;
  const unit = showUnit(displayUnit(metric, prefs));
  const meta = VITAL_METRICS[metric];
  const history = vitalHistory(ledger.vitals, metric, windowDays, now);
  const trend = vitalTrend(metric, history);
  const pressure = metric === "bloodPressure";
  const value = parseNumberInput(raw.trim());
  const second = parseNumberInput(secondRaw.trim());
  const reading = pressure
    ? value !== null && second !== null ? { systolic: value, diastolic: second } : null
    : value;
  const validation = t(pressure
    ? "Ingresa dos valores positivos. La sistólica debe ser mayor que la diastólica."
    : "Revisa el valor y la unidad de la medición.");
  const primaryInvalid = error === validation && (pressure ? value === null || value <= 0 : true);
  const secondaryInvalid = error === validation && pressure &&
    (second === null || second <= 0 || (value !== null && value <= second));

  function clearFeedback() {
    setError(undefined);
    setSaved(false);
  }

  function selectMetric(next: VitalMetric) {
    if (saveInProgress.current) return;
    if (next !== metric) {
      setMetric(next);
      setRaw("");
      setSecondRaw("");
      setSource("manual");
      clearFeedback();
    }
    formTitle.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInProgress.current || ledger.error) return;
    if (reading === null || !validVitalValue(metric, reading)) {
      setSaved(false);
      setError(validation);
      const ref = pressure && value !== null && value > 0 ? secondaryInput : primaryInput;
      void ref.current?.setFocus?.();
      return;
    }
    saveInProgress.current = true;
    setPending(true);
    clearFeedback();
    try {
      const measuredAt = new Date();
      const vitals = await saveVital(owner, metric, reading, source, measuredAt);
      setLedger({ vitals, error: false });
      setNow(measuredAt);
      setRaw("");
      setSecondRaw("");
      setSaved(true);
    } catch {
      setError(t("No se pudo guardar la medición. Inténtalo de nuevo."));
    } finally {
      saveInProgress.current = false;
      setPending(false);
    }
  }

  useEffect(() => {
    if (error && error !== validation) errorMessage.current?.focus();
  }, [error, validation]);

  function changeUnit(next: string) {
    const updated = { ...prefs, [metric]: next };
    try {
      saveUnitPrefs(owner, updated);
      setPrefs(updated);
      clearFeedback();
    } catch {
      setError(t("No se pudo guardar la unidad de visualización."));
    }
  }

  function formatValue(id: VitalMetric, value: VitalValue) {
    const values = vitalSeries(value).map((entry) => number.format(toDisplayValue(id, entry, prefs)));
    return values.join("/") + " " + showUnit(displayUnit(id, prefs));
  }

  function details(entry: VitalReading, date: string) {
    const recordedTime = new Date(Date.parse(entry.measuredAt) - entry.timezoneOffset * 60_000);
    return (
      <span className="wv-meta">
        <IonBadge className={`wv-source wv-source-${entry.source}`}>{t(VITAL_SOURCES[entry.source])}</IonBadge>
        <time dateTime={entry.measuredAt}>{formatDateForDisplay(date)} · {time.format(recordedTime)}</time>
      </span>
    );
  }

  return (
    <div className="wv-content">
      <section aria-labelledby="wv-metrics">
        <h2 id="wv-metrics">{t("Mediciones")}</h2>
        {ledger.error && (
          <p className="wv-message wv-error" role="alert">{t("No se pudo leer el historial de signos vitales.")}</p>
        )}
        <ul className="wv-metrics">
          {VITAL_METRIC_IDS.map((id) => {
            const latest = latestDay(ledger.vitals, id);
            return (
              <li key={id}>
                <IonButton className="wv-metric" fill="outline" aria-pressed={id === metric}
                  aria-controls="wv-detail" onClick={() => selectMetric(id)}>
                  <span className="wv-metric-content">
                    <span>{t(VITAL_METRICS[id].label)}</span>
                    {latest
                      ? <><strong>{formatValue(id, latest.value)}</strong>{details(latest, latest.date)}</>
                      : <span className="wv-empty">{t(ledger.error ? "No disponible" : "Sin registros")}</span>}
                  </span>
                </IonButton>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="wp-card wv-detail" id="wv-detail" aria-labelledby="wv-detail-title">
        <h2 ref={formTitle} tabIndex={-1} id="wv-detail-title">{t(meta.label)}</h2>
        <form className="wv-form" noValidate onSubmit={submit}>
          <h3>{t("Registrar medición")}</h3>
          <div className={pressure ? "wv-fields wv-fields-pressure" : "wv-fields"}>
            <IonInput ref={primaryInput} name="vital-value" label={t("{measurement} ({unit})", {
              measurement: t(pressure ? "Sistólica" : meta.label), unit: showUnit(meta.unit),
            })} labelPlacement="stacked" fill="outline" type="text"
              inputmode={metric === "steps" ? "numeric" : "decimal"} value={raw} required disabled={pending}
              className={primaryInvalid ? "ion-invalid ion-touched" : undefined} errorText={validation}
              onIonInput={(event) => { setRaw(event.detail.value ?? ""); clearFeedback(); }} />
            {pressure && (
              <IonInput ref={secondaryInput} name="vital-diastolic" label={t("{measurement} ({unit})", {
                measurement: t("Diastólica"), unit: meta.unit,
              })} labelPlacement="stacked" fill="outline" type="text" inputmode="decimal"
                value={secondRaw} required disabled={pending}
                className={secondaryInvalid ? "ion-invalid ion-touched" : undefined} errorText={validation}
                onIonInput={(event) => { setSecondRaw(event.detail.value ?? ""); clearFeedback(); }} />
            )}
          </div>
          <IonSelect label={t("Origen de la medición")} value={source} disabled={pending}
            labelPlacement="stacked" fill="outline" cancelText={t("Cancelar")} okText={t("Aceptar")}
            onIonChange={(event) => { setSource(event.detail.value); clearFeedback(); }}>
            {Object.entries(VITAL_SOURCES).map(([id, label]) => (
              <IonSelectOption key={id} value={id}>{t(label)}</IonSelectOption>
            ))}
          </IonSelect>
          <IonButton className="wp-primary" expand="block" type="submit" disabled={pending || ledger.error}>
            {t("Guardar medición")}
          </IonButton>
        </form>
        <p className="wv-message" role="status">{saved ? t("Medición guardada en este dispositivo.") : ""}</p>
        {error && (
          <p className="wv-message wv-error" ref={errorMessage} tabIndex={-1} role="alert">{error}</p>
        )}

        <section className="wv-history" aria-labelledby="wv-history-title">
          <h3 id="wv-history-title">{t("Historial")}</h3>
          {hasUnitPrefs(metric) && (
            <IonSelect label={t("Unidad de visualización")} labelPlacement="stacked"
              fill="outline" value={prefs[metric]} interface="popover"
              onIonChange={(event) => changeUnit(event.detail.value)}>
              {UNIT_OPTIONS[metric].map((option) => (
                <IonSelectOption key={option} value={option}>{option}</IonSelectOption>
              ))}
            </IonSelect>
          )}
          <IonSegment aria-label={t("Período del historial")} value={String(windowDays)}
            onIonChange={(event) => {
              const days = VITAL_WINDOWS.find((option) => String(option) === event.detail.value);
              if (days) setWindowDays(days);
            }}>
            {VITAL_WINDOWS.map((days) => (
              <IonSegmentButton key={days} value={String(days)}>
                {t("{days} días", { days: String(days) })}
              </IonSegmentButton>
            ))}
          </IonSegment>
          {!history.length ? (
            !ledger.error && <p className="wv-empty">{t("Sin registros en este período.")}</p>
          ) : (
            <>
              <VitalChart history={history} metric={metric} unit={unit}
                convert={(value) => toDisplayValue(metric, value, prefs)} format={(value) => number.format(value)} />
              {trend && (
                <div className="wv-trend" role="status">
                  <strong>{t("Tendencia: {trend}", { trend: t(TREND_LABELS[trend]) })}</strong>
                  <p>{t("La tendencia compara la estabilidad de tus registros. Más estabilidad se muestra como «Mejorando».")}</p>
                </div>
              )}
              <ol className="wv-days">
                {[...history].reverse().map((day) => (
                  <li key={day.date} className="wv-day">
                    <div className="wv-reading"><strong>{formatValue(metric, day.value)}</strong>{details(day, day.date)}</div>
                    {day.previous.length > 0 && (
                      <div className="wv-previous">
                        <h4>{t("Cambios del día")}</h4>
                        <ol>
                          {day.previous.map((entry, index) => (
                            <li className="wv-reading" key={index}>
                              <span>{formatValue(metric, entry.value)}</span>{details(entry, day.date)}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </section>
    </div>
  );
}

function readLedger(owner: string): { vitals: Vitals; error: boolean } {
  try {
    return { vitals: loadVitals(owner), error: false };
  } catch {
    return { vitals: {}, error: true };
  }
}

function VitalChart({ history, metric, unit, convert, format }: {
  history: VitalDay[];
  metric: VitalMetric;
  unit: string;
  convert: (value: number) => number;
  format: (value: number) => string;
}) {
  const { t } = useI18n();
  const first = history[0].date;
  const last = history[history.length - 1].date;
  const duration = calendarDays(first, last);
  const series = VITAL_METRICS[metric].series.map((_, index) =>
    history.map(({ date, value }) => ({ date, value: convert(vitalSeries(value)[index]) })),
  );
  const values = series.flatMap((points) => points.map((point) => point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const x = (date: string) => duration ? 8 + 224 * calendarDays(first, date) / duration : 120;
  const y = (value: number) => range ? 70 - 60 * (value - min) / range : 40;
  const dates = first === last ? formatDateForDisplay(first)
    : formatDateForDisplay(first) + " – " + formatDateForDisplay(last);
  return (
    <figure className="wv-chart">
      <figcaption>
        {t("Gráfica de {measurement} ({unit})", { measurement: t(VITAL_METRICS[metric].label), unit })}
      </figcaption>
      <div className="wv-plot">
        <span aria-hidden="true" className="wv-y-axis">
          <span>{format(max)}</span>{range > 0 && <span>{format(min)}</span>}
        </span>
        <svg viewBox="0 0 240 80" role="img"
          aria-label={t("{dates}. Mínimo {min}, máximo {max} {unit}. Los valores por fecha están en el historial.", {
            dates, min: format(min), max: format(max), unit,
          })}>
          <path className="wv-grid" d="M8 10H232 M8 40H232 M8 70H232" />
          {series.map((points, index) => (
            <g key={index} className={`wv-series wv-series-${index}`}>
              <polyline points={points.map((point) => `${x(point.date)},${y(point.value)}`).join(" ")} />
              {points.map((point) => <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r="3" />)}
            </g>
          ))}
        </svg>
      </div>
      <p className="wv-dates" aria-hidden="true">{dates}</p>
      {metric === "bloodPressure" && (
        <ul className="wv-legend">
          {VITAL_METRICS[metric].series.map((label, index) => (
            <li key={label}><span aria-hidden="true" className={`wv-key wv-key-${index}`} />{t(label)}</li>
          ))}
        </ul>
      )}
    </figure>
  );
}
