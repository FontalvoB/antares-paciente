import { useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonIcon, IonInput, IonSkeletonText, IonToggle } from "@ionic/react";
import {
  bodyOutline,
  calendarOutline,
  clipboardOutline,
  infinite,
  languageOutline,
  leafOutline,
  logOutOutline,
  medkit,
  schoolOutline,
} from "ionicons/icons";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import { useI18n } from "../i18n/I18nContext";
import type { Screen as ScreenId } from "../types";
import { useLeague } from "../hooks/useLeague";
import { useMetricsHistory } from "../hooks/useMetricsHistory";
import { useProgram } from "../hooks/useProgram";
import { formatMetricValue } from "../data/metrics";
import { updateLeaguePreferences } from "../services/program/league-service";
import { programKeys } from "../hooks/queryKeys";
import { ApiError } from "../utils/apiClient";
import { isValidNickname } from "../utils/league";
import type { LeagueResponseDto } from "../services/program/types";

/**
 * Sección "Liga" del perfil: opt-in + apodo (LEAGUE v1). La verdad de las
 * preferencias sale del GET league (`me`); el guardado hace PUT y parchea el
 * cache de la liga (el cohorte no cambia). Errores 400 con mensajes reales
 * del backend (p.ej. token reservado) se muestran inline vía `errors`.
 */
function LeagueSection() {
  const { league, isLoading, isError, refetch } = useLeague();
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const t = useT();
  const [optedIn, setOptedIn] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Snapshot pre-guardado: si el PUT falla se REVIERTE toggle+input a estos
  // valores (sin writes al cache, sin verdades a medias).
  const preSaveRef = useRef<{ optedIn: boolean; nickname: string }>({
    optedIn: false,
    nickname: "",
  });

  // Sincroniza el borrador con la verdad del server cuando llega la liga.
  useEffect(() => {
    if (league) {
      setOptedIn(league.me.optedIn);
      setNickname(league.me.nickname ?? "");
      setServerError(null);
    }
  }, [league]);

  const trimmed = nickname.trim();
  const nicknameValid = isValidNickname(trimmed);
  const canSave = !saving && (!optedIn || nicknameValid);

  async function save() {
    if (!canSave) return;
    preSaveRef.current = { optedIn, nickname };
    setSaving(true);
    setServerError(null);
    try {
      // Opt-out → nickname null SIEMPRE limpia lo almacenado (server).
      const saved = await updateLeaguePreferences({
        optIn: optedIn,
        nickname: optedIn ? trimmed : null,
      });
      setOptedIn(saved.optedIn);
      setNickname(saved.nickname ?? "");
      // Patch local inmediato (feedback del toggle) + invalidación para que
      // el refetch traiga entries/isMe/myRank frescos — un paciente recién
      // opt-in debe aparecer en SU ranking sin esperar el staleTime.
      queryClient.setQueryData<LeagueResponseDto>(programKeys.league, (old) =>
        old ? { ...old, me: { optedIn: saved.optedIn, nickname: saved.nickname } } : old,
      );
      void queryClient.invalidateQueries({ queryKey: programKeys.league });
      showToast(t("Preferencias guardadas"), "ok");
    } catch (e) {
      // Fallo → REVERT al snapshot pre-guardado (no mentir sobre el estado).
      setOptedIn(preSaveRef.current.optedIn);
      setNickname(preSaveRef.current.nickname);
      if (e instanceof ApiError) {
        // El 400 de validación trae el mensaje real en `errors` (RFC 7807);
        // passthrough inline. El resto → toast.
        const first = e.errors ? Object.values(e.errors).flat()[0] : undefined;
        if (first) setServerError(first);
        else showToast(e.message, "err");
      } else {
        showToast(t("No pudimos guardar tus preferencias."), "err");
      }
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card league-prefs">
        <IonSkeletonText animated style={{ width: "60%", height: 18 }} />
        <IonSkeletonText animated style={{ width: "85%", height: 13 }} />
      </div>
    );
  }

  if (isError || !league) {
    // Degradación honesta: sin datos, la sección queda deshabilitada con
    // reintento — nunca un toggle "off-unknown" que parezca verdad.
    return (
      <div className="card league-prefs">
        <strong>{t("No pudimos cargar tus preferencias de la Liga.")}</strong>
        <IonButton fill="clear" size="small" onClick={() => void refetch()}>
          {t("Reintentar")}
        </IonButton>
      </div>
    );
  }

  return (
    <div className="card league-prefs">
      <div className="league-prefs-row">
        <div>
          <strong>{t("Aparecer en la Liga")}</strong>
          <small>{t("Con tu apodo. Tus datos clínicos nunca se muestran con tu nombre.")}</small>
        </div>
        <IonToggle
          checked={optedIn}
          disabled={saving}
          onIonChange={(e) => setOptedIn(e.detail.checked)}
          aria-label={t("Aparecer en la Liga")}
        />
      </div>
      {serverError && <small className="league-prefs-err">{serverError}</small>}
      {optedIn && (
        <div className="league-prefs-nick">
          <IonInput
            value={nickname}
            maxlength={32}
            counter
            disabled={saving}
            label={t("Apodo")}
            labelPlacement="stacked"
            placeholder={t("Apodo")}
            onIonInput={(e) => setNickname(String(e.detail.value ?? ""))}
            className={nickname && !nicknameValid ? "ion-invalid" : undefined}
          />
          {nickname && !nicknameValid && (
            <small className="league-prefs-err">
              {t("El apodo debe tener entre 3 y 32 caracteres y solo letras, números, espacios, guiones o guiones bajos.")}
            </small>
          )}
          <IonButton expand="block" className="bt bt-teal" disabled={!canSave} onClick={() => void save()}>
            {saving ? t("Guardando…") : t("Guardar")}
          </IonButton>
        </div>
      )}
    </div>
  );
}

