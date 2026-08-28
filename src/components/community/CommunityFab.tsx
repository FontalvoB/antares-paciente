import { IonIcon } from '@ionic/react'
import {
  add,
  chatbubblesOutline,
  compassOutline,
  createOutline,
  moonOutline,
  peopleOutline,
  personOutline,
  shareSocialOutline,
  sunnyOutline,
} from 'ionicons/icons'
import { useEffect, useRef, useState, type RefObject } from 'react'

export type FabAction = 'publish' | 'feed' | 'perfil' | 'chat' | 'amigos' | 'redes' | 'darkmode'

/** Ítems del menú: el primero en DOM se asienta más cerca del botón (el
 *  contenedor usa column-reverse, así el orden visual es Publish → Redes). */
const ITEMS: { id: FabAction; label: string; icon: string; tone: string }[] = [
  { id: 'publish', label: 'Nueva publicación', icon: createOutline, tone: 'pur' },
  { id: 'feed', label: 'Feed', icon: compassOutline, tone: 'teal' },
  { id: 'perfil', label: 'Perfil', icon: personOutline, tone: 'blue' },
  { id: 'chat', label: 'Chats', icon: chatbubblesOutline, tone: 'org' },
  { id: 'amigos', label: 'Amigos', icon: peopleOutline, tone: 'gold' },
  { id: 'redes', label: 'Redes', icon: shareSocialOutline, tone: 'red' },
]

/** Botón flotante de la comunidad: se despliega hacia arriba con las acciones
 *  principales. Se cierra con animación de salida y con cualquier scroll.
 *  La visibilidad (ocultar al bajar / mostrar al subir) la controla la página. */
export function CommunityFab({
  hidden = false,
  scrollRef,
  onPick,
  dark = false,
}: {
  hidden?: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  onPick: (a: FabAction) => void
  dark?: boolean
}) {
  const items = [
    ...ITEMS,
    {
      id: 'darkmode' as FabAction,
      label: dark ? 'Modo claro' : 'Modo oscuro',
      icon: dark ? sunnyOutline : moonOutline,
      tone: 'teal',
    },
  ]
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const visible = open || closing
  const openRef = useRef(false)
  openRef.current = open

  const close = () => {
    if (!open || closing) return
    setClosing(true)
    window.setTimeout(() => {
      setClosing(false)
      setOpen(false)
    }, 240)
  }
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        // Cualquier scroll cierra el menú si está abierto.
        if (openRef.current) closeRef.current()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [scrollRef])

  const toggle = () => {
    if (open) {
      close()
    } else {
      setOpen(true)
      setClosing(false)
    }
  }

  const pick = (id: FabAction) => {
    setOpen(false)
    setClosing(false)
    onPick(id)
  }

  return (
    <div className={`comfab-wrap ${hidden ? 'comfab-hidden' : ''}`}>
      {visible && (
        <div
          className={`comfab-backdrop ${closing ? 'is-closing' : ''}`}
          aria-hidden="true"
          onClick={close}
        />
      )}
      {visible && (
        <div className="comfab-items">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              className={`comfab-item ${closing ? 'is-closing' : ''}`}
              style={{ animationDelay: `${(closing ? items.length - 1 - i : i) * 40}ms` }}
              onClick={() => pick(it.id)}
            >
              <span className="comfab-item-lbl">{it.label}</span>
              <span className={`comfab-item-ico tone-${it.tone}`}>
                <IonIcon icon={it.icon} />
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`comfab ${open ? 'is-open' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Cerrar acciones de la comunidad' : 'Abrir acciones de la comunidad'}
      >
        <IonIcon icon={add} className="comfab-ico" />
      </button>
    </div>
  )
}
