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
import { useT } from '../i18n/I18nContext'
import type { Screen } from '../types'

export function BottomNav({ dark = false }: { dark?: boolean }) {
  const { screen, navigate, openPanic } = useApp()
  const t = useT()

  const items: { id: Screen; label: string; icon: string; iconOn: string; sos?: boolean }[] = [
    { id: 'home', label: t('Inicio'), icon: homeOutline, iconOn: home },
    { id: 'book', label: t('Citas'), icon: calendarOutline, iconOn: calendar },
    //{ id: 'nut', label: t('Nutrición'), icon: leafOutline, iconOn: leaf },
    { id: 'home', label: t('SOS'), icon: medkit, iconOn: medkit, sos: true },
    { id: 'chat', label: t('Chat'), icon: chatbubbleEllipsesOutline, iconOn: chatbubbleEllipses },
    { id: 'prof', label: t('Perfil'), icon: personOutline, iconOn: person },
  ]

  return (
    <nav className={`bnav ${dark ? 'bnav-dark' : ''}`}>
      {items.map((it, i) => {
        if (it.sos) {
          return (
            <button key="sos" type="button" className="ni ni-sos" onClick={openPanic} aria-label={t('Botón de pánico')}>
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
