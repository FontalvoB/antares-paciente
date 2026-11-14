import { useId, useState } from 'react';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonImg } from '@ionic/react';
import { chatbubbleEllipsesOutline, imageOutline } from 'ionicons/icons';
import { useT } from '../../i18n/I18nContext';
import { formatDateForDisplay } from '../../utils/dates';
import type { NutritionCycleRecommendationDto } from '../../services/nutrition/nutrition-cycle-recommendation-types';

function RecommendationImage({ url, caption }: NutritionCycleRecommendationDto['attachments'][number]) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  return <figure>
    {failed
      ? <div className="nutrition-recommendations-image-error" role="status"><IonIcon icon={imageOutline} aria-hidden="true" />{t('Imagen no disponible')}</div>
      : <IonImg src={url} alt={caption || t('Imagen adjunta de tu nutricionista')} onIonError={() => setFailed(true)} />}
    {caption && <figcaption>{caption}</figcaption>}
  </figure>;
}

/** Bloque publicado para el paciente. No consulta APIs ni representa borradores de IA. */
export function NutritionRecommendations({ recommendation, unavailable = false }: {
  recommendation?: NutritionCycleRecommendationDto | null;
  unavailable?: boolean;
}) {
  const t = useT();
  const titleId = useId();
  const imagesId = useId();
  if (unavailable || !recommendation) return null;

  // Lista explícita de campos públicos; nunca se imprime ni se propaga el objeto completo.
  const { cycleNumber, startDate, endDate, publishedAt, professionalName, patientMessage, attachments } = recommendation;
  return <IonCard className="nutrition-recommendations" role="region" aria-labelledby={titleId}>
    <IonCardHeader>
      <IonCardTitle id={titleId} role="heading" aria-level={2}>
        <IonIcon icon={chatbubbleEllipsesOutline} aria-hidden="true" />{t('Recomendaciones de tu nutricionista')}
      </IonCardTitle>
      <p className="nutrition-recommendations-professional">{professionalName}</p>
      <p className="nutrition-recommendations-cycle">{t('Revisión de tu ciclo {cycle}', { cycle: String(cycleNumber) })}</p>
      <p className="nutrition-recommendations-dates">{t('Del {start} al {end}', {
        start: formatDateForDisplay(startDate), end: formatDateForDisplay(endDate),
      })}</p>
      <p className="nutrition-recommendations-published">{t('Publicado el {date}', { date: formatDateForDisplay(publishedAt.slice(0, 10)) })}</p>
    </IonCardHeader>
    <IonCardContent>
      <p className="nutrition-recommendations-message">{patientMessage}</p>
      {attachments.length > 0 && <section className="nutrition-recommendations-images" aria-labelledby={imagesId}>
        <h3 id={imagesId}>{t('Adjuntos')}</h3>
        {attachments.map(attachment => <RecommendationImage key={attachment.url} url={attachment.url} caption={attachment.caption} />)}
      </section>}
    </IonCardContent>
  </IonCard>;
}