export function ProfilePage() {
  const {
    user,
    navigate,
    openPanic,
    showToast,
    pointsTotal,
    logout,
    openTests,
    teamProfessionals,
  } = useApp();
  const { snapshot, isMockFallback } = useProgram();
  const { history: metricsHistory } = useMetricsHistory();
  const { lang, toggleLang, t } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-ES";

  const go = (s: ScreenId) => navigate(s);

  // Semana del programa SOLO desde el snapshot real; el fallback mock de
  // useProgram (sin cache) no se pinta como verdad del servidor (patrón
  // HistoryPage).
  const programWeek = isMockFallback
    ? undefined
    : snapshot?.template?.currentWeekNumber;
  const totalWeeks = isMockFallback ? undefined : snapshot?.template?.totalWeeks;
  const weekSub =
    programWeek != null && totalWeeks != null
      ? t("Semana {cur} de {total}", {
          cur: String(programWeek),
          total: String(totalWeeks),
        })
      : undefined;

  // Delta de peso real (metrics-history): primera → última medición. Sin dos
  // puntos reales no hay tarjeta — nunca un delta inventado.
  const weightDelta = useMemo(() => {
    const series = metricsHistory?.metrics.find(
      (m) => m.code.toLowerCase() === "weight",
    );
    const points = series?.points ?? [];
    if (points.length < 2) return null;
    const delta = points[points.length - 1].value - points[0].value;
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
    return `${sign}${formatMetricValue(Math.abs(delta), 1, locale)} ${
      series?.unit ?? "kg"
    }`;
  }, [metricsHistory, locale]);

  // Hero: solo tarjetas con verdad real (semana del snapshot, delta de peso,
  // puntos del backend). Sin dato → la tarjeta no se renderiza.
  const heroMetrics: Array<[string, string]> = [];
  if (programWeek != null) heroMetrics.push([String(programWeek), "Semanas"]);
  if (weightDelta) heroMetrics.push([weightDelta, "Peso"]);
  heroMetrics.push([String(pointsTotal), "Puntos"]);

  return (
    <Screen>
      <PageHeader title={t("Perfil")} sub={weekSub} />
      <Scroll>
        <IonButton expand="block" fill="outline" style={{ margin: '12px 16px', minHeight: 44 }} onClick={() => go('avatar')}>
          {t('Probar avatar 3D')}
        </IonButton>
        <div className="profile-hero-card">
          <div
            className="avatar"
            style={{
              width: 64,
              height: 64,
              fontSize: 22,
              background: "linear-gradient(145deg,#1a6ad8,#20c8ff)",
            }}
          >
            MG
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h2" style={{ margin: 0 }}>
              {user.nombre}
            </div>
            <div className="cs">{t("Miembro BIO activo")}</div>
          </div>
        </div>

        <div
          className="hero-metrics"
          style={{ padding: "0 16px", marginBottom: 8 }}
        >
          {heroMetrics.map(([v, l]) => (
            <div
              key={l}
              className="metric-card"
              style={{ flex: 1, textAlign: "center", padding: "12px 8px" }}
            >
              <div
                className="metric-card-val"
                style={{ fontSize: 20, margin: "0 0 2px", color: "var(--tx)" }}
              >
                {v}
              </div>
              <div className="metric-card-lbl">{t(l)}</div>
            </div>
          ))}
        </div>

        <div className="sec">{t("Mi plan")}</div>
        <div className="group-list">
          {[
            {
              ico: clipboardOutline,
              t: "Historia clínica",
              s: "Diagnósticos · Lab · Medicamentos",
              fn: () => go("hc"),
            },
            {
              ico: bodyOutline,
              t: "Visualización del perfil",
              s: "Índices y mediciones corporales",
              fn: () => go("body"),
            },
            {
              ico: clipboardOutline,
              t: "Batería de evaluación",
              s: "Tests de salud pendientes",
              fn: () => openTests(),
            },
            {
              ico: calendarOutline,
              t: "Calendario de citas",
              s: "Próxima: Dr. Ramírez hoy 15:00",
              fn: () => go("book"),
            },
            {
              ico: leafOutline,
              t: "Plan nutricional",
              s: "1,800 kcal · Mediterránea",
              fn: () => go("nut"),
            },
          ].map((r) => (
            <button
              key={r.t}
              type="button"
              className="group-row"
              onClick={r.fn}
            >
              <span className="group-row-ico">
                <IonIcon icon={r.ico} />
              </span>
              <span className="group-row-body">
                <strong>{t(r.t)}</strong>
                <small>{t(r.s)}</small>
              </span>
              <span className="group-row-chevron">›</span>
            </button>
          ))}
        </div>

        {teamProfessionals === null ? null : (
          <>
            <div className="sec">{t("Equipo ANTARES")}</div>
            {teamProfessionals.length > 0 ? (
              <div className="group-list">
                {teamProfessionals.map((pro) => (
                  <button
                    key={pro.id}
                    type="button"
                    className="group-row"
                    onClick={() =>
                      showToast(
                        t("Contactando a {name}…", { name: pro.name }),
                        "info",
                      )
                    }
                  >
                    <span className="group-row-ico">{pro.emoji}</span>
                    <span className="group-row-body">
                      <strong>{pro.name}</strong>
                      <small>{pro.role}</small>
                    </span>
                    <span className="group-row-chevron">›</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="card" style={{ margin: "0 16px 8px" }}>
                <small>
                  {t("Aún no hay profesionales asignados a tu equipo.")}
                </small>
              </div>
            )}
          </>
        )}

        <div className="sec">{t("Ecosistema")}</div>
        <div className="group-list">
          <button type="button" className="group-row" onClick={() => go("edu")}>
            <span className="group-row-ico">
              <IonIcon icon={schoolOutline} />
            </span>
            <span className="group-row-body">
              <strong>{t("Academia BIO")}</strong>
              <small>{t("18 hrs completadas")}</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
          <button
            type="button"
            className="group-row"
            onClick={() => go("infinito")}
          >
            <span className="group-row-ico">
              <IonIcon icon={infinite} />
            </span>
            <span className="group-row-body">
              <strong>INFINITO B2C</strong>
              <small>{t("Consciencia · Bienestar")}</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
        </div>

        <div className="sec">{t("Cuenta")}</div>
        <LeagueSection />
        <div className="group-list" style={{ marginBottom: 20 }}>
          <button type="button" className="group-row" onClick={toggleLang}>
            <span className="group-row-ico">
              <IonIcon icon={languageOutline} />
            </span>
            <span className="group-row-body">
              <strong>{t("Idioma")}</strong>
              <small>{lang === "es" ? "ES → EN" : "EN → ES"}</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
          <button type="button" className="group-row" onClick={openPanic}>
            <span
              className="group-row-ico"
              style={{ background: "var(--red-l)", color: "var(--panic)" }}
            >
              <IonIcon icon={medkit} />
            </span>
            <span className="group-row-body">
              <strong style={{ color: "var(--panic)" }}>
                {t("Botón de pánico SOS")}
              </strong>
              <small>{t("Ambulancia + familia + médico")}</small>
            </span>
          </button>
          <button
            type="button"
            className="group-row"
            onClick={() => {
              logout();
              showToast(t("Sesión cerrada"), "ok");
            }}
          >
            <span
              className="group-row-ico"
              style={{ background: "var(--red-l)", color: "var(--red)" }}
            >
              <IonIcon icon={logOutOutline} />
            </span>
            <span className="group-row-body">
              <strong style={{ color: "var(--red)" }}>
                {t("Cerrar sesión")}
              </strong>
            </span>
          </button>
        </div>
      </Scroll>
    </Screen>
  );
}
