import { useState } from "react";
import { motion, useReducedMotion } from 'framer-motion';
import { IonButton, IonIcon, IonItem, IonLabel, IonChip, IonAccordion, IonAccordionGroup, IonProgressBar, IonModal, IonContent } from "@ionic/react";
import { arrowBackOutline, barbellOutline, checkmarkCircleOutline, imageOutline, play, pause, playSkipBack, playSkipForward, closeOutline, shareSocialOutline, timeOutline, flashOutline } from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
import type { ExerciseItemDto } from "../../services/program/types";
import { resolveStationSec } from "../../utils/exerciseSteps";
import { ExerciseGuide } from "./ExerciseGuide";
import { exerciseMediaUrl } from "../../utils/exerciseMedia";
import { ExerciseRestNotice } from "./ExerciseRestNotice";
import { MISSION_PHOTOS } from '../../data/missionPhotos';
import { exerciseVideo } from '../../data/exerciseVideos';

export interface ExerciseLessonProps {
  done: boolean;
  pts: number;
  title?: string;
  exercises?: ExerciseItemDto[] | null;
  step: number;
  left: number;
  running: boolean;
  onToggle: () => void;
  onSkip: () => void;
  onComplete: () => void;
  unavailable?: boolean;
  rest?: boolean;
  pending?: boolean;
  saving?: boolean;
  errorMessage?: string | null;
  awardedPoints?: number | null;
  activeSeconds?: number | null;
  programWeek?: number | null;
  onPrevious?: () => void;
  onExit?: () => void;
  onShare?: () => void;
}

