import { useMemo } from "react";
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonSpinner,
} from "@ionic/react";
import {
  accessibilityOutline,
  bodyOutline,
  clipboardOutline,
  heartOutline,
  manOutline,
  nutritionOutline,
  pulseOutline,
  scaleOutline,
  shieldCheckmarkOutline,
  speedometerOutline,
  thermometerOutline,
  trendingUpOutline,
  walkOutline,
  waterOutline,
  flaskOutline,
  personOutline,
} from "ionicons/icons";
import {
  normalizeSource,
  SOURCE_LABEL_KEYS,
  SOURCE_META,
} from "../utils/measurement-source";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { useMetricsHistory } from "../hooks/useMetricsHistory";
import { useMyMeasurements } from "../hooks/useMyMeasurements";
import { useProgram } from "../hooks/useProgram";
import { useScoresHistory } from "../hooks/useScoresHistory";
import { useI18n } from "../i18n/I18nContext";
import {
  formatMetricValue,
  resolveHomeCards,
  type HomeMetricCard,
  type MetricId,
} from "../data/metrics";

/**
 * Historia clínica — expediente del paciente construido SOLO con verdad del
 * backend. Ya no hay datos demo: identidad desde AppContext (usuario real),
 * métricas clínicas desde `metrics-history` resueltas con el MISMO builder de
 * las tarjetas del Home (`resolveHomeCards`) y puntajes semanales desde
 * `scores-history`. Las secciones sin fuente real se eliminan (no placeholders).
 */

/** Tarjetas clínicas que el expediente muestra (sin TA/adherencia/puntos). */
const CLINICAL_IDS: readonly MetricId[] = ["imc", "hba1c", "fat"];

/**
 * Formatea una fecha ISO (YYYY-MM-DD) con el locale activo. Regla i18n:
 * las fechas NO pasan por t(); se formatean aparte.
 */
function formatIsoDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formatea el `observedAt` ISO con offset del backend (DateTimeOffset) a
 * dd/mm/aaaa con el locale activo. Solo la fecha (la hora no aporta al
 * expediente); nunca pasa por t().
 */
function formatObservedAt(iso: string, locale: string): string {
  const datePart = iso.split("T")[0] ?? iso;
  return formatIsoDate(datePart, locale);
}

/** Valor numérico con el locale activo (máx. 2 decimales) + símbolo. */
function formatMeasurementValue(
  value: number,
  unitSymbol: string,
  locale: string,
): string {
  const num = value.toLocaleString(locale, { maximumFractionDigits: 2 });
  return unitSymbol ? `${num} ${unitSymbol}` : num;
}

/**
 * Etiqueta legible del origen: mapa compartido (`utils/measurement-source`;
 * alias clínicos como `seed-hist` → "Consulta médica"). El crudo viaja tal
 * cual si aparece un origen desconocido.
 */
const SOURCE_LABELS = SOURCE_LABEL_KEYS;

/**
 * Icono temático por métrica (coincidencia por subcadena sobre código +
 * nombre del backend). Solo presentación: no altera ningún dato ni cálculo.
 */
function metricIcon(code: string, name: string): string {
  const hay = `${code} ${name}`.toLowerCase();
  if (hay.includes("weight") || hay.includes("peso")) return scaleOutline;
  if (hay.includes("height") || hay.includes("talla") || hay.includes("tall"))
    return accessibilityOutline;
  if (hay.includes("waist") || hay.includes("cintura")) return bodyOutline;
  if (hay.includes("hip") || hay.includes("cadera")) return manOutline;
  if (hay.includes("wrist") || hay.includes("muñeca") || hay.includes("muneca"))
    return pulseOutline;
  if (
    hay.includes("fat") ||
    hay.includes("grasa") ||
    hay.includes("imc") ||
    hay.includes("bmi")
  )
    return speedometerOutline;
  if (hay.includes("gluc")) return waterOutline;
  if (hay.includes("hba1c") || hay.includes("a1c")) return flaskOutline;
  if (
    hay.includes("pressure") ||
    hay.includes("presion") ||
    hay.includes("presión") ||
    hay.includes("arterial") ||
    hay.includes("tension") ||
    hay.includes("tensión") ||
    hay.includes("sistol") ||
    hay.includes("diastol")
  )
    return heartOutline;
  if (hay.includes("colest") || hay.includes("trigli")) return nutritionOutline;
  if (hay.includes("temp")) return thermometerOutline;
  if (hay.includes("step") || hay.includes("paso")) return walkOutline;
  return pulseOutline;
}

