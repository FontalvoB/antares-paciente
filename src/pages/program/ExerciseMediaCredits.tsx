import { useT } from '../../i18n/I18nContext'
import type { MediaProvenanceDto } from '../../services/program/types'
import { exerciseMediaUrl } from '../../utils/exerciseMedia'

/** Los créditos pertenecen al recurso, no al equipo que lo asigna. */
export function ExerciseMediaCredits({ provenance }: { provenance?: MediaProvenanceDto | null }) {
  const t = useT()
  if (!provenance) return null
  const source = exerciseMediaUrl(provenance.sourceUrl), license = exerciseMediaUrl(provenance.licenseUrl)
  return <div className="exercise-media-credits">
    <strong>{exerciseMediaUrl(provenance.authorUrl) ? <a href={exerciseMediaUrl(provenance.authorUrl)!} target="_blank" rel="noopener noreferrer">{provenance.author}</a> : provenance.author || t('Autor no indicado por la fuente')}</strong>
    <span>{provenance.title}</span>
    <div>{source && <a href={source} target="_blank" rel="noopener noreferrer">{t('Fuente original')}</a>}
      {license && <a href={license} target="_blank" rel="noopener noreferrer">{provenance.licenseName}</a>}</div>
    {exerciseMediaUrl(provenance.derivativeSourceUrl) && <a href={exerciseMediaUrl(provenance.derivativeSourceUrl)!} target="_blank" rel="noopener noreferrer">{t('Fuente de la obra original')}</a>}
    {provenance.changes && <small>{t('Cambios: {changes}', { changes: provenance.changes })}</small>}
    <small>{t('La licencia corresponde a esta demostración; no implica respaldo de su autor al programa.')}</small>
  </div>
}
