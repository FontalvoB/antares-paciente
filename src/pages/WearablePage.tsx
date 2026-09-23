import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  IonAccordion,
  IonAccordionGroup,
  IonAlert,
  IonButton,
  IonProgressBar,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonToggle,
} from "@ionic/react";
import {
  batteryHalfOutline,
  bluetooth,
  copyOutline,
  pulseOutline,
  syncOutline,
  trashOutline,
} from "ionicons/icons";
import { EcgTrace } from "../components/EcgTrace";
import { PageHeader } from "../components/PageHeader";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { useWearable } from "../context/WearableContext";
import { describeServices, formatEntry } from "../devices/diagnostics";
import { useI18n } from "../i18n/I18nContext";
import { useElapsed } from "../hooks/useElapsed";
import { measurePhase, measurePhaseLabel } from "../utils/measure";
import { agoLabel, formatSleep } from "../utils/wearable";
import type {
  DeviceDescriptor,
  HealthSample,
  MeasureOutcome,
  MetricKind,
  WearableErrorCode,
} from "../devices/types";

const ERROR_KEYS: Record<WearableErrorCode, string> = {
  "bluetooth-off":
    "Bluetooth está apagado. Actívalo para buscar tu dispositivo.",
  "permission-denied":
    "Permiso de Bluetooth denegado. Habilítalo en los ajustes del sistema.",
  "scan-unavailable": "Tu navegador no permite buscar dispositivos Bluetooth.",
  "connection-failed": "No se pudo conectar. Inténtalo de nuevo.",
  "unsupported-device":
    "Este dispositivo no expone datos compatibles con la app.",
  "no-data":
    "El dispositivo no envía datos. Verifica que esté vinculado con su app oficial.",
  unknown: "Ocurrió un error inesperado. Inténtalo de nuevo.",
};

/** Etiqueta del botón de medida por métrica. */
const MEASURE_LABELS: Partial<Record<MetricKind, string>> = {
  heart_rate: "Medir FC ahora",
  spo2: "Medir SpO2 ahora",
  blood_pressure: "Medir presión ahora",
};

/** Red de seguridad de la UI: si el driver nunca avisa, se libera el botón. */
const MEASURE_SAFETY_MS = 45_000;

/** Hora local de hoy (para que la muestra de sueño parezca "de anoche"). */
function todayAt(hours: number, minutes: number): number {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

/**
 * Muestras de prueba del modo diagnóstico: recorren el mismo camino que una
 * lectura real (tarjetas, agregado del día) sin escribir nada en el backend.
 */
const DEBUG_SAMPLES: Array<{
  label: string;
  sample: () => Omit<HealthSample, "deviceId">;
}> = [
  {
    label: "Sueño 6 h 33 min",
    sample: () => ({
      metric: "sleep",
      value: 393,
      unit: "min",
      ts: todayAt(6, 33),
    }),
  },
  {
    label: "Pasos 6,240",
    sample: () => ({
      metric: "steps",
      value: 6240,
      unit: "count",
      ts: Date.now(),
    }),
  },
  {
    label: "FC 72",
    sample: () => ({
      metric: "heart_rate",
      value: 72,
      unit: "bpm",
      ts: Date.now(),
    }),
  },
  {
    label: "SpO2 98",
    sample: () => ({ metric: "spo2", value: 98, unit: "%", ts: Date.now() }),
  },
  {
    label: "Presión 118/76",
    sample: () => ({
      metric: "blood_pressure",
      value: 118,
      value2: 76,
      unit: "mmHg",
      ts: Date.now(),
    }),
  },
];

function signalBars(rssi?: number) {
  if (rssi === undefined) return 1;
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

function signalLabel(rssi?: number) {
  const bars = signalBars(rssi);
  if (bars === 4) return "Señal alta";
  if (bars === 3) return "Señal media";
  return "Señal baja";
}

function Signal({ n }: { n: number }) {
  return (
    <span className="bt-signal" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={i <= n ? "on" : ""} />
      ))}
    </span>
  );
}

