import { ExerciseMediaCredits } from "./ExerciseMediaCredits";
import { useState } from "react";
import { IonButton, IonIcon, IonItem, IonLabel, IonChip, IonAccordion, IonAccordionGroup, IonProgressBar } from "@ionic/react";
import { arrowBackOutline, barbellOutline, checkmarkCircleOutline, imageOutline } from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
import type { ExerciseItemDto } from "../../services/program/types";
import { resolveStationSec } from "../../utils/exerciseSteps";
import { ExerciseGuide } from "./ExerciseGuide";
import { exerciseMediaUrl } from "../../utils/exerciseMedia";

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
  if (failed) return <><div className="exercise-media-empty" role="alert">
    <strong>{t("No se pudo cargar la demostración.")}</strong>
    <IonButton fill="outline" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t("Reintentar")}</IonButton>
  </div><ExerciseMediaCredits provenance={exercise.provenance} /></>;
  // El reproductor HTML es el control nativo de vídeo; Ionic no ofrece uno.
  return <figure className="exercise-demonstration">
    {exercise.mediaType === "Video"
      ? <video key={attempt} src={source} poster={poster} controls playsInline preload="metadata"
          aria-label={t("Vídeo de {exercise}", { exercise: exercise.name })} onPlay={onPlay} onError={() => setFailed(true)} />
      : <img key={attempt} src={source} alt={t("Técnica de {exercise}", { exercise: exercise.name })}
          loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    <figcaption>{exercise.provenance ? <ExerciseMediaCredits provenance={exercise.provenance} /> : t("Demostración de tu equipo clínico")}</figcaption>
  </figure>;
}

/** Circuito y vista propia por ejercicio. Consultar la técnica pausa el
 * cronómetro; abrir/reproducir un vídeo nunca completa una misión ni da XP. */
