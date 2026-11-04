import { useState, type ReactNode } from 'react'
import { IonButton, IonChip, IonIcon, IonSpinner } from '@ionic/react'
import { playCircleOutline, openOutline, barbellOutline } from 'ionicons/icons'
import { exerciseVideo } from '../../data/exerciseVideos'
import { MISSION_PHOTOS } from '../../data/missionPhotos'
import { useT } from '../../i18n/I18nContext'
import type { ExerciseItemDto } from '../../services/program/types'

/** Reproductor externo opt-in: la rutina y su prescripción siguen siendo del servidor. */
export function ExerciseGuide({ exercise, onWatch, media }: { exercise: ExerciseItemDto; onWatch: () => void; media?: ReactNode }) {
  const t = useT()
  const [opened, setOpened] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const video = exerciseVideo(exercise.name)
  return <section className="ex-guide">
    {media ?? <div className="ex-video-stage">
      {opened && video ? <>
        {!loaded && <IonSpinner className="ex-video-loading" aria-label={t('Cargando video')} />}
        <iframe title={t('Demostración de {exercise}', { exercise: exercise.name })}
          src={video.embedUrl} allow="fullscreen; picture-in-picture" allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} />
      </> : <>
        <img src={MISSION_PHOTOS.ejercicio} alt="" />
        <div className="ex-video-overlay"><span>{t('TÉCNICA Y MOVIMIENTO')}</span>
          <h3>{t(exercise.name)}</h3>
          {video ? <IonButton className="bt bt-teal" onClick={() => { onWatch(); setOpened(true) }}>
            <IonIcon icon={playCircleOutline} slot="start" />{t('Ver demostración')}
          </IonButton> : <p>{t('Video no disponible para este ejercicio. Consulta la técnica indicada en tu rutina.')}</p>}
        </div>
      </>}
    </div>}
    { !media && video && <div className="ex-video-source"><small>{video.author}</small>
      <IonButton fill="clear" size="small" href={video.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={onWatch}>
        {t('Abrir video en origen')}<IonIcon icon={openOutline} slot="end" />
      </IonButton>
    </div>}
    <div className="ex-guide-copy">
      <div className="ex-detail-chips">
        {exercise.targetMuscle && <IonChip>{t(exercise.targetMuscle)}</IonChip>}
        {exercise.equipment && <IonChip><IonIcon icon={barbellOutline} />{t(exercise.equipment)}</IonChip>}
      </div>
      <h3>{t('Cómo realizarlo')}</h3>
      <p>{exercise.description ? t(exercise.description) : t('Sigue las indicaciones de tu equipo para este ejercicio.')}</p>
      {exercise.tips && <p className="ex-coach-tip">{t(exercise.tips)}</p>}
      {exercise.restSeconds != null && <p>{t('Descanso indicado entre series: {n} segundos', { n: String(exercise.restSeconds) })}</p>}
    </div>
  </section>
}
