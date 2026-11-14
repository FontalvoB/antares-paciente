import { useId, useState } from 'react';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonImg, IonSkeletonText } from '@ionic/react';
import { chevronForwardOutline, lockClosedOutline, nutritionOutline, refreshOutline, warningOutline } from 'ionicons/icons';
import { useT } from '../../i18n/I18nContext';
import { formatDateForDisplay } from '../../utils/dates';
import type { NutritionCycleRecommendationDto } from '../../services/nutrition/nutrition-cycle-recommendation-types';

function RecommendationImage({ url, caption, onRefresh }: NutritionCycleRecommendationDto['attachments'][number] & { onRefresh?: () => void }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  return <figure data-testid="nutrition-recommendation-attachment">
    {failed
      ? <div data-testid="nutrition-recommendation-image-error" className="nutrition-recommendations-image-error" role="status"><IonIcon icon={lockClosedOutline} aria-hidden="true" />{t('Imagen caducada')}</div>
      : <IonImg data-testid="nutrition-recommendation-image" src={url} alt={caption || t('Imagen adjunta de tu nutricionista')} onIonError={() => setFailed(true)} />}
    {caption && <figcaption data-testid="nutrition-recommendation-caption">{caption}</figcaption>}
    {failed && <IonButton data-testid="nutrition-recommendation-image-refresh" expand="block" fill="outline" className="nutrition-image-refresh" disabled={!onRefresh} onClick={onRefresh}><IonIcon icon={refreshOutline} slot="start" />{t('Actualizar')}</IonButton>}
  </figure>;
}

/** Bloque publicado para el paciente. No consulta APIs ni representa borradores de IA. */
export function NutritionRecommendations({ recommendation, unavailable = false, loading = false, errorMessage, onRetry, onOpenHistory, presentation = 'current' }: {
  recommendation?: NutritionCycleRecommendationDto | null;
  unavailable?: boolean;
  loading?: boolean;
  errorMessage?: string;
  /** Solicita renovar el envoltorio completo; nunca altera la URL firmada. */
  onRetry?: () => void;
  onOpenHistory?: () => void;
  presentation?: 'current' | 'history';
}) {
  const t = useT();
  const titleId = useId();
  const messageId = useId();
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  if (loading) return <IonCard data-testid="nutrition-recommendations" data-state="loading" className="nutrition-recommendations" role="region" aria-labelledby={titleId} aria-busy="true">
    <IonCardHeader><IonCardTitle id={titleId} role="heading" aria-level={2}>{t('Recomendaciones de tu nutricionista')}</IonCardTitle></IonCardHeader>
    <IonCardContent><IonSkeletonText animated className="ntr-skeleton" role="status" aria-label={t('Cargando recomendaciones')}/></IonCardContent>
  </IonCard>;
  if (recommendation === undefined && !unavailable) return null;

  if (unavailable || !recommendation) return <IonCard data-testid="nutrition-recommendations" data-state={unavailable ? 'error' : 'empty'} className="nutrition-recommendations" role="region" aria-labelledby={titleId}>
    <IonCardHeader><IonCardTitle id={titleId} role="heading" aria-level={2}>{t('Recomendaciones de tu nutricionista')}</IonCardTitle></IonCardHeader>
    <IonCardContent>
      {unavailable ? <>
        <p className="nutrition-recommendations-warning" role="alert"><IonIcon icon={warningOutline} aria-hidden="true" />{errorMessage ?? t('No pudimos cargar tus recomendaciones. Tu plan y tus registros siguen disponibles.')}</p>
        <div className="nutrition-recommendations-error-lines" aria-hidden="true"><span/><span/></div>
        <IonButton data-testid="nutrition-recommendations-retry" expand="block" fill="outline" className="nutrition-recommendations-retry" onClick={onRetry} disabled={!onRetry}><IonIcon icon={refreshOutline} slot="start" />{t('Reintentar')}</IonButton>
      </> : <div className="nutrition-recommendations-empty">
        <span className="nutrition-empty-icon"><IonIcon icon={nutritionOutline} aria-hidden="true" /></span>
        <h3>{t('Aún no tienes recomendaciones')}</h3>
        <p>{t('Tu nutricionista las publicará aquí cuando cierre tu primer ciclo. Mientras tanto, sigue tu plan y registra tus comidas.')}</p>
      </div>}
      {!unavailable && onOpenHistory && <IonButton data-testid="nutrition-history-open" className="nutrition-recommendations-history-link" fill="clear" expand="block" onClick={onOpenHistory}><span>{t('Ver ciclos anteriores')}<IonIcon icon={chevronForwardOutline} aria-hidden="true" /></span></IonButton>}
    </IonCardContent>
  </IonCard>;

  // Lista explícita de campos públicos; nunca se imprime ni se propaga el objeto completo.
  const { cycleNumber, publishedAt, professionalName, patientMessage, attachments } = recommendation;
  const initials = professionalName.split('·')[0].trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toLocaleUpperCase();
  const longMessage = Array.from(patientMessage).length > 480;
  const expanded = expandedMessage === patientMessage;
  const message = longMessage && !expanded ? `${Array.from(patientMessage).slice(0, 480).join('').trimEnd()}…` : patientMessage;
  return <IonCard data-testid="nutrition-recommendations" data-state="ready" data-cycle-number={cycleNumber} data-published-at={publishedAt} className="nutrition-recommendations" data-presentation={presentation} role="region"
    aria-labelledby={presentation === 'current' ? titleId : undefined}
    aria-label={presentation === 'history' ? t('Recomendaciones del ciclo {cycle}', { cycle: String(cycleNumber) }) : undefined}>
    <IonCardHeader>
      {presentation === 'current' && <IonCardTitle id={titleId} role="heading" aria-level={2}>
        {t('Recomendaciones de tu nutricionista')}
      </IonCardTitle>}
      <div className="nutrition-recommendations-byline"><span className="nutrition-professional-avatar" aria-hidden="true">{initials}</span><div>
        <p data-testid="nutrition-recommendation-professional" className="nutrition-recommendations-professional">{professionalName}</p>
        <p data-testid="nutrition-recommendation-publication" className="nutrition-recommendations-published">{presentation === 'history'
          ? t('Publicado el {date}', { date: formatDateForDisplay(publishedAt.slice(0, 10)) })
          : t('Cierre del ciclo {cycle} · publicado el {date}', { cycle: String(cycleNumber), date: formatDateForDisplay(publishedAt.slice(0, 10)) })}</p>
      </div></div>
    </IonCardHeader>
    <IonCardContent>
      <p data-testid="nutrition-recommendation-message" id={messageId} className="nutrition-recommendations-message">{message}</p>
      {longMessage && <IonButton fill="clear" className="nutrition-message-expand" aria-controls={messageId} onClick={() => setExpandedMessage(expanded ? null : patientMessage)}>{t(expanded ? 'Leer menos' : 'Leer más')}</IonButton>}
      {attachments.length > 0 && <section className="nutrition-recommendations-images" aria-label={t('Adjuntos')} data-layout={attachments.length === 3 ? 'three' : 'two'}>
        {attachments.map(attachment => <RecommendationImage key={attachment.url} url={attachment.url} caption={attachment.caption} onRefresh={onRetry} />)}
      </section>}
      {onOpenHistory && <IonButton data-testid="nutrition-history-open" className="nutrition-recommendations-history-link" fill="clear" expand="block" onClick={onOpenHistory}><span>{t('Ver ciclos anteriores')}<IonIcon icon={chevronForwardOutline} aria-hidden="true" /></span></IonButton>}
    </IonCardContent>
  </IonCard>;
}
