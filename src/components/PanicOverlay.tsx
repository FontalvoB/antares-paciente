import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
} from "@ionic/react";
import {
  call,
  checkmarkCircle,
  close,
  heart,
  location,
  medkit,
  people,
  pulse,
  volumeHigh,
  shieldCheckmarkOutline,
  informationCircleOutline,
  arrowBack,
  hourglass,
} from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import {
  SosServiceError,
  activateSosAlert,
  cancelSosAlert,
  fetchActiveSosAlert,
  getCoordinatesBestEffort,
  isSosRealEnabled,
  type SosAlertDto,
} from "../services/sos/sos-service";

type SosView = "protocol" | "confirm" | "call911" | "callFamily";
type CallPhase = "dialing" | "ringing" | "connected";

const RING = 2 * Math.PI * 78;
/** Sondeo ligero del estado real de la alerta (REQ-SOS-07). */
const ACTIVE_POLL_MS = 15_000;

function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function Waveform({ live }: { live: boolean }) {
  return (
    <div className={`sos-wave ${live ? "live" : ""}`} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

export function PanicOverlay() {
  const { panicOpen, sosActive, closePanic, activateSos, user, showToast } =
    useApp();
  const t = useT();
  const reduce = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<SosView>("protocol");
  const [phase, setPhase] = useState<CallPhase>("dialing");
  const [callSec, setCallSec] = useState(0);
  const [lit, setLit] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  // SOS real (change sos-panic-real): flag por env. Con false el flujo es
  // simulación local; en ambos casos la activación SIEMPRE exige doble
  // confirmación deliberada (REQ-SOS-07: nunca auto-activación por
  // inactividad — el temporizador de 5 s se elimina).
  const sosEnabled = isSosRealEnabled();
  const [alertId, setAlertId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  /** Cuenta regresiva 429 (segundos de Retry-After) que bloquea el orbe. */
  const [rateLimitSecs, setRateLimitSecs] = useState(0);

  // Overlay de emergencia custom: conserva el foco al cerrar. Los controles
  // siguen siendo componentes Ionic.
  useEffect(() => {
    if (!panicOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus();
  }, [panicOpen]);

  useEffect(() => {
    if (!panicOpen) return;
    const frame = requestAnimationFrame(() => overlayRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [panicOpen, view]);

  const family = user.fam1Nombre;
  const familyRole = user.fam1Parentesco;
  const familyCel = user.fam1Cel;
  const initials = family
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!panicOpen) {
      setView("protocol");
      setPhase("dialing");
      setCallSec(0);
      setLit(0);
      setSpeakerOn(true);
      setAlertId(null);
      setActivating(false);
      setRateLimitSecs(0);
    }
  }, [panicOpen]);

  // REQ-SOS-07 (eliminado): ya NO existe el temporizador que activaba SOS a
  // los 5 s de inactividad. La alerta solo nace de la doble confirmación
  // (toque del orbe → pantalla de confirmación → botón afirmativo).
  useEffect(() => {
    if (!sosActive) {
      setLit(0);
      return;
    }
    setLit(1);
    const timers = [450, 950, 1450, 1950, 2400].map((ms, i) =>
      window.setTimeout(() => setLit(i + 2), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [sosActive]);

  // SOS real activo: sondeo ligero (15 s) para reflejar Atendida/Cancelada
  // (REQ-SOS-07). Una alerta que ya no está activa saca al paciente de la
  // vista de emergencia automáticamente.
  useEffect(() => {
    if (!sosEnabled || !sosActive || !panicOpen) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const alert = await fetchActiveSosAlert();
        if (cancelled) return;
        if (!alert || alert.status !== "Activa") {
          closePanic();
          showToast(t("Tu alerta SOS ya fue atendida."), "ok");
        } else {
          setAlertId(alert.id);
        }
      } catch {
        /* sondeo best-effort: el próximo tick reintenta */
      }
    };
    const id = window.setInterval(() => void poll(), ACTIVE_POLL_MS);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sosEnabled, sosActive, panicOpen, closePanic, showToast, t]);

  // Cuenta regresiva del 429 (Retry-After): bloquea el orbe hasta expirar.
  useEffect(() => {
    if (rateLimitSecs <= 0) return;
    const id = window.setInterval(() => {
      setRateLimitSecs((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [rateLimitSecs]);

  useEffect(() => {
    if (view !== "call911" && view !== "callFamily") return;
    setPhase("dialing");
    setCallSec(0);
    const t1 = window.setTimeout(() => setPhase("ringing"), 800);
    const t2 = window.setTimeout(() => setPhase("connected"), 2600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [view]);

  useEffect(() => {
    if (phase !== "connected") return;
    const id = window.setInterval(() => setCallSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const startCall = (next: SosView) => {
    // REQ-SOS-07: abrir una llamada ya NO activa SOS implícitamente.
    setView(next);
  };

  const hangUp = () => {
    setView("protocol");
    setPhase("dialing");
    setCallSec(0);
  };

  /**
   * Confirmación deliberada (segundo paso de la doble confirmación):
   * GPS best-effort → activación real (flag on) o local (flag off) →
   * estado visual "SOS ACTIVO". Los errores del backend se presentan sin
   * bloquear el protocolo visual.
   */
  const confirmActivation = async () => {
    setView("protocol");
    if (activating || sosActive || rateLimitSecs > 0) return;
    setActivating(true);
    try {
      const coords = await getCoordinatesBestEffort();
      if (sosEnabled) {
        const alert: SosAlertDto = await activateSosAlert(coords);
        setAlertId(alert.id);
      }
      activateSos();
    } catch (err) {
      if (err instanceof SosServiceError) {
        if (err.status === 429) {
          const secs = err.retryAfterSeconds ?? 60;
          setRateLimitSecs(secs);
          showToast(
            t("Límite de alertas alcanzado. Espera {seconds} s.", {
              seconds: String(secs),
            }),
            "err",
          );
        } else {
          showToast(err.message, "err");
        }
      } else {
        showToast(t("No se pudo enviar la alerta. Intenta de nuevo."), "err");
      }
    } finally {
      setActivating(false);
    }
  };

  /** "Estoy bien": cancela la alerta real si existe (best-effort) y cierra. */
  const imOk = () => {
    if (sosEnabled && alertId) {
      void cancelSosAlert(alertId).catch(() => {
        /* la alerta real se atiende igual; el cierre local no depende de esto */
      });
    }
    closePanic();
    showToast(t("Alerta cancelada. Quédate en observación."), "ok");
  };

  const ringPct = sosActive ? 1 : 0;
  const calling911 = view === "call911";
  const callingFam = view === "callFamily";
  const inCall = calling911 || callingFam;
  const phaseLabel =
    phase === "dialing"
      ? t("Marcando…")
      : phase === "ringing"
        ? t("Sonando…")
        : t("En llamada");

  const rows: {
    key: string;
    ico: string;
    title: string;
    sub: string;
    tone: string;
  }[] = [
    {
      key: "amb",
      ico: medkit,
      title: t("Emergencias 911"),
      sub: sosActive
        ? lit >= 1
          ? t("Alerta enviada · despacho en curso")
          : t("Notificando…")
        : t("En espera de activación"),
      tone: "red",
    },
    {
      key: "fam",
      ico: people,
      title: family,
      sub:
        sosActive && lit >= 2
          ? t("Alerta enviada · {phone}", { phone: familyCel })
          : `${familyRole} · ${familyCel}`,
      tone: "ice",
    },
    {
      key: "doc",
      ico: pulse,
      title: t("Dr. Ramírez"),
      sub:
        sosActive && lit >= 3
          ? t("Equipo COPP-ADRESD notificado")
          : t("Médico de cabecera"),
      tone: "blue",
    },
    {
      key: "gps",
      ico: location,
      title: t("Ubicación GPS"),
      sub:
        sosActive && lit >= 4
          ? t("Enviando 25.7617° N, 80.1918° W")
          : t("Se comparte al activar"),
      tone: "teal",
    },
    {
      key: "vit",
      ico: heart,
      title: t("Signos vitales"),
      sub:
        sosActive && lit >= 5
          ? t("FC 140 · SpO2 94% · TA 160/110")
          : t("Se adjuntan al activar"),
      tone: "org",
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {panicOpen && (
          <motion.div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("Asistencia de emergencia SOS")}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const buttons = Array.from(
                overlayRef.current?.querySelectorAll("ion-button") ?? [],
              ).filter(
                (button) =>
                  !button.disabled && button.getClientRects().length > 0,
              );
              const first = buttons[0];
              const last = buttons[buttons.length - 1];
              const active = document.activeElement;
              if (
                event.shiftKey &&
                (active === first || active === overlayRef.current)
              ) {
                event.preventDefault();
                last?.shadowRoot?.querySelector("button")?.focus();
              } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first?.shadowRoot?.querySelector("button")?.focus();
              }
            }}
            className={`overlay overlay-panic sos-screen sos-modern ${sosActive ? "is-hot" : ""} ${inCall ? "is-call" : ""} ${calling911 ? "is-call-911" : ""} ${callingFam ? "is-call-fam" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <header className="sos-topbar">
              <div className="sos-brand">
                <span>
                  <IonIcon icon={medkit} aria-hidden="true" />
                </span>
                <div>
                  <strong>SOS</strong>
                  <small>{t("Asistencia de emergencia")}</small>
                </div>
              </div>
              <IonButton
                fill="clear"
                className="sos-top-close"
                onClick={inCall ? hangUp : imOk}
                aria-label={
                  inCall
                    ? t("Volver al protocolo")
                    : sosActive
                      ? t("Estoy bien")
                      : t("Cancelar activación")
                }
              >
                <IonIcon icon={inCall ? arrowBack : close} slot="start" />
                {inCall ? t("Volver") : sosActive ? t("Cerrar") : t("Cancelar")}
              </IonButton>
            </header>
            <div className="sos-demo-note">
              <IonIcon icon={informationCircleOutline} aria-hidden="true" />
              <span>
                {sosEnabled
                  ? t(
                      "Alerta real: se enviará SMS a tu contacto de emergencia.",
                    )
                  : t("Simulación SOS: no realiza llamadas ni envía alertas.")}
              </span>
            </div>

            <AnimatePresence initial={false}>
              {!inCall && view !== "confirm" ? (
                <motion.div
                  key="protocol"
                  className="sos-protocol"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="sos-scroll-body">
                    <section className="sos-alert-card">
                      <header className="sos-head">
                        <IonBadge
                          className={`sos-live ${sosActive ? "on" : ""}`}
                        >
                          {sosActive ? t("SOS ACTIVO") : t("PROTOCOLO ARMADO")}
                        </IonBadge>
                        <p>
                          {sosActive
                            ? t("Protocolo de emergencia")
                            : t("Toca el botón para activar, luego confirma")}
                        </p>
                      </header>

                      <div className="sos-orb-wrap">
                        <span className="sos-ripple r1" aria-hidden="true" />
                        <span className="sos-ripple r2" aria-hidden="true" />
                        <svg
                          className="sos-count-ring"
                          viewBox="0 0 180 180"
                          aria-hidden="true"
                        >
                          <circle
                            cx="90"
                            cy="90"
                            r="78"
                            className="sos-count-track"
                          />
                          <motion.circle
                            cx="90"
                            cy="90"
                            r="78"
                            className="sos-count-fill"
                            strokeDasharray={RING}
                            animate={{ strokeDashoffset: RING * (1 - ringPct) }}
                            transition={{
                              duration: reduce ? 0 : sosActive ? 0.4 : 0.95,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            transform="rotate(-90 90 90)"
                          />
                        </svg>
                        <IonButton
                          type="button"
                          className={`sos-orb ${sosActive ? "hot" : ""}`}
                          onClick={() => !sosActive && setView("confirm")}
                          disabled={
                            sosActive || activating || rateLimitSecs > 0
                          }
                          aria-label={
                            sosActive
                              ? t("SOS activado")
                              : rateLimitSecs > 0
                                ? t("Espera {seconds} segundos para activar", {
                                    seconds: String(rateLimitSecs),
                                  })
                                : t("Activar SOS ahora")
                          }
                        >
                          <span className="sos-orb-content">
                            {sosActive ? (
                              <IonIcon icon={medkit} aria-hidden="true" />
                            ) : rateLimitSecs > 0 ? (
                              <IonIcon icon={hourglass} aria-hidden="true" />
                            ) : (
                              <b>SOS</b>
                            )}
                            <small>
                              {sosActive
                                ? "SOS"
                                : rateLimitSecs > 0
                                  ? `${rateLimitSecs}s`
                                  : t("Activar ahora")}
                            </small>
                          </span>
                        </IonButton>
                      </div>

                      <div className="sos-copy">
                        <h1 aria-live="polite">
                          {sosActive
                            ? t("Protocolo activado")
                            : t("Estamos para ayudarte")}
                        </h1>
                        <p>
                          {sosActive
                            ? t(
                                "Ambulancia, familia y tu equipo médico están recibiendo GPS y signos vitales.",
                              )
                            : t(
                                "Toca el círculo y confirma. 911, tu familiar y el médico se notifican juntos.",
                              )}
                        </p>
                      </div>
                    </section>

                    <section className="sos-network">
                      <div className="sos-section-heading">
                        <div>
                          <small>{t("CONTACTOS DE EMERGENCIA")}</small>
                          <h2>{t("Tu red de ayuda")}</h2>
                        </div>
                        <IonIcon icon={people} aria-hidden="true" />
                      </div>
                      <IonList className="sos-feed" lines="none">
                        {rows.slice(0, 3).map((r, i) => {
                          const on = sosActive && lit > i;
                          return (
                            <IonItem
                              key={r.key}
                              className={`sos-feed-row tone-${r.tone} ${on ? "on" : ""}`}
                            >
                              <span slot="start" className="sos-feed-ico">
                                <IonIcon icon={r.ico} aria-hidden="true" />
                              </span>
                              <IonLabel>
                                <strong>{r.title}</strong>
                                <small>{r.sub}</small>
                              </IonLabel>
                              <IonIcon
                                className="sos-row-status"
                                slot="end"
                                icon={
                                  on ? checkmarkCircle : shieldCheckmarkOutline
                                }
                                aria-label={
                                  on ? t("Notificado") : t("En espera")
                                }
                              />
                            </IonItem>
                          );
                        })}
                      </IonList>
                    </section>

                    <section className="sos-shared">
                      <div className="sos-section-heading">
                        <div>
                          <small>{t("CONTEXTO DE LA ALERTA")}</small>
                          <h2>{t("Información compartida")}</h2>
                        </div>
                        <IonIcon
                          icon={shieldCheckmarkOutline}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="sos-data-grid">
                        {rows.slice(3).map((row, i) => (
                          <article
                            key={row.key}
                            className={`sos-data-card ${sosActive && lit > i + 3 ? "on" : ""}`}
                          >
                            <IonIcon icon={row.ico} aria-hidden="true" />
                            <h3>{row.title}</h3>
                            <p>{row.sub}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>

                  <footer className="sos-action-dock">
                    <div className="sos-actions">
                      <IonButton
                        className="bt sos-act-911"
                        aria-label={t("Llamar 911")}
                        onClick={() => startCall("call911")}
                      >
                        <IonIcon icon={call} slot="start" />
                        {t("Llamar 911")}
                      </IonButton>
                      <IonButton
                        className="bt sos-act-fam"
                        aria-label={t("Llamar familiar")}
                        onClick={() => startCall("callFamily")}
                      >
                        <IonIcon icon={people} slot="start" />
                        {t("Llamar familiar")}
                      </IonButton>
                    </div>
                    <IonButton
                      expand="block"
                      className="bt sos-act-ok"
                      onClick={imOk}
                      aria-label={
                        sosActive ? t("Estoy bien") : t("Cancelar activación")
                      }
                    >
                      <IonIcon
                        icon={sosActive ? checkmarkCircle : close}
                        slot="start"
                      />
                      {sosActive ? t("Estoy bien") : t("Cancelar activación")}
                    </IonButton>
                  </footer>
                </motion.div>
              ) : view === "confirm" ? (
                <motion.div
                  key="confirm"
                  className="sos-protocol"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="sos-scroll-body">
                    <section className="sos-alert-card">
                      <header className="sos-head">
                        <IonBadge className="sos-live on">
                          {t("CONFIRMACIÓN")}
                        </IonBadge>
                        <p>{t("Paso 2 de 2")}</p>
                      </header>
                      <div className="sos-copy">
                        <h1 aria-live="polite">
                          {t("¿Activar tu alerta SOS real?")}
                        </h1>
                        <p>
                          {sosEnabled
                            ? t(
                                "Se enviará una alerta a tu contacto de emergencia y a tu equipo médico, con tu ubicación si la compartes.",
                              )
                            : t(
                                "Modo simulación: no se enviará ninguna alerta real.",
                              )}
                        </p>
                      </div>
                    </section>
                  </div>
                  <footer className="sos-action-dock">
                    <div className="sos-actions">
                      <IonButton
                        className="bt sos-act-911"
                        aria-label={t("Sí, activar mi SOS")}
                        onClick={() => void confirmActivation()}
                        disabled={activating}
                      >
                        <IonIcon icon={checkmarkCircle} slot="start" />
                        {activating ? t("Enviando…") : t("Sí, activar mi SOS")}
                      </IonButton>
                      <IonButton
                        className="bt sos-act-fam"
                        aria-label={t("No, volver")}
                        onClick={() => setView("protocol")}
                        disabled={activating}
                      >
                        <IonIcon icon={close} slot="start" />
                        {t("No, volver")}
                      </IonButton>
                    </div>
                  </footer>
                </motion.div>
              ) : (
                <motion.div
                  key={view}
                  className={`sos-call ${calling911 ? "tone-911" : "tone-fam"}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="sos-call-body">
                    <div className="sos-call-kicker">
                      {calling911
                        ? t("EMERGENCIAS 911")
                        : t("CONTACTO DE EMERGENCIA")}
                    </div>

                    <div className="sos-call-orb">
                      <span className="sos-call-halo h1" />
                      <span className="sos-call-halo h2" />
                      <span className="sos-call-halo h3" />
                      <span className="sos-call-face">
                        {calling911 ? <IonIcon icon={medkit} /> : initials}
                      </span>
                    </div>

                    <h2>{calling911 ? "911" : family}</h2>
                    {!calling911 && (
                      <em className="sos-call-role">{familyRole}</em>
                    )}
                    <p className="sos-call-sub">
                      {calling911
                        ? phase === "connected"
                          ? t("Operador de emergencias · Miami-Dade")
                          : t("Central de emergencias")
                        : familyCel}
                    </p>
                    <div className={`sos-call-phase ${phase}`}>
                      <i />
                      {phase === "connected" ? mmss(callSec) : phaseLabel}
                    </div>
                    <Waveform live={phase === "connected"} />

                    <div className="sos-call-chips">
                      <span>
                        <IonIcon icon={location} /> {t("GPS en vivo")}
                      </span>
                      <span>
                        <IonIcon icon={heart} /> {t("FC 140 · SpO2 94%")}
                      </span>
                    </div>

                    {phase === "connected" && (
                      <p className="sos-call-note">
                        {calling911
                          ? t(
                              "Unidad en despacho. Quédate en el teléfono y no cuelgues.",
                            )
                          : t(
                              "{name} ya recibió tu alerta, ubicación y signos.",
                              { name: family.split(" ")[0] },
                            )}
                      </p>
                    )}
                  </div>
                  <footer className="sos-call-controls">
                    <div className="sos-call-bar">
                      <IonButton
                        className={`bt bt-round-lg sos-side ${speakerOn ? "on" : ""}`}
                        aria-label={
                          speakerOn
                            ? t("Altavoz encendido")
                            : t("Altavoz apagado")
                        }
                        aria-pressed={speakerOn ? "true" : "false"}
                        onClick={() => setSpeakerOn((v) => !v)}
                      >
                        <IonIcon icon={volumeHigh} slot="icon-only" />
                      </IonButton>
                      <IonButton
                        className="bt sos-hang"
                        aria-label={t("Colgar")}
                        onClick={hangUp}
                      >
                        <IonIcon icon={call} slot="icon-only" />
                      </IonButton>
                      <IonButton
                        className="bt bt-round-lg sos-side"
                        aria-label={t("Volver al protocolo")}
                        onClick={hangUp}
                      >
                        <IonIcon
                          icon={shieldCheckmarkOutline}
                          slot="icon-only"
                        />
                      </IonButton>
                    </div>
                    <div className="sos-control-labels">
                      <span>{t("Altavoz")}</span>
                      <span>{t("Colgar")}</span>
                      <span>{t("Protocolo")}</span>
                    </div>
                    <span className="sos-hang-lbl">
                      {t("Colgar y volver al protocolo")}
                    </span>
                  </footer>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
