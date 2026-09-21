import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  IonAlert,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonToggle,
} from '@ionic/react'
import {
  batteryHalfOutline,
  bluetooth,
  checkmarkCircle,
  copyOutline,
  pulseOutline,
  trashOutline,
} from 'ionicons/icons'
import { PageHeader } from '../components/PageHeader'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { useWearable } from '../context/WearableContext'
import { describeServices, formatEntry } from '../devices/diagnostics'
import { useT } from '../i18n/I18nContext'
import type { DeviceDescriptor, MetricKind, WearableErrorCode } from '../devices/types'

const ERROR_KEYS: Record<WearableErrorCode, string> = {
  'bluetooth-off': 'Bluetooth está apagado. Actívalo para buscar tu dispositivo.',
  'permission-denied': 'Permiso de Bluetooth denegado. Habilítalo en los ajustes del sistema.',
  'scan-unavailable': 'Tu navegador no permite buscar dispositivos Bluetooth.',
  'connection-failed': 'No se pudo conectar. Inténtalo de nuevo.',
  'unsupported-device': 'Este dispositivo no expone datos compatibles con la app.',
  'no-data': 'El dispositivo no envía datos. Verifica que esté vinculado con su app oficial.',
  unknown: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
}

function signalBars(rssi?: number) {
  if (rssi === undefined) return 1
  if (rssi >= -55) return 4
  if (rssi >= -67) return 3
  if (rssi >= -80) return 2
  return 1
}

function signalLabel(rssi?: number) {
  const bars = signalBars(rssi)
  if (bars === 4) return 'Señal alta'
  if (bars === 3) return 'Señal media'
  return 'Señal baja'
}

function Signal({ n }: { n: number }) {
  return (
    <span className="bt-signal" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  )
}

