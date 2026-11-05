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
  chatbubbles,
  checkmarkCircle,
  close,
  heart,
  location,
  mailOutline,
  medkit,
  people,
  pulse,
  shieldCheckmarkOutline,
  informationCircleOutline,
  hourglass,
  flame,
  shield,
} from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useApp } from "../context/AppContext";
import { useWearable } from "../context/WearableContext";
import type { HealthSample, MetricKind } from "../devices/types";
import { useT } from "../i18n/I18nContext";
import {
  SosServiceError,
  activateSosAlert,
  cancelSosAlert,
  fetchActiveSosAlert,
  getCoordinatesBestEffort,
  getEmergencyLocation,
  type SosVitalsDto,
  type SosAlertDto,
} from "../services/sos/sos-service";
import { openNativeDialer } from "../utils/nativeDialer";
import { emergencyNumberForCountry } from "../utils/emergencyNumbers";
import type { EmergencyCountry } from "../utils/emergencyNumbers";

import logoIcon from "../assets/LogoIndividual.png";

type SosView = "protocol" | "confirm";
/** Botones de llamada manual: emergencias del país (911/123) o el contacto
 * de emergencia (tel: nativo). */
type DialTarget = "callEmergency" | "callFamily";

const RING = 2 * Math.PI * 78;
/** Sondeo ligero del estado real de la alerta (REQ-SOS-07). */
const ACTIVE_POLL_MS = 15_000;
/** Solo lecturas en vivo de los últimos cinco minutos; nunca datos de prueba. */
const SOS_VITAL_MAX_AGE_MS = 5 * 60_000;
const COUNTRY_REFRESH_MS = 60_000;

function recentVitals(samples: Partial<Record<MetricKind, HealthSample>>, now: number): SosVitalsDto | null {
  const fresh = (sample: HealthSample | undefined): sample is HealthSample => !!sample && sample.source !== "history" &&
    sample.deviceId !== "debug" && Number.isFinite(sample.ts) &&
    now - sample.ts >= 0 && now - sample.ts <= SOS_VITAL_MAX_AGE_MS && Number.isFinite(sample.value);
  const vitals: SosVitalsDto = {};
  const hr = samples.heart_rate;
  const oxygen = samples.spo2;
  const pressure = samples.blood_pressure;
  if (fresh(hr) && hr.value >= 20 && hr.value <= 300) vitals.heartRate = Math.round(hr.value);
  if (fresh(oxygen) && oxygen.value >= 50 && oxygen.value <= 100) vitals.spo2 = Math.round(oxygen.value);
  if (fresh(pressure) && pressure.value > 0 && pressure.value2 !== undefined && Number.isFinite(pressure.value2) && pressure.value2 > 0) {
    const bloodPressure = `${Math.round(pressure.value)}/${Math.round(pressure.value2)}`;
    if (bloodPressure.length <= 20) vitals.bloodPressure = bloodPressure;
  }
  return Object.keys(vitals).length ? vitals : null;
}

const EMERGENCY_SERVICES = [
  { key: "ambulance", label: "Ambulancia", description: "Atención médica", icon: medkit },
  { key: "police", label: "Policía", description: "Seguridad y protección", icon: shield },
  { key: "fire", label: "Bomberos", description: "Incendios y rescate", icon: flame },
] as const;


