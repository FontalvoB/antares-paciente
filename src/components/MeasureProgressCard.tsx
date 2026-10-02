import { IonIcon } from "@ionic/react";
import type { MeasurePhase } from "../utils/measure";
import { MEASURE_SHORT, measureIcon } from "../utils/measure";
import type { MetricKind } from "../devices/types";
import { useT } from "../i18n/I18nContext";

/**
 * Tarjeta de "medición en curso": qué se está midiendo, cuánto falta y qué
 * debe hacer el usuario. La comparten Reloj (medida puntual y sync) y
 * Programa (autollenado de signos). El progreso sale de la misma ventana que
 * aplica el driver (`MeasurePolicy`), así el número es honesto.
 *
 * `bare` = versión desnuda para la vista de foco: solo mensaje, temporizador
 * con porcentaje y barra. Sin orbe, sin bajada ni pie.
 */
export function MeasureProgressCard({
  kind,
  phase,
  elapsedSec,
  queue = 0,
  bare = false,
  /** La lectura ya llegó: barra al 100 % (el progreso corriendo topa en 99). */
  complete = false,
}: {
  kind: MetricKind;
  phase: MeasurePhase;
  /** Segundos transcurridos desde que empezó la medida. */
  elapsedSec: number;
  /** Medidas encoladas detrás de la actual ("Medir todo"). */
  queue?: number;
  /** Solo mensaje + tiempo/% + barra (vista de foco). */
  bare?: boolean;
  complete?: boolean;
}) {
  const t = useT();
  const adjusting = phase.phase === "adjusting";
  const metric = t(MEASURE_SHORT[kind] ?? "Medición");
  const expectedSec = Math.max(1, Math.round(phase.expectedMs / 1000));
  // Un único conteo: lo que falta para el tiempo esperado, sin reiniciarse
  // cuando el sensor entra en fase de ajuste.
  const shownSec = Math.max(
    0,
    Math.ceil((phase.expectedMs - elapsedSec * 1000) / 1000),
  );
  const percent = complete ? 100 : Math.round(phase.progress * 100);

  if (bare) {
    return (
      <section className="measure-card is-bare" aria-live="polite">
        <div className="measure-bare-top">
          <strong>
            {adjusting
              ? t("Ajustando el sensor…")
              : t("Midiendo {metric}…", { metric })}
          </strong>
          <span className="measure-timer">
            {percent}
            <small>%</small>
          </span>
        </div>
        <div
          className="measure-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={t("Progreso de la medición")}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
      </section>
    );
  }

  return (
    <section className="measure-card" aria-live="polite">
      <div className="measure-card-top">
        <span className="measure-orb" aria-hidden="true">
          <IonIcon icon={measureIcon(kind)} />
        </span>
        <div className="measure-copy">
          <strong>
            {adjusting
              ? t("Ajustando el sensor…")
              : t("Midiendo {metric}", { metric })}
          </strong>
          <small>
            {adjusting
              ? t("Casi listo, mantén la posición")
              : t("Suele tardar ~{seconds} s", {
                  seconds: String(expectedSec),
                })}
          </small>
        </div>
        <span className="measure-timer">
          {shownSec}
          <small>s</small>
        </span>
      </div>
      <div
        className="measure-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(phase.progress * 100)}
        aria-label={t("Progreso de la medición")}
      >
        <i style={{ width: `${Math.round(phase.progress * 100)}%` }} />
      </div>
      <div className="measure-foot">
        <span>{t("Mantén la banda en contacto y sin moverte.")}</span>
        {queue > 0 && (
          <span className="measure-queue">
            {t("Quedan {count}", { count: String(queue) })}
          </span>
        )}
      </div>
    </section>
  );
}
