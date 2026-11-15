import { useId, useState } from 'react';
import { IonAccordion, IonAccordionGroup, IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonSkeletonText } from '@ionic/react';
import { chevronUpOutline, nutritionOutline, refreshOutline, warningOutline } from 'ionicons/icons';
import { useI18n } from '../../i18n/I18nContext';
import { formatLocalizedDate, formatLocalizedDateRange } from '../../utils/dates';
import type { NutritionCycleRecommendationDto } from '../../services/nutrition/nutrition-cycle-recommendation-types';
import { NutritionRecommendations } from './NutritionRecommendations';

/** D0014: previous llega seleccionado y ordenado por el backend, sin contexto de programa. */
export function NutritionRecommendationHistory({ history, unavailable = false, loading = false, errorMessage, onRetry, labelledBy }: {
  history?: readonly NutritionCycleRecommendationDto[] | null;
  unavailable?: boolean;
  loading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  labelledBy?: string;
}) {
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  const titleId = useId();
  const [selection, setSelection] = useState<string | null | undefined>();
  if (!loading && !unavailable && history == null) return null;
  const firstKey = history?.[0] ? `${history[0].cycleNumber}:${history[0].startDate}` : undefined;
  const expanded = selection === undefined ? firstKey : selection;

  return <section data-testid="nutrition-history" data-state={loading ? 'loading' : unavailable ? 'error' : history!.length === 0 ? 'empty' : 'ready'} className="nutrition-recommendation-history" aria-labelledby={labelledBy ?? titleId}>
    {!labelledBy && <h2 id={titleId}>{t('Ciclos anteriores')}</h2>}
    {loading ? <IonSkeletonText animated className="ntr-skeleton" role="status" aria-label={t('Cargando recomendaciones')}/> : unavailable ? <div className="nutrition-history-state">
      <p className="nutrition-recommendations-warning" role="alert"><IonIcon icon={warningOutline} aria-hidden="true" />{errorMessage ?? t('No pudimos cargar tus ciclos anteriores. Puedes volver a Plan y seguir con tus actividades.')}</p>
      {onRetry && <IonButton data-testid="nutrition-history-retry" fill="outline" expand="block" onClick={onRetry}><IonIcon icon={refreshOutline} slot="start" />{t('Reintentar')}</IonButton>}
    </div> : history!.length === 0
      ? <div className="nutrition-history-state nutrition-recommendations-empty">
        <span className="nutrition-empty-icon"><IonIcon icon={nutritionOutline} aria-hidden="true" /></span>
        <h3>{t('Todavía no hay ciclos anteriores')}</h3>
        <p>{t('Cuando termines tu primer ciclo y tu nutricionista lo cierre, su recomendación quedará guardada aquí.')}</p>
      </div>
      : <>
        <p className="nutrition-history-intro">{t('Aquí quedan las recomendaciones de ciclos que ya cerraron. La recomendación más reciente está en Plan.')}</p>
        <IonAccordionGroup value={expanded ?? undefined} onIonChange={event => {
          if (event.target !== event.currentTarget) return;
          setSelection(typeof event.detail.value === 'string' ? event.detail.value : null);
        }}>
        {history!.map(cycle => <IonAccordion data-testid="nutrition-history-cycle" data-cycle-number={cycle.cycleNumber} data-published-at={cycle.publishedAt} key={`${cycle.cycleNumber}:${cycle.startDate}`} value={`${cycle.cycleNumber}:${cycle.startDate}`}>
          <IonItem data-testid="nutrition-history-cycle-toggle" slot="header" lines="none">
            <IonLabel className="ion-text-wrap">
              <h3>{t('Ciclo {number}', { number: String(cycle.cycleNumber) })}</h3>
              <p>{formatLocalizedDateRange(cycle.startDate, cycle.endDate, locale)}</p>
              {expanded !== `${cycle.cycleNumber}:${cycle.startDate}` && <p>{cycle.professionalName} · {t('Nutricionista')} · {t('Publicado el {date}', { date: formatLocalizedDate(cycle.publishedAt, locale) })}{cycle.attachments.length === 0 ? ` · ${t('Sin imágenes')}` : ''}</p>}
            </IonLabel>
            <IonBadge slot="end">{t('Anterior')}</IonBadge>
          </IonItem>
          <div slot="content"><NutritionRecommendations recommendation={cycle} presentation="history" onRetry={onRetry}/>
            <IonButton data-testid="nutrition-history-cycle-hide" className="nutrition-history-hide" fill="clear" expand="block" onClick={event => {
              const header = event.currentTarget.closest('ion-accordion')?.querySelector<HTMLElement>('ion-item');
              setSelection(null);
              (header?.shadowRoot?.querySelector<HTMLElement>('button') ?? header)?.focus();
            }}><span>{t('Ocultar')}<IonIcon icon={chevronUpOutline} aria-hidden="true" /></span></IonButton>
          </div>
        </IonAccordion>)}
      </IonAccordionGroup></>}
  </section>;
}
