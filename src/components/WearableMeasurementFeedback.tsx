import { IonButton, IonCard, IonCardContent } from "@ionic/react";
import type { FocusResult } from "./MeasureFocusOverlay";
import { MEASURE_SHORT } from "../utils/measure";
import { useT } from "../i18n/I18nContext";

/** Recuperación compartida por FC, SpO2 y presión, junto a sus lecturas. */
export function WearableMeasurementFeedback({
  result, canMeasure, onRetry, onClose, onNext,
}: {
  result: FocusResult;
  canMeasure: boolean;
  onRetry: () => void;
  onClose: () => void;
  onNext?: () => void;
}) {
  const t = useT();
  return (
    <IonCard className="wearable-measure-feedback">
      <IonCardContent>
        <div role="status" aria-live="polite">
          <h2>{t("Medición pendiente")}: {t(MEASURE_SHORT[result.kind] ?? "Medición")}</h2>
          <p>{t(result.message)}</p>
          <p>{t("Las lecturas anteriores conservan su fecha original.")}</p>
        </div>
        <div className="wearable-measure-feedback-actions">
          <IonButton disabled={!canMeasure} onClick={onRetry}>{t("Reintentar")}</IonButton>
          {onNext && <IonButton fill="outline" disabled={!canMeasure}
            onClick={onNext}>{t("Medir siguiente")}</IonButton>}
          <IonButton fill="clear" onClick={onClose}>{t("Cerrar")}</IonButton>
        </div>
      </IonCardContent>
    </IonCard>
  );
}
