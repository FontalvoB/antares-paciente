import { IonIcon } from '@ionic/react'
import {
  calendarOutline,
  chatbubbleEllipsesOutline,
  close,
  homeOutline,
  menu,
  personOutline,
} from 'ionicons/icons'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Profile } from '../../graphql/community'
import { useI18n } from '../../i18n/I18nContext'
import type { Screen } from '../../types'
import { Avatar } from './community'

/** Navegación de la app (antes en la barra inferior). */
const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: 'home', label: 'Inicio', icon: homeOutline },
  { id: 'book', label: 'Citas', icon: calendarOutline },
  { id: 'chat', label: 'Chat', icon: chatbubbleEllipsesOutline },
  { id: 'prof', label: 'Perfil', icon: personOutline },
]

/** Sidebar lateral + SOS flotante para la comunidad (reemplaza la barra
 *  inferior). El hamburger se despliega con animación de entrada/colapso. */
export function ComSidebar({
  me,
  hidden = false,
}: {
  me: Profile | null
  hidden?: boolean
}) {
  const { screen, navigate } = useApp()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const visible = open || closing

  const closeDrawer = () => {
    if (!open || closing) return
    setClosing(true)
    window.setTimeout(() => {
      setClosing(false)
      setOpen(false)
    }, 260)
  }

  const openDrawer = () => {
    setOpen(true)
    setClosing(false)
  }

  return (
    <>
      <button
        type="button"
        className={`com-hamb ${hidden ? 'com-hamb-hidden' : ''}`}
        onClick={openDrawer}
        aria-label={t('Abrir menú')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <IonIcon icon={menu} />
      </button>

      {visible && (
        <>
          <div
            className={`com-side-backdrop ${closing ? 'is-closing' : ''}`}
            aria-hidden
            onClick={closeDrawer}
          />
          <aside
            className={`com-side ${closing ? 'is-closing' : ''}`}
            role="dialog"
            aria-label={t('Navegación de la app')}
          >
            <div className="com-side-head">
              <Avatar name={me?.displayName ?? 'MG'} seedId={me?.id ?? 'me'} size={44} src={me?.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="com-side-name">{me?.displayName ?? 'Mi perfil'}</div>
                <div className="com-side-sub">Copp Adresd Paciente</div>
              </div>
              <button
                type="button"
                className="com-side-close"
                onClick={closeDrawer}
                aria-label={t('Cerrar menú')}
              >
                <IonIcon icon={close} />
              </button>
            </div>
            <nav className="com-side-nav">
              {NAV.map((it) => {
                const on = screen === it.id
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`com-side-item ${on ? 'on' : ''}`}
                    onClick={() => {
                      setOpen(false)
                      setClosing(false)
                      navigate(it.id)
                    }}
                  >
                    <span className="com-side-ico">
                      <IonIcon icon={it.icon} />
                    </span>
                    {it.label}
                    {on && <span className="com-side-dot" />}
                  </button>
                )
              })}
            </nav>
            <div className="com-side-foot">COPP-ADRESD + INFINITO</div>
          </aside>
        </>
      )}
    </>
  )
}
