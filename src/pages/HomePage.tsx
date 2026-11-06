import { useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonPopover,
  IonList,
  IonItem,
  IonIcon,
  IonProgressBar,
  IonSkeletonText,
} from "@ionic/react";
import { useI18n } from "../i18n/I18nContext";
import {
  bodyOutline,
  calendarOutline,
  chevronForward,
  clipboardOutline,
  menuOutline,
  personOutline,
  scaleOutline,
  waterOutline,
  checkmarkCircleOutline,
  trophyOutline,
  chatbubbleEllipsesOutline,
  flame,
  medkitOutline,
  micOutline,
  notificationsOutline,
  school,
  restaurantOutline,
  leafOutline,
  arrowForward,
  walk,
  watchOutline,
  water,
} from "ionicons/icons";
import { ProtocolWheel } from "../components/ProtocolWheel";
import { Mascot } from "../components/Mascot";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { PROGRAM_TASKS } from "../data/program";
import { LanguageToggle } from "../components/LanguageToggle";
import { MetricHistoryModal } from "../components/MetricHistoryModal";
import {
  formatMetricValue,
  HOME_METRIC_CARDS,
  resolveHomeCards,
  type HomeMetricCard,
  type MetricId,
} from "../data/metrics";
import { useProgram } from "../hooks/useProgram";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationsModal } from "../components/notifications/NotificationsModal";
import { useMetricsHistory } from "../hooks/useMetricsHistory";
import { useScoresHistory } from "../hooks/useScoresHistory";
import { useWearable } from "../context/WearableContext";
import { deriveIntakeTotals } from "../utils/nutritionIntake";
import { programDayNumber } from "../utils/programDayNumber";
import logoIcon from "../assets/LogoIndividual.png";
import coverComunidad from "../assets/modules/comunidad.png";
import coverPerfil from "../assets/modules/perfil.png";
import type { CSSProperties } from "react";
import type { ProgramDay, Screen as ScreenId } from "../types";

