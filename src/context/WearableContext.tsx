import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { BleService } from "@capacitor-community/bluetooth-le";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import * as ble from "../devices/ble/ble-client";
import { DIAG_LOG_LIMIT, shortUuid } from "../devices/diagnostics";
import type { DiagEntry } from "../devices/diagnostics";
import {
  applySample,
  EMPTY_TOTALS,
  newDayStore,
  totalsOf,
} from "../devices/day-totals";
import type { DayStore, DeviceDayTotals } from "../devices/day-totals";
import { mergeDiscovered } from "../devices/discovery";
import { staleMeasureKinds } from "../devices/measure";
import {
  canAutoReconnectHere,
  clearSavedDevice,
  loadSavedDevice,
  saveDevice,
} from "../devices/device-store";
import type { SavedDevice } from "../devices/device-store";
import { toWearableError } from "../devices/errors";
import { openSession } from "../devices/registry";
import { toHex } from "../devices/util";
import { programKeys } from "../hooks/queryKeys";
import { recordDeviceMetrics } from "../services/program/metrics-history-service";
import { toLocalISODate } from "../utils/dates";
import { useT } from "../i18n/I18nContext";
import { useApp } from "./AppContext";
import type {
  DeviceDescriptor,
  DeviceInfo,
  DeviceSession,
  HealthSample,
  MeasureCallback,
  MeasurePolicy,
  MetricKind,
  WearableErrorCode,
} from "../devices/types";

export type { DeviceDayTotals } from "../devices/day-totals";

export type WearablePhase =
  "idle" | "scanning" | "connecting" | "connected" | "error";

/** Ingreso periódico de métricas: agrupa cambios y evita un POST por muestra. */
const INGEST_INTERVAL_MS = 60_000;
/** Espera mínima entre reintentos automáticos (arranque/segundo plano). */
const RECONNECT_DEBOUNCE_MS = 15_000;
/**
 * Escalera de reintentos de la reconexión automática: al abrir la app el
 * wearable puede tardar en anunciarse (o estar dormido), y un único intento
 * dejaba al usuario con el botón "Reconectar" en pantalla.
 */
const AUTO_RECONNECT_DELAYS_MS = [0, 5_000, 15_000, 30_000, 60_000];

export interface WearableState {
  phase: WearablePhase;
  /** Dispositivos encontrados en la búsqueda actual. */
  devices: DeviceDescriptor[];
  /** true cuando la última búsqueda terminó (para el estado vacío). */
  hasScanned: boolean;
  device: DeviceDescriptor | null;
  info: DeviceInfo;
  /** Última medida recibida por métrica. */
  samples: Partial<Record<MetricKind, HealthSample>>;
  /** Acumulado del día (pasos/distancia/kcal/sueño) del anillo conectado. */
  today: DeviceDayTotals;
  error: WearableErrorCode | null;
  /** Modo diagnóstico: lista todos los dispositivos y registra el tráfico BLE. */
  diagnostics: boolean;
  setDiagnostics(on: boolean): void;
  /** Servicios GATT del dispositivo conectado (solo con diagnóstico). */
  gatt: BleService[];
  /** Últimas tramas BLE intercambiadas (solo con diagnóstico). */
  log: DiagEntry[];
  clearLog(): void;
  /** true si el driver admite medidas bajo demanda (SpO2, presión…). */
  canMeasure: boolean;
  /** Métricas que el driver puede medir ahora (bitmap del anillo). */
  measureKinds: MetricKind[];
  measure(kind: MetricKind, onDone?: MeasureCallback): void;
  /** Ventana/umbral de la medida de una métrica (cronómetro de la UI). */
  measurePolicy(kind: MetricKind): MeasurePolicy | undefined;
  /** true mientras corre un volcado de historial (sueño, pasos…). */
  syncing: boolean;
  /** Epoch ms del último volcado completado. */
  lastSyncAt: number | null;
  syncHistory(): Promise<void>;
  /** Volcado + medidas pendientes: deja todas las métricas al día. */
  syncAll(): Promise<void>;
  /** Medida puntual en curso dentro de un sync (para el cronómetro de la UI). */
  syncStage: { kind: MetricKind; startedAt: number } | null;
  /** Re-pide info del dispositivo (batería/firmware) al driver conectado. */
  refreshInfo(): void;
  /** Último dispositivo conectado (persistido en localStorage). */
  savedDevice: SavedDevice | null;
  /** Intenta reconectar al último dispositivo guardado. */
  reconnect(): void;
  /**
   * Herramienta de diagnóstico: inyecta una muestra como si la hubiera enviado
   * el anillo, para ver el efecto en tarjetas/agregados sin esperar hardware.
   * NO se persiste en el backend (se salta el ingreso de device-metrics).
   */
  injectDebugSample(sample: Omit<HealthSample, "deviceId">): void;
  scan(): void;
  cancelScan(): void;
  connect(device: DeviceDescriptor): void;
  disconnect(): void;
  clearError(): void;
}

