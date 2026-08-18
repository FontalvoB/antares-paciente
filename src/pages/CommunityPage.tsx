import { useState } from 'react'
import { IonButton, IonSearchbar, IonTextarea } from '@ionic/react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

const friends = [
  { i: 'CR', n: 'Carlos Rodríguez', m: 'Semana 14 · Miami FL · 1,240 pts', g: 'linear-gradient(135deg,#1B6CA8,#0A1F36)' },
  { i: 'LP', n: 'Laura Pedraza', m: 'Semana 8 · Houston TX · 620 pts', g: 'linear-gradient(135deg,#D4537E,#9B2D5A)' },
  { i: 'JM', n: 'Jorge Martínez', m: 'Semana 20 · Orlando FL · 2,890 pts', g: 'linear-gradient(135deg,#E87B2B,#C05A0A)' },
  { i: 'SM', n: 'Sandra Morales', m: 'Semana 6 · Tampa FL · 380 pts', g: 'linear-gradient(135deg,#059669,#047857)' },
]

export function CommunityPage() {
  const { posts, likePost, addPost, showToast, user, pointsTotal } = useApp()
  const [tab, setTab] = useState<'feed' | 'perfil' | 'amigos' | 'redes'>('feed')
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')

  return (
    <Screen>
      <div className="hero hero-pur" style={{ paddingBottom: 0 }}>
        <div className="h2">🌐 Comunidad ANTARES</div>
        <div className="sub" style={{ marginBottom: 10 }}>
          10,847 miembros activos · COPP-ADRESD + INFINITO
        </div>
        <div style={{ display: 'flex' }}>
          {(['feed', 'perfil', 'amigos', 'redes'] as const).map((t) => (
            <button key={t} className={`com-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <Scroll>
        {tab === 'feed' && (
          <>
            <div className="card" style={{ margin: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="avatar" style={{ width: 36, height: 36, background: 'linear-gradient(145deg,#1a6ad8,#20c8ff)', fontSize: 12 }}>
                  MG
                </div>
                <IonTextarea className="fld draft-tx" value={draft} placeholder="¿Qué quieres compartir hoy?" onIonInput={(e) => setDraft(e.detail.value ?? '')} autoGrow />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <IonButton
                  className="bt bt-pur bt-mini"
                  onClick={() => {
                    if (!draft.trim()) return
                    addPost(draft.trim())
                    setDraft('')
                    showToast('Publicado en la comunidad', 'ok')
                  }}
                >
                  Publicar
                </IonButton>
              </div>
            </div>
            {posts.map((p) => (
              <div key={p.id} className="card" style={{ margin: '0 14px 10px' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div className="avatar" style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#1B6CA8,#0A1F36)', fontSize: 13 }}>
                    {p.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>{p.meta}</div>
                  </div>
                  <span className={`chip chip-${p.badgeTone}`}>{p.badge}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{p.text}</div>
                {p.progress && (
                  <div style={{ background: 'linear-gradient(135deg,#0C3D2C,#1D9E75)', color: '#fff', borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    {p.progress}
                  </div>
                )}
                {p.photo && (
                  <div style={{ height: 110, borderRadius: 12, background: 'var(--g1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 8 }}>
                    {p.photo}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--g1)', paddingTop: 8 }}>
                  <button style={{ background: 'none', border: 'none', color: p.liked ? 'var(--red)' : 'var(--mu)', fontWeight: 700, fontSize: 12 }} onClick={() => likePost(p.id)}>
                    {p.liked ? '♥' : '♡'} {p.likes}
                  </button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--mu)', fontWeight: 700, fontSize: 12 }} onClick={() => showToast('Comentarios próximamente', 'info')}>
                    💬 {p.comments}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'perfil' && (
          <>
            <div style={{ background: 'linear-gradient(135deg,#2D1B69,#1A0A3C)', padding: 18, textAlign: 'center', color: '#fff' }}>
              <div className="avatar" style={{ width: 64, height: 64, margin: '0 auto 8px', background: 'linear-gradient(135deg,var(--teal),#0F6E56)', fontSize: 22 }}>
                MG
              </div>
              <div className="display" style={{ fontSize: 18, fontWeight: 800 }}>{user.nombre}</div>
              <div style={{ fontSize: 11, opacity: 0.55 }}>Semana 12/24 · {pointsTotal} pts</div>
            </div>
            <div className="card" style={{ margin: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Sobre mí</div>
              <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                Mamá de 2, 38 años, Miami FL. En COPP-ADRESD desde mayo 2026. Meta: revertir la prediabetes y llegar a 65 kg.
              </div>
            </div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              {['🥗', '💪', '📊', '🧘', '🌙', '+'].map((e) => (
                <div key={e} style={{ aspectRatio: '1', background: 'var(--g1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                  {e}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'amigos' && (
          <>
            <div style={{ padding: 14 }}>
              <IonSearchbar
                className="sbar"
                value={q}
                placeholder="Buscar amigos en ANTARES…"
                onIonInput={(e) => setQ(e.detail.value ?? '')}
              />
            </div>
            {friends
              .filter((f) => f.n.toLowerCase().includes(q.toLowerCase()))
              .map((f) => (
                <div key={f.n} className="row-card">
                  <div className="avatar" style={{ width: 40, height: 40, background: f.g, fontSize: 13 }}>
                    {f.i}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{f.n}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>{f.m}</div>
                  </div>
                  <IonButton className="bt bt-outline bt-mini" onClick={() => showToast(`Mensaje a ${f.n}`, 'ok')}>
                    💬
                  </IonButton>
                </div>
              ))}
          </>
        )}

        {tab === 'redes' && (
          <div style={{ padding: 14 }}>
            {[
              ['♪', 'TikTok ANTARES', '@antaresbiohacking · 48.2K', 'linear-gradient(90deg,#010101,#1A1A1A)'],
              ['📷', 'Instagram ANTARES', '@antares.biohacking · 23.7K', 'linear-gradient(90deg,#3A1F5C,#831843)'],
              ['f', 'Facebook Community', '15.4K miembros', 'linear-gradient(90deg,#0A1F5C,#1A3A8A)'],
              ['▶', 'YouTube ANTARES', 'SUMMITs · Clases · 8.1K', 'linear-gradient(90deg,#1A0000,#4A0000)'],
              ['💬', 'WhatsApp Miami', 'Grupo COPP-ADRESD · 284', 'linear-gradient(90deg,#003A1A,#004D23)'],
            ].map(([e, t, s, bg]) => (
              <button
                key={t}
                onClick={() => showToast(`Abriendo ${t}…`, 'info')}
                style={{ width: '100%', background: String(bg), border: 'none', borderRadius: 14, padding: 12, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, color: '#fff', textAlign: 'left' }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {e}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{t}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{s}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Scroll>
    </Screen>
  )
}