function clock(value: number) {
  const seconds = Math.max(0, Math.round(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function ExerciseDemonstration({ exercise, onPlay }: { exercise: ExerciseItemDto; onPlay?: () => void }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const source = exerciseMediaUrl(exercise.mediaUrl);
  const poster = exerciseMediaUrl(exercise.thumbnailUrl) ?? undefined;
  if (!source || (exercise.mediaType !== "Image" && exercise.mediaType !== "Video")) {
    return <div className="exercise-media-empty">
      <IonIcon icon={imageOutline} aria-hidden="true" />
      <strong>{t("Demostración no disponible")}</strong>
      <p>{t("Tu equipo aún no ha añadido una imagen o un vídeo para este ejercicio.")}</p>
    </div>;
  }
  if (failed) return <div className="exercise-media-empty" role="alert">
    <strong>{t("No se pudo cargar la demostración.")}</strong>
    <IonButton fill="outline" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t("Reintentar")}</IonButton>
  </div>;
  // El reproductor HTML es el control nativo de vídeo; Ionic no ofrece uno.
  return <figure className="exercise-demonstration">
    {exercise.mediaType === "Video"
      ? <video key={attempt} src={source} poster={poster} controls playsInline preload="metadata"
          aria-label={t("Vídeo de {exercise}", { exercise: t(exercise.name) })} onPlay={onPlay} onError={() => setFailed(true)} />
      : <img key={attempt} src={source} alt={t("Técnica de {exercise}", { exercise: t(exercise.name) })}
          loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    <figcaption>{t("Demostración de tu equipo clínico")}</figcaption>
  </figure>;
}

/** Circuito y vista propia por ejercicio. Consultar la técnica pausa el
 * cronómetro; abrir/reproducir un vídeo nunca completa una misión ni da XP. */
export function ExerciseLesson({ done, pts, title, exercises, step, left, running, onToggle, onSkip, onComplete, unavailable, rest, pending = false, saving = false, errorMessage, awardedPoints, activeSeconds, programWeek, onPrevious, onExit, onShare }: ExerciseLessonProps) {
  const t = useT();
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState('0');
  if (rest === true) return <ExerciseRestNotice />;
  if (unavailable || !exercises?.length) return <div className="exercise-media-empty" role="status"><IonIcon icon={barbellOutline} aria-hidden="true" /><strong>{t('Rutina no disponible')}</strong><p>{t('Tu equipo está preparando los ejercicios de hoy. Vuelve a consultar más tarde.')}</p></div>;
  const safeStep = Math.max(0, Math.min(step, exercises.length - 1));
  const current = exercises[safeStep];
  const currentDuration = resolveStationSec(current);
  const total = exercises.reduce((sum, ex) => sum + resolveStationSec(ex), 0);
  const elapsed = exercises.slice(0, safeStep).reduce((sum, ex) => sum + resolveStationSec(ex), 0) + Math.max(0, currentDuration-left);
  const active = started || running;
  const viewed = selected == null ? null : exercises[Math.min(selected, exercises.length-1)];
  const inspect = (index:number) => { if(running) onToggle(); setSelected(index); };
  const instructions = (ex:ExerciseItemDto) => <>
    <div className="ex-detail-chips">{ex.targetMuscle && <IonChip>{t(ex.targetMuscle)}</IonChip>}{ex.equipment && <IonChip>{t(ex.equipment)}</IonChip>}</div>
    {ex.description && <p>{t(ex.description)}</p>}
    <dl className="p2-ex-prescription">
      {ex.sets != null && <div><dt>{t('Series')}</dt><dd>{ex.sets}</dd></div>}
      {ex.repetitions != null && <div><dt>{t('Repeticiones')}</dt><dd>{ex.repetitions}</dd></div>}
      {ex.durationSecs != null && <div><dt>{t('Duración')}</dt><dd>{clock(ex.durationSecs)}</dd></div>}
      {ex.restSeconds != null && <div><dt>{t('Descanso')}</dt><dd>{t('{seconds} segundos',{seconds:String(ex.restSeconds)})}</dd></div>}
      {ex.weightKg != null && <div><dt>{t('Peso indicado')}</dt><dd>{ex.weightKg} kg</dd></div>}
      {ex.tempo && <div><dt>{t('Tempo')}</dt><dd>{ex.tempo}</dd></div>}
      {ex.rpe != null && <div><dt>{t('Esfuerzo percibido')}</dt><dd>{ex.rpe}/10</dd></div>}
    </dl>{ex.tips && <p className="ex-coach-tip">{t(ex.tips)}</p>}
  </>;
  const demonstration = (ex:ExerciseItemDto) => exerciseMediaUrl(ex.mediaUrl) && (ex.mediaType==='Image'||ex.mediaType==='Video')
    ? <ExerciseDemonstration exercise={ex} onPlay={()=>{if(running)onToggle();}} />
    : ('referenceVideo' in ex ? ex.referenceVideo : exerciseVideo(ex.name)) ? <ExerciseGuide exercise={ex} onWatch={()=>{if(running)onToggle();}} />
    : <div className="exercise-media-empty"><IonIcon icon={imageOutline} aria-hidden="true" /><strong>{t('Demostración no disponible')}</strong><p>{t('Tu equipo aún no ha añadido una imagen o un vídeo para este ejercicio.')}</p></div>;

  if(done && !pending) return <section className="p2-success exercise-session" data-testid="exercise-completed">
    <div className="p2-success-mark"><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /></div>
    <h2>{t('¡Circuito completado!')}</h2><p>{title ? t(title) : t('Tu rutina')}{programWeek != null && <> · {t('Semana {n}',{n:String(programWeek)})}</>}</p>
    <div className="p2-success-stats"><div><strong>{activeSeconds != null ? clock(activeSeconds) : '—'}</strong><span>{t('Tiempo activo')}</span></div><div><strong>{exercises.length}</strong><span>{t('Estaciones del circuito')}</span></div><div><strong>{awardedPoints != null ? `+${awardedPoints}` : '—'}</strong><span>{t(awardedPoints != null ? 'Puntos recibidos' : 'Puntos registrados en tu protocolo')}</span></div></div>
    <p className="p2-muted">{t('Rutina de hoy completada')}</p>
    <div className="p2-success-actions">{onShare && <IonButton expand="block" fill="outline" onClick={onShare}><IonIcon icon={shareSocialOutline} slot="start" />{t('Compartir en la comunidad')}</IonButton>}{onExit && <IonButton expand="block" onClick={onExit}>{t('Listo')}</IonButton>}</div>
  </section>;
  if(pending) return <section className="p2-status" role="status"><IonIcon icon={timeOutline} aria-hidden="true" /><h2>{t(saving?'Guardando…':'Pendiente de sincronización')}</h2><p>{t('Tu registro se confirmará al sincronizar con el servidor.')}</p>{onExit && <IonButton onClick={onExit}>{t('Volver al protocolo')}</IonButton>}</section>;
  return <div className={`exercise-session p2-exercise ${active ? 'is-active' : 'is-list'}`} data-testid={active ? 'exercise-active' : 'exercise-list'}>
    {active ? <>
      <header className="p2-active-heading"><IonButton fill="clear" aria-label={t('Volver a mi rutina')} onClick={()=>{if(running)onToggle();setStarted(false);}}><IonIcon icon={closeOutline} slot="icon-only" /></IonButton><div><strong>{t('ESTACIÓN {current} DE {total}',{current:String(safeStep+1),total:String(exercises.length)})}</strong><p>{t('Sesión')} {clock(elapsed)} / {clock(total)}</p></div></header>
      <IonProgressBar className="p2-session-progress" value={Math.min(1,elapsed/total)} aria-label={t('Progreso de la rutina')} />
      <motion.section className="p2-active-station" key={safeStep} initial={reduced ? false : {opacity:0,x:12}} animate={{opacity:1,x:0}} transition={{duration:reduced ? 0 : .2}}>
        <div className="p2-countdown"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="105" className="p2-ring-track" /><circle cx="120" cy="120" r="105" className="p2-ring-value" strokeDasharray="660" strokeDashoffset={660*(1-Math.max(0,Math.min(1,left/currentDuration)))} transform="rotate(-90 120 120)" /></svg><div><strong role="timer" aria-label={t('Tiempo restante')}>{clock(left).padStart(5,'0')}</strong><span>{t(running ? 'restante' : 'En pausa')}</span></div></div>
        <h2 aria-live="polite" aria-atomic="true">{t(current.name)}</h2>{current.description && <p>{t(current.description)}</p>}
        <IonButton fill="clear" className="p2-demo-button" aria-label={t('Ver demostración de {exercise}',{exercise:t(current.name)})} onClick={()=>inspect(safeStep)}><IonIcon icon={play} slot="start" />{t('Ver demostración')}</IonButton>
        {exercises[safeStep+1] && <div className="p2-next-station"><small>{t('SIGUE')}</small><strong>{t(exercises[safeStep+1].name)}</strong><span>{clock(resolveStationSec(exercises[safeStep+1]))}</span></div>}
      </motion.section>
      <div className="p2-ex-controls"><IonButton fill="outline" disabled={!onPrevious||safeStep===0||saving} aria-label={t('Estación anterior')} onClick={onPrevious}><IonIcon icon={playSkipBack} slot="icon-only" /></IonButton><IonButton className="p2-pause" disabled={saving} aria-label={t(running ? 'Pausar' : 'Continuar')} onClick={onToggle}><IonIcon icon={running ? pause : play} slot="icon-only" /></IonButton><IonButton fill="outline" disabled={saving} aria-label={t(safeStep===exercises.length-1 ? 'Finalizar circuito' : 'Saltar estación')} onClick={onSkip}><IonIcon icon={playSkipForward} slot="icon-only" /></IonButton></div>
    </> : <>
      <section className="p2-ex-hero"><img src={MISSION_PHOTOS.ejercicio} alt="" /><div>{programWeek != null && <span className="p2-week-badge">{t('Semana {n}',{n:String(programWeek)})}</span>}<h2>{title ? t(title) : t('Tu rutina')}</h2><div className="p2-hero-stats"><div><IonIcon icon={barbellOutline} aria-hidden="true" /><span>{t('Ejercicios')}</span><strong>{exercises.length}</strong></div><div><IonIcon icon={timeOutline} aria-hidden="true" /><span>{t('Duración')}</span><strong>{clock(total)}</strong></div><div><IonIcon icon={flashOutline} aria-hidden="true" /><span>{t('Puntos')}</span><strong>+{pts}</strong></div></div></div></section>
      <div className="p2-circuit-heading"><h3>{t('Tu circuito')}</h3><p>{t('Toca para ver cómo hacerlo')}</p></div>
      <IonAccordionGroup value={expanded} onIonChange={event=>{if(event.target===event.currentTarget)setExpanded(String(event.detail.value??''))}} className="p2-circuit-list">{exercises.map((ex,index)=><IonAccordion key={`${ex.name}:${index}`} value={String(index)}><IonItem slot="header" lines="none"><span slot="start" className="p2-station-number">{index+1}</span><IonLabel><h3>{t(ex.name)}</h3>{index===0&&<p>{t('Empiezas aquí')}</p>}</IonLabel><span slot="end">{clock(resolveStationSec(ex))}</span></IonItem><div slot="content" className="p2-station-detail">{expanded===String(index)&&demonstration(ex)}{instructions(ex)}<IonButton fill="clear" aria-label={t(index===0?'Ver mis indicaciones de {exercise}':'Ver técnica y demostración de {exercise}',{exercise:t(ex.name)})} onClick={()=>inspect(index)}>{t(index===0?'Ver mis indicaciones':'Ver técnica y demostración')}</IonButton></div></IonAccordion>)}</IonAccordionGroup>
      <div className="p2-list-actions"><IonButton expand="block" disabled={saving} onClick={()=>{setStarted(true);onToggle();}}><IonIcon icon={play} slot="start" />{t('Iniciar circuito')}</IonButton><IonButton expand="block" fill="clear" disabled={saving} onClick={onComplete}>{t('Ya lo hice por mi cuenta · +{pts} pts',{pts:String(pts)})}</IonButton></div>
    </>}
    {saving && <p role="status" className="p2-save-state">{t('Guardando…')}</p>}{errorMessage&&<p role="alert" className="p2-save-error">{errorMessage}</p>}
    <IonModal className="p2-demo-modal" isOpen={viewed!==null} onDidDismiss={()=>setSelected(null)} aria-label={t('Técnica y movimiento')}><IonContent>{viewed&&<div className="p2-demo-content"><IonButton fill="clear" onClick={()=>setSelected(null)}><IonIcon slot="start" icon={arrowBackOutline}/>{t('Volver a mi rutina')}</IonButton><h2>{t(viewed.name)}</h2>{demonstration(viewed)}{instructions(viewed)}</div>}</IonContent></IonModal>
  </div>;
}
