import { IonIcon } from '@ionic/react'
import {
  calendar,
  calendarOutline,
  chatbubbleEllipses,
  chatbubbleEllipsesOutline,
  home,
  homeOutline,
  medkit,
  person,
  personOutline,
} from 'ionicons/icons'
import { useApp } from '../context/AppContext'
import type { Screen } from '../types'

const items: { id: Screen; label: string; icon: string; iconOn: string; sos?: boolean }[] = [
  { id: 'home', label: 'Inicio', icon: homeOutline, iconOn: home },
  { id: 'book', label: 'Citas', icon: calendarOutline, iconOn: calendar },
  //{ id: 'nut', label: 'Nutrición', icon: leafOutline, iconOn: leaf },
  { id: 'home', label: 'SOS', icon: medkit, iconOn: medkit, sos: true },
  { id: 'chat', label: 'Chat', icon: chatbubbleEllipsesOutline, iconOn: chatbubbleEllipses },
  { id: 'prof', label: 'Perfil', icon: personOutline, iconOn: person },
]

export function BottomNav({ dark = false }: { dark?: boolean }) {
  const { screen, navigate, openPanic } = useApp()

  return (
    <nav className={`bnav ${dark ? 'bnav-dark' : ''}`}>
      {items.map((it, i) => {
        if (it.sos) {
          return (
            <button key="sos" type="button" className="ni ni-sos" onClick={openPanic} aria-label="Botón de pánico">
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
            type="button"
            className={`ni ${on ? 'on' : ''}`}
            onClick={() => navigate(it.id)}
            aria-current={on ? 'page' : undefined}
          >
            <span className="ni-ico">
              <IonIcon icon={on ? it.iconOn : it.icon} />
            </span>
            <span>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
