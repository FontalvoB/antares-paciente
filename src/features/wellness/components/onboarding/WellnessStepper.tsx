import { IonProgressBar } from "@ionic/react";
import { useT } from "../../../../i18n/I18nContext";

/**
 * Indicador del onboarding de 5 pasos.
 *
 * `current` es 1-based (paso visible), igual que el contador del encabezado.
 * El nombre del paso lo muestra el `h1` de la página; aquí solo va el avance
 * para no repetir la misma palabra tres veces en pantalla.
 */
export function WellnessStepper({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const t = useT();
  if (total < 1) return <></>;

  const step = Math.min(Math.max(current, 1), total);
  const count = t("Paso {step} de {total}", {
    step: String(step),
    total: String(total),
  });

  return (
    <div className="wl-step-head">
      <p className="wl-step-count" aria-current="step">
        {count}
      </p>
      <IonProgressBar aria-label={count} value={step / total} />
    </div>
  );
}
