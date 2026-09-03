import { useMemo, useState } from "react";
import { IonIcon, IonProgressBar, IonSkeletonText } from "@ionic/react";
import { useI18n } from "../i18n/I18nContext";
import {
  add,
  bluetooth,
  calendar,
  chatbubbleEllipses,
  chevronForward,
  clipboard,
  leaf,
  medkit,
  mic,
  notificationsOutline,
  people,
  person,
  refreshOutline,
} from "ionicons/icons";
import { ProtocolWheel } from "../components/ProtocolWheel";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { PROGRAM_TASKS } from "../data/program";
import { LanguageToggle } from "../components/LanguageToggle";
import { MetricHistoryModal } from "../components/MetricHistoryModal";
import { HEALTH_METRICS, metricProgress, type MetricId } from "../data/metrics";
import { useProgram } from "../hooks/useProgram";
import logoIcon from "../assets/LogoIndividual.png";
import type { CSSProperties } from "react";
import type { ProgramDay, Screen as ScreenId } from "../types";

/** Indicadores clínicos que van en la tarjeta destacada del inicio. */
const CARD_METRIC_IDS: MetricId[] = ["imc", "hba1c", "fat"];
const CARD_METRICS = HEALTH_METRICS.filter((m) =>
  CARD_METRIC_IDS.includes(m.id),
);

