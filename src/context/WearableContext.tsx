import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { BleService } from '@capacitor-community/bluetooth-le';
import * as ble from '../devices/ble/ble-client';
import { DIAG_LOG_LIMIT, shortUuid } from '../devices/diagnostics';
import type { DiagEntry } from '../devices/diagnostics';
import { toWearableError } from '../devices/errors';
import { openSession } from '../devices/registry';
import { toHex } from '../devices/util';
import { useT } from '../i18n/I18nContext';
import { useApp } from './AppContext';
import type {
  DeviceDescriptor,
  DeviceInfo,
  DeviceSession,
  HealthSample,
  MetricKind,
  WearableErrorCode,
} from '../devices/types';

export type WearablePhase =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

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
  measure(kind: MetricKind): void;
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

/** Mantiene viva la sesión BLE aunque el usuario cambie de pantalla. */
export function WearableProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const t = useT();

  const [phase, setPhase] = useState<WearablePhase>('idle');
  const [devices, setDevices] = useState<DeviceDescriptor[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [device, setDevice] = useState<DeviceDescriptor | null>(null);
  const [info, setInfo] = useState<DeviceInfo>({});
  const [samples, setSamples] = useState<
    Partial<Record<MetricKind, HealthSample>>
  >({});
  const [error, setError] = useState<WearableErrorCode | null>(null);
  const [diagnostics, setDiagnosticsState] = useState(false);
  const [gatt, setGatt] = useState<BleService[]>([]);
  const [log, setLog] = useState<DiagEntry[]>([]);
  const [canMeasure, setCanMeasure] = useState(false);

  const sessionRef = useRef<DeviceSession | null>(null);
  const scanTimer = useRef<number | undefined>(undefined);
  const intentionalDisconnect = useRef(false);

  const clearScanTimer = useCallback(() => {
    if (scanTimer.current !== undefined) {
      window.clearTimeout(scanTimer.current);
      scanTimer.current = undefined;
    }
  }, []);

  const resetSessionState = useCallback(() => {
    sessionRef.current = null;
    setDevice(null);
    setInfo({});
    setSamples({});
    setGatt([]);
    setCanMeasure(false);
    setPhase('idle');
  }, []);

  const handleUnexpectedDisconnect = useCallback(() => {
    if (intentionalDisconnect.current) {
      intentionalDisconnect.current = false;
      return;
    }
    resetSessionState();
    app.disconnectWatch();
    app.showToast(t('Se perdió la conexión con el dispositivo'), 'warn');
  }, [app, resetSessionState, t]);

  const handleSample = useCallback((sample: HealthSample) => {
    setSamples((prev) => ({ ...prev, [sample.metric]: sample }));
  }, []);

  const handleInfo = useCallback((delta: DeviceInfo) => {
    setInfo((prev) => ({ ...prev, ...delta }));
  }, []);

  const finishScan = useCallback(() => {
    clearScanTimer();
    void ble.stopScan();
    setHasScanned(true);
    setPhase((prev) => (prev === 'scanning' ? 'idle' : prev));
  }, [clearScanTimer]);

  const scan = useCallback(() => {
    if (phase === 'scanning') {
      finishScan();
      return;
    }
    setError(null);
    setDevices([]);
    setHasScanned(false);
    setPhase('scanning');
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
          setDevices((prev) => {
            if (prev.some((d) => d.deviceId === found.deviceId)) return prev;
            return [...prev, found].sort(
              (a, b) => (b.rssi ?? -999) - (a.rssi ?? -999),
            );
          });
        },
        { includeUnnamed: diagnostics },
      )
      .catch((err: unknown) => {
        clearScanTimer();
        setError(toWearableError(err).code);
        setPhase('error');
      });
  }, [clearScanTimer, diagnostics, finishScan, phase]);

  const connect = useCallback(
    (target: DeviceDescriptor) => {
      clearScanTimer();
      void ble.stopScan();
      setError(null);
      setPhase('connecting');
      void (async () => {
        try {
          await ble.connectDevice(target.deviceId, handleUnexpectedDisconnect);
          const session = await openSession(target);
          await session.start(handleSample, handleInfo);
          sessionRef.current = session;
          setCanMeasure(session.supportsMeasure === true);
          // El volcado GATT solo se pide en modo diagnóstico: la conexión ya
          // descubrió los servicios, así que la consulta es inmediata.
          if (diagnostics) {
            void ble
              .getDeviceServices(target.deviceId)
              .then(setGatt)
              .catch(() => undefined);
          }
          // El anillo puede anunciarse sin nombre: se usa una etiqueta legible
          // para el estado global, que otras pantallas muestran tal cual.
          const label = target.name || t('Dispositivo sin nombre');
          setDevice(target);
          setInfo({ name: label });
          setSamples({});
          setPhase('connected');
          app.connectWatch(label);
          app.showToast(t('{name} conectado', { name: label }), 'ok');
        } catch (err) {
          await ble.disconnectDevice(target.deviceId);
          resetSessionState();
          setError(toWearableError(err, 'connection-failed').code);
          setPhase('error');
        }
      })();
    },
    [app, clearScanTimer, diagnostics, handleInfo, handleSample, handleUnexpectedDisconnect, resetSessionState, t],
  );

  const disconnect = useCallback(() => {
    const session = sessionRef.current;
    const deviceId = device?.deviceId;
    intentionalDisconnect.current = true;
    resetSessionState();
    app.disconnectWatch();
    void (async () => {
      if (session) await session.stop().catch(() => undefined);
      if (deviceId) await ble.disconnectDevice(deviceId);
    })();
  }, [app, device, resetSessionState]);

  const cancelScan = useCallback(() => finishScan(), [finishScan]);

  const clearError = useCallback(() => {
    setError(null);
    setPhase((prev) => (prev === 'error' ? 'idle' : prev));
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

  const measure = useCallback((kind: MetricKind) => {
    sessionRef.current?.measure?.(kind);
  }, []);

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
        label: `${shortUuid(info.service)}/${shortUuid(info.characteristic)}`,
        hex: toHex(info.bytes),
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
      error,
      diagnostics,
      setDiagnostics,
      gatt,
      log,
      clearLog,
      canMeasure,
      measure,
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
      error,
      diagnostics,
      setDiagnostics,
      gatt,
      log,
      clearLog,
      canMeasure,
      measure,
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
  if (!ctx) throw new Error('useWearable must be used within WearableProvider');
  return ctx;
}
