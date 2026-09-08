import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import Body, { type ExtendedBodyPart, type Slug } from 'react-muscle-highlighter'
import {
  BODY_INDICES,
  REGION_SELECT,
  bodySelection,
  type BodyIndex,
  type BodyRegion,
  type BodyView,
} from '../data/bodyProfile'
import { useT } from '../i18n/I18nContext'

const FILL = '#d4dee8'
const HAIR = '#8fa0b5'
const STROKE = '#b8c7d6'

const BASE: BodyRegion[] = [
  'abs',
  'adductors',
  'ankles',
  'biceps',
  'calves',
  'chest',
  'deltoids',
  'feet',
  'forearm',
  'gluteal',
  'hamstring',
  'hands',
  'head',
  'knees',
  'lower-back',
  'neck',
  'obliques',
  'quadriceps',
  'tibialis',
  'trapezius',
  'triceps',
  'upper-back',
]

function paint(
  fills: Map<BodyRegion, string>,
  regions: BodyRegion[],
  color: string,
  overwrite: boolean,
) {
  for (const region of regions) {
    if (overwrite || !fills.has(region)) fills.set(region, color)
  }
}

/**
 * Figura anatómica femenina (frente/espalda) con grupos musculares táctiles.
 * Ionic no cubre visualizaciones de anatomía: se usa `react-muscle-highlighter`
 * (SVG, sin UI kit extra) y se pinta con la paleta del perfil.
 */
export function BodyMap({
  indices,
  activeId,
  view,
  onSelect,
}: {
  indices: BodyIndex[]
  activeId: string
  view: BodyView
  onSelect: (id: string) => void
}) {
  const t = useT()
  const selection = bodySelection(activeId)
  const activeColor = selection.item.color
  const zone = selection.item.zone

  const data = useMemo(() => {
    const fills = new Map<BodyRegion, string>()
    for (const region of BASE) fills.set(region, FILL)
    fills.set('hair', HAIR)

    for (const index of BODY_INDICES) {
      const active = index.id === activeId
      paint(fills, index.regions[view], active ? index.color : index.colorSoft, true)
    }

    if (selection.kind === 'measure') {
      paint(fills, selection.item.regions[view], selection.item.color, true)
    }

    return [...fills.entries()].map(([slug, color]) => ({
      slug: slug as Slug,
      color,
    })) satisfies ExtendedBodyPart[]
  }, [activeId, view, selection])

  return (
    <div className="bm-stage">
      <div className="bm-rail">
        {indices
          .filter((index) => index.tag[view].side === 'left')
          .map((index) => (
            <Tag
              key={index.id}
              index={index}
              view={view}
              active={index.id === activeId}
              onSelect={onSelect}
            />
          ))}
      </div>

      <div className="bm-anatomy" style={{ '--a': activeColor } as CSSProperties}>
        <Body
          data={data}
          gender="female"
          side={view}
          scale={1}
          border="#87aeca"
          defaultFill={FILL}
          defaultStroke={STROKE}
          defaultStrokeWidth={1.4}
          onBodyPartPress={(part) => {
            const id = part.slug ? REGION_SELECT[part.slug] : undefined
            if (id) onSelect(id)
          }}
        />
      </div>

      <div className="bm-rail">
        {indices
          .filter((index) => index.tag[view].side === 'right')
          .map((index) => (
            <Tag
              key={index.id}
              index={index}
              view={view}
              active={index.id === activeId}
              onSelect={onSelect}
            />
          ))}
      </div>

      <p className="bm-zone" style={{ '--a': activeColor } as CSSProperties}>
        {t(zone)}
      </p>
    </div>
  )
}

function Tag({
  index,
  view,
  active,
  onSelect,
}: {
  index: BodyIndex
  view: BodyView
  active: boolean
  onSelect: (id: string) => void
}) {
  const t = useT()
  const place = index.tag[view]
  return (
    <button
      type="button"
      className={`bm-tag ${place.side}${active ? ' on' : ''}`}
      style={{ '--a': index.color, top: `${place.y}%` } as CSSProperties}
      aria-pressed={active}
      onClick={() => onSelect(index.id)}
    >
      <strong>{index.value}</strong>
      <small>{t(index.label)}</small>
    </button>
  )
}
