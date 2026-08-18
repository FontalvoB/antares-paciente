import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  IonAlert,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
} from '@ionic/react'
import {
  batteryHalfOutline,
  bluetooth,
  checkmarkCircle,
  pulseOutline,
} from 'ionicons/icons'
import { PageHeader } from '../components/PageHeader'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

const devices = [
  { name: 'ANTARES Watch Pro', kind: 'ANTARES', signal: 4, rssi: 'Señal alta' },
  { name: 'Apple Watch Series 10', kind: 'Apple', signal: 3, rssi: 'Señal media' },
  { name: 'Samsung Galaxy Watch', kind: 'Samsung', signal: 2, rssi: 'Señal baja' },
]

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
  const { watchConnected, watchName, connectWatch, disconnectWatch, showToast } = useApp()
  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState<typeof devices>([])
  const [pairing, setPairing] = useState<string | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const [fc, setFc] = useState(72)
  const scanTimer = useRef(0)
  const pairTimer = useRef(0)

  useEffect(() => {
    return () => {
      window.clearTimeout(scanTimer.current)
      window.clearTimeout(pairTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!watchConnected) return
    const id = window.setInterval(() => setFc((n) => Math.min(98, Math.max(62, n + (Math.random() > 0.5 ? 1 : -1)))), 1200)
    return () => window.clearInterval(id)
  }, [watchConnected])

  const scan = () => {
    if (scanning) return
    setScanning(true)
    setFound([])
    window.clearTimeout(scanTimer.current)
    scanTimer.current = window.setTimeout(() => {
      setFound(devices)
      setScanning(false)
      showToast('3 dispositivos encontrados', 'ok')
    }, 1400)
  }

  const pair = (name: string) => {
    if (pairing) return
    setPairing(name)
    window.clearTimeout(pairTimer.current)
    pairTimer.current = window.setTimeout(() => {
      connectWatch(name)
      setPairing(null)
      showToast(`${name} conectado`, 'ok')
    }, 700)
  }

  return (
    <Screen>
      <PageHeader
        kicker="Biometría en vivo"
        title="Reloj"
        sub={watchConnected ? `${watchName} · datos en tiempo real` : 'Empareja un dispositivo para ver FC, sueño y SpO2'}
        trailing={
          <span className={`status-pill ${watchConnected ? 'on' : ''}`}>
            <span className="dot" style={{ background: watchConnected ? 'var(--safe)' : 'var(--mu)' }} />
            {watchConnected ? 'Conectado' : 'Sin reloj'}
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

            <h2 className="watch-pair-title">{scanning ? 'Buscando cerca de ti…' : 'Conecta tu reloj'}</h2>
            <p className="watch-pair-copy">
              {scanning
                ? 'Mantén el reloj desbloqueado y cerca del teléfono.'
                : 'Recibiremos frecuencia cardíaca, sueño, presión, SpO2 y ECG.'}
            </p>

            <div className="watch-caps">
              {['FC · ECG', 'SpO2', 'Presión', 'Sueño', 'Pasos', 'Movilidad'].map((t) => (
                <span key={t} className="chip chip-teal">{t}</span>
              ))}
            </div>

            <IonButton expand="block" className="bt bt-primary" onClick={scan} disabled={scanning}>
              {scanning ? (
                <>
                  <IonSpinner name="crescent" color="light" style={{ width: 18, height: 18, marginRight: 8 }} />
                  Buscando dispositivos…
                </>
              ) : (
                <>
                  <IonIcon icon={bluetooth} slot="start" />
                  Buscar dispositivo
                </>
              )}
            </IonButton>

            {found.length > 0 && !scanning && (
              <>
                <div className="group-label">Disponibles</div>
                <IonList className="group-list" lines="full">
                  {found.map((d) => (
                    <IonItem
                      key={d.name}
                      className="group-item"
                      button
                      detail={false}
                      disabled={!!pairing}
                      onClick={() => pair(d.name)}
                    >
                      <div className="bt-dev-ico" slot="start">
                        <IonIcon icon={pulseOutline} />
                      </div>
                      <IonLabel>
                        <h3>{d.name}</h3>
                        <p>
                          {d.kind} · {d.rssi}
                        </p>
                      </IonLabel>
                      <div slot="end" className="bt-dev-end">
                        <Signal n={d.signal} />
                        {pairing === d.name ? (
                          <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
                        ) : (
                          <span className="bt-connect">Conectar</span>
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
                <div className="watch-live-name">{watchName}</div>
                <div className="watch-live-meta">Bluetooth · sincronizando</div>
              </div>
              <div className="watch-batt">
                <IonIcon icon={batteryHalfOutline} />
                <strong>87%</strong>
              </div>
            </div>

            <div className="vital-hero">
              <div className="vital-hero-kicker">Frecuencia cardíaca</div>
              <div className="vital-hero-row">
                <div className="vital-hero-val">
                  {fc}
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
              <div className="vital-hero-hint">Ritmo en reposo · zona normal</div>
            </div>

            <div className="sec">Métricas de hoy</div>
            <div className="grid-2">
              {[
                ['98%', 'SpO2', 'Normal', 'ac-blue'],
                ['118/76', 'Presión', 'Óptima', 'ac-org'],
                ['6.8 h', 'Sueño', 'Meta 8 h', 'ac-pur'],
                ['6,240', 'Pasos', '78% de 8,000', 'ac-teal'],
              ].map(([v, l, s, a]) => (
                <div key={String(l)} className={`card card-accent ${a}`}>
                  <div className="display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px' }}>
                    {v}
                  </div>
                  <div className="ct" style={{ marginTop: 4 }}>{l}</div>
                  <div className="cs">{s}</div>
                </div>
              ))}
            </div>

            <div className="card ecg-card">
              <div className="ecg-label">Electrocardiograma · ritmo sinusal</div>
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

            <div style={{ padding: '4px 16px 20px' }}>
              <IonButton
                expand="block"
                className="bt"
                style={{ '--background': 'var(--red-l)', '--color': 'var(--red)' } as CSSProperties}
                onClick={() => setConfirmOff(true)}
              >
                Desconectar reloj
              </IonButton>
            </div>
          </>
        )}
      </Scroll>

      <IonAlert
        isOpen={confirmOff}
        header="¿Desconectar el reloj?"
        message="Dejarán de llegar datos en vivo hasta que lo vuelvas a emparejar."
        buttons={[
          { text: 'Seguir conectado', role: 'cancel' },
          {
            text: 'Desconectar',
            role: 'destructive',
            handler: () => {
              disconnectWatch()
              setFound([])
              showToast('Reloj desconectado', 'warn')
            },
          },
        ]}
        onDidDismiss={() => setConfirmOff(false)}
      />
    </Screen>
  )
}
