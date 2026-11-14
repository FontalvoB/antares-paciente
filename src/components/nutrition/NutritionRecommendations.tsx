import { useId, useState } from 'react';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonImg } from '@ionic/react';
import { chevronForwardOutline, lockClosedOutline, nutritionOutline, refreshOutline, warningOutline } from 'ionicons/icons';
import { useT } from '../../i18n/I18nContext';
import { formatDateForDisplay } from '../../utils/dates';
import type { NutritionCycleRecommendationDto } from '../../services/nutrition/nutrition-cycle-recommendation-types';

function RecommendationImage({ url, caption, onRefresh }: NutritionCycleRecommendationDto['attachments'][number] & { onRefresh?: () => void }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  return <figure>
    {failed
      ? <div className="nutrition-recommendations-image-error" role="status"><IonIcon icon={lockClosedOutline} aria-hidden="true" />{t('Imagen caducada')}</div>
      : <IonImg src={url} alt={caption || t('Imagen adjunta de tu nutricionista')} onIonError={() => setFailed(true)} />}
    {caption && <figcaption>{caption}</figcaption>}
    {failed && <IonButton expand="block" fill="outline" className="nutrition-image-refresh" disabled={!onRefresh} onClick={onRefresh}><IonIcon icon={refreshOutline} slot="start" />{t('Actualizar')}</IonButton>}
  </figure>;
}

/** Bloque publicado para el paciente. No consulta APIs ni representa borradores de IA. */
export function NutritionRecommendations({ recommendation, unavailable = false, onRetry, onOpenHistory }: {
  recommendation?: NutritionCycleRecommendationDto | null;
  unavailable?: boolean;
  /** Solicita renovar el envoltorio completo; nunca altera la URL firmada. */
  onRetry?: () => void;
  onOpenHistory?: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const messageId = useId();
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  if (recommendation === undefined && !unavailable) return null;

  if (unavailable || !recommendation) return <IonCard className="nutrition-recommendations" role="region" aria-labelledby={titleId}>
    <IonCardHeader><IonCardTitle id={titleId} role="heading" aria-level={2}>{t('Recomendaciones de tu nutricionista')}</IonCardTitle></IonCardHeader>
    <IonCardContent>
      {unavailable ? <>
        <p className="nutrition-recommendations-warning" role="alert"><IonIcon icon={warningOutline} aria-hidden="true" />{t('No pudimos cargar tus recomendaciones. Tu plan y tus registros siguen disponibles.')}</p>
        <div className="nutrition-recommendations-error-lines" aria-hidden="true"><span/><span/></div>
        <IonButton expand="block" fill="outline" className="nutrition-recommendations-retry" onClick={onRetry} disabled={!onRetry}><IonIcon icon={refreshOutline} slot="start" />{t('Reintentar')}</IonButton>
      </> : <div className="nutrition-recommendations-empty">
        <span className="nutrition-empty-icon"><IonIcon icon={nutritionOutline} aria-hidden="true" /></span>
        <h3>{t('Aún no tienes recomendaciones')}</h3>
        <p>{t('Tu nutricionista las publicará aquí cuando cierre tu primer ciclo. Mientras tanto, sigue tu plan y registra tus comidas.')}</p>
      </div>}
      {!unavailable && onOpenHistory && <IonButton className="nutrition-recommendations-history-link" fill="clear" expand="block" onClick={onOpenHistory}><span>{t('Ver ciclos anteriores')}<IonIcon icon={chevronForwardOutline} aria-hidden="true" /></span></IonButton>}
    </IonCardContent>
  </IonCard>;

  // Lista explícita de campos públicos; nunca se imprime ni se propaga el objeto completo.
  const { cycleNumber, publishedAt, professionalName, patientMessage, attachments } = recommendation;
  const initials = professionalName.split('·')[0].trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toLocaleUpperCase();
  const longMessage = Array.from(patientMessage).length > 480;
  const expanded = expandedMessage === patientMessage;
  const message = longMessage && !expanded ? `${Array.from(patientMessage).slice(0, 480).join('').trimEnd()}…` : patientMessage;
  return <IonCard className="nutrition-recommendations" role="region" aria-labelledby={titleId}>
    <IonCardHeader>
      <IonCardTitle id={titleId} role="heading" aria-level={2}>
        {t('Recomendaciones de tu nutricionista')}
      </IonCardTitle>
      <div className="nutrition-recommendations-byline"><span className="nutrition-professional-avatar" aria-hidden="true">{initials}</span><div>
        <p className="nutrition-recommendations-professional">{professionalName}</p>
        <p className="nutrition-recommendations-published">{t('Cierre del ciclo {cycle} · publicado el {date}', { cycle: String(cycleNumber), date: formatDateForDisplay(publishedAt.slice(0, 10)) })}</p>
      </div></div>
    </IonCardHeader>
    <IonCardContent>
      <p id={messageId} className="nutrition-recommendations-message">{message}</p>
      {longMessage && <IonButton fill="clear" className="nutrition-message-expand" aria-controls={messageId} onClick={() => setExpandedMessage(expanded ? null : patientMessage)}>{t(expanded ? 'Leer menos' : 'Leer más')}</IonButton>}
      {attachments.length > 0 && <section className="nutrition-recommendations-images" aria-label={t('Adjuntos')} data-layout={attachments.length === 3 ? 'three' : 'two'}>
        {attachments.map(attachment => <RecommendationImage key={attachment.url} url={attachment.url} caption={attachment.caption} onRefresh={onRetry} />)}
      </section>}
      {onOpenHistory && <IonButton className="nutrition-recommendations-history-link" fill="clear" expand="block" onClick={onOpenHistory}><span>{t('Ver ciclos anteriores')}<IonIcon icon={chevronForwardOutline} aria-hidden="true" /></span></IonButton>}
    </IonCardContent>
  </IonCard>;
}
