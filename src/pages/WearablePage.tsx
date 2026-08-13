import { useEffect, useState } from 'react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

const devices = ['ANTARES Watch Pro', 'Apple Watch Series 10', 'Samsung Galaxy Watch']

export function WearablePage() {
  const { watchConnected, watchName, connectWatch, disconnectWatch, showToast } = useApp()
  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState<string[]>([])
  const [fc, setFc] = useState(72)

  useEffect(() => {
    if (!watchConnected) return
    const id = window.setInterval(() => setFc((n) => n + (Math.random() > 0.5 ? 1 : -1)), 1200)
    return () => window.clearInterval(id)
  }, [watchConnected])

  const scan = () => {
    setScanning(true)
    setFound([])
    window.setTimeout(() => {
      setFound(devices)
      showToast('Dispositivos encontrados', 'ok')
    }, 900)
  }

  return (
    <Screen>
      <Scroll>
        <div className="hero hero-indigo">
          <div className="kicker" style={{ color: '#818CF8' }}>ANTARES · BIOMETRÍA</div>
          <div className="h1">⌚ Reloj inteligente</div>
          <div className="sub">Datos biométricos vía Bluetooth · tiempo real</div>
          <div className="chips">
            <span className="chip chip-glass">
              <span className="dot" style={{ background: watchConnected ? 'var(--safe)' : '#6B8094' }} />
              {watchConnected ? `${watchName} conectado` : 'Sin dispositivo'}
            </span>
          </div>
        </div>

        {!watchConnected ? (
          <div className="card" style={{ margin: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>⌚</div>
            <div className="ct">Conecta tu reloj inteligente</div>
            <div className="cs" style={{ marginBottom: 14 }}>
              La app recibirá FC, TA, SpO2, ECG, sueño, pasos y movilidad.
            </div>
            <div className="grid-2" style={{ padding: 0, marginBottom: 14 }}>
              {['❤️ FC · ECG', '🫁 SpO2', '🩺 Presión', '🌙 Sueño', '👟 Pasos', '🏃 Movilidad'].map((t) => (
                <div key={t} style={{ background: 'var(--g1)', borderRadius: 10, padding: 10, fontSize: 12 }}>
                  {t}
                </div>
              ))}
            </div>
            <button className="btn btn-pur" onClick={scan}>
              {scanning ? 'Buscando…' : 'Activar Bluetooth y buscar'}
            </button>
            {found.length > 0 && (
              <div style={{ marginTop: 12, textAlign: 'left' }}>
                {found.map((d) => (
                  <button
                    key={d}
                    className="prow"
                    onClick={() => {
                      connectWatch(d)
                      showToast(`${d} conectado`, 'ok')
                    }}
                  >
                    <span>⌚</span>
                    <div style={{ flex: 1, fontWeight: 700 }}>{d}</div>
                    <span style={{ color: 'var(--teal)', fontWeight: 700, fontSize: 12 }}>Conectar</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ margin: 14, background: 'linear-gradient(135deg,#0C3D2C,var(--teal))', borderRadius: 14, padding: 14, color: '#fff', display: 'flex', gap: 10 }}>
              <div style={{ fontSize: 24 }}>⌚</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{watchName}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Bluetooth · datos en vivo</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Batería</div>
                <div style={{ fontWeight: 800 }}>87%</div>
              </div>
            </div>
            <div className="sec">Datos en vivo</div>
            <div className="grid-2">
              {[
                ['❤️', `${fc} lpm`, 'Frecuencia cardíaca', 'Normal', 'ac-panic'],
                ['💨', '98%', 'Oximetría SpO2', 'Normal', 'ac-blue'],
                ['🩺', '118/76', 'Presión arterial', 'Óptima', 'ac-org'],
                ['🌙', '6.8 hrs', 'Sueño anoche', 'Meta: 8h', 'ac-pur'],
                ['👟', '6,240', 'Pasos / 8,000', '78%', 'ac-teal'],
                ['🏃', 'Activo', 'Movilidad', 'Caminando', 'ac-org'],
              ].map(([e, v, l, s, a]) => (
                <div key={String(l)} className={`card card-accent ${a}`}>
                  <div>{e}</div>
                  <div className="display" style={{ fontSize: 22, fontWeight: 800 }}>
                    {v}
                  </div>
                  <div className="cs">{l}</div>
                  <span className="chip chip-teal" style={{ marginTop: 6 }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
            <div className="card" style={{ margin: 14, background: '#0A0A1A', color: '#4ADE80', borderColor: 'rgba(255,255,255,.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>● Electrocardiograma · ritmo sinusal</div>
              <div style={{ height: 48, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                {Array.from({ length: 42 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 8 + Math.abs(Math.sin(i / 2.2)) * 32 + (i % 7 === 0 ? 18 : 0),
                      background: '#4ADE80',
                      borderRadius: 1,
                      opacity: 0.85,
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ padding: '0 14px 16px' }}>
              <button
                className="btn"
                style={{ background: 'var(--red-l)', color: 'var(--red)' }}
                onClick={() => {
                  disconnectWatch()
                  showToast('Reloj desconectado', 'warn')
                }}
              >
                Desconectar reloj
              </button>
            </div>
          </>
        )}
      </Scroll>
    </Screen>
  )
}