export function HomePage() {
  const {
    user,
    navigate,
    openPanic,
    openVoice,
    pointsTotal: appPointsTotal,
    watchConnected,
    program: appProgram,
    streak: appStreak,
    programWeek: appProgramWeek,
    realMode,
    upcomingAppointments,
    appointmentsLoading,
    appointmentsError,
    refreshAppointments,
    openRoom,
    showToast,
  } = useApp();
  const { snapshot } = useProgram();
  const { lang, t } = useI18n();

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

  const moreModules: {
    id: ScreenId;
    title: string;
    sub: string;
    icon: string;
  }[] = [
    {
      id: "hc",
      title: t("Historia clínica"),
      sub: t("Diagnósticos, lab y medicamentos"),
      icon: clipboard,
    },
    {
      id: "com",
      title: t("Comunidad"),
      sub: t("10,847 miembros activos"),
      icon: people,
    },
    {
      id: "prof",
      title: t("Mi perfil"),
      sub: t("Seguros, equipo y ajustes"),
      icon: person,
    },
  ];
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
      nutribiotico: Boolean(byCode.nutribiotico),
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
  const nextTaskTitle =
    nextServerTask?.title || nextFallbackTask?.title || "";
  const nextTaskShort =
    nextServerTask?.short || nextFallbackTask?.short || "";
  const dayComplete = todayDone === missionTotal;

  // Peso más reciente del backend para recalcular el IMC del indicador.
  const recentVitals = snapshot?.todayTasks?.find(
    (task) => task.taskCode === "vitals",
  )?.content?.recentVitals;
  const metricValue = (metric: (typeof CARD_METRICS)[number]) => {
    if (metric.id === "pts") return String(activePointsTotal);
    if (metric.id === "imc" && recentVitals?.weightKg) {
      return (recentVitals.weightKg / (1.68 * 1.68)).toFixed(1);
    }
    return metric.current;
  };

  return (
    <Screen>
      <Scroll className="home">
        <header className="hm-head">
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
                className="hm-icon-btn"
                onClick={() => showToast(t("No tienes notificaciones nuevas"), "info")}
                aria-label={t("Notificaciones")}
              >
                <IonIcon icon={notificationsOutline} />
              </button>
              <img src={logoIcon} alt="COPP-ADRESD" className="hm-brand" />
            </div>
          </div>

          <h1 className="hm-hello">
            {t("Hola,")} {first}
          </h1>
          <div className="hm-date">{today}</div>

          <div className="hm-chips">
            <span className="hm-chip green">{t("Riesgo bajo")}</span>
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
            caption={
              dayComplete
                ? t("Día completado · cofre listo")
                : t(nextTaskShort) || t("Toca para continuar")
            }
          />
          <span className="hm-wheel-foot">
            {activeStreak} {t("días")}/{t("Semana")} {activeProgramWeek}
          </span>
        </button>

        <div className="hm-metrics" aria-label={t("Indicadores de salud")}>
          {CARD_METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="hm-metric"
              onClick={() => setMetricId(m.id)}
              aria-label={t("Ver historial de {label}", { label: t(m.label) })}
            >
              <span className="hm-metric-val">{metricValue(m)}</span>
              <span className="hm-metric-lbl">{t(m.label)}</span>
              <span className="hm-metric-bar">
                <i
                  style={{
                    width: `${Math.round(metricProgress({ ...m, current: metricValue(m) }) * 100)}%`,
                  }}
                />
              </span>
            </button>
          ))}
        </div>

        <div className="hm-duo">
          <div className="hm-quick">
            {[
              {
                id: "chat" as const,
                label: t("Chat IA"),
                icon: chatbubbleEllipses,
                fn: () => navigate("chat"),
              },
              { id: "voice" as const, label: t("Voz"), icon: mic, fn: openVoice },
              {
                id: "bt" as const,
                label: watchConnected ? t("Reloj") : t("Conectar"),
                icon: bluetooth,
                fn: () => navigate("bt"),
              },
              {
                id: "sos" as const,
                label: t("SOS"),
                icon: medkit,
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
                <span className="hm-quick-ico">
                  {a.panic ? "SOS" : <IonIcon icon={a.icon} />}
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
            {apptState === "loading" ? (
              <span className="hm-appt-skeleton">
                <IonSkeletonText animated style={{ width: "64%", height: 17 }} />
                <IonSkeletonText animated style={{ width: "88%", height: 13 }} />
                <IonSkeletonText animated style={{ width: "76%", height: 10 }} />
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
                  {apptState === "demo" || apptState === "ready" ? (
                    <span className="hm-appt-doc">
                      <IonIcon icon={person} />
                    </span>
                  ) : null}
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

        <div className="sec">{t("Accesos")}</div>
        <div className="grid-2" style={{ marginBottom: 8 }}>
          {[
            {
              id: "book" as ScreenId,
              title: t("Citas"),
              sub: featuredReal
                ? `${featuredReal.time} · ${t(featuredReal.day)}`
                : realMode
                  ? t("Sin citas")
                  : t("Hoy 3:00 PM"),
              icon: calendar,
              bg: "var(--teal-l)",
              color: "var(--teal)",
            },
            {
              id: "nut" as ScreenId,
              title: t("Nutrición"),
              sub: t("1,650 / 1,800 kcal"),
              icon: leaf,
              bg: "var(--ice-l)",
              color: "var(--teal-d)",
            },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              className="card widget-card"
              onClick={() => navigate(m.id)}
            >
              <div className="ico" style={{ background: m.bg, color: m.color }}>
                <IonIcon icon={m.icon} />
              </div>
              <div className="ct">{m.title}</div>
              <div className="cs">{m.sub}</div>
            </button>
          ))}
        </div>

        <div className="group-list">
          {moreModules.map((m) => (
            <button
              key={m.title}
              type="button"
              className="group-row"
              onClick={() => navigate(m.id)}
            >
              <span className="group-row-ico">
                <IonIcon icon={m.icon} />
              </span>
              <span className="group-row-body">
                <strong>{m.title}</strong>
                <small>{m.sub}</small>
              </span>
              <span className="group-row-chevron">
                <IonIcon icon={chevronForward} />
              </span>
            </button>
          ))}
        </div>

        <div className="sec">{t("Progreso semanal")}</div>
        <div className="card" style={{ margin: "0 16px 20px" }}>
          {[
            [t("Hidratación"), "7/8 vasos", 87, "var(--teal)"],
            [t("Pasos"), "6,240 / 8,000", 78, "var(--blue)"],
            [t("Calorías"), "1,650 / 1,800", 91, "var(--org)"],
            [t("Academia"), "Módulo 5", 68, "var(--cyan)"],
          ].map(([l, r, w, c]) => (
            <div key={String(l)} className="progress-row">
              <div className="progress-row-top">
                <span>{l}</span>
                <span>{r}</span>
              </div>
              <IonProgressBar
                className="pb"
                style={{ "--progress-background": String(c) } as CSSProperties}
                value={Number(w) / 100}
              />
            </div>
          ))}
        </div>
      </Scroll>
      <MetricHistoryModal
        metricId={metricId}
        pointsTotal={activePointsTotal}
        onClose={() => setMetricId(null)}
      />
    </Screen>
  );
}