export function WearablePage() {
  const { t, lang } = useI18n();
  // S3: locale activo para números (es-ES coma decimal / en-US punto).
  const locale = lang === "en" ? "en-US" : "es-ES";
  const { wearableConnected, wearableName, showToast } = useApp();
  const {
    phase,
    devices,
    hasScanned,
    info,
    samples,
    today,
    error,
    diagnostics,
    setDiagnostics,
    gatt,
    log,
    clearLog,
    measureKinds,
    measure,
    measurePolicy,
    syncing,
    syncStage,
    lastSyncAt,
    syncHistory,
    syncAll: syncAllAction,
    refreshInfo,
    savedDevice,
    reconnect,
    injectDebugSample,
    scan,
    connect,
    disconnect,
    clearError,
  } = useWearable();
  const [confirmOff, setConfirmOff] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState<{
    kind: MetricKind;
    since: number;
  } | null>(null);
  /** Cola de "Medir todo": se ejecuta una métrica tras otra. */
  const measureQueue = useRef<MetricKind[]>([]);
  const [queued, setQueued] = useState(0);
  /** Segundos transcurridos de la medida en curso (para la pista de espera). */
  const elapsed = useElapsed(measuring?.since);
  const syncElapsed = useElapsed(syncStage?.startedAt);
  const startRef = useRef<(kind: MetricKind) => void>(() => undefined);
  /** Temporizador que libera la medida si el driver no llama a onDone. */
  const measureSafety = useRef<number | undefined>(undefined);
  const announced = useRef(false);

  /** Fase del cronómetro de la medida en curso (ventana real del driver). */
  const measureProgress = measurePhase(
    elapsed * 1000,
    measuring ? measurePolicy(measuring.kind) : undefined,
  );
  /** Fase del sync (medidas que dispara "Sincronizar ahora"). */
  const syncProgress = measurePhase(
    syncElapsed * 1000,
    syncStage ? measurePolicy(syncStage.kind) : undefined,
  );

  const scanning = phase === "scanning";
  const connecting = phase === "connecting";
  const hrSample = samples.heart_rate;
  const hr = hrSample?.value;
  const spo2Sample = samples.spo2;
  const spo2 = spo2Sample?.value;
  const bloodSample = samples.blood_pressure;
  const blood = bloodSample;
  const steps = today.steps ?? samples.steps?.value ?? null;
  const stepsAt = samples.steps?.ts;
  const sleepMinutes = today.sleepMinutes;

  /**
   * Lista única de dispositivos: el último guardado (primero, con `Reconectar`)
   * más los encontrados al buscar (emparejados en el sistema o por anuncio),
   * sin duplicar por `deviceId`.
   */
  const deviceList = useMemo(() => {
    const entries: Array<DeviceDescriptor & { saved?: boolean }> = [];
    if (savedDevice) entries.push({ ...savedDevice, saved: true });
    for (const device of devices) {
      const index = entries.findIndex(
        (entry) => entry.deviceId === device.deviceId,
      );
      if (index === -1) {
        entries.push(device);
      } else {
        entries[index] = {
          ...entries[index],
          ...device,
          saved: entries[index].saved,
        };
      }
    }
    return entries;
  }, [devices, savedDevice]);

  useEffect(() => {
    if (phase !== "connecting" && pending) setPending(null);
  }, [phase, pending]);

  useEffect(() => {
    if (!hasScanned) {
      announced.current = false;
      return;
    }
    if (announced.current || !devices.length) return;
    announced.current = true;
    showToast(
      t("{count} dispositivos encontrados", { count: String(devices.length) }),
      "ok",
    );
  }, [devices.length, hasScanned, showToast, t]);

  // Al abrir la pantalla se re-pide la info del dispositivo: la batería solo
  // llegaba cuando el wearable la empujaba (p. ej. al abrir la app oficial).
  useEffect(() => {
    if (wearableConnected) refreshInfo();
  }, [refreshInfo, wearableConnected]);

  // Al abrir la pantalla, si hay un dispositivo recordado y no hay sesión, se
  // intenta reconectar sin que el usuario tenga que tocar nada (una vez por
  // entrada a la pantalla; los reintentos los lleva el contexto).
  const reconnectOnOpen = useRef(false);
  useEffect(() => {
    if (reconnectOnOpen.current) return;
    reconnectOnOpen.current = true;
    if (!wearableConnected && savedDevice) reconnect();
  }, [reconnect, savedDevice, wearableConnected]);

  // Al salir de la pantalla no queda ningún temporizador de medida vivo.
  useEffect(
    () => () => {
      if (measureSafety.current !== undefined) {
        window.clearTimeout(measureSafety.current);
        measureSafety.current = undefined;
      }
    },
    [],
  );

  /** Cierra la medida en curso y encadena la siguiente de la cola, si hay. */
  const finishMeasure = useCallback(
    (kind: MetricKind, ok: boolean, reason: MeasureOutcome) => {
      if (measureSafety.current !== undefined) {
        window.clearTimeout(measureSafety.current);
        measureSafety.current = undefined;
      }
      setMeasuring((current) => (current?.kind === kind ? null : current));
      if (!ok) {
        // Mensaje por causa real, no un genérico: el driver distingue entre
        // rechazo del sensor, fallo por contacto/movimiento y silencio.
        const message =
          reason === "refused"
            ? t("El wearable rechazó esta medición.")
            : reason === "failed"
              ? t("La medición falló por falta de contacto o movimiento.")
              : t(
                  "La medición no se completó. Mantén el wearable en contacto e inténtalo de nuevo.",
                );
        showToast(message, "err");
        // El dispositivo puede haber guardado la lectura en su historial: un
        // volcado extra la trae sin que el usuario tenga que reintentar.
        if (kind === "spo2") syncHistory();
      }
      const next = measureQueue.current.shift();
      setQueued(measureQueue.current.length);
      if (next) startRef.current(next);
    },
    [showToast, syncHistory, t],
  );

  const startMeasure = useCallback(
    (kind: MetricKind) => {
      setMeasuring({ kind, since: Date.now() });
      // Si el driver no avisa (bug o hardware mudo), la UI se libera sola:
      // antes el botón quedaba "midiendo" para siempre y bloqueaba los demás.
      if (measureSafety.current !== undefined) {
        window.clearTimeout(measureSafety.current);
      }
      measureSafety.current = window.setTimeout(
        () => finishMeasure(kind, false, "timeout"),
        MEASURE_SAFETY_MS,
      );
      measure(kind, (ok, reason) => finishMeasure(kind, ok, reason));
    },
    [finishMeasure, measure],
  );
  startRef.current = startMeasure;

  /** Una sola acción: FC → SpO2 → presión, en secuencia. */
  const measureAll = () => {
    if (measuring || measureQueue.current.length > 0) return;
    const [first, ...rest] = measureKinds;
    if (!first) return;
    measureQueue.current = rest;
    setQueued(rest.length);
    startMeasure(first);
  };

  /**
   * Sincronización completa (la implementa el contexto, compartida con
   * Programa): volcado de historial y luego las medidas que falten o estén
   * vencidas, en secuencia.
   */
  const syncAll = () => {
    if (syncing || measuring) return;
    void syncAllAction();
  };

  const copyDiagnostics = () => {
    const text = [describeServices(gatt), "", ...log.map(formatEntry)].join(
      "\n",
    );
    const failed = () =>
      showToast(t("Ocurrió un error inesperado. Inténtalo de nuevo."), "err");
    try {
      void navigator.clipboard
        .writeText(text)
        .then(() => showToast(t("Copiado al portapapeles"), "ok"))
        .catch(failed);
    } catch {
      failed();
    }
  };

  const pair = (device: DeviceDescriptor) => {
    if (connecting) return;
    setPending(device.deviceId);
    connect(device);
  };

  const liveHint =
    info.wearing === false
      ? t("Coloca el wearable para medir")
      : hr
        ? agoLabel(hrSample?.ts, t)
        : t("Sin datos aún");

  /** Etiqueta del botón de sync según la fase en curso. */
  const syncButtonLabel = measuring
    ? measurePhaseLabel(measuring.kind, measureProgress, elapsed, t)
    : syncStage
      ? measurePhaseLabel(syncStage.kind, syncProgress, syncElapsed, t)
      : t("Sincronizando…");

  return (
    <Screen>
      <PageHeader
        kicker={t("Biometría en vivo")}
        title={t("Wearable")}
        sub={
          wearableConnected
            ? `${info.name || wearableName} · ${t("datos en tiempo real")}`
            : t("Empareja un dispositivo para ver FC, sueño y SpO2")
        }
        trailing={
          <span className={`status-pill ${wearableConnected ? "on" : ""}`}>
            <span
              className="dot"
              style={{
                background: wearableConnected ? "var(--safe)" : "var(--mu)",
              }}
            />
            {wearableConnected ? t("Conectado") : t("Sin wearable")}
          </span>
        }
      />

      <Scroll>
        {!wearableConnected ? (
          <div className="watch-pair">
            <div
              className={`watch-radar ${scanning ? "is-scanning" : ""}`}
              aria-hidden="true"
            >
              <span className="watch-ring" />
              <span className="watch-ring" />
              <span className="watch-ring" />
              <div className="watch-face">
                <IonIcon icon={bluetooth} />
              </div>
            </div>

            <h2 className="watch-pair-title">
              {scanning ? t("Buscando cerca de ti…") : t("Conecta tu wearable")}
            </h2>
            <p className="watch-pair-copy">
              {connecting
                ? t("Estableciendo sesión con el dispositivo…")
                : scanning
                  ? t("Mantén el wearable desbloqueado y cerca del teléfono.")
                  : t(
                      "Recibiremos frecuencia cardíaca, sueño, presión, SpO2 y pasos.",
                    )}
            </p>

            {phase === "error" && error && (
              <p className="watch-pair-copy" style={{ color: "var(--red)" }}>
                {t(ERROR_KEYS[error])}
              </p>
            )}

            <div className="watch-caps">
              {["FC", "SpO2", "Presión", "Sueño", "Pasos", "Movilidad"].map(
                (item) => (
                  <span key={item} className="chip chip-teal">
                    {t(item)}
                  </span>
                ),
              )}
            </div>

            {/* Último guardado + encontrados al buscar, en una sola lista. */}
            {deviceList.length > 0 && (
              <>
                <div className="group-label">{t("Tus dispositivos")}</div>
                <IonList className="group-list" lines="full">
                  {deviceList.map((device) => (
                    <IonItem
                      key={device.deviceId}
                      className="group-item"
                      button
                      detail={false}
                      disabled={connecting}
                      onClick={() => pair(device)}
                    >
                      <div className="bt-dev-ico" slot="start">
                        <IonIcon icon={pulseOutline} />
                      </div>
                      <IonLabel>
                        <h3>{device.name || t("Dispositivo sin nombre")}</h3>
                        <p>
                          {device.paired
                            ? t("Ya emparejado en los ajustes del teléfono")
                            : t(signalLabel(device.rssi))}
                        </p>
                      </IonLabel>
                      <div slot="end" className="bt-dev-end">
                        {device.paired ? (
                          <span
                            className="chip chip-teal"
                            style={{ fontSize: 10, padding: "2px 8px" }}
                          >
                            {t("Emparejado")}
                          </span>
                        ) : (
                          <Signal n={signalBars(device.rssi)} />
                        )}
                        {pending === device.deviceId ? (
                          <IonSpinner
                            name="crescent"
                            style={{ width: 18, height: 18 }}
                          />
                        ) : (
                          <span className="bt-connect">
                            {device.saved ? t("Reconectar") : t("Conectar")}
                          </span>
                        )}
                      </div>
                    </IonItem>
                  ))}
                </IonList>
              </>
            )}

            {hasScanned && !devices.length && phase !== "error" && (
              <p className="watch-pair-copy">
                {t(
                  "No encontramos dispositivos cerca. Acércalo al teléfono e inténtalo de nuevo.",
                )}
              </p>
            )}

            {/* Se puede tocar de nuevo para cancelar la búsqueda en curso. */}
            <IonButton
              expand="block"
              className="bt bt-primary"
              onClick={scan}
              disabled={connecting}
            >
              {scanning ? (
                <>
                  <IonSpinner
                    name="crescent"
                    color="light"
                    style={{ width: 18, height: 18, marginRight: 8 }}
                  />
                  {t("Buscando dispositivos…")}
                </>
              ) : (
                <>
                  <IonIcon icon={bluetooth} slot="start" />
                  {t("Buscar dispositivo")}
                </>
              )}
            </IonButton>

            <IonList className="group-list" lines="none">
              <IonItem className="group-item">
                <IonLabel>
                  <h3>{t("Modo diagnóstico")}</h3>
                  <p>
                    {t("Muestra todos los dispositivos y el detalle GATT.")}
                  </p>
                </IonLabel>
                <IonToggle
                  slot="end"
                  checked={diagnostics}
                  onIonChange={(event) => setDiagnostics(event.detail.checked)}
                />
              </IonItem>
            </IonList>
          </div>
        ) : (
          <>
            {/* Estado del dispositivo + acciones, en una sola tarjeta. */}
            <section className="card dev-card">
              <div className="dev-card-top">
                <div className="bt-dev-ico">
                  <IonIcon icon={pulseOutline} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="watch-live-name">
                    {info.name || wearableName}
                  </div>
                  <div className="watch-live-meta">
                    {hr
                      ? agoLabel(hrSample?.ts, t)
                      : t("Bluetooth · sincronizando")}
                  </div>
                </div>
                {info.battery !== undefined && (
                  <div className="watch-batt">
                    <IonIcon icon={batteryHalfOutline} />
                    <strong>{info.battery}%</strong>
                  </div>
                )}
              </div>

              <div className="dev-card-meta">
                {info.firmware && (
                  <span>
                    {t("Firmware")} {info.firmware}
                  </span>
                )}
                <span>
                  {lastSyncAt
                    ? t("Última sincronización: {when}", {
                        when: agoLabel(lastSyncAt, t),
                      })
                    : t("Aún no sincronizado")}
                </span>
              </div>

              <div className="dev-card-actions">
                <IonButton
                  expand="block"
                  className="bt bt-primary"
                  disabled={syncing || measuring !== null}
                  onClick={syncAll}
                >
                  {syncing || measuring !== null ? (
                    <>
                      <IonSpinner
                        name="crescent"
                        color="light"
                        style={{ width: 16, height: 16, marginRight: 8 }}
                      />
                      {syncButtonLabel}
                    </>
                  ) : (
                    <>
                      <IonIcon icon={syncOutline} slot="start" />
                      {t("Sincronizar ahora")}
                    </>
                  )}
                </IonButton>
                <IonButton
                  expand="block"
                  size="small"
                  fill="clear"
                  className="bt"
                  style={
                    {
                      "--color": "var(--red)",
                    } as CSSProperties
                  }
                  onClick={() => setConfirmOff(true)}
                >
                  {t("Desconectar wearable")}
                </IonButton>
              </div>

              {(syncing || measuring !== null) && (
                <div className="dev-card-progress">
                  <IonProgressBar
                    value={
                      measuring
                        ? measureProgress.progress
                        : syncProgress.progress
                    }
                    aria-label={t("Progreso de la medición")}
                  />
                  <p className="cs">{syncButtonLabel}</p>
                </div>
              )}
            </section>

            {/* Un solo hero: FC grande + traza del pulso al ritmo real. */}
            <div className="vital-hero">
              <div className="vital-hero-kicker">
                {t("Frecuencia cardíaca")}
              </div>
              <div className="vital-hero-row">
                <div className="vital-hero-val">
                  {hr ? Math.round(hr) : "—"}
                  <span>{t("lpm")}</span>
                </div>
              </div>
              <EcgTrace bpm={hr} height={56} />
              <div className="vital-hero-hint">{liveHint}</div>
            </div>

            <div className="sec">{t("Métricas de hoy")}</div>
            <div className="grid-2">
              <div className="card card-accent ac-blue">
                <div
                  className="display"
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.6px",
                  }}
                >
                  {spo2 ? `${Math.round(spo2)}%` : "—"}
                </div>
                <div className="ct" style={{ marginTop: 4 }}>
                  {t("SpO2")}
                </div>
                <div className="cs">{agoLabel(spo2Sample?.ts, t)}</div>
              </div>
              <div className="card card-accent ac-org">
                <div
                  className="display"
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.6px",
                  }}
                >
                  {blood
                    ? `${Math.round(blood.value)}/${Math.round(blood.value2 ?? 0)}`
                    : "—"}
                </div>
                <div className="ct" style={{ marginTop: 4 }}>
                  {t("Presión")}
                </div>
                <div className="cs">{agoLabel(bloodSample?.ts, t)}</div>
              </div>
              <div className="card card-accent ac-pur">
                <div
                  className="display"
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.6px",
                  }}
                >
                  {sleepMinutes != null ? formatSleep(sleepMinutes, t) : "—"}
                </div>
                <div className="ct" style={{ marginTop: 4 }}>
                  {t("Sueño")}
                </div>
                <div className="cs">
                  {sleepMinutes != null
                    ? t("Última noche")
                    : t("Sin datos aún")}
                </div>
              </div>
              <div className="card card-accent ac-teal">
                <div
                  className="display"
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.6px",
                  }}
                >
                  {steps != null
                    ? Math.round(steps).toLocaleString(locale)
                    : "—"}
                </div>
                <div className="ct" style={{ marginTop: 4 }}>
                  {t("Pasos")}
                </div>
                <div className="cs">{agoLabel(stepsAt, t)}</div>
              </div>
            </div>

            {measureKinds.length > 0 && (
              <>
                <div className="sec">{t("Mediciones puntuales")}</div>
                <div style={{ padding: "0 16px" }}>
                  <IonButton
                    expand="block"
                    className="bt bt-primary"
                    disabled={measuring !== null || queued > 0 || syncing}
                    onClick={measureAll}
                  >
                    {measuring ? (
                      <>
                        <IonSpinner
                          name="crescent"
                          color="light"
                          style={{ width: 16, height: 16, marginRight: 8 }}
                        />
                        {queued > 0
                          ? t("Midiendo… · quedan {count}", {
                              count: String(queued + 1),
                            })
                          : t("Midiendo…")}
                      </>
                    ) : (
                      <>
                        <IonIcon icon={pulseOutline} slot="start" />
                        {t("Medir todo (FC, SpO2, presión)")}
                      </>
                    )}
                  </IonButton>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 16px 0",
                    flexWrap: "wrap",
                  }}
                >
                  {measureKinds.map((kind) => (
                    <IonButton
                      key={kind}
                      expand="block"
                      className="bt"
                      fill="outline"
                      disabled={measuring !== null || queued > 0 || syncing}
                      onClick={() => startMeasure(kind)}
                    >
                      {measuring?.kind === kind ? (
                        <>
                          <IonSpinner
                            name="crescent"
                            style={{ width: 16, height: 16, marginRight: 8 }}
                          />
                          {t("Midiendo…")}
                        </>
                      ) : (
                        t(MEASURE_LABELS[kind] ?? "Medir ahora")
                      )}
                    </IonButton>
                  ))}
                </div>
                {measuring ? (
                  <>
                    <div style={{ padding: "8px 0 4px" }}>
                      <IonProgressBar
                        value={measureProgress.progress}
                        aria-label={t("Progreso de la medición")}
                      />
                    </div>
                    <p className="watch-pair-copy">
                      {measurePhaseLabel(
                        measuring.kind,
                        measureProgress,
                        elapsed,
                        t,
                      )}
                    </p>
                  </>
                ) : (
                  <p className="watch-pair-copy">
                    {t("Mantén el wearable en contacto y sin moverte.")}
                  </p>
                )}
              </>
            )}

            {/* Lo que llena el volcado: pasos del día y sueño de anoche. */}
            <div className="sec">{t("Historial del wearable")}</div>
            <div className="card" style={{ margin: "0 16px", padding: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cs">{t("Pasos")}</div>
                  <div
                    className="display"
                    style={{ fontSize: 20, fontWeight: 800 }}
                  >
                    {steps != null
                      ? Math.round(steps).toLocaleString(locale)
                      : "—"}
                  </div>
                  <div className="cs">{agoLabel(stepsAt, t)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cs">{t("Sueño")}</div>
                  <div
                    className="display"
                    style={{ fontSize: 20, fontWeight: 800 }}
                  >
                    {sleepMinutes != null ? formatSleep(sleepMinutes, t) : "—"}
                  </div>
                  <div className="cs">
                    {sleepMinutes != null
                      ? t("Última noche")
                      : t("Sin datos aún")}
                  </div>
                </div>
              </div>
            </div>

            {/* Avanzado: diagnóstico colapsado para no ensuciar la vista. */}
            <div className="sec">{t("Avanzado")}</div>
            <div style={{ padding: "0 16px" }}>
              <IonAccordionGroup className="adv-group">
                <IonAccordion value="diagnostics">
                  <IonItem slot="header" lines="none">
                    <IonLabel>
                      <h3>{t("Modo diagnóstico")}</h3>
                      <p>
                        {t("Muestra todos los dispositivos y el detalle GATT.")}
                      </p>
                    </IonLabel>
                  </IonItem>
                  <div slot="content">
                    <IonList className="group-list" lines="none">
                      <IonItem className="group-item">
                        <IonLabel>{t("Activar diagnóstico")}</IonLabel>
                        <IonToggle
                          slot="end"
                          checked={diagnostics}
                          onIonChange={(event) =>
                            setDiagnostics(event.detail.checked)
                          }
                        />
                      </IonItem>
                    </IonList>

                    {diagnostics && (
                      <>
                        <div className="cs" style={{ marginTop: 12 }}>
                          {t("Inyectar muestra de prueba")}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 6,
                          }}
                        >
                          {DEBUG_SAMPLES.map((entry) => (
                            <IonButton
                              key={entry.label}
                              size="small"
                              className="bt"
                              fill="outline"
                              onClick={() => {
                                injectDebugSample(entry.sample());
                                showToast(
                                  t("Muestra de prueba inyectada (solo local)"),
                                  "ok",
                                );
                              }}
                            >
                              {t(entry.label)}
                            </IonButton>
                          ))}
                        </div>

                        <div className="cs" style={{ marginTop: 12 }}>
                          {t("Servicios GATT")}
                        </div>
                        <pre className="adv-pre">
                          {gatt.length
                            ? describeServices(gatt)
                            : t("Sin datos aún")}
                        </pre>

                        <div className="cs" style={{ marginTop: 12 }}>
                          {t("Registro BLE")} · {log.length}
                        </div>
                        <pre className="adv-pre" style={{ maxHeight: 220 }}>
                          {log.length
                            ? log.map(formatEntry).join("\n")
                            : t("Sin datos aún")}
                        </pre>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <IonButton
                            size="small"
                            className="bt"
                            onClick={copyDiagnostics}
                          >
                            <IonIcon icon={copyOutline} slot="start" />
                            {t("Copiar")}
                          </IonButton>
                          <IonButton
                            size="small"
                            className="bt"
                            fill="outline"
                            onClick={clearLog}
                          >
                            <IonIcon icon={trashOutline} slot="start" />
                            {t("Limpiar")}
                          </IonButton>
                        </div>
                      </>
                    )}
                  </div>
                </IonAccordion>
              </IonAccordionGroup>
            </div>

            <div style={{ height: 20 }} />
          </>
        )}
      </Scroll>

      <IonAlert
        isOpen={confirmOff}
        header={t("¿Desconectar el wearable?")}
        message={t(
          "Dejarán de llegar datos en vivo hasta que lo vuelvas a emparejar.",
        )}
        buttons={[
          { text: t("Seguir conectado"), role: "cancel" },
          {
            text: t("Desconectar"),
            role: "destructive",
            handler: () => {
              disconnect();
              clearError();
              showToast(t("Wearable desconectado"), "warn");
            },
          },
        ]}
        onDidDismiss={() => setConfirmOff(false)}
      />
    </Screen>
  );
}
