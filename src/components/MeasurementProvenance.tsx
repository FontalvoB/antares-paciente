import { IonBadge } from "@ionic/react";
import { useT } from "../i18n/I18nContext";
import type { MeasurementItemDto } from "../services/measurements/types";
import { getMeasurementSourceBadge, isSupersededMeasurement } from "../utils/measurement-source";

export function MeasurementProvenance({ measurement }: { measurement: MeasurementItemDto }) {
  const t = useT();
  const source = getMeasurementSourceBadge(measurement);
  const superseded = isSupersededMeasurement(measurement);

  if (!source && !superseded) return null;

  return (
    <div className="measurement-provenance">
      {source && (
        <IonBadge className={`hc-src hc-src-${source.variant}`}>
          {t(source.label)}
        </IonBadge>
      )}
      {superseded && (
        <IonBadge className="hc-src hc-src-superseded">
          {t("Reemplazado")}
        </IonBadge>
      )}
    </div>
  );
}