export function ExerciseLesson({ done, pts, title, exercises, step, left, running, onToggle, onSkip, onComplete, unavailable }: ExerciseLessonProps) {
  const t = useT();
  const [selected, setSelected] = useState<number | null>(null);
  if (unavailable || !exercises?.length) return <div className="exercise-media-empty" role="status">
    <IonIcon icon={barbellOutline} aria-hidden="true" />
    <strong>{t("Rutina no disponible")}</strong>
    <p>{t("Tu equipo está preparando los ejercicios de hoy. Vuelve a consultar más tarde.")}</p>
  </div>;

  const safeStep = Math.max(0, Math.min(step, exercises.length - 1));
  const current = exercises[safeStep];
  const currentDuration = resolveStationSec(current);
  const total = exercises.reduce((sum, exercise) => sum + resolveStationSec(exercise), 0);
  const elapsed = exercises.slice(0, safeStep).reduce((sum, exercise) => sum + resolveStationSec(exercise), 0)
    + Math.max(0, currentDuration - left);
  const viewed = selected === null ? null : exercises[Math.max(0, Math.min(selected, exercises.length - 1))];

  if (viewed) return <div className="lsn-stack exercise-session">
    <IonButton fill="clear" className="exercise-back" onClick={() => setSelected(null)}>
      <IonIcon icon={arrowBackOutline} slot="start" />{t("Volver a mi rutina")}
    </IonButton>
    <header className="exercise-detail-heading">
      <p className="kicker">{t("Técnica y movimiento")}</p>
      <h2>{viewed.name}</h2>
      {viewed.description && <p>{viewed.description}</p>}
    </header>
    {viewed.referenceVideo && !viewed.mediaUrl
      ? <ExerciseGuide key={`${selected}:${viewed.name}`} exercise={viewed} onWatch={() => {}} />
      : <ExerciseDemonstration key={`${selected}:${viewed.mediaId ?? viewed.mediaUrl ?? viewed.name}`} exercise={viewed} />}
    <section className="exercise-prescription" aria-label={t("Indicaciones del ejercicio")}>
      <h3>{t("Tu indicación")}</h3>
      <dl>
        {viewed.sets != null && <div><dt>{t("Series")}</dt><dd>{viewed.sets}</dd></div>}
        {viewed.repetitions != null && <div><dt>{t("Repeticiones")}</dt><dd>{viewed.repetitions}</dd></div>}
        {viewed.durationSecs != null && <div><dt>{t("Duración")}</dt><dd>{clock(viewed.durationSecs)}</dd></div>}
        {viewed.restSeconds != null && <div><dt>{t("Descanso")}</dt><dd>{t("{seconds} segundos", { seconds: String(viewed.restSeconds) })}</dd></div>}
        {viewed.weightKg != null && <div><dt>{t("Peso indicado")}</dt><dd>{viewed.weightKg} kg</dd></div>}
        {viewed.tempo && <div><dt>{t("Tempo")}</dt><dd>{viewed.tempo}</dd></div>}
        {viewed.rpe != null && <div><dt>{t("Esfuerzo percibido")}</dt><dd>{viewed.rpe}/10</dd></div>}
      </dl>
      {viewed.targetMuscle && <p><strong>{t("Músculo objetivo")}:</strong> {viewed.targetMuscle}</p>}
      {viewed.equipment && <p><strong>{t("Equipamiento")}:</strong> {viewed.equipment}</p>}
    </section>
    {viewed.tips && <section className="exercise-technique"><h3>{t("Cuida tu técnica")}</h3><p>{viewed.tips}</p></section>}
  </div>;

  const hasAssignedMedia = Boolean(exerciseMediaUrl(current.mediaUrl)) && (current.mediaType === 'Video' || current.mediaType === 'Image');
  const pauseForGuide = () => { if (running) onToggle(); };
  const ring = Math.max(0, Math.min(1, 1 - left / currentDuration));
  return <div className="lsn-stack exercise-session exercise-studio">
    <div className="ex-studio-header"><span className="kicker">{t("TU MOVIMIENTO DE HOY")}</span><h3>{title ? t(title) : t("Tu rutina")}</h3>
      <div className="ex-session-meta"><IonChip>{t("{n} ejercicios", { n: String(exercises.length) })}</IonChip><IonChip>{clock(total)} · {t("Tiempo activo")}</IonChip></div>
    </div>
    <section className="exercise-current" aria-label={t("Estación actual")}>
      <ExerciseGuide key={`${safeStep}:${current.mediaUrl ?? current.name}`} exercise={current} onWatch={pauseForGuide}
        media={hasAssignedMedia ? <ExerciseDemonstration exercise={current} onPlay={pauseForGuide} /> : undefined} />
      <IonButton fill="clear" aria-label={t('Ver indicaciones de {exercise}', { exercise: current.name })} onClick={() => { pauseForGuide(); setSelected(safeStep); }}>{t('Ver mis indicaciones')}</IonButton>
    </section>
    <div className="ex-timer">
      <div className="ex-ring-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
          <circle cx="70" cy="70" r="58" fill="none" stroke="var(--ice)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${ring * 364.4} 364.4`} transform="rotate(-90 70 70)" />
        </svg>
        <div className="ex-ring-center"><div className="kicker" style={{color:'var(--ice)'}}>{safeStep + 1} / {exercises.length}</div><div className="display ex-clock">{clock(left).padStart(5, '0')}</div></div>
      </div>
      <div className="ex-step-name">{t(current.name)}</div>
      {current.description && <div className="ex-step-cue">{t(current.description)}</div>}
      <div className="ex-total">{t("Sesión")} {clock(elapsed)} / {clock(total)}</div>
    </div>
    <section className="ex-routine-plan"><h3>{t("Tu sesión, paso a paso")}</h3>
      <IonProgressBar value={Math.max(0, Math.min(1, elapsed / total))} aria-label={t("Progreso de la rutina")} />
      <IonAccordionGroup>{exercises.map((exercise, index) => <IonAccordion key={`${exercise.name}:${index}`} value={String(index)}>
        <IonItem slot="header" lines="none" className={index === safeStep ? 'ex-plan-current' : ''}>
          <span slot="start" className="ex-plan-number">{index < safeStep || done ? <IonIcon icon={checkmarkCircleOutline} /> : String(index + 1).padStart(2, '0')}</span>
          <IonLabel><h3>{t(exercise.name)}</h3><p>{clock(resolveStationSec(exercise))}{index === safeStep ? ` · ${t('Ahora')}` : ''}</p></IonLabel>
        </IonItem>
        <div slot="content" className="ex-plan-detail">
          {exercise.description && <p>{t(exercise.description)}</p>}
          <div className="ex-detail-chips">
            {exercise.sets != null && <IonChip>{t('{n} series', {n:String(exercise.sets)})}</IonChip>}
            {exercise.repetitions != null && <IonChip>{t('{n} repeticiones', {n:String(exercise.repetitions)})}</IonChip>}
            {exercise.restSeconds != null && <IonChip>{t('Descanso: {n} s', {n:String(exercise.restSeconds)})}</IonChip>}
          </div>
          {exercise.targetMuscle && <p><strong>{t('Zona de trabajo')}: </strong>{t(exercise.targetMuscle)}</p>}
          {exercise.equipment && <p><strong>{t('Equipamiento')}: </strong>{t(exercise.equipment)}</p>}
          {exercise.tips && <p className="ex-coach-tip">{t(exercise.tips)}</p>}
          {index !== safeStep && <IonButton fill="clear" aria-label={t('Ver indicaciones de {exercise}', {exercise:exercise.name})} onClick={() => {pauseForGuide();setSelected(index);}}>{t('Ver técnica y demostración')}</IonButton>}
        </div>
      </IonAccordion>)}</IonAccordionGroup>
    </section>
    {done ? <div className="lesson-done-banner">{t("Rutina de hoy completada")}</div> : <>
      <IonButton expand="block" className="bt bt-pur" onClick={onToggle}>{running ? t('Pausar') : step === 0 && left === currentDuration ? t('Iniciar circuito') : t('Continuar')}</IonButton>
      <IonButton expand="block" className="bt bt-ghost" onClick={onSkip}>{t('Saltar estación')}</IonButton>
      <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>{t('Ya lo hice · +{pts} pts', {pts:String(pts)})}</IonButton>
    </>}
  </div>;
}
