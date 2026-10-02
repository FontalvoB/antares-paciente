import { IonButton, IonContent, IonIcon, IonModal } from "@ionic/react";
import { LayoutGroup, motion } from "framer-motion";
import {
  checkmarkCircle,
  close,
  refresh,
  syncOutline,
  warning,
} from "ionicons/icons";
import type { MeasurePhase } from "../utils/measure";
import { MEASURE_SHORT, measureIcon } from "../utils/measure";
import type { MetricKind } from "../devices/types";
import { useT } from "../i18n/I18nContext";
import { MeasureProgressCard } from "./MeasureProgressCard";
import { BpWave, Spo2Bubbles } from "./MeasureMotion";
import { EcgTrace } from "./EcgTrace";

export interface FocusStep {
  kind: MetricKind;
  state: "done" | "active" | "queued";
  /** Valor logrado (los pasos hechos lo muestran en su lugar). */
  value?: string;
  /** Unidad lista para mostrar (el padre ya aplicó `t()`). */
  unit?: string;
}

/** Valor ya logrado en esta sesión de medidas (solo FC y SpO2 entran). */
export interface FocusSessionValue {
  kind: MetricKind;
  value: string;
  /** Unidad lista para mostrar (el padre ya aplicó `t()`). */
  unit: string;
}

export type FocusResult = { ok: false; kind: MetricKind; message: string };

export interface MeasureFocusContentProps {
  /** Métrica en foco (la que se mide ahora). */
  kind: MetricKind;
  phase: MeasurePhase;
  /** Segundos transcurridos de la medida en curso. */
  elapsedSec: number;
  /** Valor en vivo ya formateado (FC) o null (presión/SpO2 hasta el cierre). */
  liveValue: string | null;
  /** Unidad del valor en vivo/final (lpm, %, mmHg). */
  liveUnit: string;
  /** Secuencia completa incluyendo la actual (vacía = medida suelta). */
  steps: FocusStep[];
  /** Medidas encoladas detrás de la actual (para "Quedan N"). */
  queue: number;
  /** La lectura llegó: el número vuela a su paso y la barra va al 100 %. */
  complete?: boolean;
  /** null = midiendo; con valor = fallo con Reintentar. */
  result: FocusResult | null;
  onCancel: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Contenido de la vista de foco sin el marco del modal: se prueba sin montar
 * IonModal (su stack de overlays no existe en happy-dom).
 */
export function MeasureFocusContent({
  kind,
  phase,
  elapsedSec,
  liveValue,
  liveUnit,
  steps,
  queue,
  result,
  complete = false,
  onCancel,
  onRetry,
  onClose,
}: MeasureFocusContentProps) {
  const t = useT();
  const metric = t(MEASURE_SHORT[kind] ?? "Medición");
  const running = result === null;
  // Latido al ritmo medido (FC con lectura): sin lectura, ritmo de reposo.
  const liveBpm =
    kind === "heart_rate" && liveValue !== null
      ? Number.parseFloat(liveValue)
      : NaN;
  const beatSeconds =
    Number.isFinite(liveBpm) && liveBpm > 0 ? 60 / liveBpm : 1;

  return (
    <div className="mfocus-wrap">
      {running ? (
        <LayoutGroup>
          <div className="mfocus-steps" aria-hidden="true">
            {steps.map((step) => (
              <span key={step.kind} className={`mfocus-step is-${step.state}`}>
                <IonIcon
                  icon={
                    step.state === "done" && step.value === undefined
                      ? checkmarkCircle
                      : measureIcon(step.kind)
                  }
                />
                {step.value !== undefined ? (
                  <motion.span
                    className="mfocus-stepval"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  >
                    <motion.strong layoutId={`mfocus-val-${step.kind}`}>
                      {step.value}
                    </motion.strong>
                    <span>{step.unit}</span>
                  </motion.span>
                ) : (
                  t(MEASURE_SHORT[step.kind] ?? "Medición")
                )}
              </span>
            ))}
          </div>
          <span className="mfocus-bigico" aria-hidden="true">
            <IonIcon
              icon={measureIcon(kind)}
              style={{ animationDuration: `${beatSeconds.toFixed(2)}s` }}
            />
          </span>
          <div className="mfocus-live" aria-live="polite">
            {liveValue !== null ? (
              <>
                <motion.strong layoutId={`mfocus-val-${kind}`}>
                  {liveValue}
                </motion.strong>
                <span>{liveUnit}</span>
              </>
            ) : (
              <span className="mfocus-wait">{t("Esperando la lectura…")}</span>
            )}
          </div>
          {kind === "heart_rate" && (
            <EcgTrace
              bpm={
                Number.isFinite(liveBpm) && liveBpm > 0 ? liveBpm : undefined
              }
              height={84}
              className="mfocus-ecg"
            />
          )}
          {kind === "spo2" && <Spo2Bubbles />}
          {kind === "blood_pressure" && <BpWave />}
          <MeasureProgressCard
            kind={kind}
            phase={phase}
            elapsedSec={elapsedSec}
            queue={queue}
            bare
            complete={complete}
          />
          <IonButton
            expand="block"
            fill="outline"
            className="bt"
            onClick={onCancel}
          >
            {t("Cancelar")}
          </IonButton>
        </LayoutGroup>
      ) : (
        <div className="mfocus-result is-err">
          <IonIcon icon={warning} aria-hidden="true" />
          <span className="mfocus-metric">{metric}</span>
          <p>{result.message}</p>
          <IonButton expand="block" className="bt bt-primary" onClick={onRetry}>
            <IonIcon icon={refresh} slot="start" />
            {t("Reintentar")}
          </IonButton>
          <IonButton expand="block" fill="clear" onClick={onClose}>
            <IonIcon icon={close} slot="start" />
            {t("Cerrar")}
          </IonButton>
        </div>
      )}
    </div>
  );
}

export interface MeasureFocusOverlayProps extends MeasureFocusContentProps {
  isOpen: boolean;
}

/**
 * Marco Ionic de la vista de foco: el contenido vive en MeasureFocusContent
 * (probable sin montar el stack de overlays) y aquí solo se envuelve en el
 * IonModal de pantalla completa. Cerrar con gesto/fondo equivale a Cancelar
 * si aún mide, o a Cerrar si ya hay resultado.
 */
export function MeasureFocusOverlay({
  isOpen,
  ...content
}: MeasureFocusOverlayProps) {
  const running = content.result === null;
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={running ? content.onCancel : content.onClose}
      className="measure-focus-modal"
      data-testid="measure-focus"
    >
      <IonContent>
        <MeasureFocusContent {...content} />
      </IonContent>
    </IonModal>
  );
}

