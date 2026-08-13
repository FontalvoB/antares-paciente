import { IonIcon } from '@ionic/react'
import {
  calendar,
  chatbubbleEllipses,
  home,
  leaf,
  medkit,
  person,
} from 'ionicons/icons'
import { useApp } from '../context/AppContext'
import type { Screen } from '../types'

const items: { id: Screen; label: string; icon: string; sos?: boolean }[] = [
  { id: 'home', label: 'Inicio', icon: home },
  { id: 'book', label: 'Citas', icon: calendar },
  { id: 'nut', label: 'Nutrición', icon: leaf },
  { id: 'home', label: 'SOS', icon: medkit, sos: true },
  { id: 'chat', label: 'Chat IA', icon: chatbubbleEllipses },
  { id: 'prof', label: 'Perfil', icon: person },
]

export function BottomNav({ dark = false }: { dark?: boolean }) {
  const { screen, navigate, openPanic } = useApp()

  return (
    <nav className={`bnav ${dark ? 'bnav-dark' : ''}`}>
      {items.map((it, i) => {
        if (it.sos) {
          return (
            <button key="sos" className="ni ni-sos" onClick={openPanic}>
              <span className="ni-ico">
                <IonIcon icon={medkit} />
              </span>
              <span>SOS</span>
            </button>
          )
        }
        const on = screen === it.id
        return (
          <button
            key={`${it.id}-${i}`}
            className={`ni ${on ? 'on' : ''}`}
            onClick={() => navigate(it.id)}
          >
            <span className="ni-ico">
              <IonIcon icon={it.icon} />
            </span>
            <span>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
