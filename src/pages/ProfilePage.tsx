import { useEffect, useMemo, useRef, useState } from "react";
import { IonAccordion, IonAccordionGroup, IonAvatar, IonButton, IonIcon, IonInput, IonItem, IonLabel, IonList, IonSkeletonText, IonToggle } from "@ionic/react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
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
  arrowForward,
  chevronForward,
  optionsOutline,
  trophyOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  locationOutline,
} from "ionicons/icons";
import { useQueryClient } from "@tanstack/react-query";
import { BodyIcon3D } from "../components/icons3d";
import profileCover from "../assets/modules/perfil.png";
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
import { updateMyPatientProfile } from "../utils/patientProfileApi";
import { isValidNickname } from "../utils/league";
import type { LeagueResponseDto } from "../services/program/types";

/**
 * Tarjeta de contacto editable del paciente (FASE 2): email + celular con
 * guardado vía PUT /me/patient-profile (anti-IDOR por JWT). Al fallar se
 * revierten los inputs al snapshot pre-guardado (rollback, spec FASE 2).
 */
function ContactSection() {
  const { user, showToast } = useApp();
  const t = useT();
  const [email, setEmail] = useState(user.email);
  const [cel, setCel] = useState(user.celular);
  const [saving, setSaving] = useState(false);
  const preSaveRef = useRef({ email: user.email, cel: user.celular });

  useEffect(() => {
    setEmail(user.email);
    setCel(user.celular);
  }, [user.email, user.celular]);

  const save = async () => {
    if (saving) return;
    preSaveRef.current = { email, cel };
    setSaving(true);
    try {
      await updateMyPatientProfile({
        dateOfBirth: user.dob || null,
        email,
        phone: cel,
        emergencyName: user.fam1Nombre,
        emergencyRelationship: user.fam1Parentesco,
        emergencyPhone: user.fam1Cel,
        emergencyEmail: user.fam1Email,
        insurerId: user.seguro || null,
        memberId: user.poliza,
      });
      showToast(t("Datos actualizados"), "ok");
    } catch (err) {
      setEmail(preSaveRef.current.email);
      setCel(preSaveRef.current.cel);
      showToast(
        err instanceof Error
          ? err.message
          : t("No se pudo actualizar tu contacto"),
        "err",
      );
    } finally {
      setSaving(false);
    }
  };

  const dirty = email !== user.email || cel !== user.celular;

  return (
    <div className="pf-contact">
      <div className="h3" style={{ margin: "0 0 10px" }}>
        {t("Datos de contacto")}
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="pf-email">{t("Correo")}</label>
        <IonInput
          id="pf-email"
          className="fld"
          type="email"
          value={email}
          inputmode="email"
          enterkeyhint="next"
          onIonInput={(e) => setEmail(String(e.detail.value ?? ""))}
        />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="pf-cel">{t("Celular")}</label>
        <IonInput
          id="pf-cel"
          className="fld"
          type="tel"
          value={cel}
          inputmode="tel"
          enterkeyhint="done"
          onIonInput={(e) => setCel(String(e.detail.value ?? ""))}
        />
      </div>
      <IonButton
        expand="block"
        className="bt bt-primary"
        disabled={saving || !dirty}
        onClick={() => void save()}
      >
        {saving ? t("Guardando…") : t("Guardar contacto")}
      </IonButton>
    </div>
  );
}

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
  const reduce = useReducedMotion();
  const accountRef = useRef<HTMLElement>(null);
  const initials = user.nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase(locale);

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
    <MotionConfig reducedMotion="user">
      <Screen className="pf-screen">
        <Scroll className="pf-scroll">
          <div className="pf-layout">
            <div className="pf-overview">
              <header className="pf-heading">
                <div>
                  <span className="pf-eyebrow">{t("TU ESPACIO PERSONAL")}</span>
                  <h1>{t("Mi perfil")}<span aria-hidden="true">.</span></h1>
                  <p>{t("Todo lo que te hace avanzar.")}</p>
                </div>
                <IonButton fill="clear" className="pf-settings" aria-label={t("Ir a ajustes de cuenta")}
                  onClick={() => {
                    accountRef.current?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
                    accountRef.current?.focus({ preventScroll: true });
                  }}>
                  <IonIcon icon={optionsOutline} slot="icon-only" />
                </IonButton>
              </header>

              {/* Tarjeta de identidad: composición editorial de dominio, sin equivalente Ionic. */}
              <motion.section className="pf-identity" aria-label={t("Tu perfil")}
                initial={{ opacity: 0, y: reduce ? 0 : 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.55 }}>
                <div className="pf-identity-cover">
                  <img src={profileCover} alt="" className="pf-cover-photo" />
                  <div className="pf-cover-shade" aria-hidden="true" />
                  <div className="pf-card-brand"><span>COPP<span className="pf-brand-divider"> / </span>ADRESD</span><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /></div>
                  <div className="pf-person">
                    <IonAvatar className="pf-monogram" aria-hidden="true">{initials || <IonIcon icon={bodyOutline} />}</IonAvatar>
                    <span className="pf-card-caption">{t("MI PERFIL DE SALUD")}</span>
                    <h2>{user.nombre}</h2>
                    {user.cedula && <p className="pf-doc"><span>{t("Documento")}</span>{user.cedula}</p>}
                    {user.ciudad && <p className="pf-city"><IonIcon icon={locationOutline} aria-hidden="true" />{user.ciudad}</p>}
                  </div>
                  {weekSub && <div className="pf-membership"><span aria-hidden="true" />{weekSub}</div>}
                </div>
                <div className="pf-metrics" aria-label={t("Tu recorrido")}>
                  {heroMetrics.map(([value, label]) => (
                    <div className="pf-metric" key={label}>
                      <strong>{value}</strong><span>{t(label)}</span>
                    </div>
                  ))}
                </div>
              </motion.section>

              <motion.div initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : 0.12, duration: reduce ? 0 : 0.45 }}>
                <IonButton className="pf-avatar-feature" fill="clear" expand="block" onClick={() => go("body")}>
                  <span className="pf-avatar-copy">
                    <span className="pf-feature-kicker"><IonIcon icon={sparklesOutline} aria-hidden="true" />{t("TU VERSIÓN DIGITAL")}</span>
                    <strong>{t("Mi Avatar")}</strong>
                    <span className="pf-feature-description">{t("Una nueva forma de conocerte.")}</span>
                    <span className="pf-text-link">{t("Explorar mi avatar")}<IonIcon icon={arrowForward} aria-hidden="true" /></span>
                  </span>
                  <span className="pf-avatar-art" aria-hidden="true"><span className="pf-art-orbit" /><BodyIcon3D size={126} /></span>
                </IonButton>
              </motion.div>
            </div>

            <div className="pf-content">
              <section className="pf-care" aria-labelledby="pf-care-title">
                <div className="pf-section-title"><div><span className="pf-eyebrow">{t("MI CUIDADO")}</span><h2 id="pf-care-title">{t("Tu plan de salud")}</h2></div><span className="pf-section-mark" aria-hidden="true">01</span></div>
                <div className="pf-quick-grid">
                  {[
                    { icon: calendarOutline, title: "Calendario de citas", caption: "Tu próxima conexión", short: "Mis citas", screen: "book" as ScreenId, tone: "sky" },
                    { icon: clipboardOutline, title: "Historia clínica", caption: "Tu salud, en contexto", short: "Mi historia", screen: "hc" as ScreenId, tone: "mint" },
                  ].map(item => (
                    <IonButton key={item.screen} fill="clear" className={"pf-quick pf-quick-" + item.tone} onClick={() => go(item.screen)} aria-label={t(item.title)}>
                      <span className="pf-quick-inner">
                        <span className="pf-quick-top"><span className="pf-quick-icon"><IonIcon icon={item.icon} aria-hidden="true" /></span><IonIcon icon={arrowForward} aria-hidden="true" /></span>
                        <strong>{t(item.short)}</strong><small>{t(item.caption)}</small>
                      </span>
                    </IonButton>
                  ))}
                </div>
                <IonList className="pf-menu" lines="none">
                  {[
                    { icon: bodyOutline, title: "Perfil corporal", sub: "Índices y mediciones corporales", tone: "lilac", action: () => go("body") },
                    { icon: clipboardOutline, title: "Batería de evaluación", sub: "Tests de salud pendientes", tone: "sky", action: () => openTests() },
                    { icon: leafOutline, title: "Plan nutricional", sub: "Alimentación que te acompaña", tone: "mint", action: () => go("nut") },
                  ].map(item => (
                    <IonItem button detail={false} key={item.title} onClick={item.action} className="pf-menu-row">
                      <span slot="start" className={"pf-menu-icon " + item.tone}><IonIcon icon={item.icon} aria-hidden="true" /></span>
                      <IonLabel><h3>{t(item.title)}</h3><p>{t(item.sub)}</p></IonLabel>
                      <IonIcon slot="end" className="pf-chevron" icon={chevronForward} aria-hidden="true" />
                    </IonItem>
                  ))}
                </IonList>
              </section>

              {teamProfessionals !== null && (
                <section className="pf-team" aria-labelledby="pf-team-title">
                  <div className="pf-section-title"><div><span className="pf-eyebrow">{t("CERCA DE TI")}</span><h2 id="pf-team-title">{t("Equipo Copp Adresd")}</h2></div><span className="pf-section-mark" aria-hidden="true">02</span></div>
                  {teamProfessionals.length > 0 ? (
                    <div className="pf-team-grid">
                      {teamProfessionals.map(pro => (
                        <IonButton fill="clear" key={pro.id} className="pf-team-card" onClick={() => showToast(t("Contactando a {name}…", { name: pro.name }), "info")}>
                          <span className="pf-team-inner">
                            <span className="pf-team-top"><IonAvatar className="pf-pro-avatar" aria-hidden="true">{pro.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("")}</IonAvatar><IonIcon icon={arrowForward} aria-hidden="true" /></span>
                            <strong>{pro.name}</strong><small>{pro.role}</small>
                          </span>
                        </IonButton>
                      ))}
                    </div>
                  ) : <p className="pf-empty">{t("Aún no hay profesionales asignados a tu equipo.")}</p>}
                </section>
              )}

              <section className="pf-discover" aria-labelledby="pf-discover-title">
                <div className="pf-section-title"><div><span className="pf-eyebrow">{t("MÁS PARA TI")}</span><h2 id="pf-discover-title">{t("Crece a tu ritmo")}</h2></div><span className="pf-section-mark" aria-hidden="true">{teamProfessionals !== null ? '03' : '02'}</span></div>
                <div className="pf-discover-grid">
                  <IonButton fill="clear" className="pf-discover-card pf-academy" onClick={() => go("edu")}>
                    <span className="pf-discover-content">
                      <IonIcon className="pf-discover-symbol" icon={schoolOutline} aria-hidden="true" />
                      <span className="pf-discover-kicker">{t("APRENDE")}</span>
                      <strong>{t("Academia BIO")}</strong><small>{t("Conocimiento para cuidarte.")}</small>
                      <span className="pf-discover-arrow"><IonIcon icon={arrowForward} aria-hidden="true" /></span>
                    </span>
                  </IonButton>
                  <IonButton fill="clear" className="pf-discover-card pf-infinito" onClick={() => go("infinito")}>
                    <span className="pf-discover-content">
                      <IonIcon className="pf-discover-symbol" icon={infinite} aria-hidden="true" />
                      <span className="pf-discover-kicker">{t("CONECTA")}</span>
                      <strong>INFINITO</strong><small>{t("Consciencia · Bienestar")}</small>
                      <span className="pf-discover-arrow"><IonIcon icon={arrowForward} aria-hidden="true" /></span>
                    </span>
                  </IonButton>
                </div>
              </section>

              <section className="pf-account" ref={accountRef} tabIndex={-1} aria-labelledby="pf-account-title">
                <div className="pf-section-title"><div><span className="pf-eyebrow">{t("A TU MANERA")}</span><h2 id="pf-account-title">{t("Cuenta y preferencias")}</h2></div><IonIcon className="pf-section-settings" icon={optionsOutline} aria-hidden="true" /></div>
                <ContactSection />
                <IonAccordionGroup className="pf-league">
                  <IonAccordion value="league">
                    <IonItem slot="header" className="pf-menu-row" lines="none">
                      <span slot="start" className="pf-menu-icon sand"><IonIcon icon={trophyOutline} aria-hidden="true" /></span>
                      <IonLabel><h3>{t("Privacidad en la Liga")}</h3><p>{t("Elige cómo participas")}</p></IonLabel>
                    </IonItem>
                    <div slot="content"><LeagueSection /></div>
                  </IonAccordion>
                </IonAccordionGroup>
                <IonList className="pf-menu pf-account-menu" lines="none">
                  <IonItem button detail={false} className="pf-menu-row" onClick={toggleLang}>
                    <span slot="start" className="pf-menu-icon neutral"><IonIcon icon={languageOutline} aria-hidden="true" /></span>
                    <IonLabel><h3>{t("Idioma")}</h3><p>{t("Elige cómo quieres leernos")}</p></IonLabel>
                    <span slot="end" className="pf-language">{lang === "es" ? "ES" : "EN"}<IonIcon icon={chevronForward} aria-hidden="true" /></span>
                  </IonItem>
                  <IonItem button detail={false} className="pf-menu-row pf-sos-row" onClick={openPanic}>
                    <span slot="start" className="pf-menu-icon alert"><IonIcon icon={medkit} aria-hidden="true" /></span>
                    <IonLabel><h3>{t("Botón de pánico SOS")}</h3><p>{t("Acceso al protocolo de emergencia")}</p></IonLabel>
                    <IonIcon slot="end" className="pf-chevron" icon={chevronForward} aria-hidden="true" />
                  </IonItem>
                </IonList>
                <IonButton fill="clear" expand="block" className="pf-logout" onClick={() => { logout(); showToast(t("Sesión cerrada"), "ok"); }}>
                  <IonIcon icon={logOutOutline} slot="start" />{t("Cerrar sesión")}
                </IonButton>
                <div className="pf-signature"><span aria-hidden="true" /><span>COPP ADRESD</span><span aria-hidden="true" /></div>
                <p className="pf-closing">{t("Tu bienestar empieza contigo.")}</p>
              </section>
            </div>
          </div>
        </Scroll>
      </Screen>
    </MotionConfig>
  );
}
