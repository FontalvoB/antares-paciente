import { useState } from "react";
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonProgressBar } from "@ionic/react";
import { arrowBackOutline, barbellOutline, checkmarkCircleOutline, imageOutline, playCircleOutline } from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
import type { ExerciseItemDto } from "../../services/program/types";
import { resolveStationSec } from "../../utils/exerciseSteps";
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
  if (failed) return <div className="exercise-media-empty" role="alert">
    <strong>{t("No se pudo cargar la demostración.")}</strong>
    <IonButton fill="outline" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t("Reintentar")}</IonButton>
  </div>;
  // El reproductor HTML es el control nativo de vídeo; Ionic no ofrece uno.
  return <figure className="exercise-demonstration">
    {exercise.mediaType === "Video"
      ? <video key={attempt} src={source} poster={poster} controls playsInline preload="metadata"
          aria-label={t("Vídeo de {exercise}", { exercise: exercise.name })} onPlay={onPlay} onError={() => setFailed(true)} />
      : <img key={attempt} src={source} alt={t("Técnica de {exercise}", { exercise: exercise.name })}
          loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    <figcaption>{t("Demostración de tu equipo clínico")}</figcaption>
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
    <ExerciseDemonstration key={`${selected}:${viewed.mediaId ?? viewed.mediaUrl ?? viewed.name}`} exercise={viewed} />
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

  return <div className="lsn-stack exercise-session">
    <section className="exercise-session-summary">
      <div className="exercise-session-heading"><IonIcon icon={barbellOutline} aria-hidden="true" />
        <div><p className="kicker">{t("Tu movimiento de hoy")}</p><h2>{title || t("Mi rutina")}</h2></div>
      </div>
      <p>{t("Mira la demostración y empieza cuando estés listo.")}</p>
      <div className="exercise-session-stats"><span>{t("{count} ejercicios", { count: String(exercises.length) })}</span><span>{clock(total)}</span></div>
    </section>
    <section className="exercise-current" aria-label={t("Estación actual")}>
      <p className="kicker">{t("Ejercicio {current} de {total}", { current: String(safeStep + 1), total: String(exercises.length) })}</p>
      <h3>{current.name}</h3>
      <ExerciseDemonstration key={`preview:${safeStep}:${current.mediaUrl}`} exercise={current} onPlay={() => { if (running) onToggle(); }} />
      <IonButton fill="clear" aria-label={t('Ver indicaciones de {exercise}', { exercise: current.name })} onClick={() => { if (running) onToggle(); setSelected(safeStep); }}>{t('Ver mis indicaciones')}</IonButton>
      <strong className="exercise-session-clock">{clock(left)}</strong>
      <IonProgressBar value={Math.max(0, Math.min(1, elapsed / total))} aria-label={t("Progreso de la rutina")} />
      <p>{t("Tiempo de sesión: {elapsed} de {total}", { elapsed: clock(elapsed), total: clock(total) })}</p>
    </section>
    {exercises.length > 1 && <IonList className="exercise-stations" aria-label={t("Ejercicios de la rutina")}>
      {exercises.map((exercise, index) => index === safeStep ? null : <IonItem key={`${exercise.sortOrder}:${exercise.name}:${index}`} button detail
        className={index === safeStep ? "exercise-station-current" : ""}
        onClick={() => { if (running) onToggle(); setSelected(index); }}>
        <IonIcon slot="start" aria-hidden="true" icon={index < safeStep || done ? checkmarkCircleOutline : exercise.mediaType === "Video" ? playCircleOutline : exercise.mediaType === "Image" ? imageOutline : barbellOutline} />
        <IonLabel><h3>{exercise.name}</h3><p>{t("Ver técnica y demostración")} · {clock(resolveStationSec(exercise))}</p></IonLabel>
      </IonItem>)}
    </IonList>}
    {done ? <div className="lesson-done-banner">{t("Rutina de hoy completada")}</div> : <>
      <IonButton expand="block" className="bt bt-navy" onClick={onToggle}>{running ? t("Pausar") : t("Iniciar o continuar rutina")}</IonButton>
      <IonButton expand="block" fill="outline" onClick={onSkip}>{t("Saltar estación")}</IonButton>
      <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>{t("Ya lo hice · +{pts} pts", { pts: String(pts) })}</IonButton>
    </>}
  </div>;
}
