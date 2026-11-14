import { useId } from 'react';
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel } from '@ionic/react';
import { useT } from '../../i18n/I18nContext';
import { formatDateForDisplay } from '../../utils/dates';
import type { NutritionCycleRecommendationDto } from '../../services/nutrition/nutrition-cycle-recommendation-types';
import { NutritionRecommendations } from './NutritionRecommendations';

/** Lista de presentación inyectada; no define el envoltorio HTTP pendiente de 3.10. */
export function NutritionRecommendationHistory({ history, unavailable = false }: {
  history?: readonly NutritionCycleRecommendationDto[] | null;
  unavailable?: boolean;
}) {
  const t = useT();
  const titleId = useId();
  if (unavailable || history == null) return null;

  return <section className="nutrition-recommendation-history" aria-labelledby={titleId}>
    <h2 id={titleId}>{t('Ciclos anteriores')}</h2>
    {history.length === 0
      ? <p className="nutrition-recommendation-history-empty">{t('Cuando tu nutricionista publique recomendaciones de ciclos anteriores, las encontrarás aquí.')}</p>
      : <IonAccordionGroup>
        {history.map(cycle => <IonAccordion key={`${cycle.cycleNumber}:${cycle.startDate}`} value={`${cycle.cycleNumber}:${cycle.startDate}`}>
          <IonItem slot="header" lines="none">
            <IonLabel className="ion-text-wrap">
              <h3>{t('Ciclo {number}', { number: String(cycle.cycleNumber) })}</h3>
              <p>{t('Del {start} al {end}', { start: formatDateForDisplay(cycle.startDate), end: formatDateForDisplay(cycle.endDate) })}</p>
              <p>{cycle.professionalName}</p>
            </IonLabel>
          </IonItem>
          <div slot="content"><NutritionRecommendations recommendation={cycle} /></div>
        </IonAccordion>)}
      </IonAccordionGroup>}
  </section>;
}
