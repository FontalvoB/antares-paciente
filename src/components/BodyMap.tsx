import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties } from 'react'
import type { BodyIndex } from '../data/bodyProfile'
import { useT } from '../i18n/I18nContext'

/* --------------------------------------------------------------------------
   Silueta humana de frente, en unidades del viewBox. Es una ilustración de
   dominio: Ionic no tiene nada equivalente y no se añade una librería de
   gráficos solo para esto (regla de excepción en `ionic-rules`).

   Las extremidades son trazos con extremo redondeado en vez de contornos
   cerrados: se leen igual y el path queda mantenible.
   -------------------------------------------------------------------------- */
const VIEW_W = 200
const VIEW_H = 384

const TORSO =
  'M71 82C71 71 83 66 100 66C117 66 129 71 129 82L126 128C124 140 122 147 122 156L126 194C126 202 116 206 100 206C84 206 74 202 74 194L78 156C78 147 76 140 74 128Z'
const ARM_L = 'M76 86C62 94 55 114 53 138C52 154 55 170 59 182'
const ARM_R = 'M124 86C138 94 145 114 147 138C148 154 145 170 141 182'
const LEG_L = 'M88 202C86 232 84 264 84 296C84 324 85 344 86 360'
const LEG_R = 'M112 202C114 232 116 264 116 296C116 324 115 344 114 360'

/**
 * Figura del paciente con un marcador por índice. Cada marcador se conecta
 * con una etiqueta táctil en el margen: tocarla selecciona el índice, que la
 * página de arriba detalla debajo de la figura.
 */
export function BodyMap({
  indices,
  activeId,
  onSelect,
}: {
  indices: BodyIndex[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const t = useT()
  const reduce = useReducedMotion()

  const at = (index: BodyIndex) => ({
    x: (index.spot.x / 100) * VIEW_W,
    y: (index.spot.y / 100) * VIEW_H,
  })

  return (
    <div className="bm-figure">
      <svg
        className="bm-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={t('Figura del cuerpo con los índices de salud señalados')}
      >
        <g className="bm-body">
          <path className="bm-limb" d={LEG_L} />
          <path className="bm-limb" d={LEG_R} />
          <path className="bm-limb bm-arm" d={ARM_L} />
          <path className="bm-limb bm-arm" d={ARM_R} />
          <path className="bm-limb bm-neck" d="M100 54L100 72" />
          <path className="bm-fill" d={TORSO} />
          <circle className="bm-fill" cx="100" cy="34" r="22" />
        </g>

        {indices.map((index) => {
          const { x, y } = at(index)
          const active = index.id === activeId
          const edge = index.side === 'left' ? 4 : VIEW_W - 4
          return (
            <g key={index.id} style={{ '--a': index.color } as CSSProperties}>
              <line
                className={`bm-lead${active ? ' on' : ''}`}
                x1={x}
                y1={y}
                x2={edge}
                y2={y}
              />
              {active && (
                <motion.circle
                  className="bm-halo"
                  cx={x}
                  cy={y}
                  r={13}
                  initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                  animate={
                    reduce
                      ? { scale: 1, opacity: 0.45 }
                      : { scale: [1, 1.25, 1], opacity: [0.45, 0.15, 0.45] }
                  }
                  transition={
                    reduce
                      ? { duration: 0.2 }
                      : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                  }
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
              )}
              <circle className={`bm-dot${active ? ' on' : ''}`} cx={x} cy={y} r={5.5} />
            </g>
          )
        })}
      </svg>

      {indices.map((index) => (
        <button
          key={index.id}
          type="button"
          className={`bm-tag ${index.side}${index.id === activeId ? ' on' : ''}`}
          style={{ '--a': index.color, top: `${index.spot.y}%` } as CSSProperties}
          aria-pressed={index.id === activeId}
          onClick={() => onSelect(index.id)}
        >
          <strong>{index.value}</strong>
          <small>{t(index.label)}</small>
        </button>
      ))}
    </div>
  )
}