const WearableContext = createContext<WearableState | null>(null);

const SCAN_TIMEOUT_MS = 12_000;
/** El selector nativo del navegador necesita tiempo humano para elegir. */
const CHOOSER_TIMEOUT_MS = 30_000;
/** Métricas medibles por defecto si el driver no declara su bitmap. */
const DEFAULT_MEASURE_KINDS: MetricKind[] = [
  "heart_rate",
  "spo2",
  "blood_pressure",
];

/** Mantiene viva la sesión BLE aunque el usuario cambie de pantalla. */
export function WearableProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const t = useT();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<WearablePhase>("idle");
  const [devices, setDevices] = useState<DeviceDescriptor[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [device, setDevice] = useState<DeviceDescriptor | null>(null);
  const [info, setInfo] = useState<DeviceInfo>({});
  const [samples, setSamples] = useState<
    Partial<Record<MetricKind, HealthSample>>
  >({});
  const [today, setToday] = useState<DeviceDayTotals>(EMPTY_TOTALS);
  const [error, setError] = useState<WearableErrorCode | null>(null);
  const [diagnostics, setDiagnosticsState] = useState(false);
  const [gatt, setGatt] = useState<BleService[]>([]);
  const [log, setLog] = useState<DiagEntry[]>([]);
  const [canMeasure, setCanMeasure] = useState(false);
  const [measureKinds, setMeasureKinds] = useState<MetricKind[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState<{
    kind: MetricKind;
    startedAt: number;
  } | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [savedDevice, setSavedDevice] = useState<SavedDevice | null>(() =>
    loadSavedDevice(),
  );

  const sessionRef = useRef<DeviceSession | null>(null);
  const scanTimer = useRef<number | undefined>(undefined);
  const intentionalDisconnect = useRef(false);
  const dayStore = useRef<DayStore>(newDayStore(toLocalISODate()));
  const ingestDirty = useRef(false);
  const ingestInFlight = useRef(false);
  const lastIngestAt = useRef(0);
  const lastIngestPayload = useRef("");
  // Espejo de `samples`: syncAll decide qué medir sin depender del render.
  const samplesRef = useRef(samples);
  samplesRef.current = samples;

  const clearScanTimer = useCallback(() => {
    if (scanTimer.current !== undefined) {
      window.clearTimeout(scanTimer.current);
      scanTimer.current = undefined;
    }
  }, []);

  /**
   * Limpia el acumulado del día y la memoria de ingesta: los datos de pasos y
   * sueño son DE UN dispositivo, así que al cambiar de wearable no pueden
   * quedar los del anterior (la banda registra sueño, el anillo no).
   */
  const resetDayAggregate = useCallback(() => {
    dayStore.current = newDayStore(toLocalISODate());
    setToday(EMPTY_TOTALS);
    lastIngestPayload.current = "";
    setLastSyncAt(null);
  }, []);

  const resetSessionState = useCallback(() => {
    resetDayAggregate();
    sessionRef.current = null;
    setDevice(null);
    setInfo({});
    setSamples({});
    setGatt([]);
    setCanMeasure(false);
    setMeasureKinds([]);
    setSyncing(false);
    setPhase("idle");
  }, [resetDayAggregate]);

  const handleUnexpectedDisconnect = useCallback(() => {
    if (intentionalDisconnect.current) {
      intentionalDisconnect.current = false;
      return;
    }
    resetSessionState();
    app.disconnectWearable();
    app.showToast(t("Se perdió la conexión con el dispositivo"), "warn");
  }, [app, resetSessionState, t]);

  /**
   * Envía el acumulado del día al backend (upsert por día y métrica). Se
   * agrupa: como máximo un POST por minuto, más uno inmediato al terminar un
   * volcado de historial o al desconectar. Un fallo se ignora: la siguiente
   * pasada reenvía el acumulado completo del día.
   *
   * El sueño va en su propio POST con `recordedAt` = la hora de despertar: la
   * noche pertenece al día en que terminó, no al día en que se sincroniza (una
   * sincronización pasada la medianoche, si no, la archivaría en el día nuevo).
   */
  const flushIngest = useCallback(
    async (force = false) => {
      if (!ingestDirty.current || ingestInFlight.current) return;
      const now = Date.now();
      if (!force && now - lastIngestAt.current < INGEST_INTERVAL_MS) return;

      const totals = totalsOf(dayStore.current);
      const sleep = dayStore.current.sleep;
      const activity = {
        ...(totals.steps !== null ? { steps: totals.steps } : {}),
        ...(totals.distanceM !== null ? { distanceM: totals.distanceM } : {}),
        ...(totals.activityKcal !== null
          ? { activityKcal: totals.activityKcal }
          : {}),
      };
      const key = JSON.stringify({
        activity,
        sleep: sleep ? [sleep.ts, sleep.minutes] : null,
      });
      if (key === lastIngestPayload.current) {
        ingestDirty.current = false;
        return;
      }

      ingestInFlight.current = true;
      try {
        const requests: Array<Promise<unknown>> = [];
        if (Object.keys(activity).length > 0) {
          requests.push(recordDeviceMetrics(activity));
        }
        if (sleep && sleep.minutes > 0) {
          requests.push(
            recordDeviceMetrics({
              sleepMinutes: sleep.minutes,
              recordedAt: new Date(sleep.ts).toISOString(),
            }),
          );
        }
        await Promise.all(requests);
        lastIngestAt.current = now;
        lastIngestPayload.current = key;
        ingestDirty.current = false;
        void queryClient.invalidateQueries({
          queryKey: programKeys.metricsHistory,
        });
      } catch {
        // Sin red/sesión: el acumulado se reenvía en la próxima pasada.
      } finally {
        ingestInFlight.current = false;
      }
    },
    [queryClient],
  );

  const handleSample = useCallback((sample: HealthSample) => {
    setSamples((prev) => ({ ...prev, [sample.metric]: sample }));

    const day = toLocalISODate();
    if (dayStore.current.date !== day) {
      dayStore.current = newDayStore(day);
      lastIngestPayload.current = "";
    }
    const store = dayStore.current;
    if (!applySample(store, sample)) return;
    setToday(totalsOf(store));
    ingestDirty.current = true;
  }, []);

  const handleInfo = useCallback((delta: DeviceInfo) => {
    setInfo((prev) => ({ ...prev, ...delta }));
  }, []);

  const finishScan = useCallback(() => {
    clearScanTimer();
    void ble.stopScan();
    setHasScanned(true);
    setPhase((prev) => (prev === "scanning" ? "idle" : prev));
  }, [clearScanTimer]);

  /**
   * Dispositivos ya emparejados en los ajustes del teléfono (o conectados al
   * sistema): no anuncian, así que se listan al empezar la búsqueda para poder
   * reconectar sin salir de la app.
   */
  const loadPaired = useCallback(async () => {
    const paired = await ble.listPairedDevices();
    if (!paired.length) return;
    setDevices((prev) =>
      paired.reduce((acc, d) => mergeDiscovered(acc, d), prev),
    );
  }, []);

  const scan = useCallback(() => {
    if (phase === "scanning") {
      finishScan();
      return;
    }
    setError(null);
    setDevices([]);
    setHasScanned(false);
    setPhase("scanning");
    void loadPaired();
    // El temporizador se arma ANTES de escanear: si el plugin se queda
    // esperando (permiso del navegador, adaptador ocupado) la pantalla no se
    // queda en "buscando" para siempre.
    clearScanTimer();
    scanTimer.current = window.setTimeout(
      () => finishScan(),
      ble.usesDeviceChooser() ? CHOOSER_TIMEOUT_MS : SCAN_TIMEOUT_MS,
    );
    void ble
      .startScan(
        (found) => {
          setDevices((prev) => mergeDiscovered(prev, found));
        },
        { includeUnnamed: diagnostics },
      )
      .catch((err: unknown) => {
        clearScanTimer();
        setError(toWearableError(err).code);
        setPhase("error");
      });
  }, [clearScanTimer, diagnostics, finishScan, loadPaired, phase]);

  /** Volcado del historial (sin estado: lo gobiernan syncHistory/syncAll). */
  const runSync = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.syncHistory) return;
    try {
      await session.syncHistory();
      setLastSyncAt(Date.now());
      // Las muestras del volcado ya marcaron el acumulado como pendiente.
      await flushIngest(true);
    } catch {
      // El driver ya aísla sus fallos; sin volcado no hay nada que reportar.
    }
  }, [flushIngest]);

  /** Volcado del historial del anillo, con estado para la UI. */
  const syncHistory = useCallback(async () => {
    setSyncing(true);
    try {
      await runSync();
    } finally {
      setSyncing(false);
    }
  }, [runSync]);

  /**
   * Sincronización completa, compartida por Reloj y Programa: volcado del
   * historial (pasos, sueño, vitales guardados) y después las medidas
   * puntuales que falten o estén vencidas, en secuencia. Un solo toque deja
   * todas las métricas al día sin depender de la app oficial.
   */
  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      await runSync();
      const session = sessionRef.current;
      if (!session?.measure) return;
      const stale = staleMeasureKinds(
        session.measureKinds ?? measureKinds,
        samplesRef.current,
        Date.now(),
      );
      for (const kind of stale) {
        setSyncStage({ kind, startedAt: Date.now() });
        await new Promise<void>((resolve) => {
          session.measure?.(kind, () => resolve());
        });
      }
    } finally {
      setSyncStage(null);
      setSyncing(false);
    }
  }, [measureKinds, runSync]);

  const connect = useCallback(
    (target: DeviceDescriptor, options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      clearScanTimer();
      void ble.stopScan();
      setError(null);
      setPhase("connecting");
      void (async () => {
        try {
          // En iOS el plugin solo conecta ids de su mapa interno: tras
          // reiniciar la app hay que re-registrar el dispositivo guardado.
          const canonicalId = await ble
            .resolveDeviceId(target.deviceId)
            .catch(() => null);
          const resolved: DeviceDescriptor =
            canonicalId && canonicalId !== target.deviceId
              ? { ...target, deviceId: canonicalId }
              : target;
          await ble.connectDevice(
            resolved.deviceId,
            handleUnexpectedDisconnect,
            {
              silent,
              timeoutMs: silent ? 30_000 : undefined,
            },
          );
          const session = await openSession(resolved);
          // Dispositivo nuevo: los pasos/sueño en memoria eran del anterior.
          resetDayAggregate();
          await session.start(handleSample, handleInfo);
          sessionRef.current = session;
          setCanMeasure(session.supportsMeasure === true);
          setMeasureKinds(
            session.measureKinds ??
              (session.supportsMeasure ? DEFAULT_MEASURE_KINDS : []),
          );
          // El volcado GATT solo se pide en modo diagnóstico: la conexión ya
          // descubrió los servicios, así que la consulta es inmediata.
          if (diagnostics) {
            void ble
              .getDeviceServices(resolved.deviceId)
              .then(setGatt)
              .catch(() => undefined);
          }
          // El anillo puede anunciarse sin nombre: se usa una etiqueta legible
          // para el estado global, que otras pantallas muestran tal cual.
          const label = resolved.name || t("Dispositivo sin nombre");
          setDevice(resolved);
          // Fusionar (no reemplazar): durante `session.start` ya pudieron
          // llegar batería y firmware, y reemplazar los borraba.
          setInfo((prev) => ({ ...prev, name: label }));
          setSamples({});
          setPhase("connected");
          app.connectWearable(label);
          // Se recuerda el dispositivo para reconectar sin volver a emparejar.
          saveDevice(resolved);
          setSavedDevice(loadSavedDevice());
          if (!silent) {
            app.showToast(t("{name} conectado", { name: label }), "ok");
          }
          // Primer volcado: sueño, pasos y vitales guardados en el anillo.
          void runSync();
        } catch (err) {
          await ble.disconnectDevice(target.deviceId);
          resetSessionState();
          // Una reconexión automática fallida no invade la pantalla con un
          // error: queda la tarjeta de "Último dispositivo" para reintentar.
          if (silent) return;
          setError(toWearableError(err, "connection-failed").code);
          setPhase("error");
        }
      })();
    },
    [
      app,
      clearScanTimer,
      diagnostics,
      handleInfo,
      handleSample,
      handleUnexpectedDisconnect,
      resetDayAggregate,
      resetSessionState,
      runSync,
      t,
    ],
  );

  const disconnect = useCallback(() => {
    const session = sessionRef.current;
    const deviceId = device?.deviceId;
    intentionalDisconnect.current = true;
    // Último envío con el acumulado completo antes de soltar la sesión.
    void flushIngest(true);
    resetSessionState();
    app.disconnectWearable();
    // Desconexión explícita: se olvida el dispositivo para no reconectar solo.
    clearSavedDevice();
    setSavedDevice(null);
    void (async () => {
      if (session) await session.stop().catch(() => undefined);
      if (deviceId) await ble.disconnectDevice(deviceId);
    })();
  }, [app, device, flushIngest, resetSessionState]);

  /** Reconexión al último dispositivo guardado (una sola pasada, sin ruido). */
  const reconnect = useCallback(() => {
    const target = savedDevice;
    if (!target || phase === "connecting" || phase === "connected") return;
    connect(target, { silent: true });
  }, [connect, phase, savedDevice]);

  const cancelScan = useCallback(() => finishScan(), [finishScan]);

  const clearError = useCallback(() => {
    setError(null);
    setPhase((prev) => (prev === "error" ? "idle" : prev));
  }, []);

  const setDiagnostics = useCallback((on: boolean) => {
    ble.setBleDebug(on);
    setDiagnosticsState(on);
    if (!on) {
      setGatt([]);
      setLog([]);
    }
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  const measure = useCallback((kind: MetricKind, onDone?: MeasureCallback) => {
    sessionRef.current?.measure?.(kind, onDone);
  }, []);

  const measurePolicy = useCallback(
    (kind: MetricKind) => sessionRef.current?.measurePolicy?.(kind),
    [],
  );

  const refreshInfo = useCallback(() => {
    sessionRef.current?.requestInfo?.();
  }, []);

  /**
   * Muestra inyectada a mano (solo con Modo diagnóstico): recorre el MISMO
   * camino que una muestra real (tarjetas, agregado del día, día del store),
   * pero restaura la marca de ingreso para que una prueba nunca escriba filas
   * falsas en el backend.
   */
  const injectDebugSample = useCallback(
    (sample: Omit<HealthSample, "deviceId">) => {
      const wasDirty = ingestDirty.current;
      handleSample({ ...sample, deviceId: "debug" });
      ingestDirty.current = wasDirty;
    },
    [handleSample],
  );

  // Refs espejo: la reconexión automática necesita el estado y el `connect`
  // vigentes sin re-suscribir el listener en cada render.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const lastReconnectAt = useRef(0);
  const autoAttempt = useRef(0);
  const autoTimer = useRef<number | undefined>(undefined);

  /**
   * Reconexión al último dispositivo guardado. Silenciosa: si el anillo no
   * está cerca, la pantalla queda igual y ofrece "Reconectar".
   */
  const tryAutoReconnect = useCallback((force: boolean) => {
    const saved = loadSavedDevice();
    if (!saved || !canAutoReconnectHere(saved)) return;
    if (phaseRef.current === "connecting" || phaseRef.current === "connected") {
      return;
    }
    const now = Date.now();
    if (!force && now - lastReconnectAt.current < RECONNECT_DEBOUNCE_MS) return;
    lastReconnectAt.current = now;
    connectRef.current(saved, { silent: true });
  }, []);

  /**
   * Reintentos automáticos escalonados: al abrir la app el anillo puede estar
   * dormido o tardar en anunciarse, así que un único intento no basta. La
   * escalera se reinicia al conectar y al volver del segundo plano.
   */
  const scheduleAutoReconnect = useCallback(() => {
    if (autoAttempt.current >= AUTO_RECONNECT_DELAYS_MS.length) return;
    const delay = AUTO_RECONNECT_DELAYS_MS[autoAttempt.current] ?? 0;
    autoAttempt.current += 1;
    window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(() => {
      if (phaseRef.current === "connected") return;
      tryAutoReconnect(true);
      scheduleAutoReconnect();
    }, delay);
  }, [tryAutoReconnect]);

  const startAutoReconnect = useCallback(() => {
    autoAttempt.current = 0;
    scheduleAutoReconnect();
  }, [scheduleAutoReconnect]);

  const stopAutoReconnect = useCallback(() => {
    window.clearTimeout(autoTimer.current);
    autoAttempt.current = AUTO_RECONNECT_DELAYS_MS.length;
  }, []);

  // Al entrar a la app y al volver del segundo plano (iOS suspende el BLE).
  // No se intenta durante login/onboarding/tests: el usuario todavía no pidió
  // nada del reloj y no corresponde pedir permisos ahí.
  useEffect(() => {
    if (app.flow !== "app") {
      stopAutoReconnect();
      return;
    }
    startAutoReconnect();
    if (!Capacitor.isNativePlatform()) return;
    const handle = App.addListener("resume", () => {
      // iOS suspende el enlace en segundo plano: se reintenta desde cero.
      if (phaseRef.current !== "connected") startAutoReconnect();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [app.flow, startAutoReconnect, stopAutoReconnect]);

  // La conexión correcta (manual o automática) corta los reintentos.
  useEffect(() => {
    if (phase === "connected") stopAutoReconnect();
  }, [phase, stopAutoReconnect]);

  useEffect(() => stopAutoReconnect, [stopAutoReconnect]);

  // Ingreso periódico mientras hay sesión: el acumulado del día se actualiza
  // aunque no haya volcados ni medidas puntuales.
  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(
      () => void flushIngest(),
      INGEST_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [flushIngest, phase]);

  // Registro del tráfico BLE: solo mientras el modo diagnóstico está activo.
  useEffect(() => {
    if (!diagnostics) {
      ble.setNotificationTap(null);
      return;
    }
    ble.setNotificationTap((info) => {
      const entry: DiagEntry = {
        ts: Date.now(),
        direction: info.direction,
        label: info.note
          ? "ycbt"
          : `${shortUuid(info.service)}/${shortUuid(info.characteristic)}`,
        hex: info.note ?? toHex(info.bytes),
      };
      setLog((prev) => {
        const next = [...prev, entry];
        return next.length > DIAG_LOG_LIMIT
          ? next.slice(next.length - DIAG_LOG_LIMIT)
          : next;
      });
    });
    return () => ble.setNotificationTap(null);
  }, [diagnostics]);

  useEffect(() => {
    return () => {
      clearScanTimer();
      void ble.stopScan();
      void sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [clearScanTimer]);

  const value = useMemo<WearableState>(
    () => ({
      phase,
      devices,
      hasScanned,
      device,
      info,
      samples,
      today,
      error,
      diagnostics,
      setDiagnostics,
      gatt,
      log,
      clearLog,
      canMeasure,
      measureKinds,
      measure,
      measurePolicy,
      syncing,
      lastSyncAt,
      syncHistory,
      syncAll,
      syncStage,
      refreshInfo,
      savedDevice,
      reconnect,
      injectDebugSample,
      scan,
      cancelScan,
      connect,
      disconnect,
      clearError,
    }),
    [
      phase,
      devices,
      hasScanned,
      device,
      info,
      samples,
      today,
      error,
      diagnostics,
      setDiagnostics,
      gatt,
      log,
      clearLog,
      canMeasure,
      measureKinds,
      measure,
      measurePolicy,
      syncing,
      lastSyncAt,
      syncHistory,
      syncAll,
      syncStage,
      refreshInfo,
      savedDevice,
      reconnect,
      injectDebugSample,
      scan,
      cancelScan,
      connect,
      disconnect,
      clearError,
    ],
  );

  return (
    <WearableContext.Provider value={value}>
      {children}
    </WearableContext.Provider>
  );
}

export function useWearable() {
  const ctx = useContext(WearableContext);
  if (!ctx) throw new Error("useWearable must be used within WearableProvider");
  return ctx;
}
