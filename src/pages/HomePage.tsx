import { useMemo, useState } from "react";
import {
  IonAvatar,
  IonBadge,
  IonIcon,
  IonProgressBar,
  IonSkeletonText,
} from "@ionic/react";
import { useI18n } from "../i18n/I18nContext";
import {
  add,
  bodyOutline,
  chatbubbleEllipsesOutline,
  flame,
  medkitOutline,
  micOutline,
  notificationsOutline,
  refreshOutline,
  school,
  videocamOutline,
  walk,
  watchOutline,
  water,
} from "ionicons/icons";
import {
  ModuleCarousel,
  type CarouselModule,
} from "../components/ModuleCarousel";
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
import logoIcon from "../assets/LogoIndividual.png";
import coverCitas from "../assets/modules/citas.png";
import coverComunidad from "../assets/modules/comunidad.png";
import coverCuerpo from "../assets/modules/cuerpo.png";
import coverHistoria from "../assets/modules/historia.png";
import coverNutricion from "../assets/modules/nutricion.png";
import coverPerfil from "../assets/modules/perfil.png";
import doctorAvatar from "../assets/home/doctor-avatar.png";
import type { CSSProperties } from "react";
import type { ProgramDay, Screen as ScreenId } from "../types";

export function HomePage() {
  const {
    user,
    navigate,
    openPanic,
    openVoice,
    pointsTotal: appPointsTotal,
    wearableConnected,
    program: appProgram,
    streak: appStreak,
    programWeek: appProgramWeek,
    realMode,
    upcomingAppointments,
    appointmentsLoading,
    appointmentsError,
    refreshAppointments,
    openRoom,
  } = useApp();
  const { snapshot } = useProgram();
  const { unreadCount } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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

  // Cita destacada real (modo sesión) — misma tarjeta, dato del backend.
  const featuredReal =
    realMode && upcomingAppointments && upcomingAppointments.length > 0
      ? upcomingAppointments[0]
      : undefined;
  const [metricId, setMetricId] = useState<MetricId | null>(null);

  /**
   * La tarjeta de cita siempre ocupa su celda junto a los accesos rápidos: sin
   * datos del backend muestra carga, error o vacío en vez de desaparecer (eso
   * reordenaba el inicio y rompía la distribución del diseño).
   */
  const apptState = !realMode
    ? "demo"
    : featuredReal
      ? "ready"
      : appointmentsLoading
        ? "loading"
        : appointmentsError
          ? "error"
          : "empty";
  const openAppt = () => {
    if (featuredReal) openRoom(featuredReal);
    else if (apptState === "error") void refreshAppointments();
    else navigate("book");
  };
  const apptCopy = {
    demo: {
      time: "15:00 · " + t("Hoy"),
      name: "Dr. Carlos Ramírez",
      meta: t("Telemedicina · Control semana 12"),
      chip: t("Unirse"),
      label: t("Unirse a tu cita"),
    },
    ready: {
      time: `${featuredReal?.time ?? ""} · ${t(featuredReal?.day ?? "Hoy")}`,
      name: featuredReal?.name ?? "",
      meta: featuredReal
        ? `${t(featuredReal.mode)} · ${t(featuredReal.motivo)}`
        : "",
      chip: t("Unirse"),
      label: t("Unirse a tu cita"),
    },
    loading: {
      time: "",
      name: "",
      meta: "",
      chip: "",
      label: t("Cargando tus citas"),
    },
    empty: {
      time: t("Sin citas"),
      name: t("Agenda tu control"),
      meta: t("Elige profesional y horario disponible"),
      chip: t("Agendar"),
      label: t("Agendar una cita"),
    },
    error: {
      time: t("Sin datos"),
      name: t("No pudimos cargar tus citas"),
      meta: t("Revisa tu conexión e intenta de nuevo"),
      chip: t("Reintentar"),
      label: t("Reintentar cargar tus citas"),
    },
  }[apptState];

  /**
   * Módulos del carrusel. El dato vivo solo se declara donde hay una verdad
   * que mostrar; el resto se apoya en su descripción. El acento (`--mod-*`)
   * identifica al módulo en la tarjeta, el botón y el punto de paginación.
   */
  const modules: (CarouselModule & { id: ScreenId })[] = [
    {
      id: "book",
      title: t("Citas"),
      sub: t("Agenda, control y telemedicina"),
      accent: "var(--mod-appt)",
      cover: coverCitas,
      cta: t("Ver agenda"),
      data: featuredReal
        ? `${featuredReal.time} · ${t(featuredReal.day)}`
        : realMode
          ? t("Sin citas")
          : t("Hoy 3:00 PM"),
    },
    {
      id: "nut",
      title: t("Nutrición"),
      sub: t("Tu plan y el registro del día"),
      accent: "var(--mod-nut)",
      cover: coverNutricion,
      cta: t("Ver plan"),
      data: realMode ? t("Sin datos") : t("1,650 / 1,800 kcal"),
    },
    {
      id: "body",
      title: t("Visualización del perfil"),
      sub: t("Índices y mediciones corporales"),
      accent: "var(--mod-body)",
      cover: coverCuerpo,
      cta: t("Ver mi cuerpo"),
    },
    {
      id: "hc",
      title: t("Historia clínica"),
      sub: t("Diagnósticos, lab y medicamentos"),
      accent: "var(--mod-record)",
      cover: coverHistoria,
      cta: t("Abrir expediente"),
    },
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
  const initials =
    user.nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "ME";
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
  const nextServerTask = snapshot?.todayTasks?.find(
    (task) => task.status !== "Completed",
  );
  const nextFallbackTask = PROGRAM_TASKS.find((task) => !program[task.id]);
  const nextTaskTitle = nextServerTask?.title || nextFallbackTask?.title || "";
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
          <Mascot pose="success" className="mascot-home" />
          <div className="hm-head-top">
            <button
              type="button"
              className="hm-avatar"
              onClick={() => navigate("prof")}
              aria-label={t("Abrir perfil")}
            >
              {initials}
            </button>
            <div className="hm-head-actions">
              <button
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
              </button>
              {/* Atajo directo al perfil corporal: es el módulo que más se
                  consulta y estaba a dos toques desde el inicio. */}
              <button
                type="button"
                className="hm-icon-btn"
                onClick={() => navigate("body")}
                aria-label={t("Abrir visualización del perfil")}
              >
                <IonIcon icon={bodyOutline} />
              </button>
              <img src={logoIcon} alt="COPP-ADRESD" className="hm-brand" />
            </div>
          </div>

          <h1 className="hm-hello">
            {t("Hola,")} {first}
          </h1>
          <div className="hm-date">{today}</div>

          <div className="hm-chips">
            <span className="hm-chip navy">
              {t("Semana {cur} de {total}", {
                cur: String(activeProgramWeek),
                total: String(activeTotalWeeks),
              })}
            </span>
            <LanguageToggle />
          </div>
        </header>

        <button
          type="button"
          className="hm-wheel-card"
          onClick={() => navigate("prog")}
          aria-label={
            dayComplete
              ? t("Programa de hoy completado. Abrir protocolo.")
              : t(
                  "Programa de hoy. Siguiente: {next}. {done} de {total} misiones.",
                  {
                    next: nextTaskTitle || t("continuar"),
                    done: String(todayDone),
                    total: String(missionTotal),
                  },
                )
          }
        >
          <span className="hm-wheel-kicker">{t("Protocolo diario")}</span>
          <ProtocolWheel
            program={program}
            chestClaimed={dayComplete}
            title={t("Protocolo diario")}
            count={todayDone}
            total={todayTotal}
          />
          <span className="hm-wheel-foot">
            {activeStreak} {t("días")}/{t("Semana")} {activeProgramWeek}
          </span>
        </button>

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
                    <span className="hm-metric-sub">{t(card.note)}</span>
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
                label: wearableConnected ? t("Wearable") : t("Conectar"),
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

          <button
            type="button"
            className="hm-appt"
            onClick={openAppt}
            aria-label={apptCopy.label}
            aria-busy={apptState === "loading"}
          >
            <span className="hm-appt-tele" aria-hidden="true">
              <IonIcon icon={videocamOutline} />
            </span>
            {apptState === "loading" ? (
              <span className="hm-appt-skeleton">
                <IonSkeletonText
                  animated
                  style={{ width: "64%", height: 17 }}
                />
                <IonSkeletonText
                  animated
                  style={{ width: "88%", height: 13 }}
                />
                <IonSkeletonText
                  animated
                  style={{ width: "76%", height: 10 }}
                />
                <IonSkeletonText
                  animated
                  style={{ width: 58, height: 18, borderRadius: 999 }}
                />
              </span>
            ) : (
              <>
                <span className="hm-appt-time">{apptCopy.time}</span>
                <span className="hm-appt-name">{apptCopy.name}</span>
                <span className="hm-appt-meta">{apptCopy.meta}</span>
                <span className="hm-appt-chip">{apptCopy.chip}</span>
                <span className="hm-appt-people">
                  <IonAvatar className="hm-appt-doc" aria-hidden="true">
                    <img src={doctorAvatar} alt="" />
                  </IonAvatar>
                  <span className="hm-appt-add">
                    <IonIcon
                      icon={apptState === "error" ? refreshOutline : add}
                    />
                  </span>
                </span>
              </>
            )}
          </button>
        </div>

        <div className="sec">{t("Tus módulos")}</div>
        <ModuleCarousel
          modules={modules}
          label={t("Tus módulos")}
          onSelect={(id) => navigate(id as ScreenId)}
        />

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