interface HcRow {
  /** Clave t() del label (la traducción se resuelve al render). */
  label: string;
  /** Params de interpolación del label (ej. semana). */
  params?: Record<string, string>;
  /** Valor ya formateado (números y fechas fuera de t()). */
  value: string;
}

interface HcSection {
  id: string;
  /** Icono Ionicons del encabezado (presentación; antes emoji). */
  icon: string;
  title: string;
  rows: HcRow[];
  loading?: boolean;
  empty?: string;
}

export function HistoryPage() {
  const { user } = useApp();
  const { snapshot, isMockFallback } = useProgram();
  const { history: metricsHistory, isLoading: metricsLoading } =
    useMetricsHistory();
  const { history: scoresHistory, isLoading: scoresLoading } =
    useScoresHistory();
  // Historial clínico completo paginado (sin corte de 365 días ni
  // inscripción: la historia es del paciente, no del programa).
  const {
    items: measurements,
    isLoading: measurementsLoading,
    isFetchingMore: measurementsFetchingMore,
    error: measurementsError,
    hasNextPage: measurementsHasMore,
    loadMore: loadMoreMeasurements,
    reload: reloadMeasurements,
  } = useMyMeasurements();
  const { t, lang } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-ES";

  // Tarjetas clínicas con la verdad de metrics-history (mismo resolver del
  // Home): IMC (con fallback peso/talla), HbA1c y % de grasa. Sin filas →
  // requires-data, nunca un número inventado.
  const cards = useMemo(
    () =>
      resolveHomeCards({
        heightCm: metricsHistory?.heightCm ?? null,
        metrics: metricsHistory?.metrics ?? [],
        adherence: [],
        xpBalance: 0,
      }),
    [metricsHistory],
  );
  const statCards = CLINICAL_IDS.map((id) => cards[id]).filter(
    (card): card is Extract<HomeMetricCard, { kind: "value" }> =>
      card.kind === "value",
  );

  /** Fecha real de la última medición clínica (serie + historial paginado). */
  const updatedIso = useMemo(() => {
    const dates = [
      ...(metricsHistory?.metrics ?? []).flatMap((series) =>
        series.points.map((point) => point.date),
      ),
      ...measurements.map((m) => m.observedAt.split("T")[0] ?? ""),
    ].filter(Boolean);
    return dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null;
  }, [metricsHistory, measurements]);

  const identityRows: HcRow[] = [
    { label: "Nombre", value: user.nombre },
    ...(user.cedula ? [{ label: "Documento", value: user.cedula }] : []),
    ...(user.email ? [{ label: "Correo electrónico", value: user.email }] : []),
  ];

  const metricRows: HcRow[] = statCards.map((card) => {
    const last = card.points[card.points.length - 1];
    const value = [
      `${formatMetricValue(card.current, card.decimals, locale)}${
        card.unit ? ` ${card.unit}` : ""
      }`,
      last?.date ? formatIsoDate(last.date, locale) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { label: card.label, value };
  });

  // Puntajes semanales reales de scores-history (semanas persistidas con
  // cómputo). Sin puntos → la sección completa se omite.
  const scoreRows: HcRow[] = useMemo(() => {
    const points = scoresHistory?.points ?? [];
    return [...points]
      .reverse()
      .map((point) => {
        const parts: string[] = [];
        if (point.healthScore != null) {
          parts.push(`${t("Salud")} ${point.healthScore}`);
        }
        if (point.transformationScore != null) {
          parts.push(`${t("Transformación")} ${point.transformationScore}`);
        }
        if (point.periodEnd) {
          parts.push(formatIsoDate(point.periodEnd, locale));
        }
        return {
          label: "Semana {week}",
          params: { week: String(point.weekNumber) },
          value: parts.join(" · "),
        };
      })
      .filter((row) => row.value.length > 0);
  }, [scoresHistory, t, locale]);

  const sections: HcSection[] = [
    {
      id: "ident",
      icon: personOutline,
      title: "Datos de identificación",
      rows: identityRows,
    },
    {
      id: "lab",
      icon: flaskOutline,
      title: "Resultados de laboratorio",
      rows: metricRows,
      loading: metricsLoading && metricRows.length === 0,
      empty: "Aún no hay resultados de laboratorio registrados",
    },
  ];
  if (scoresLoading || scoreRows.length > 0) {
    sections.push({
      id: "prog",
      icon: trendingUpOutline,
      title: "Seguimiento del programa",
      rows: scoreRows,
      loading: scoresLoading && scoreRows.length === 0,
    });
  }

  // Semana del programa SOLO desde el snapshot real; el fallback mock de
  // useProgram (sin cache) no se pinta como si fuera verdad del servidor.
  const programWeek = isMockFallback
    ? undefined
    : snapshot?.template?.currentWeekNumber;
  const totalWeeks = isMockFallback
    ? undefined
    : snapshot?.template?.totalWeeks;

  return (
    <Screen>
      <Scroll className="hc">
        <header className="hc-head">
          <div className="hc-head-top">
            <div>
              <span className="hc-kicker">{t("Expediente clínico")}</span>
              <h1 className="hc-title">{t("Historia clínica")}</h1>
              {updatedIso ? (
                <p className="hc-date">
                  {t("Actualizada {date}", {
                    date: formatIsoDate(updatedIso, locale),
                  })}
                </p>
              ) : null}
            </div>
            <span className="hc-shield" aria-hidden="true">
              <IonIcon icon={shieldCheckmarkOutline} />
            </span>
          </div>

          <div className="hc-chips">
            <span className="hc-chip green">{t("HIPAA protegida")}</span>
            {programWeek != null && totalWeeks != null ? (
              <span className="hc-chip navy">
                {t("Semana {cur} de {total}", {
                  cur: String(programWeek),
                  total: String(totalWeeks),
                })}
              </span>
            ) : null}
          </div>
        </header>

        <div className="hc-patient">
          <span className="hc-patient-kicker">{t("Paciente")}</span>
          <strong className="hc-patient-name">{user.nombre}</strong>
          {user.cedula ? (
            <span className="hc-patient-meta">{user.cedula}</span>
          ) : null}
          {metricsLoading && statCards.length === 0 ? (
            <div className="hc-patient-stats" aria-busy="true">
              {CLINICAL_IDS.map((id) => (
                <div key={id} className="hc-stat">
                  <IonSkeletonText
                    animated
                    style={{ width: 46, height: 20, margin: "2px 0 4px" }}
                  />
                  <IonSkeletonText animated style={{ width: 34, height: 10 }} />
                </div>
              ))}
            </div>
          ) : statCards.length > 0 ? (
            <div className="hc-patient-stats">
              {statCards.map((card) => (
                <div key={card.id} className="hc-stat">
                  <b>
                    {formatMetricValue(card.current, card.decimals, locale)}
                    <i>{card.unit}</i>
                  </b>
                  <small>{t(card.label)}</small>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="sec">{t("Secciones del expediente")}</div>

        <IonAccordionGroup className="hc-acc" value="ident">
          {sections.map((s) => (
            <IonAccordion key={s.id} value={s.id}>
              <IonItem slot="header" lines="none">
                <span className="hc-acc-ico" aria-hidden="true">
                  <IonIcon icon={s.icon} />
                </span>
                <IonLabel>{t(s.title)}</IonLabel>
              </IonItem>
              <div slot="content" className="hc-acc-body">
                {s.loading ? (
                  <div aria-busy="true">
                    {[0, 1].map((i) => (
                      <div key={i} className="hc-row">
                        <span className="hc-lbl">
                          <IonSkeletonText
                            animated
                            style={{ width: 64, height: 11 }}
                          />
                        </span>
                        <span className="hc-val">
                          <IonSkeletonText
                            animated
                            style={{ width: "72%", height: 12 }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : s.rows.length === 0 ? (
                  s.empty ? (
                    <p className="hc-empty">{t(s.empty)}</p>
                  ) : null
                ) : (
                  s.rows.map((row) => (
                    <div
                      key={`${s.id}-${row.label}-${row.value}`}
                      className="hc-row"
                    >
                      <span className="hc-lbl">{t(row.label, row.params)}</span>
                      <strong className="hc-val">{row.value}</strong>
                    </div>
                  ))
                )}
              </div>
            </IonAccordion>
          ))}
          <IonAccordion value="meas">
            <IonItem slot="header" lines="none">
              <span className="hc-acc-ico" aria-hidden="true">
                <IonIcon icon={clipboardOutline} />
              </span>
              <IonLabel>{t("Historial de mediciones")}</IonLabel>
              {measurements.length > 0 ? (
                <IonBadge slot="end" color="primary">
                  {measurements.length}
                </IonBadge>
              ) : null}
            </IonItem>
            <div slot="content" className="hc-acc-body">
              {measurementsLoading && measurements.length === 0 ? (
                <div aria-busy="true">
                  {[0, 1].map((i) => (
                    <div key={i} className="hc-row">
                      <span className="hc-lbl">
                        <IonSkeletonText
                          animated
                          style={{ width: 64, height: 11 }}
                        />
                      </span>
                      <span className="hc-val">
                        <IonSkeletonText
                          animated
                          style={{ width: "72%", height: 12 }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              ) : measurements.length === 0 ? (
                measurementsError ? (
                  <div className="hc-err">
                    <IonNote color="danger">
                      {t("No se pudieron cargar las mediciones")}
                    </IonNote>
                    <IonButton
                      fill="outline"
                      color="danger"
                      style={{ minHeight: 44 }}
                      onClick={() => void reloadMeasurements()}
                    >
                      {t("Reintentar")}
                    </IonButton>
                  </div>
                ) : (
                  <p className="hc-empty">
                    {t(
                      "Aún no hay mediciones registradas en tu historial clínico",
                    )}
                  </p>
                )
              ) : (
                <>
                  <IonList className="hc-meas-list" lines="none">
                    {measurements.map((m) => {
                      const sourceKey = normalizeSource(m.source);
                      const meta = SOURCE_META[sourceKey];
                      return (
                        <IonItem key={m.id} lines="none" className="hc-meas">
                          <span className="hc-meas-ico" aria-hidden="true">
                            <IonIcon
                              icon={metricIcon(m.metricCode, m.metricName)}
                            />
                          </span>
                          <IonLabel>
                            <h2>{m.metricName}</h2>
                            <p>
                              <strong>
                                {formatMeasurementValue(
                                  m.value,
                                  m.unitSymbol,
                                  locale,
                                )}
                              </strong>
                              <span className="hc-meas-date">
                                {formatObservedAt(m.observedAt, locale)}
                              </span>
                            </p>
                          </IonLabel>
                          <IonBadge
                            slot="end"
                            className={`hc-src ${meta?.className ?? "hc-src-prof"}`}
                          >
                            {meta ? (
                              <IonIcon icon={meta.icon} aria-hidden="true" />
                            ) : null}
                            {SOURCE_LABELS[sourceKey]
                              ? t(SOURCE_LABELS[sourceKey])
                              : m.source}
                          </IonBadge>
                        </IonItem>
                      );
                    })}
                  </IonList>
                  {measurementsError ? (
                    <div className="hc-err">
                      <IonNote color="danger">
                        {t("No se pudieron cargar las mediciones")}
                      </IonNote>
                      <IonButton
                        fill="outline"
                        color="danger"
                        style={{ minHeight: 44 }}
                        onClick={() => void reloadMeasurements()}
                      >
                        {t("Reintentar")}
                      </IonButton>
                    </div>
                  ) : null}
                  {measurementsHasMore ? (
                    <IonButton
                      expand="block"
                      fill="outline"
                      className="hc-more"
                      style={{ minHeight: 44 }}
                      disabled={measurementsFetchingMore}
                      onClick={() => void loadMoreMeasurements()}
                    >
                      {measurementsFetchingMore ? (
                        <>
                          <IonSpinner name="crescent" aria-hidden="true" />
                          <span>{t("Cargando…")}</span>
                        </>
                      ) : (
                        t("Cargar mediciones anteriores")
                      )}
                    </IonButton>
                  ) : null}
                </>
              )}
            </div>
          </IonAccordion>
        </IonAccordionGroup>
      </Scroll>
    </Screen>
  );
}