export function WearablePage() {
  const t = useT()
  const { watchConnected, watchName, showToast } = useApp()
  const {
    phase,
    devices,
    hasScanned,
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
    connect,
    disconnect,
    clearError,
  } = useWearable()
  const [confirmOff, setConfirmOff] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [measuring, setMeasuring] = useState<{ kind: MetricKind; since: number } | null>(null)
  const announced = useRef(false)

  const scanning = phase === 'scanning'
  const connecting = phase === 'connecting'
  const hr = samples.heart_rate?.value
  const spo2 = samples.spo2?.value
  const blood = samples.blood_pressure
  const steps = samples.steps?.value

  useEffect(() => {
    if (phase !== 'connecting' && pending) setPending(null)
  }, [phase, pending])

  useEffect(() => {
    if (!hasScanned) {
      announced.current = false
      return
    }
    if (announced.current || !devices.length) return
    announced.current = true
    showToast(t('{count} dispositivos encontrados', { count: String(devices.length) }), 'ok')
  }, [devices.length, hasScanned, showToast, t])

  // La medida puntual termina cuando llega una muestra posterior al toque.
  useEffect(() => {
    if (!measuring) return
    const sample = samples[measuring.kind]
    if (sample && sample.ts > measuring.since) setMeasuring(null)
  }, [measuring, samples])

  const startMeasure = (kind: MetricKind) => {
    setMeasuring({ kind, since: Date.now() })
    measure(kind)
  }

  const copyDiagnostics = () => {
    const text = [describeServices(gatt), '', ...log.map(formatEntry)].join('\n')
    const failed = () =>
      showToast(t('Ocurrió un error inesperado. Inténtalo de nuevo.'), 'err')
    try {
      void navigator.clipboard
        .writeText(text)
        .then(() => showToast(t('Copiado al portapapeles'), 'ok'))
        .catch(failed)
    } catch {
      failed()
    }
  }

  const pair = (device: DeviceDescriptor) => {
    if (connecting) return
    setPending(device.deviceId)
    connect(device)
  }

  const liveHint = info.wearing === false
    ? t('Coloca el anillo para medir')
    : hr
      ? t('En vivo')
      : t('Sin datos aún')

  return (
    <Screen>
      <PageHeader
        kicker={t('Biometría en vivo')}
        title={t('Reloj')}
        sub={watchConnected ? `${watchName} · ${t('datos en tiempo real')}` : t('Empareja un dispositivo para ver FC, sueño y SpO2')}
        trailing={
          <span className={`status-pill ${watchConnected ? 'on' : ''}`}>
            <span className="dot" style={{ background: watchConnected ? 'var(--safe)' : 'var(--mu)' }} />
            {watchConnected ? t('Conectado') : t('Sin reloj')}
          </span>
        }
      />

      <Scroll>
        {!watchConnected ? (
          <div className="watch-pair">
            <div className={`watch-radar ${scanning ? 'is-scanning' : ''}`} aria-hidden="true">
              <span className="watch-ring" />
              <span className="watch-ring" />
              <span className="watch-ring" />
              <div className="watch-face">
                <IonIcon icon={bluetooth} />
              </div>
            </div>

            <h2 className="watch-pair-title">{scanning ? t('Buscando cerca de ti…') : t('Conecta tu reloj')}</h2>
            <p className="watch-pair-copy">
              {connecting
                ? t('Estableciendo sesión con el dispositivo…')
                : scanning
                  ? t('Mantén el reloj desbloqueado y cerca del teléfono.')
                  : t('Recibiremos frecuencia cardíaca, sueño, presión, SpO2 y ECG.')}
            </p>

            {phase === 'error' && error && (
              <p className="watch-pair-copy" style={{ color: 'var(--red)' }}>
                {t(ERROR_KEYS[error])}
              </p>
            )}

            <div className="watch-caps">
              {['FC · ECG', 'SpO2', 'Presión', 'Sueño', 'Pasos', 'Movilidad'].map((item) => (
                <span key={item} className="chip chip-teal">{t(item)}</span>
              ))}
            </div>

            <IonList className="group-list" lines="none">
              <IonItem className="group-item">
                <IonLabel>
                  <h3>{t('Modo diagnóstico')}</h3>
                  <p>{t('Muestra todos los dispositivos y el detalle GATT.')}</p>
                </IonLabel>
                <IonToggle
                  slot="end"
                  checked={diagnostics}
                  onIonChange={(event) => setDiagnostics(event.detail.checked)}
                />
              </IonItem>
            </IonList>

            {/* Se puede tocar de nuevo para cancelar la búsqueda en curso. */}
            <IonButton expand="block" className="bt bt-primary" onClick={scan} disabled={connecting}>
              {scanning ? (
              <>
                  <IonSpinner name="crescent" color="light" style={{ width: 18, height: 18, marginRight: 8 }} />
                  {t('Buscando dispositivos…')}
                </>
              ) : (
              <>
                  <IonIcon icon={bluetooth} slot="start" />
                  {t('Buscar dispositivo')}
                </>
              )}
            </IonButton>

            {hasScanned && !devices.length && phase !== 'error' && (
              <p className="watch-pair-copy">
                {t('No encontramos dispositivos cerca. Acércalo al teléfono e inténtalo de nuevo.')}
              </p>
            )}

            {devices.length > 0 && (
              <>
                <div className="group-label">
                  {t('Disponibles')} · {devices.length}
                </div>
                <IonList className="group-list" lines="full">
                  {devices.map((d) => (
                    <IonItem
                      key={d.deviceId}
                      className="group-item"
                      button
                      detail={false}
                      disabled={connecting}
                      onClick={() => pair(d)}
                    >
                      <div className="bt-dev-ico" slot="start">
                        <IonIcon icon={pulseOutline} />
                      </div>
                      <IonLabel>
                        <h3>{d.name || t('Dispositivo sin nombre')}</h3>
                        <p>{t(signalLabel(d.rssi))}</p>
                      </IonLabel>
                      <div slot="end" className="bt-dev-end">
                        <Signal n={signalBars(d.rssi)} />
                        {pending === d.deviceId ? (
                          <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
                        ) : (
                          <span className="bt-connect">{t('Conectar')}</span>
                        )}
                      </div>
                    </IonItem>
                  ))}
                </IonList>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="watch-live-bar">
              <div className="watch-live-ico">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="watch-live-name">{info.name || watchName}</div>
                <div className="watch-live-meta">
                  {hr ? t('En vivo') : t('Bluetooth · sincronizando')}
                </div>
              </div>
              {info.battery !== undefined && (
                <div className="watch-batt">
                  <IonIcon icon={batteryHalfOutline} />
                  <strong>{info.battery}%</strong>
                </div>
              )}
            </div>

            <div className="vital-hero">
              <div className="vital-hero-kicker">{t('Frecuencia cardíaca')}</div>
              <div className="vital-hero-row">
                <div className="vital-hero-val">
                  {hr ? Math.round(hr) : '—'}
                  <span>lpm</span>
                </div>
                <div className="waves" aria-hidden="true">
                  <span className="wave" />
                  <span className="wave" />
                  <span className="wave" />
                  <span className="wave" />
                  <span className="wave" />
                </div>
              </div>
              <div className="vital-hero-hint">{liveHint}</div>
            </div>

            <div className="sec">{t('Métricas de hoy')}</div>
            <div className="grid-2">
              <div className="card card-accent ac-blue">
                <div className="display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>
                  {spo2 ? `${Math.round(spo2)}%` : '—'}
                </div>
                <div className="ct" style={{ marginTop: 4 }}>{t('SpO2')}</div>
                <div className="cs">{spo2 ? t('En vivo') : t('Sin datos aún')}</div>
              </div>
              <div className="card card-accent ac-org">
                <div className="display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>
                  {blood ? `${Math.round(blood.value)}/${Math.round(blood.value2 ?? 0)}` : '—'}
                </div>
                <div className="ct" style={{ marginTop: 4 }}>{t('Presión')}</div>
                <div className="cs">{blood ? t('En vivo') : t('Sin datos aún')}</div>
              </div>
              <div className="card card-accent ac-pur">
                <div className="display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>
                  —
                </div>
                <div className="ct" style={{ marginTop: 4 }}>{t('Sueño')}</div>
                <div className="cs">{t('Sin datos aún')}</div>
              </div>
              <div className="card card-accent ac-teal">
                <div className="display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>
                  {steps ? Math.round(steps).toLocaleString('es-US') : '—'}
                </div>
                <div className="ct" style={{ marginTop: 4 }}>{t('Pasos')}</div>
                <div className="cs">{steps ? t('En vivo') : t('Sin datos aún')}</div>
              </div>
            </div>

            {canMeasure && (
              <>
                <div className="sec">{t('Mediciones puntuales')}</div>
                <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
                  <IonButton
                    expand="block"
                    className="bt"
                    fill="outline"
                    disabled={measuring?.kind === 'spo2'}
                    onClick={() => startMeasure('spo2')}
                  >
                    {measuring?.kind === 'spo2' ? (
                      <>
                        <IonSpinner name="crescent" style={{ width: 16, height: 16, marginRight: 8 }} />
                        {t('Midiendo…')}
                      </>
                    ) : (
                      t('Medir SpO2 ahora')
                    )}
                  </IonButton>
                  <IonButton
                    expand="block"
                    className="bt"
                    fill="outline"
                    disabled={measuring?.kind === 'blood_pressure'}
                    onClick={() => startMeasure('blood_pressure')}
                  >
                    {measuring?.kind === 'blood_pressure' ? (
                      <>
                        <IonSpinner name="crescent" style={{ width: 16, height: 16, marginRight: 8 }} />
                        {t('Midiendo…')}
                      </>
                    ) : (
                      t('Medir presión ahora')
                    )}
                  </IonButton>
                </div>
                <p className="watch-pair-copy">
                  {t('Mantén la banda en contacto y sin moverte.')}
                </p>
              </>
            )}

            <div className="card ecg-card">
              <div className="ecg-label">{t('Electrocardiograma · ritmo sinusal')}</div>
              <div className="ecg-trace">
                {Array.from({ length: 42 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 8 + Math.abs(Math.sin(i / 2.2)) * 32 + (i % 7 === 0 ? 18 : 0),
                    }}
                  />
                ))}
              </div>
            </div>

            {diagnostics && (
              <>
                <div className="sec">{t('Servicios GATT')}</div>
                <div className="card" style={{ padding: 12 }}>
                  <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {gatt.length ? describeServices(gatt) : t('Sin datos aún')}
                  </pre>
                </div>

                <div className="sec">
                  {t('Registro BLE')} · {log.length}
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 11,
                      maxHeight: 220,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {log.length ? log.map(formatEntry).join('\n') : t('Sin datos aún')}
                  </pre>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <IonButton size="small" className="bt" onClick={copyDiagnostics}>
                      <IonIcon icon={copyOutline} slot="start" />
                      {t('Copiar')}
                    </IonButton>
                    <IonButton size="small" className="bt" fill="outline" onClick={clearLog}>
                      <IonIcon icon={trashOutline} slot="start" />
                      {t('Limpiar')}
                    </IonButton>
                  </div>
                </div>
              </>
            )}

            <div style={{ padding: '4px 16px 20px' }}>
              <IonButton
                expand="block"
                className="bt"
                style={{ '--background': 'var(--red-l)', '--color': 'var(--red)' } as CSSProperties}
                onClick={() => setConfirmOff(true)}
              >
                {t('Desconectar reloj')}
              </IonButton>
            </div>
          </>
        )}
      </Scroll>

      <IonAlert
        isOpen={confirmOff}
        header={t('¿Desconectar el reloj?')}
        message={t('Dejarán de llegar datos en vivo hasta que lo vuelvas a emparejar.')}
        buttons={[
          { text: t('Seguir conectado'), role: 'cancel' },
          {
            text: t('Desconectar'),
            role: 'destructive',
            handler: () => {
              disconnect()
              clearError()
              showToast(t('Reloj desconectado'), 'warn')
            },
          },
        ]}
        onDidDismiss={() => setConfirmOff(false)}
      />
    </Screen>
  )
}
