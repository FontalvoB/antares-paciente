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
import type { BluetoothRadioState } from "../devices/ble/radio-state";
import { searchWearableAccessories, supportsAccessoryDiscovery } from "../devices/ble/accessory-discovery";
import { isSupportedWearable } from "../devices/support";
import {
  drainPendingNotifications,
  authorizeAccessory,
  detachPendingNotifications,
  NOTIFICATION_GAP_EVENT,
  startPersistentConnection,
  stopPersistentConnection,
} from "../devices/ble/notification-journal";
import {
  createSampleSnapshot,
  loadSampleSnapshot,
  recordSampleSnapshot,
  updateSampleSnapshot,
} from "../devices/sample-store";
import type { SampleSnapshot } from "../devices/sample-store";
import { buildDeviceMetricUploads } from "../devices/metrics-outbox";
import { nextHeartbeatDecision } from "../devices/heartbeat";
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
import { putNewestSample } from "../utils/samples";
import { wearingInfoUpdate } from "../utils/wearing";
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

type WearableOperation = "sync" | "measure";

/** Ingreso periódico de métricas: agrupa cambios y evita un POST por muestra. */
const INGEST_INTERVAL_MS = 60_000;
/** Pausa entre el volcado de historial y la primera medida del sync. */
const SYNC_SETTLE_MS = 800;
/** Umbral de lectura antigua: se verifica presencia antes de desmontar. */
const SESSION_STALE_MS = 120_000;
/** Cada cuánto se comprueba la liveness de la sesión conectada. */
const SESSION_LIVENESS_TICK_MS = 30_000;
/** Tope duro de un sync completo: si algo se cuelga, la UI se libera sola. */
const SYNC_SAFETY_MS = 120_000;
/** Margen por medida sobre su ventana al re-armar la red del sync. */
const MEASURE_GUARD_MARGIN_MS = 5_000;
/** Margen para el volcado de historial + respiros al re-armar la red. */
const SYNC_DUMP_MARGIN_MS = 30_000;
/**
 * Escalera de reintentos de la reconexión automática: al abrir la app el
 * wearable puede tardar en anunciarse (o estar dormido), y un único intento
 * dejaba al usuario con el botón "Reconectar" en pantalla. Tras la escalera
 * NO se abandona: queda un intento lento cada 120 segundos
 * mientras la app esté en primer plano (la conexión BLE no sobrevive al
 * cierre de la app; lo persistente es la identidad + este reintento).
 */