/**
 * Fase de volcado del historial: la vista de foco abre AL TOCAR sincronizar,
 * no cuando arranca el primer barrido (el dump previo dejaba ~20 s de UI
 * muerta). Sin cifras porque la duración del volcado no se conoce: barra
 * indeterminada honesta + Cancelar, que corta el sync en el contexto.
 */
export function MeasureSyncContent({ onCancel }: { onCancel: () => void }) {
  const t = useT();
  return (
    <div className="mfocus-wrap">
      <span className="mfocus-bigico" aria-hidden="true">
        <IonIcon icon={syncOutline} />
      </span>
      <div className="mfocus-live" aria-live="polite">
        <span className="mfocus-wait">{t("Sincronizando historial…")}</span>
      </div>
      <section className="measure-card is-bare" aria-live="polite">
        <div
          className="measure-bar is-busy"
          role="progressbar"
          aria-label={t("Progreso de la sincronización")}
        >
          <i />
        </div>
      </section>
      <IonButton
        expand="block"
        fill="outline"
        className="bt"
        onClick={onCancel}
      >
        {t("Cancelar")}
      </IonButton>
    </div>
  );
}

export function MeasureSyncOverlay({
  isOpen,
  onCancel,
}: {
  isOpen: boolean;
  onCancel: () => void;
}) {
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onCancel}
      className="measure-focus-modal"
      data-testid="measure-sync"
    >
      <IonContent>
        <MeasureSyncContent onCancel={onCancel} />
      </IonContent>
    </IonModal>
  );
}
