import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IonButton, IonChip, IonIcon, IonSpinner } from '@ionic/react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App as CapacitorApp } from '@capacitor/app'
import { playCircleOutline, openOutline, barbellOutline } from 'ionicons/icons'
import { exerciseVideo } from '../../data/exerciseVideos'
import { MISSION_PHOTOS } from '../../data/missionPhotos'
import { useT } from '../../i18n/I18nContext'
import { exerciseMediaUrl, exerciseReferenceUrl } from '../../utils/exerciseMedia'
import type { ExerciseItemDto } from '../../services/program/types'

/** El player oficial conserva controles y anuncios. En móvil, el navegador
 * nativo evita un iframe sin Referer (error 153). Nunca se descarga YouTube. */
export function ExerciseGuide({ exercise, onWatch, media }: { exercise: ExerciseItemDto; onWatch: () => void; media?: ReactNode }) {
  const t = useT()
  const iframe = useRef<HTMLIFrameElement>(null)
  const onWatchRef = useRef(onWatch)
  useEffect(() => { onWatchRef.current = onWatch }, [onWatch])
  useEffect(() => {
    const pause = () => { if (document.activeElement === iframe.current) onWatchRef.current() }
    window.addEventListener('blur', pause)
    return () => window.removeEventListener('blur', pause)
  }, [])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const video = 'referenceVideo' in exercise ? exercise.referenceVideo : exerciseVideo(exercise.name)
  const embedUrl = exerciseReferenceUrl(video?.embedUrl)
  const sourceUrl = exerciseMediaUrl(video?.sourceUrl)
  const youtubeId = embedUrl && new URL(embedUrl).hostname === 'www.youtube-nocookie.com' ? new URL(embedUrl).pathname.split('/').pop() : null
  const nativeYouTube = Boolean(youtubeId && Capacitor.isNativePlatform())
  useEffect(() => {
    if (!embedUrl || nativeYouTube || media || loaded) return
    const timer = window.setTimeout(() => setFailed(true), 15000)
    return () => window.clearTimeout(timer)
  }, [embedUrl, nativeYouTube, media, loaded, attempt])
  const openNative = async () => {
    if (!sourceUrl) return
    onWatch()
    try {
      // SFSafariViewController no admite Referer: YouTube exige origin con el
      // bundle ID. Android abre la página completa, no un embed sin identidad.
      let url = sourceUrl
      if (Capacitor.getPlatform() === 'ios' && youtubeId) {
        // El bundle de Xcode puede diferir del appId de capacitor.config.ts.
        const { id } = await CapacitorApp.getInfo()
        const player = new URL(`https://www.youtube.com/embed/${youtubeId}`)
        player.searchParams.set('playsinline', '1')
        player.searchParams.set('autoplay', '0')
        player.searchParams.set('origin', `https://${id.toLowerCase()}`)
        url = player.href
      }
      await Browser.open({ url })
    } catch { setFailed(true) }
  }
  return <section className="ex-guide">
    {media ?? <>
      <div className="ex-video-stage">
        {embedUrl && !nativeYouTube && !failed ? <>
          {!loaded && <IonSpinner className="ex-video-loading" aria-label={t('Cargando video')} />}
          <iframe ref={iframe} key={attempt} title={t('Demostración de {exercise}', { exercise: exercise.name })}
            src={embedUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
        </> : <>
          <img src={youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : MISSION_PHOTOS.ejercicio} alt="" />
          <div className="ex-video-overlay"><span>{t('TÉCNICA Y MOVIMIENTO')}</span><h3>{t(exercise.name)}</h3>
            {nativeYouTube ? <IonButton className="bt bt-teal" onClick={() => void openNative()}><IonIcon icon={playCircleOutline} slot="start" />{t('Reproducir en YouTube')}</IonButton>
              : failed ? <><p>{t('No se pudo cargar el reproductor. Puedes abrir el vídeo en su fuente original.')}</p><IonButton onClick={() => { setFailed(false); setLoaded(false); setAttempt(a => a + 1) }}>{t('Reintentar')}</IonButton></>
                : <p>{t('Video no disponible para este ejercicio. Consulta la técnica indicada en tu rutina.')}</p>}
          </div>
        </>}
      </div>
      {video && sourceUrl && <div className="ex-video-source"><small>{video.author}</small>
        <IonButton fill="clear" size="small" href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={event => { if (nativeYouTube) { event.preventDefault(); void openNative() } else onWatch() }}>
          {t('Abrir video en origen')}<IonIcon icon={openOutline} slot="end" />
        </IonButton>
      </div>}
      {youtubeId && <p className="exercise-provider-notice">{t('YouTube gestiona la reproducción y puede limitar la disponibilidad del vídeo.')} <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">{t('Condiciones de YouTube')}</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">{t('Privacidad de Google')}</a></p>}
    </>}
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