const AUTO_RECONNECT_DELAYS_MS = [0, 5_000, 15_000, 30_000, 60_000, 120_000];

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
  accessoryDiscoverySupported: boolean;
  addingAccessory: boolean;
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
  /** Detiene la medida puntual en curso (Cancelar de la vista de foco). */
  stopMeasure(): void;
  /** Cancela un `syncAll` en curso (Cancelar de la vista de foco). */
  cancelSync(): void;
  /** true mientras corre un volcado de historial (sueño, pasos…). */
  syncing: boolean;
  /** Epoch ms del último volcado completado. */
  lastSyncAt: number | null;
  syncHistory(): Promise<void>;
  /**
   * true cuando decimos estar conectados pero el dispositivo dejó de emitir
   * (fuera de rango/apagado): la UI debe dejar de mostrarlo como conectado.
   */
  sessionStale: boolean;
  /** Volcado + medidas pendientes: deja todas las métricas al día. */
  syncAll(options?: {
    forceMeasure?: readonly MetricKind[];
  }): Promise<MetricKind[]>;
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
  scan(): Promise<void>;
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
  const accountId = app.flow === "app" && !app.authLoading
    ? (app.user.id || app.user.cedula || app.user.email || "").trim() : "";
  const accountRef = useRef(accountId);
  accountRef.current = accountId;

  const [phase, setPhase] = useState<WearablePhase>("idle");
  const [sessionStale, setSessionStale] = useState(false);
  /** Última notificación recibida del dispositivo (liveness, sin re-render). */
  const lastSeenAtRef = useRef(Date.now());
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
    accountId ? loadSavedDevice(accountId) : null,
  );

  const sessionRef = useRef<DeviceSession | null>(null);
  const descriptorRef = useRef<DeviceDescriptor | null>(null);
  const snapshotRef = useRef<SampleSnapshot | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const connectionTaskRef = useRef<Promise<void> | null>(null);
  const addingAccessoryRef = useRef(false);
  const [addingAccessory, setAddingAccessory] = useState(false);
  const [accessoryDiscoverySupported, setAccessoryDiscoverySupported] = useState(false);
  useEffect(() => {
    let current = true;
    void supportsAccessoryDiscovery().then(supported => {
      if (current) setAccessoryDiscoverySupported(supported);
    }).catch(() => undefined);
    return () => { current = false; };
  }, []);
  const cleanupRef = useRef<Promise<void>>(Promise.resolve());
  const syncHistoryRef = useRef<() => Promise<void>>(() => Promise.resolve());
  /** Evita que historia, medidas manuales y sync compitan por el mismo sensor. */
  const operationRef = useRef<WearableOperation | null>(null);
  const operationGenerationRef = useRef(0);
  const queuedSyncRef = useRef(false);
  /** Pings de presencia sin respuesta acumulados (ver heartbeat). */
  const heartbeatMisses = useRef(0);
  /** La vista de foco pidió cancelar el sync: el bucle de etapas sale solo. */
  const cancelSyncRef = useRef(false);
  const appActiveRef = useRef(true);
  const bluetoothRadioRef = useRef<BluetoothRadioState>("unknown");
  /** Invalida callbacks de una conexión anterior que llegue tarde. */
  const sessionGenerationRef = useRef(0);
  const scanTimer = useRef<number | undefined>(undefined);
  const intentionalDisconnect = useRef(false);
  /** Una caída en background conserva el driver hasta comprobar el enlace nativo. */
  const backgroundRecovery = useRef(false);
  const dayStore = useRef<DayStore>(newDayStore(toLocalISODate()));
  const ingestDirty = useRef(false);
  const ingestInFlight = useRef(false);
  const lastIngestAt = useRef(0);
  const lastIngestPayload = useRef(new Map<string, string>());
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
    lastIngestPayload.current.clear();
    setLastSyncAt(null);
  }, []);

  const restoreSnapshot = useCallback((ownerId: string, deviceId: string) => {
    const snapshot = loadSampleSnapshot(ownerId, deviceId) ?? createSampleSnapshot(ownerId, deviceId);
    snapshotRef.current = snapshot;
    dayStore.current = snapshot.day;
    setInfo(snapshot.info);
    setSamples(snapshot.latest);
    samplesRef.current = snapshot.latest;
    setToday(totalsOf(snapshot.day));
    setLastSyncAt(snapshot.lastSyncAt);
    lastIngestPayload.current.clear();
    ingestDirty.current = Object.keys(snapshot.days).length > 0;
  }, []);

  const resetSessionState = useCallback((clearReadings = false) => {
    backgroundRecovery.current = false;
    sessionGenerationRef.current += 1;
    operationRef.current = null;
    operationGenerationRef.current += 1;
    queuedSyncRef.current = false;
    cancelSyncRef.current = true;
    if (clearReadings) {
      resetDayAggregate();
      snapshotRef.current = null;
      setInfo({});
      setSamples({});
      samplesRef.current = {};
      ingestDirty.current = false;
    }
    sessionRef.current = null;
    setSessionStale(false);
    setDevice(null);
    setGatt([]);
    setCanMeasure(false);
    setMeasureKinds([]);
    setSyncing(false);
    phaseRef.current = "idle";
    setPhase("idle");
  }, [resetDayAggregate]);

  const handleUnexpectedDisconnect = useCallback(async (verifyNativeLink = true) => {
    if (intentionalDisconnect.current) {
      intentionalDisconnect.current = false;
      return;
    }
    const session = sessionRef.current;
    const deviceId = descriptorRef.current?.deviceId;
    // iOS puede recuperar el enlace mientras JS está suspendido. Una caída
    // anterior entregada al despertar no debe derribar esa sesión recuperada.
    if (verifyNativeLink && session && deviceId && (phaseRef.current === "connected" || backgroundRecovery.current) &&
        Capacitor.getPlatform() === "ios" && bluetoothRadioRef.current !== "off") {
      const generation = sessionGenerationRef.current;
      const connected = await ble.getDeviceConnectionState(deviceId);
      if (generation !== sessionGenerationRef.current || sessionRef.current !== session) return;
      if (connected === true) {
        heartbeatMisses.current = 0;
        if (appActiveRef.current) session.requestInfo?.();
        return;
      }
      if (!appActiveRef.current) {
        // didDisconnect puede llegar ANTES de los 5 s del reintento nativo.
        // No cancelar ese reintento ni destruir sus consumidores/suscripciones.
        backgroundRecovery.current = true;
        phaseRef.current = "connecting";
        setPhase("connecting");
        setSessionStale(true);
        return;
      }
    }
    resetSessionState();
    app.disconnectWearable();
    // Cierre ordenado: soltar suscripciones y el enlace (antes se abandonaban
    // y solo un reintento fallido los limpiaba de rebote).
    cleanupRef.current = cleanupRef.current.then(async () => {
      if (session) await session.stop().catch(() => undefined);
      if (deviceId) await ble.disconnectDevice(deviceId).catch(() => undefined);
    });
    if (appActiveRef.current) app.showToast(t("Se perdió la conexión con el dispositivo"), "warn");
    startAutoReconnectRef.current();
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
      if (!force && !appActiveRef.current) return;
      const now = Date.now();
      if (!force && now - lastIngestAt.current < INGEST_INTERVAL_MS) return;

      const snapshot = snapshotRef.current;
      if (!snapshot || snapshot.accountId !== accountRef.current) return;

      ingestInFlight.current = true;
      try {
        for (const upload of buildDeviceMetricUploads(snapshot)) {
          if (snapshot.accountId !== accountRef.current) return;
          if (lastIngestPayload.current.get(upload.id) === upload.key) continue;
          await recordDeviceMetrics(upload.input);
          if (snapshot.accountId !== accountRef.current) return;
          lastIngestPayload.current.set(upload.id, upload.key);
        }
        lastIngestAt.current = now;
        // Una lectura llegada durante el POST conserva su ingreso pendiente.
        ingestDirty.current = snapshotRef.current !== snapshot;
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

  const handleSample = useCallback((sample: HealthSample, persist = true) => {
    lastSeenAtRef.current = Date.now();
    if (persist) {
      const previous = snapshotRef.current;
      if (!previous || previous.accountId !== accountRef.current) return;
      let snapshot = recordSampleSnapshot(previous, sample);
      const update = wearingInfoUpdate(sample, snapshot.info);
      if (update) snapshot = updateSampleSnapshot(snapshot, { info: update });
      snapshotRef.current = snapshot;
      dayStore.current = snapshot.day;
      samplesRef.current = snapshot.latest;
      setInfo(snapshot.info);
      setSamples(snapshot.latest);
      setToday(totalsOf(snapshot.day));
      ingestDirty.current = true;
      return;
    }
    setInfo((prev) => {
      const update = wearingInfoUpdate(sample, prev);
      return update ? { ...prev, ...update } : prev;
    });
    setSamples((prev) => putNewestSample(prev, sample));

    const day = toLocalISODate();
    if (dayStore.current.date !== day) {
      dayStore.current = newDayStore(day);
      lastIngestPayload.current.clear();
    }
    // El diagnóstico no modifica el snapshot real que espera subir al servidor.
    const current = dayStore.current;
    const store = { ...current, counters: { ...current.counters }, buckets: new Map(current.buckets) };
    if (!applySample(store, sample)) return;
    setToday(totalsOf(store));
  }, []);

  const handleInfo = useCallback((delta: DeviceInfo) => {
    lastSeenAtRef.current = Date.now();
    const snapshot = snapshotRef.current;
    if (snapshot && snapshot.accountId === accountRef.current) {
      const next = updateSampleSnapshot(snapshot, { info: delta });
      snapshotRef.current = next;
      dayStore.current = next.day;
      if (snapshot.day.date !== next.day.date) setToday(totalsOf(next.day));
    }
    setInfo((prev) => ({ ...prev, ...delta }));
  }, []);

  const refreshStoredDay = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot || snapshot.accountId !== accountRef.current || snapshot.day.date === toLocalISODate()) return;
    const next = updateSampleSnapshot(snapshot, {});
    snapshotRef.current = next;
    dayStore.current = next.day;
    setToday(totalsOf(next.day));
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
    const owner = accountRef.current;
    const paired = await ble.listPairedDevices();
    if (!paired.length || accountRef.current !== owner) return;
    setDevices((prev) =>
      paired.reduce((acc, d) => mergeDiscovered(acc, d), prev),
    );
  }, []);

  useEffect(() => {
    if (accountId && accessoryDiscoverySupported) void loadPaired();
  }, [accountId, accessoryDiscoverySupported, loadPaired]);

  const scanLegacy = useCallback(() => {
    if (bluetoothRadioRef.current === "off") {
      setError("bluetooth-off"); setPhase("error"); return;
    }
    if (addingAccessoryRef.current) return;
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
        { includeUnnamed: true },
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
      if (sessionRef.current !== session || !appActiveRef.current) return;
      const syncedAt = Date.now();
      if (snapshotRef.current) {
        snapshotRef.current = updateSampleSnapshot(snapshotRef.current, { lastSyncAt: syncedAt });
      }
      setLastSyncAt(syncedAt);
      // Las muestras del volcado ya marcaron el acumulado como pendiente.
      await flushIngest(true);
    } catch {
      // El driver ya aísla sus fallos; sin volcado no hay nada que reportar.
    }
  }, [flushIngest]);

  /** Volcado del historial del anillo, con estado para la UI. */
  const syncHistory = useCallback(async () => {
    if (operationRef.current === "measure") {
      queuedSyncRef.current = true;
      return;
    }
    if (operationRef.current === "sync") return;
    const session = sessionRef.current;
    if (!session) return;
    const operation = ++operationGenerationRef.current;
    const ownsOperation = () => operationGenerationRef.current === operation && sessionRef.current === session;
    operationRef.current = "sync";
    setSyncing(true);
    const safety = window.setTimeout(() => {
      if (!ownsOperation()) return;
      // Red de seguridad: ni la red ni un driver pueden dejar la UI en
      // "Midiendo…" para siempre.
      setSyncStage(null);
      setSyncing(false);
      operationRef.current = null;
      queuedSyncRef.current = false;
    }, SYNC_SAFETY_MS);
    try {
      await runSync();
    } finally {
      window.clearTimeout(safety);
      if (ownsOperation()) {
        setSyncing(false);
        operationRef.current = null;
        if (queuedSyncRef.current) {
          queuedSyncRef.current = false;
          void syncHistoryRef.current();
        }
      }
    }
  }, [runSync]);
  syncHistoryRef.current = syncHistory;

  /**
   * Sincronización completa, compartida por Reloj y Programa: volcado del
   * historial (pasos, sueño, vitales guardados) y después las medidas
   * puntuales que falten o estén vencidas, en secuencia. Un solo toque deja
   * todas las métricas al día sin depender de la app oficial.
   */
  const syncAll = useCallback(
    async (options?: { forceMeasure?: readonly MetricKind[] }) => {
      if (operationRef.current !== null) {
        if (operationRef.current === "measure") queuedSyncRef.current = true;
        return [];
      }
      const session = sessionRef.current;
      if (!session) return [];
      const operation = ++operationGenerationRef.current;
      const ownsOperation = () => operationGenerationRef.current === operation && sessionRef.current === session;
      operationRef.current = "sync";
      setSyncing(true);
      cancelSyncRef.current = false;
      // Red de seguridad: se re-arma con el costo real una vez conocida la
      // lista a medir (un fijo quedaría corto con ventanas largas: anillo
      // 30+60+90 s > 120 s y el sync se "cerraba" solo a la mitad).
      let safety = window.setTimeout(() => {
        if (!ownsOperation()) return;
        setSyncStage(null);
        setSyncing(false);
        operationRef.current = null;
        queuedSyncRef.current = false;
      }, SYNC_SAFETY_MS);
      /** Métricas que se midieron de verdad (para que la UI no espere de más). */
      const measured: MetricKind[] = [];
      try {
        await runSync();
        if (!ownsOperation()) return measured;
        // Respiro tras el volcado: la primera medida forzada no debe llegar justo
        // cuando el dump cierra (el anillo a veces la ignora y cierra en timeout).
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, SYNC_SETTLE_MS),
        ).catch(() => undefined);
        if (!ownsOperation() || !session.measure) return measured;
        const stale = staleMeasureKinds(
          session.measureKinds ?? measureKinds,
          samplesRef.current,
          Date.now(),
        );
        // `forceMeasure` mide aunque no esté vencida (check-in clínico).
        const toMeasure = [...stale];
        for (const kind of options?.forceMeasure ?? []) {
          if (!toMeasure.includes(kind)) toMeasure.push(kind);
        }
        // Re-arme de la red con el costo real: suma de ventanas + margen de
        // volcado. Un fijo mataría un sync largo de anillo antes de terminar.
        // La FC persistente aporta 5 ventanas (re-enganches en borde de ventana).
        window.clearTimeout(safety);
        const safetyBudget = toMeasure.reduce(
          (total, kind) =>
            total +
            (session.measurePolicy?.(kind)?.windowMs ?? 30_000) *
              (kind === "heart_rate" ? 5 : 1) +
            MEASURE_GUARD_MARGIN_MS,
          SYNC_DUMP_MARGIN_MS,
        );
        safety = window.setTimeout(() => {
          if (!ownsOperation()) return;
          setSyncStage(null);
          setSyncing(false);
          operationRef.current = null;
          queuedSyncRef.current = false;
        }, safetyBudget);
        for (const kind of toMeasure) {
          // Cancelación del usuario (vista de foco): no arrancar más etapas y
          // salir sin el volcado extra de SpO2.
          if (cancelSyncRef.current || !ownsOperation()) break;
          measured.push(kind);
          setSyncStage({ kind, startedAt: Date.now() });
          let ok = false;
          let closed = false;
          await new Promise<void>((resolve) => {
            const policy = session.measurePolicy?.(kind);
            // Tope por medida (ventana del driver + margen): si el driver no
            // avisa nunca, la secuencia continúa en vez de dejar "Midiendo…".
            // La FC persistente recibe 5 ventanas para no wedgar la cola si el
            // sensor queda mudo de verdad (la tarjeta la espera sin tope).
            const guardBudget =
              kind === "heart_rate"
                ? (policy?.windowMs ?? 30_000) * 5 + 5_000
                : (policy?.windowMs ?? 30_000) + 5_000;
            const guard = window.setTimeout(resolve, guardBudget);
            session.measure?.(kind, (done) => {
              ok = done;
              closed = true;
              window.clearTimeout(guard);
              resolve();
            });
          });
          // El guard cortó pero el driver sigue midiendo: pararlo para que no
          // mida en el vacío mientras la secuencia ya avanzó (cierra como
          // "cancelled", sin toast ni reintento).
          if (!closed && ownsOperation()) session.stopMeasure?.();
          if (cancelSyncRef.current || !ownsOperation()) break;
          // El anillo suele guardar la SpO2 que no llegó a tiempo: un volcado
          // extra la trae del historial sin que el usuario reintente.
          if (kind === "spo2" && !ok) await runSync();
        }
        return measured;
      } finally {
        window.clearTimeout(safety);
        if (ownsOperation()) {
          setSyncStage(null);
          setSyncing(false);
          operationRef.current = null;
          if (queuedSyncRef.current) {
            queuedSyncRef.current = false;
            void syncHistoryRef.current();
          }
        }
      }
    },
    [measureKinds, runSync],
  );

  const connect = useCallback(
    (target: DeviceDescriptor, options?: { silent?: boolean; automatic?: boolean }): Promise<void> => {
      const ownerId = accountRef.current;
      if (!ownerId) {
        if (!options?.silent) {
          setError("session-unavailable");
          if (phaseRef.current !== "connected") setPhase("error");
        }
        return Promise.resolve();
      }
      if (bluetoothRadioRef.current === "off") {
        setError("bluetooth-off"); setPhase("error"); return Promise.resolve();
      }
      if (addingAccessoryRef.current) return Promise.resolve();
      if (!isSupportedWearable(target)) {
        if (!options?.silent) {
          setError("unsupported-device");
          if (phaseRef.current !== "connected") setPhase("error");
        }
        return Promise.resolve();
      }
      // El candado se toma antes de cualquier await: un doble toque o un
      // temporizador no puede abrir otro GATT mientras sigue el handshake.
      if (connectionTaskRef.current) return connectionTaskRef.current;
      if (phaseRef.current === "connected" && descriptorRef.current?.deviceId === target.deviceId) {
        return Promise.resolve();
      }
      const silent = options?.silent === true;
      backgroundRecovery.current = false;
      intentionalDisconnect.current = false;
      const generation = ++sessionGenerationRef.current;
      const previousSession = sessionRef.current;
      const previousDevice = descriptorRef.current;
      sessionRef.current = null;
      operationGenerationRef.current += 1;
      operationRef.current = null;
      queuedSyncRef.current = false;
      cancelSyncRef.current = true;
      setSyncing(false);
      setSyncStage(null);
      let connectedId = target.deviceId;
      let session: DeviceSession | null = null;
      const current = () => sessionGenerationRef.current === generation && accountRef.current === ownerId;
      clearScanTimer();
      phaseRef.current = "connecting";
      setError(null);
      setPhase("connecting");
      const task = (async () => {
        try {
          await cleanupRef.current;
          if (previousSession) {
            await flushIngest(true);
            await previousSession.stop().catch(() => undefined);
            if (previousDevice) {
              await stopPersistentConnection(previousDevice.deviceId).catch(() => undefined);
              await ble.disconnectDevice(previousDevice.deviceId);
            }
          }
          if (!current()) return;
          await ble.stopScan();
          const canonicalId = await ble.resolveDeviceId(target.deviceId);
          if (!current()) return;
          const resolved = canonicalId ? { ...target, deviceId: canonicalId } : target;
          connectedId = resolved.deviceId;
          descriptorRef.current = resolved;
          // Restaurar antes de suscribir: incluso las respuestas iniciales
          // quedan persistidas y nunca se borran al terminar el handshake.
          restoreSnapshot(ownerId, connectedId);
          if (options?.automatic !== true && Capacitor.getPlatform() === "ios") {
            const authorization = await authorizeAccessory(resolved);
            if (!current()) return;
            if (authorization.supported && !authorization.authorized) {
              phaseRef.current = "idle";
              setPhase("idle");
              return;
            }
          }
          await startPersistentConnection(connectedId, ownerId, options?.automatic === true);
          if (!current()) {
            await stopPersistentConnection(connectedId, true).catch(() => undefined);
            return;
          }
          await ble.connectDevice(connectedId, () => {
            if (current()) handleUnexpectedDisconnect();
          }, { silent, timeoutMs: silent ? 30_000 : undefined });
          if (!current()) {
            await ble.disconnectDevice(connectedId);
            return;
          }
          session = await openSession(resolved);
          if (!current()) {
            await session.stop().catch(() => undefined);
            await ble.disconnectDevice(connectedId);
            return;
          }
          sessionRef.current = session;
          await session.start(
            (sample) => { if (current()) handleSample(sample); },
            (delta) => { if (current()) handleInfo(delta); },
          );
          if (!current()) {
            await session.stop().catch(() => undefined);
            return;
          }
          session.setAppActive?.(appActiveRef.current);
          setCanMeasure(session.supportsMeasure === true);
          setMeasureKinds(session.measureKinds ?? (session.supportsMeasure ? DEFAULT_MEASURE_KINDS : []));
          if (diagnostics) {
            void ble.getDeviceServices(connectedId).then((services) => {
              if (current()) setGatt(services);
            }).catch(() => undefined);
          }
          const label = resolved.name || t("Dispositivo sin nombre");
          setDevice(resolved);
          handleInfo({ name: label });
          phaseRef.current = "connected";
          setPhase("connected");
          lastSeenAtRef.current = Date.now();
          heartbeatMisses.current = 0;
          setSessionStale(false);
          app.connectWearable(label);
          saveDevice(resolved, ownerId);
          setSavedDevice(loadSavedDevice(ownerId));
          if (!silent) app.showToast(t("{name} conectado", { name: label }), "ok");
          if (appActiveRef.current) void syncHistoryRef.current();
        } catch (err) {
          if (session) await session.stop().catch(() => undefined);
          await ble.disconnectDevice(connectedId);
          if (!current()) return;
          resetSessionState();
          if (/stopped by user/i.test(err instanceof Error ? err.message : String(err))) {
            intentionalDisconnect.current = true;
          }
          // Un dispositivo dormido, fuera de rango o no hallado no se olvida.
          if (silent) return;
          setError(toWearableError(err, "connection-failed").code);
          phaseRef.current = "error";
          setPhase("error");
        } finally {
          connectionTaskRef.current = null;
        }
      })();
      connectionTaskRef.current = task;
      return task;
    },
    [app, clearScanTimer, diagnostics, flushIngest, handleInfo, handleSample,
      handleUnexpectedDisconnect, resetSessionState, restoreSnapshot, t],
  );

  const disconnect = useCallback(() => {
    const session = sessionRef.current;
    const deviceId = descriptorRef.current?.deviceId;
    intentionalDisconnect.current = true;
    void flushIngest(true);
    resetSessionState();
    descriptorRef.current = null;
    app.disconnectWearable();
    if (accountRef.current) clearSavedDevice(accountRef.current);
    setSavedDevice(null);
    cleanupRef.current = cleanupRef.current.then(async () => {
      if (session) await session.stop().catch(() => undefined);
      if (deviceId) {
        await stopPersistentConnection(deviceId, true).catch(() => undefined);
        await ble.disconnectDevice(deviceId);
      }
    });
  }, [app, flushIngest, resetSessionState]);

  /** Reconexión al último dispositivo guardado (una sola pasada, sin ruido). */
  const reconnect = useCallback(() => {
    const target = savedDevice;
    if (!target || phase === "connecting" || phase === "connected") return;
    connect(target, { silent: true });
  }, [connect, phase, savedDevice]);
  /** La escalera de reconexión, llamable desde caídas inesperadas. */
  const startAutoReconnectRef = useRef<() => void>(() => undefined);

  /**
   * Presencia: el silencio solo marca la UI como rancia (`sessionStale`), NO
   * tumba la sesión — el anillo es callado por diseño entre barridos y antes
   * este timer lo desconectaba a los 2 min (la banda nunca cae porque emite
   * sin parar). En quietud se pide un ping liviano (batería/info); su
   * respuesta refresca la presencia sola. N pings sin respuesta = enlace
   * realmente caído: ahí sí se desmonta y arranca la escalera.
   */
  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastSeenAtRef.current;
      setSessionStale(idleFor > SESSION_STALE_MS);
      if (operationRef.current !== null) return;
      if (!appActiveRef.current) return;
      const decision = nextHeartbeatDecision(
        idleFor,
        SESSION_STALE_MS,
        heartbeatMisses.current,
      );
      heartbeatMisses.current = decision.misses;
      if (decision.action === "ping") {
        sessionRef.current?.requestInfo?.();
      } else if (decision.action === "dead") {
        // Un GATT conectado no garantiza que el protocolo responda a pings.
        void handleUnexpectedDisconnect(false);
      }
    }, SESSION_LIVENESS_TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase, handleUnexpectedDisconnect]);

  const cancelScan = useCallback(() => finishScan(), [finishScan]);

  const clearError = useCallback(() => {
    if (bluetoothRadioRef.current === "off") { setError("bluetooth-off"); setPhase("error"); return; }
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
    if (operationRef.current === "sync") {
      onDone?.(false, "replaced");
      return;
    }
    if (operationRef.current === "measure") {
      onDone?.(false, "replaced");
      return;
    }
    operationRef.current = "measure";
    const operation = ++operationGenerationRef.current;
    const session = sessionRef.current;
    const ownsOperation = () => operationGenerationRef.current === operation && sessionRef.current === session;
    let completed = false;
    const finish = (ok: boolean, reason: Parameters<MeasureCallback>[1]) => {
      if (completed) return;
      completed = true;
      if (!ownsOperation()) { onDone?.(ok, reason); return; }
      operationRef.current = null;
      onDone?.(ok, reason);
      if (queuedSyncRef.current) {
        queuedSyncRef.current = false;
        void syncHistoryRef.current();
      }
    };
    if (!session?.measure) {
      finish(false, "refused");
      return;
    }
    session.measure(kind, (ok, reason) => {
      finish(ok, reason);
      // Mismo caso que en el sync: la lectura puede estar en el historial.
      if (!ok && kind === "spo2" && ownsOperation()) void syncHistoryRef.current();
    });
  }, []);

  const measurePolicy = useCallback((kind: MetricKind) => {
    return sessionRef.current?.measurePolicy?.(kind);
  }, []);

  /**
   * Detiene la medida puntual en curso (Cancelar de la vista de foco): para
   * el sensor en el driver y libera el candado de operación para que la UI
   * pueda medir de nuevo. Sin medida en curso no hace nada.
   */
  const stopMeasure = useCallback(() => {
    operationGenerationRef.current += 1;
    if (operationRef.current === "measure") operationRef.current = null;
    sessionRef.current?.stopMeasure?.();
  }, []);

  /**
   * Cancela un `syncAll` en curso (Cancelar de la vista de foco durante una
   * secuencia): marca la salida, para la medida actual en el driver y limpia
   * la UI de inmediato; el bucle de etapas sale solo al resolver sus esperas.
   */
  const cancelSync = useCallback(() => {
    operationGenerationRef.current += 1;
    cancelSyncRef.current = true;
    sessionRef.current?.stopMeasure?.();
    setSyncStage(null);
    setSyncing(false);
    operationRef.current = null;
    queuedSyncRef.current = false;
  }, []);

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
      handleSample({ ...sample, deviceId: "debug" }, false);
      ingestDirty.current = wasDirty;
    },
    [handleSample],
  );

  // La siguiente pasada se programa DESPUÉS de terminar el intento anterior.
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const autoAttempt = useRef(0);
  const autoTimer = useRef<number | undefined>(undefined);
  const reconnectGeneration = useRef(0);

  const scheduleAutoReconnect = useCallback((generation: number) => {
    if (generation !== reconnectGeneration.current || !accountRef.current || bluetoothRadioRef.current === "off" || backgroundRecovery.current) return;
    const delay = AUTO_RECONNECT_DELAYS_MS[Math.min(autoAttempt.current, AUTO_RECONNECT_DELAYS_MS.length - 1)];
    autoAttempt.current += 1;
    window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(() => {
      void (async () => {
        if (generation !== reconnectGeneration.current || !appActiveRef.current || addingAccessoryRef.current || bluetoothRadioRef.current === "off" || backgroundRecovery.current) return;
        const saved = loadSavedDevice(accountRef.current);
        if (!saved || !isSupportedWearable(saved) || !canAutoReconnectHere(saved) || intentionalDisconnect.current) return;
        if (phaseRef.current === "connected") return;
        if (phaseRef.current !== "scanning") {
          if (connectionTaskRef.current) await connectionTaskRef.current;
          else await connectRef.current(saved, { silent: true, automatic: true });
        }
        if (generation === reconnectGeneration.current && (phaseRef.current as WearablePhase) !== "connected") {
          scheduleAutoReconnect(generation);
        }
      })();
    }, delay);
  }, []);

  const startAutoReconnect = useCallback(() => {
    if (bluetoothRadioRef.current === "off" || backgroundRecovery.current) return;
    const generation = ++reconnectGeneration.current;
    autoAttempt.current = 0;
    scheduleAutoReconnect(generation);
  }, [scheduleAutoReconnect]);
  startAutoReconnectRef.current = startAutoReconnect;

  const stopAutoReconnect = useCallback(() => {
    reconnectGeneration.current += 1;
    window.clearTimeout(autoTimer.current);
  }, []);

  const searchAccessory = useCallback(async () => {
    if (addingAccessoryRef.current || !accountRef.current ||
        phaseRef.current === "connected" || phaseRef.current === "connecting" || phaseRef.current === "scanning") return;
    const owner = accountRef.current;
    const generation = sessionGenerationRef.current;
    const current = () => accountRef.current === owner && sessionGenerationRef.current === generation;
    addingAccessoryRef.current = true;
    setAddingAccessory(true);
    setError(null);
    setHasScanned(false);
    phaseRef.current = "scanning";
    setPhase("scanning");
    clearScanTimer();
    stopAutoReconnect();
    let selected = false;
    try {
      // Esperar un listado inicial en vuelo antes de presentar otra operación ASK.
      await ble.stopScan();
      const known = await ble.listPairedDevices();
      if (!current()) return;
      setDevices(known);
      const found = await searchWearableAccessories();
      if (!current()) return;
      const authorized = await ble.listPairedDevices();
      if (!current()) return;
      if (found?.length) {
        selected = true;
      }
      setDevices(previous => [...authorized, ...(found ?? [])].reduce((devices, device) => mergeDiscovered(devices, device), previous));
      setPhase("idle");
    } catch (error) {
      if (current()) { setError(toWearableError(error, "connection-failed").code); setPhase("error"); }
    } finally {
      addingAccessoryRef.current = false;
      setAddingAccessory(false);
      if (current()) setHasScanned(true);
      if (accountRef.current && appActiveRef.current && (!selected || !current())) startAutoReconnect();
    }
  }, [clearScanTimer, startAutoReconnect, stopAutoReconnect]);

  const scan = useCallback(async () => {
    if (bluetoothRadioRef.current === "off") { setError("bluetooth-off"); setPhase("error"); return; }
    if (addingAccessoryRef.current) return;
    try {
      if (await supportsAccessoryDiscovery()) await searchAccessory();
      else scanLegacy();
    } catch (error) {
      setError(toWearableError(error, "connection-failed").code);
      setPhase("error");
    }
  }, [searchAccessory, scanLegacy]);

  // Una cuenta nueva nunca hereda la conexión, el journal ni las tarjetas
  // del paciente anterior. La identidad guardada también está separada.
  useEffect(() => {
    stopAutoReconnect();
    if (!accountId) {
      setSavedDevice(null);
      return;
    }
    const saved = loadSavedDevice(accountId);
    setSavedDevice(saved);
    if (saved) {
      try { restoreSnapshot(accountId, saved.deviceId); }
      catch (error) { console.error("[ble] No se pudo restaurar el historial local.", error); setError("unknown"); }
    }
    startAutoReconnect();
    void flushIngest(true);
    return () => {
      stopAutoReconnect();
      // Una recreación del WebView conserva el servicio nativo. Solo el
      // cambio explícito de cuenta revoca su captura y asociación.
      if (accountRef.current === accountId) return;
      const session = sessionRef.current;
      const deviceId = descriptorRef.current?.deviceId;
      resetSessionState(true);
      descriptorRef.current = null;
      // Al cerrar sesión se corta la captura nativa: no se atribuyen datos
      // nuevos a otra persona que luego inicie sesión en este teléfono.
      cleanupRef.current = cleanupRef.current.then(async () => {
        if (session) await session.stop().catch(() => undefined);
        if (deviceId) {
          await stopPersistentConnection(deviceId, true).catch(() => undefined);
          await ble.disconnectDevice(deviceId);
        }
      });
    };
  }, [accountId, flushIngest, resetSessionState, restoreSnapshot, startAutoReconnect, stopAutoReconnect]);

  useEffect(() => {
    if (!accountId || !Capacitor.isNativePlatform()) return;
    let disposed = false;
    let activityVersion = 0;
    const onRadioState = (on: boolean, state: BluetoothRadioState = on ? "on" : "off") => {
      if (disposed) return;
      const previous = bluetoothRadioRef.current;
      bluetoothRadioRef.current = state;
      if (state === "off") {
        stopAutoReconnect();
        clearScanTimer();
        void ble.stopScan();
        setDevices([]);
        if (phaseRef.current === "connected" || backgroundRecovery.current) void handleUnexpectedDisconnect(false);
        else if (phaseRef.current === "connecting" || phaseRef.current === "scanning") resetSessionState();
        setError("bluetooth-off");
        phaseRef.current = "error";
        setPhase("error");
        return;
      }
      if (on) {
        setError((error) => error === "bluetooth-off" || error === "bluetooth-not-ready" ? null : error);
        if (previous === "off" && phaseRef.current === "error") { phaseRef.current = "idle"; setPhase("idle"); }
        if (appActiveRef.current && !addingAccessoryRef.current) startAutoReconnect();
      }
    };
    const onStateChange = (isActive: boolean) => {
      if (disposed) return;
      activityVersion += 1;
      appActiveRef.current = isActive;
      // El silencio mientras JS duerme no cuenta como un ping sin respuesta.
      // Al volver se exige una comprobación nueva antes de reciclar la sesión.
      heartbeatMisses.current = 0;
      if (!isActive || !backgroundRecovery.current) sessionRef.current?.setAppActive?.(isActive);
      if (!isActive) {
        stopAutoReconnect();
        cancelSync();
        void flushIngest(true);
        return;
      }
      const resume = async () => {
        if (disposed || addingAccessoryRef.current) return;
        const state = await ble.getBluetoothState();
        if (disposed || !appActiveRef.current) return;
        onRadioState(state === "on", state);
        if (state === "off") return;
        if (backgroundRecovery.current) {
          const session = sessionRef.current;
          const device = descriptorRef.current;
          const generation = sessionGenerationRef.current;
          if (!session || !device) return;
          const connected = await ble.getDeviceConnectionState(device.deviceId);
          if (disposed || generation !== sessionGenerationRef.current || sessionRef.current !== session ||
              !appActiveRef.current || !backgroundRecovery.current) return;
          backgroundRecovery.current = false;
          if (connected !== true) {
            await handleUnexpectedDisconnect(false);
            return;
          }
          // El enlace ya volvió: reutilizar el driver, sin repetir start/handshake.
          phaseRef.current = "connected";
          setPhase("connected");
          setError(null);
          app.connectWearable(device.name || t("Dispositivo sin nombre"));
          session.setAppActive?.(true);
          session.requestInfo?.();
        }
        refreshStoredDay();
        const deviceId = descriptorRef.current?.deviceId;
        if (deviceId) await drainPendingNotifications(deviceId);
        if (phaseRef.current !== "connected") startAutoReconnect();
        else if (operationRef.current === null) await syncHistoryRef.current();
        await flushIngest(true);
      };
      void resume().catch((error) => { console.error("[ble] Recuperación pendiente.", error); setError("unknown"); });
    };
    const handle = App.addListener("appStateChange", ({ isActive }) => onStateChange(isActive));
    const initialActivityVersion = activityVersion;
    void App.getState().then(({ isActive }) => {
      if (disposed || activityVersion !== initialActivityVersion) return;
      appActiveRef.current = isActive;
      if (backgroundRecovery.current && isActive) onStateChange(true);
      else sessionRef.current?.setAppActive?.(isActive);
    }).catch(() => undefined);
    const enabled = ble.watchBluetoothState(onRadioState).catch(() => () => Promise.resolve());
    ble.setNotificationFailureHandler(() => setError("unknown"));
    const onGap = (event: Event) => {
      const detail = (event as CustomEvent<{ ownerId: string; deviceId: string }>).detail;
      if (detail?.ownerId !== accountRef.current || detail.deviceId !== descriptorRef.current?.deviceId) return;
      setError("no-data");
      if (appActiveRef.current) void syncHistoryRef.current();
    };
    window.addEventListener(NOTIFICATION_GAP_EVENT, onGap);
    return () => {
      disposed = true;
      void handle.then((listener) => listener.remove());
      void enabled.then((remove) => remove());
      ble.setNotificationFailureHandler(null);
      window.removeEventListener(NOTIFICATION_GAP_EVENT, onGap);
    };
  }, [accountId, app, cancelSync, clearScanTimer, flushIngest, handleUnexpectedDisconnect, refreshStoredDay, resetSessionState, startAutoReconnect, stopAutoReconnect, t]);

  useEffect(() => {
    if (phase === "connected") stopAutoReconnect();
  }, [phase, stopAutoReconnect]);

  useEffect(() => stopAutoReconnect, [stopAutoReconnect]);

  // El backlog durable también se reintenta sin enlace BLE (red recuperada).
  useEffect(() => {
    if (!accountId) return;
    const flush = () => { if (appActiveRef.current) void flushIngest(true); };
    const timer = window.setInterval(() => {
      if (!appActiveRef.current) return;
      try { refreshStoredDay(); }
      catch (error) { console.error("[ble] No se pudo actualizar el día local.", error); setError("unknown"); }
      void flushIngest();
    }, INGEST_INTERVAL_MS);
    window.addEventListener("online", flush);
    return () => { window.clearInterval(timer); window.removeEventListener("online", flush); };
  }, [accountId, flushIngest, refreshStoredDay]);

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
    appActiveRef.current = true;
    return () => {
      appActiveRef.current = false;
      sessionGenerationRef.current += 1;
      operationRef.current = null;
      clearScanTimer();
      void ble.stopScan();
      sessionRef.current?.setAppActive?.(false);
      if (descriptorRef.current) detachPendingNotifications(descriptorRef.current.deviceId);
      sessionRef.current = null;
    };
  }, [clearScanTimer]);

  const value = useMemo<WearableState>(
    () => ({
      phase,
      sessionStale,
      devices,
      hasScanned,
      device,
      info,
      samples,
      today,
      error,
      diagnostics,
      setDiagnostics,
      accessoryDiscoverySupported,
      addingAccessory,
      gatt,
      log,
      clearLog,
      canMeasure,
      measureKinds,
      measure,
      measurePolicy,
      stopMeasure,
      cancelSync,
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
      sessionStale,
      devices,
      hasScanned,
      device,
      info,
      samples,
      today,
      error,
      diagnostics,
      setDiagnostics,
      accessoryDiscoverySupported,
      addingAccessory,
      gatt,
      log,
      clearLog,
      canMeasure,
      measureKinds,
      measure,
      measurePolicy,
      stopMeasure,
      cancelSync,
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