export function HomePage() {
  const {
    user,
    navigate,
    openPanic,
    openVoice,
    pointsTotal: appPointsTotal,
    program: appProgram,
    streak: appStreak,
    programWeek: appProgramWeek,
    realMode,
  } = useApp();
  const { snapshot } = useProgram();
  const activeProgramDay = programDayNumber(snapshot?.template.currentWeekNumber, snapshot?.template.currentWeekStartDateLocal, snapshot?.todayLocalDate);
  const { unreadCount } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuEvent, setMenuEvent] = useState<Event>();
  const { lang, t } = useI18n();

  // Verdad clínica de las tarjetas: metrics-history (bmi/hba1c/fat) +
  // scores-history (dimensions.adherence). Pueden 404 hasta que el backend
  // esté desplegado → el resolver degrada cada tarjeta a requires-data honesto.
  // S4: mientras un query carga SIN cache, las tarjetas de su fuente muestran
  // skeleton — nunca la nota requires-data (afirmación falsa en plena carga).
  const { history: metricsHistory, isLoading: metricsLoading } =
    useMetricsHistory();
  const { history: scoresHistory, isLoading: scoresLoading } =
    useScoresHistory();
  // S3: locale activo para números (es-ES coma decimal / en-US punto).
  const locale = lang === "en" ? "en-US" : "es-ES";

  // Hábitos con verdad real: pasos del anillo (en vivo o serie persistida) y
  // calorías de ingesta del snapshot vs la meta del plan. Sin dato → "Sin
  // datos" en modo real; en demo se conservan las cifras de demostración.
  const { today: deviceToday } = useWearable();
  const intake = useMemo(() => deriveIntakeTotals(snapshot), [snapshot]);
  const stepSeries = metricsHistory?.metrics.find(
    (m) => m.code.toLowerCase() === "step_count",
  );
  const persistedSteps = stepSeries?.points.at(-1)?.value ?? null;
  const stepsValue =
    deviceToday.steps ??
    (persistedSteps != null ? Math.round(persistedSteps) : null);
  const stepsTarget = 8000;
  const kcalTarget =
    snapshot?.todayTasks?.find((task) => task.taskCode === "nut")?.content
      ?.dailyCalorieTarget ?? null;
  const kcalValue = snapshot ? intake.calories : null;

  const [metricId, setMetricId] = useState<MetricId | null>(null);

  // Dos accesos permanentes: sin paginación, arrastre ni autoavance.
  const modules: { id: ScreenId; title: string; sub: string; accent: string; cover: string; cta: string }[] = [
    {
      id: "com",
      title: t("Comunidad"),
      sub: t("Diagnóstico, grupos y apoyo"),
      accent: "var(--mod-com)",
      cover: coverComunidad,
      cta: t("Entrar"),
    },
    {
      id: "prof",
      title: t("Mi perfil"),
      sub: t("Seguros, equipo y ajustes"),
      accent: "var(--mod-profile)",
      cover: coverPerfil,
      cta: t("Ver perfil"),
    },
  ];

  /**
   * Hábitos de la semana. El porcentaje es la fuente del resumen (promedio y
   * cuántos llegan a meta), así no hay cifras escritas a mano que se desfasen.
   */
  const weekGoals = [
    {
      id: "hyd",
      label: t("Hidratación"),
      value: t("7 / 8 vasos"),
      pct: 87,
      color: "var(--brand-blue-mid)",
      icon: water,
    },
    {
      id: "steps",
      label: t("Pasos"),
      value:
        stepsValue != null
          ? `${formatMetricValue(stepsValue, 0, locale)} / ${formatMetricValue(stepsTarget, 0, locale)}`
          : realMode
            ? t("Sin datos")
            : "6,240 / 8,000",
      pct:
        stepsValue != null
          ? Math.min(100, Math.round((stepsValue / stepsTarget) * 100))
          : realMode
            ? 0
            : 78,
      color: "var(--brand-green)",
      icon: walk,
    },
    {
      id: "kcal",
      label: t("Calorías"),
      value:
        kcalValue != null && kcalTarget != null
          ? `${formatMetricValue(kcalValue, 0, locale)} / ${formatMetricValue(kcalTarget, 0, locale)} kcal`
          : realMode
            ? t("Sin datos")
            : "1,650 / 1,800 kcal",
      pct:
        kcalValue != null && kcalTarget
          ? Math.min(100, Math.round((kcalValue / kcalTarget) * 100))
          : realMode
            ? 0
            : 91,
      color: "var(--org)",
      icon: flame,
    },
    {
      id: "edu",
      label: t("Academia"),
      value: t("Módulo 5 de 8"),
      pct: 68,
      color: "var(--pur)",
      icon: school,
    },
  ];
  const weekAvg = Math.round(
    weekGoals.reduce((sum, g) => sum + g.pct, 0) / weekGoals.length,
  );
  const weekOnTarget = weekGoals.filter((g) => g.pct >= 80).length;
  const first = user.nombre.split(" ")[0];
  const today = new Date().toLocaleDateString(
    lang === "en" ? "en-US" : "es-ES",
    { weekday: "long", day: "numeric", month: "long" },
  );

  // Verdad del backend cuando hay snapshot del programa; si no, datos del demo.
  const activeStreak = snapshot?.streak?.current ?? appStreak;
  const activePointsTotal = snapshot?.xp?.balance ?? appPointsTotal;
  const activeProgramWeek =
    snapshot?.template?.currentWeekNumber ?? appProgramWeek;
  // 24 es el total del ciclo que muestra la demo (PROGRAM_WEEKS son las 83
  // semanas del protocolo completo, no lo que anuncia este chip).
  const activeTotalWeeks = snapshot?.template?.totalWeeks ?? 24;
  const program: ProgramDay = useMemo(() => {
    if (!snapshot?.todayTasks?.length) return appProgram;
    const byCode: Record<string, boolean> = {};
    for (const task of snapshot.todayTasks) {
      byCode[task.taskCode] = task.status === "Completed";
    }
    return {
      podcast: Boolean(byCode.podcast),
      vitals: Boolean(byCode.vitals),
      nut: Boolean(byCode.nut),
      ejercicio: Boolean(byCode.ejercicio),
      nutraceutico: Boolean(byCode.nutraceutico),
      emocional: Boolean(byCode.emocional),
    };
  }, [snapshot, appProgram]);

  const missionTotal = snapshot?.todayTasks?.length ?? PROGRAM_TASKS.length;
  const todayDone = PROGRAM_TASKS.filter((task) => program[task.id]).length;
  // La rueda suma el cofre del día como último segmento.
  const todayTotal = missionTotal + 1;
  const dayComplete = todayDone === missionTotal;

  // Serie de adherencia REAL: dimensions.adherence por punto del
  // scores-history (semana persistida con cómputo). Sin puntos → requires-data.
  const adherencePoints = useMemo(
    () =>
      (scoresHistory?.points ?? [])
        .map((p) => ({
          date: p.periodEnd ?? "",
          value: p.dimensions?.adherence ?? null,
        }))
        .filter((p): p is { date: string; value: number } => p.value != null),
    [scoresHistory],
  );

  // Las 5 tarjetas resueltas con la verdad del backend (nada fabricado):
  // imc / hba1c / fat desde metrics-history, adh desde scores-history,
  // pts desde el balance XP real (sin historial falso).
  const cards = useMemo(
    () =>
      resolveHomeCards({
        heightCm: metricsHistory?.heightCm ?? null,
        metrics: metricsHistory?.metrics ?? [],
        adherence: adherencePoints,
        xpBalance: activePointsTotal,
      }),
    [metricsHistory, adherencePoints, activePointsTotal],
  );

  // Nota de tendencia honesta: solo con ≥2 puntos reales; 1 punto → valor sin
  // nota; sin puntos → (no aplica, es requires-data). "↓ desde {first}" es el
  // cambio real desde el primer registro, nunca un delta fabricado.
  const trendNote = (
    card: Extract<HomeMetricCard, { kind: "value" }>,
  ): string | null => {
    if (card.points.length < 2 || card.first == null || card.last == null)
      return null;
    const first = formatMetricValue(card.first, card.decimals, locale);
    if (card.last < card.first) return t("↓ desde {first}", { first });
    if (card.last > card.first) return t("↑ desde {first}", { first });
    return null;
  };

  // S4: estado por tarjeta según la fuente que la alimenta. Solo "loading"
  // cuando su query carga SIN cache (TanStack isLoading); con cache previa o
  // error ya resuelto → data/requires-data (error 404 = sin mediciones aún).
  const cardState = (id: MetricId): "loading" | "data" => {
    const sourceLoading = id === "adh" ? scoresLoading : metricsLoading;
    return sourceLoading && cards[id].kind === "requires-data"
      ? "loading"
      : "data";
  };

  return (
    <Screen>
      <Scroll className="home">
        <header className="hm-head">
          {/* Fondo de identidad decorativo, sin interacción ni datos. */}
          <div className="hm-landscape" aria-hidden="true">
            <i className="hm-leaf hm-leaf-one" />
            <i className="hm-leaf hm-leaf-two" />
            <i className="hm-leaf hm-leaf-three" />
            <Mascot pose="success" className="mascot-home" float={false} />
          </div>
          <div className="hm-head-top">
            <div className="hm-wordmark" aria-label="COPP-ADRESD">
              <img src={logoIcon} alt="" />
              <span>
                <strong>COPP-ADRESD<sup>®</sup></strong>
                <small>COMPREHENSIVE OBESITY<br />PREVENTION PROGRAM</small>
              </span>
            </div>
            <div className="hm-head-actions">
              <IonButton
                fill="clear"
                type="button"
                className="hm-icon-btn hm-bell"
                onClick={() => setNotificationsOpen(true)}
                aria-label={
                  unreadCount > 0
                    ? t("Notificaciones sin leer: {count}", {
                        count: String(unreadCount),
                      })
                    : t("Notificaciones")
                }
              >
                <IonIcon icon={notificationsOutline} />
                {unreadCount > 0 && (
                  <IonBadge className="hm-bell-badge" aria-hidden="true">
                    {unreadCount > 99 ? "99+" : String(unreadCount)}
                  </IonBadge>
                )}
              </IonButton>
              <LanguageToggle />
              <IonButton
                fill="clear"
                className="hm-icon-btn"
                aria-label={t("Abrir menú")}
                aria-haspopup="dialog"
                aria-expanded={Boolean(menuEvent)}
                onClick={(event) => setMenuEvent(event.nativeEvent)}
              >
                <IonIcon icon={menuOutline} />
              </IonButton>
              <IonPopover
                isOpen={Boolean(menuEvent)}
                event={menuEvent}
                onDidDismiss={() => setMenuEvent(undefined)}
                dismissOnSelect
              >
                <IonList>
                  <IonItem button onClick={() => navigate("prof")}>
                    <IonIcon slot="start" icon={personOutline} />
                    {t("Mi perfil")}
                  </IonItem>
                  <IonItem button onClick={() => navigate("body")}>
                    <IonIcon slot="start" icon={bodyOutline} />
                    {t("Visualización del perfil")}
                  </IonItem>
                </IonList>
              </IonPopover>
            </div>
          </div>

          <h1 className="hm-hello">
            {t("Hola,")} <span>{first}</span> <span aria-hidden="true">👋</span>
          </h1>
          <p className="hm-purpose">{t("Tu salud, nuestro propósito.")}</p>

          <div className="hm-day-panel">
            <IonIcon icon={calendarOutline} aria-hidden="true" />
            <div className="hm-day-copy">
              <span>{t("Hoy es")}</span>
              <strong className="hm-date">{today}</strong>
              {activeProgramDay != null && <span className="hm-program-day">{t('Día {day} del programa', { day: String(activeProgramDay) })}</span>}
              <span className="hm-chip navy">
                {t("Semana {cur} de {total}", {
                  cur: String(activeProgramWeek),
                  total: String(activeTotalWeeks),
                })}
              </span>
            </div>
            <IonButton fill="clear" className="hm-day-link" onClick={() => navigate("prog")}>
              <IonIcon icon={clipboardOutline} aria-hidden="true" />
              <span>{t("Protocolo diario")}</span>
              <IonIcon icon={chevronForward} aria-hidden="true" />
            </IonButton>
          </div>
        </header>

        <section className="hm-wheel-card" aria-label={t("Protocolo diario")}>
          <span className="hm-wheel-kicker">{t("Protocolo diario")}</span>
          <ProtocolWheel
            program={program}
            chestClaimed={dayComplete}
            title={t("Protocolo diario")}
            count={todayDone}
            total={todayTotal}
            onSelect={(id) => navigate(id === "chest" ? "program-racha" : `program-${id}`)}
            onOpenProgram={() => navigate("prog")}
          />
          <span className="hm-wheel-foot">
            {activeStreak} {t("días")}/{t("Semana")} {activeProgramWeek}
          </span>
        </section>

        <div className="hm-metrics" aria-label={t("Indicadores de salud")}>
          {HOME_METRIC_CARDS.map((meta) => {
            const card = cards[meta.id];
            const state = cardState(meta.id);
            return (
              <button
                key={meta.id}
                type="button"
                className="hm-metric"
                onClick={() => setMetricId(meta.id)}
                disabled={state === "loading"}
                aria-busy={state === "loading"}
                aria-label={t("Ver historial de {label}", {
                  label: t(meta.label),
                })}
              >
                <span className="hm-metric-icon" aria-hidden="true">
                  {meta.id === "fat" ? "%" : (
                    <IonIcon icon={{
                      imc: scaleOutline,
                      hba1c: waterOutline,
                      adh: checkmarkCircleOutline,
                      pts: trophyOutline,
                    }[meta.id]} />
                  )}
                </span>
                {state === "loading" ? (
                  // S4: skeleton honesto mientras carga la fuente — sin nota
                  // requires-data (patrón de la tarjeta de cita).
                  <span className="hm-metric-skeleton">
                    <IonSkeletonText
                      animated
                      style={{ width: "56%", height: 18 }}
                    />
                    <IonSkeletonText
                      animated
                      style={{ width: "72%", height: 10 }}
                    />
                  </span>
                ) : card.kind === "requires-data" ? (
                  <>
                    <span className="hm-metric-val hm-metric-rd">—</span>
                    <span className="hm-metric-lbl">{t(card.label)}</span>
                  </>
                ) : (
                  <>
                    <span className="hm-metric-val">
                      {formatMetricValue(card.current, card.decimals, locale)}
                      {card.unit ? (
                        <small className="hm-metric-unit">{card.unit}</small>
                      ) : null}
                    </span>
                    <span className="hm-metric-lbl">{t(card.label)}</span>
                    {trendNote(card) ? (
                      <span className="hm-metric-sub">{trendNote(card)}</span>
                    ) : null}
                    {card.progress !== null ? (
                      <span className="hm-metric-bar">
                        <i
                          style={{
                            width: `${Math.round(card.progress * 100)}%`,
                          }}
                        />
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="hm-duo">
          <div className="hm-quick">
            {[
              {
                id: "chat" as const,
                label: t("Chat IA"),
                icon: chatbubbleEllipsesOutline,
                fn: () => navigate("chat"),
              },
              {
                id: "voice" as const,
                label: t("Voz"),
                icon: micOutline,
                fn: openVoice,
              },
              {
                id: "bt" as const,
                label: t("Conectar"),
                icon: watchOutline,
                fn: () => navigate("bt"),
              },
              {
                id: "sos" as const,
                label: t("SOS"),
                icon: medkitOutline,
                fn: openPanic,
                panic: true,
              },
            ].map((a) => (
              <button
                key={a.id}
                type="button"
                className={`hm-quick-btn${a.panic ? " panic" : ""}`}
                onClick={a.fn}
              >
                <span className="hm-quick-ico" aria-hidden="true">
                  <IonIcon icon={a.icon} />
                </span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>

          <IonButton
            className="hm-appt hm-nutrition-card"
            onClick={() => navigate("program-nut")}
            aria-label={t("Abrir protocolo de nutrición")}
          >
            <span className="hm-nutrition-content">
              <span className="hm-appt-tele" aria-hidden="true"><IonIcon icon={restaurantOutline} /></span>
              <span className="hm-appt-time">{t("Nutrición")}</span>
              <span className="hm-appt-name">{t("Tu plan diario")}</span>
              <span className="hm-appt-meta">{t("Tu plan y el registro del día")}</span>
              <span className="hm-appt-chip">{t("Ver plan")}</span>
              <span className="hm-appt-people" aria-hidden="true">
                <span className="hm-nutrition-leaf"><IonIcon icon={leafOutline} /></span>
                <span className="hm-appt-add"><IonIcon icon={arrowForward} /></span>
              </span>
            </span>
          </IonButton>
        </div>

        <div className="sec" id="home-modules-title">{t("Tus módulos")}</div>
        <section className="hm-modules" aria-labelledby="home-modules-title">
          {modules.map(module => <IonButton key={module.id} className="hm-module-card" style={{ "--a": module.accent } as CSSProperties} onClick={() => navigate(module.id)}>
            <span className="hm-module-content">
              <img className="mcar-cover" src={module.cover} alt="" aria-hidden="true" />
              <span className="mcar-txt"><strong>{module.title}</strong><small>{module.sub}</small></span>
              <span className="mcar-cta">{module.cta}<IonIcon icon={arrowForward} aria-hidden="true" /></span>
            </span>
          </IonButton>)}
        </section>

        {!realMode && (
          <>
            <div className="sec">{t("Progreso semanal")}</div>
            <div className="hm-week">
              <div className="hm-week-head">
                <div className="hm-week-score">
                  <strong>{weekAvg}%</strong>
                  <small>{t("Cumplimiento promedio")}</small>
                </div>
                <span className="hm-week-tag">
                  {t("{done} de {total} hábitos en meta", {
                    done: String(weekOnTarget),
                    total: String(weekGoals.length),
                  })}
                </span>
              </div>

              {weekGoals.map((g) => (
                <div
                  key={g.id}
                  className="hm-week-row"
                  style={{ "--a": g.color } as CSSProperties}
                >
                  <span className="hm-week-ico">
                    <IonIcon icon={g.icon} />
                  </span>
                  <div className="hm-week-body">
                    <div className="hm-week-top">
                      <strong>{g.label}</strong>
                      <span>{g.value}</span>
                      <em>{g.pct}%</em>
                    </div>
                    <IonProgressBar
                      className="hm-week-bar"
                      style={
                        { "--progress-background": g.color } as CSSProperties
                      }
                      value={g.pct / 100}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Scroll>
      <MetricHistoryModal
        card={metricId ? cards[metricId] : null}
        onClose={() => setMetricId(null)}
      />
      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </Screen>
  );
}