export function PanicOverlay() {
  const { panicOpen, sosActive, closePanic, activateSos, user, showToast } =
    useApp();
  const t = useT();
  const wearable = useWearable();
  const wearableRef = useRef(wearable);
  wearableRef.current = wearable;
  const reduce = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<SosView>("protocol");
  // SOS real (change sos-panic-real): flujo exclusivamente real, sin
  // simulación local. La activación SIEMPRE exige doble confirmación
  // deliberada (REQ-SOS-07: nunca auto-activación por inactividad — el
  // temporizador de 5 s se elimina).
  const [alertId, setAlertId] = useState<string | null>(null);
  /** Alerta real (POST /api/v1/sos/alerts o GET /alerts/active): fuente del
   * copy honesto — estado del canal SMS y ubicación efectiva (BUG-01). */
  const [realAlert, setRealAlert] = useState<SosAlertDto | null>(null);
  // Las acciones del contexto cambian de identidad al renderizar. Mantenerlas
  // fuera de las dependencias evita cancelar cada sondeo antes de su respuesta.
  const alertActions = useRef({ closePanic, showToast });
  alertActions.current = { closePanic, showToast };
  const [activating, setActivating] = useState(false);
  /** Cuenta regresiva 429 (segundos de Retry-After) que bloquea el orbe. */
  const [rateLimitSecs, setRateLimitSecs] = useState(0);
  /** Sondeo rápido (3 s) durante el primer minuto tras activar. */
  const [fastPoll, setFastPoll] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<EmergencyCountry | null>(null);
  const [manualCountry, setManualCountry] = useState<EmergencyCountry | null>(null);
  const manualCountryRef = useRef(manualCountry);
  manualCountryRef.current = manualCountry;
  const [locationStatus, setLocationStatus] = useState<"locating" | "located" | "unavailable" | "unsupported">("locating");
  const [sharedVitals, setSharedVitals] = useState(false);

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
  const emergencyCountry = manualCountry ?? detectedCountry;
  const emergencyNumber = emergencyCountry ? emergencyNumberForCountry(emergencyCountry) : null;
  const countryLabel = emergencyCountry === "CO" ? t("Colombia") : t("Estados Unidos");

  // La selección manual prevalece. El país obtenido por GPS se renueva al
  // volver a la app y cada minuto mientras esta pantalla siga abierta.
  useEffect(() => {
    if (!panicOpen) return;
    let cancelled = false;
    let pending = false;
    let nativeActive = true;
    let lastAttempt = 0;
    let expiry: number | undefined;
    setDetectedCountry(null);
    setManualCountry(null);
    manualCountryRef.current = null;
    const detect = () => {
      if (cancelled || pending || manualCountryRef.current || !nativeActive || document.visibilityState === "hidden") return;
      pending = true;
      lastAttempt = Date.now();
      setDetectedCountry(null);
      setLocationStatus("locating");
      void getEmergencyLocation().then((result) => {
        if (cancelled) return;
        setDetectedCountry(result.country);
        setLocationStatus(result.status);
        if (result.status === "located" && !manualCountryRef.current) expiry = window.setTimeout(detect, COUNTRY_REFRESH_MS);
      }).catch(() => {
        if (!cancelled) setLocationStatus("unavailable");
      }).finally(() => { pending = false; });
    };
    const resume = () => {
      if (!nativeActive || document.visibilityState === "hidden" || Date.now() - lastAttempt < 5_000) return;
      window.clearTimeout(expiry);
      detect();
    };
    detect();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    const handle = Capacitor.isNativePlatform()
      ? App.addListener("appStateChange", ({ isActive }) => { nativeActive = isActive; if (isActive) resume(); }).catch(() => null) : null;
    return () => {
      cancelled = true;
      window.clearTimeout(expiry);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      void handle?.then((listener) => listener?.remove());
    };
  }, [panicOpen]);

  useEffect(() => {
    if (!panicOpen) {
      setView("protocol");
      setAlertId(null);
      setRealAlert(null);
      setActivating(false);
      setRateLimitSecs(0);
      setFastPoll(false);
      setSharedVitals(false);
    }
  }, [panicOpen]);

  // REQ-SOS-07 (eliminado): ya NO existe el temporizador que activaba SOS a
  // los 5 s de inactividad. La alerta solo nace de la doble confirmación
  // (toque del orbe → pantalla de confirmación → botón afirmativo). El copy
  // de "progreso" (lit) también salió: se refleja el estado real de la
  // alerta (BUG-01), no una secuencia animada fabricada.

  // SOS real activo: sondeo ligero (15 s) para reflejar Atendida/Cancelada
  // (REQ-SOS-07) y el estado vivo de los canales (BUG-01). Una alerta que ya
  // no está activa saca al paciente de la vista de emergencia automáticamente.
  useEffect(() => {
    if (!sosActive || !panicOpen) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const alert = await fetchActiveSosAlert();
        if (cancelled) return;
        if (!alert || alert.status !== "Activa") {
          alertActions.current.closePanic();
          alertActions.current.showToast(t("Tu alerta SOS ya fue atendida."), "ok");
        } else {
          setAlertId(alert.id);
          setRealAlert(alert);
        }
      } catch {
        /* sondeo best-effort: el próximo tick reintenta */
      }
    };
    const id = window.setInterval(
      () => void poll(),
      fastPoll ? 3_000 : ACTIVE_POLL_MS,
    );
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sosActive, panicOpen, t, fastPoll]);

  // Refresco rápido (3 s) durante el primer minuto tras activar: el estado
  // real de entrega (SMS/llamada) suele resolverse en segundos.
  useEffect(() => {
    if (!fastPoll) return;
    const id = window.setTimeout(() => setFastPoll(false), 60_000);
    return () => window.clearTimeout(id);
  }, [fastPoll]);

  // Cuenta regresiva del 429 (Retry-After): bloquea el orbe hasta expirar.
  useEffect(() => {
    if (rateLimitSecs <= 0) return;
    const id = window.setInterval(() => {
      setRateLimitSecs((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [rateLimitSecs]);

  /**
   * Llamada nativa (tel:): abre el marcador del teléfono con el número de
   * emergencias del país (123 en Colombia, 911 en EE. UU.) o con el número
   * del contacto de emergencia. REQ-SOS-07: abrir una llamada ya NO activa
   * SOS implícitamente. Sin número configurado se avisa y no se navega.
   */
  const startCall = (target: DialTarget) => {
    if (target === "callEmergency") {
      if (emergencyNumber) openNativeDialer(emergencyNumber);
      return;
    }

    if (!openNativeDialer(familyCel)) {
      showToast(
        t("No hay un contacto de emergencia con teléfono configurado."),
        "err",
      );
    }
  };

  /**
   * Confirmación deliberada (segundo paso de la doble confirmación):
   * GPS best-effort → activación real en el backend → estado visual
   * "SOS ACTIVO". Los errores del backend se presentan sin bloquear el
   * protocolo visual.
   */
  const confirmActivation = async () => {
    setView("protocol");
    if (activating || sosActive || rateLimitSecs > 0) return;
    setActivating(true);
    try {
      const coords = await getCoordinatesBestEffort();
      const current = wearableRef.current;
      const vitals = current.phase === "connected" && !current.sessionStale && current.info.wearing !== false
        ? recentVitals(current.samples, Date.now()) : null;
      const alert: SosAlertDto = await activateSosAlert(coords, vitals);
      setSharedVitals(vitals !== null);
      setAlertId(alert.id);
      // La respuesta real del backend alimenta el copy (BUG-01):
      // smsChannelStatus + location deciden qué se puede afirmar.
      setRealAlert(alert);
      setFastPoll(true);
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
        } else if (err.status === 409) {
          // Ya existe una alerta activa: adoptarla en vez de fallar. El aviso
          // (llamada/SMS) ya se disparó al crearla; para re-notificar hay que
          // cancelarla con "Estoy bien" y activar de nuevo.
          const active = await fetchActiveSosAlert();
          if (active) {
            setAlertId(active.id);
            setRealAlert(active);
            setFastPoll(true);
            activateSos();
            showToast(
              t(
                "Ya tenías una alerta SOS activa. Mostrándola; pulsa Estoy bien para cancelarla.",
              ),
              "ok",
            );
          } else {
            showToast(err.message, "err");
          }
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
    if (alertId) {
      void cancelSosAlert(alertId).catch(() => {
        /* la alerta real se atiende igual; el cierre local no depende de esto */
      });
    }
    closePanic();
    showToast(t("Alerta cancelada. Quédate en observación."), "ok");
  };

  const ringPct = sosActive ? 1 : 0;

  // ── Copy honesto según el estado REAL de la alerta (BUG-01) ────────────────
  // Fuente: respuesta de POST /api/v1/sos/alerts y sondeo de GET /alerts/active.
  const smsStatus = realAlert?.smsChannelStatus ?? null;
  const smsSent = smsStatus === "Enviado";
  // Degradación: canal reportado distinto de Enviado/Pendiente (Fallido,
  // Timeout, NoConfigurado). Sin afirmar entrega ni GPS.
  const smsDegraded =
    !!smsStatus && smsStatus !== "Enviado" && smsStatus !== "Pendiente";
  const voiceStatus = realAlert?.voiceChannelStatus ?? null;
  const voiceSent = voiceStatus === "Enviado";
  // Mismo criterio para el canal de voz: distinto de Enviado/Pendiente.
  const voiceDegraded =
    !!voiceStatus &&
    voiceStatus !== "Enviado" &&
    voiceStatus !== "Pendiente";
  /** Correo al contacto: canal opcional. SinDestino = no hay correo (no se envía). */
  const emailStatus = realAlert?.emailChannelStatus ?? null;
  /** Al menos un canal de contacto (voz o SMS) confirmó entrega. */
  const contactSent = voiceSent || smsSent;
  /** Algún canal de contacto degradó y ninguno confirmó entrega. */
  const contactDegraded = voiceDegraded || smsDegraded;
  const locationShared = realAlert?.location != null;

  const activeCopy = voiceSent && smsSent
    ? t("Llamada y SMS enviados a tu contacto de emergencia.")
    : voiceSent
      ? t("Llamada realizada a tu contacto de emergencia.")
      : smsSent
        ? t("SMS enviado a tu contacto de emergencia.")
        : contactDegraded
          ? t(
              "Alerta registrada para tu equipo clínico. Canal de contacto no disponible en este momento.",
            )
          : t("Alerta registrada para tu equipo clínico.");
  const locationCopy = locationShared
    ? t("Tu ubicación fue compartida con tu equipo.")
    : t("Sin ubicación en esta alerta.");

  /** Duración de llamada en formato m:ss (65 → "1:05"). */
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.max(0, Math.floor(seconds % 60));
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  /** Estado de entrega por canal: refleja lo reportado por el backend. */
  const deliveryLabel = (
    status: string | null,
    okLabel: string,
    deliveryStatus?: string | null,
    answeredBy?: string | null,
    durationSeconds?: number | null,
  ) => {
    // Entrega real reportada por Twilio (statusCallback), tiene prioridad
    // sobre el estado de aceptación del envío.
    if (deliveryStatus === "delivered") return t("Entregado");
    if (deliveryStatus === "undelivered") return t("No entregado");
    if (deliveryStatus === "completed") {
      if (answeredBy === "machine_start") return t("Buzón de voz");
      const label = t("Contestada");
      return durationSeconds && durationSeconds > 0
        ? `${label} · ${formatDuration(durationSeconds)}`
        : label;
    }
    if (deliveryStatus === "no-answer") return t("No contestada");
    if (deliveryStatus === "busy") return t("Ocupado");
    if (deliveryStatus === "canceled") return t("Cancelada");
    if (deliveryStatus === "failed") return t("Falló");
    if (status === "Enviado") return okLabel;
    if (status === "SinDatos") return t("Sin datos");
    if (!status) return t("Pendiente");
    if (status === "Pendiente") return t("Enviando…");
    if (status === "SinDestino") return t("Sin correo registrado");
    if (status === "NoConfigurado") return t("No disponible");
    if (status === "Timeout") return t("Sin respuesta");
    return t("Falló");
  };
  const deliveryRows = [
    {
      key: "voice",
      ico: call,
      title: t("Llamada al contacto"),
      status: voiceStatus,
      okLabel: t("Realizada"),
      deliveryStatus: realAlert?.voiceCallStatus ?? null,
      answeredBy: realAlert?.voiceAnsweredBy ?? null,
      durationSeconds: realAlert?.voiceDurationSeconds ?? null,
    },
    {
      key: "sms",
      ico: chatbubbles,
      title: t("SMS al contacto"),
      status: smsStatus,
      okLabel: t("Enviado"),
      deliveryStatus: realAlert?.smsDeliveryStatus ?? null,
      answeredBy: null,
      durationSeconds: null,
    },
    {
      key: "email",
      ico: mailOutline,
      title: t("Correo al contacto"),
      // Backend viejo (sin emailChannelStatus en el DTO): "Sin datos" en vez
      // de un falso "Pendiente" — el correo pudo haberse enviado igual.
      status: emailStatus ?? "SinDatos",
      okLabel: t("Enviado"),
      deliveryStatus: null,
      answeredBy: null,
      durationSeconds: null,
    },
    {
      key: "push",
      ico: people,
      title: t("Equipo clínico"),
      status: realAlert?.pushChannelStatus ?? null,
      deliveryStatus: null,
      answeredBy: null,
      durationSeconds: null,
      okLabel: t("Notificado"),
    },
  ];

  const rows: {
    key: string;
    ico: string;
    title: string;
    sub: string;
    tone: string;
    /** El check solo se muestra cuando el estado REAL lo respalda. */
    on: boolean;
  }[] = [
    {
      key: "fam",
      ico: people,
      title: family,
      sub: voiceSent && smsSent
        ? t("Llamada y SMS enviados · {phone}", { phone: familyCel })
        : voiceSent
          ? t("Llamada realizada · {phone}", { phone: familyCel })
          : smsSent
            ? t("SMS enviado · {phone}", { phone: familyCel })
            : sosActive && contactDegraded
              ? t("Canal de contacto no disponible en este momento")
              : `${familyRole} · ${familyCel}`,
      tone: "ice",
      on: contactSent,
    },
    {
      key: "doc",
      ico: pulse,
      title: t("Equipo clínico"),
      sub:
        sosActive
          ? t("Alerta registrada para tu equipo clínico")
          : t("Médico de cabecera"),
      tone: "blue",
      on: realAlert?.pushChannelStatus === "Enviado",
    },
    {
      key: "gps",
      ico: location,
      title: t("Ubicación GPS"),
      sub: sosActive ? locationCopy : t("Se comparte al activar"),
      tone: "teal",
      on: locationShared,
    },
    {
      key: "vit",
      ico: heart,
      title: t("Signos vitales"),
      sub: sosActive && sharedVitals
        ? t("Lecturas recientes del wearable compartidas")
        : t("Sin lecturas recientes confirmadas en esta alerta"),
      tone: "org",
      on: sosActive && sharedVitals,
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
            className={`overlay overlay-panic sos-screen sos-modern sos-reference ${view === "protocol" ? "is-protocol" : ""} ${sosActive ? "is-hot" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <header className="sos-topbar">
              <div className="sos-brand">
                <img src={logoIcon} alt="" />
                <div><strong>COPP-ADRESD<sup>®</sup></strong><small>COMPREHENSIVE OBESITY<br />PREVENTION PROGRAM</small></div>
              </div>
              <div className="sos-greeting"><h1>{t('Hola, {nombre} 👋', { nombre: user.nombre || t('Paciente') })}</h1><p>{t('Tu salud es nuestra prioridad')}</p></div>
              <IonButton
                fill="clear"
                className="sos-top-close"
                onClick={imOk}
                aria-label={
                  sosActive ? t("Estoy bien") : t("Cancelar activación")
                }
              >
                <IonIcon icon={close} slot="start" />
                {sosActive ? t("Cerrar") : t("Cancelar")}
              </IonButton>
            </header>
            {view !== "protocol" && (            <div className="sos-demo-note">
              <IonIcon icon={informationCircleOutline} aria-hidden="true" />
              <span>
                {t(
                  "Alerta real: se notificará a tu contacto de emergencia por llamada y SMS.",
                )}
              </span>
            </div>)}

            <AnimatePresence initial={false}>
              {view !== "confirm" ? (
                <motion.div
                  key="protocol"
                  className="sos-protocol"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="sos-scroll-body">
                    <section className="sos-services" aria-labelledby="sos-services-title">
                      <div className="sos-section-heading">
                        <div>
                          <small>{t("LLAMAR A EMERGENCIAS")}</small>
                          <h2 id="sos-services-title">{t("¿Qué ayuda necesitas?")}</h2>
                        </div>
                        <IonIcon icon={call} aria-hidden="true" />
                      </div>
                      <p className="sos-country-status" role="status" aria-live="polite">
                        <IonIcon icon={location} aria-hidden="true" />
                        {manualCountry
                          ? t("País confirmado por ti: {pais}", { pais: countryLabel })
                          : detectedCountry
                            ? t("Ubicación del dispositivo: {pais}", { pais: countryLabel })
                            : locationStatus === "locating"
                              ? t("Buscando tu ubicación. Puedes confirmar el país ahora.")
                              : locationStatus === "unsupported"
                                ? t("Ubicación fuera de cobertura o cerca de una frontera. Confirma el país.")
                                : t("No pudimos obtener tu ubicación. Confirma el país para llamar.")}
                      </p>
                      <div className="sos-country-options" role="group" aria-label={t("País para llamar")}>
                        {(["CO", "US"] as const).map((country) => (
                          <IonButton
                            key={country}
                            className={emergencyCountry === country ? "is-selected" : undefined}
                            fill={emergencyCountry === country ? "solid" : "outline"}
                            aria-pressed={emergencyCountry === country}
                            onClick={() => { manualCountryRef.current = country; setManualCountry(country); }}
                          >
                            {country === "CO" ? t("Colombia") : t("Estados Unidos")}
                          </IonButton>
                        ))}
                      </div>
                      <div className="sos-service-actions" role="group" aria-label={t("Servicios de emergencia")}>
                        {EMERGENCY_SERVICES.map((service) => (
                          <IonButton
                            key={service.key}
                            className={`sos-service-action service-${service.key}`}
                            disabled={!emergencyNumber}
                            aria-label={emergencyNumber
                              ? t("Llamar: {servicio} · {numero}", { servicio: t(service.label), numero: emergencyNumber })
                              : t("Confirma el país para llamar: {servicio}", { servicio: t(service.label) })}
                            onClick={() => startCall("callEmergency")}
                          >
                            <span className="sos-service-content">
                              <IonIcon icon={service.icon} aria-hidden="true" />
                              <strong>{t(service.label)}</strong>
                              <span>{t(service.description)}</span>
                              <b>{emergencyNumber ? t("Llamar {numero}", { numero: emergencyNumber }) : t("Confirma el país")}</b>
                            </span>
                          </IonButton>
                        ))}
                      </div>
                      <p className="sos-services-note">
                        {emergencyNumber
                          ? t("Las tres opciones llaman al {numero}. Indica al operador si necesitas ambulancia, policía o bomberos.", { numero: emergencyNumber })
                          : t("Confirma Colombia o Estados Unidos para mostrar el número de emergencias.")}
                      </p>
                      <p className="sos-services-separate">{t("Estas llamadas son independientes de la alerta a tu contacto y equipo clínico.")}</p>
                    </section>
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
                              <><IonIcon icon={medkit} aria-hidden="true" /><b>SOS</b></>
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
                            ? `${activeCopy} ${locationCopy}`
                            : t(
                                "Toca SOS y confirma para solicitar ayuda a tu contacto de emergencia y a tu equipo clínico.",
                              )}
                        </p>
                      </div>
            <div className="sos-demo-note">
              <IonIcon icon={informationCircleOutline} aria-hidden="true" />
              <span>
                {t(
                  "Alerta real: se notificará a tu contacto de emergencia por llamada y SMS.",
                )}
              </span>
            </div>
                    {sosActive && (
                      <div className="sos-delivery">
                        <div className="sos-delivery-head">
                          <small>{t("ESTADO DE LA ENTREGA")}</small>
                          <h2>{t("Confirmación de canales")}</h2>
                        </div>
                        <ul className="sos-delivery-list">
                          {deliveryRows.map((d) => {
                            const label = deliveryLabel(
                              d.status,
                              d.okLabel,
                              d.deliveryStatus,
                              d.answeredBy,
                              d.durationSeconds,
                            );
                            const isVoicemail =
                              d.deliveryStatus === "completed" &&
                              d.answeredBy === "machine_start";
                            // Sin estados "esperando": si el canal ya se
                            // despachó, se muestra como realizado aunque el
                            // callback tarde (esto es una emergencia).
                            const finalNegative =
                              d.deliveryStatus === "no-answer" ||
                              d.deliveryStatus === "busy" ||
                              d.deliveryStatus === "canceled" ||
                              d.deliveryStatus === "failed" ||
                              d.deliveryStatus === "undelivered";
                            const okDelivery =
                              !isVoicemail &&
                              !finalNegative &&
                              (d.deliveryStatus === "delivered" ||
                                d.deliveryStatus === "completed" ||
                                d.status === "Enviado");
                            const pendingDelivery =
                              isVoicemail ||
                              !d.status ||
                              d.status === "Pendiente" ||
                              // Sin correo registrado no es fallo: neutro.
                              d.status === "SinDestino" ||
                              // Backend sin el campo de correo: tampoco es fallo.
                              d.status === "SinDatos";
                            const tone = okDelivery
                              ? "ok"
                              : pendingDelivery
                                ? "pending"
                                : "bad";
                            return (
                              <li
                                key={d.key}
                                className={`sos-delivery-row ${tone}`}
                              >
                                <IonIcon icon={d.ico} aria-hidden="true" />
                                <span>{d.title}</span>
                                <b>{label}</b>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
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
                        {realAlert?.recipients?.map(recipient => <IonItem key={recipient.id} className="sos-feed-row sos-recipient-row">
                          <span slot="start" className="sos-feed-ico"><IonIcon icon={people} aria-hidden="true" /></span>
                          <IonLabel><strong>{t(recipient.contactOrder === 0 ? "Contacto principal" : "Contacto de respaldo")}</strong>
                            {recipient.maskedPhone && <small>{recipient.maskedPhone}</small>}
                            <dl className="sos-recipient-channels">
                              <div><dt>SMS</dt><dd>{deliveryLabel(recipient.smsChannelStatus, t("Aceptado por el proveedor"), recipient.smsDeliveryStatus)}</dd></div>
                              <div><dt>{t("Llamada")}</dt><dd>{deliveryLabel(recipient.voiceChannelStatus, t("Llamada solicitada"), recipient.voiceCallStatus)}</dd></div>
                              {recipient.emailChannelStatus && <div><dt>{t("Correo")}</dt><dd>{deliveryLabel(recipient.emailChannelStatus, t("Enviado"))}</dd></div>}
                            </dl>
                          </IonLabel>
                        </IonItem>)}
                        {rows.slice(realAlert?.recipients?.length ? 1 : 0, 2).map((r) => {
                          // BUG-01: el check refleja el estado REAL del canal,
                          // no una secuencia animada (r.on lo decide).
                          const on = r.on;
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
                        {rows.slice(2).map((row) => (
                          <article
                            key={row.key}
                            // BUG-01: encendido solo con respaldo real (GPS).
                            className={`sos-data-card ${row.on ? "on" : ""}`}
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
                    <div className="sos-actions sos-contact-actions">
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
              ) : (
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
                          {t(
                            "Se enviará una alerta a tu contacto de emergencia y a tu equipo médico, con tu ubicación si la compartes.",
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
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
