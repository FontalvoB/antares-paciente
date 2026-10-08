import { useMemo, type CSSProperties } from "react";
import { IonAccordion, IonAccordionGroup, IonButton, IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { checkmarkCircleOutline, documentTextOutline, peopleOutline } from "ionicons/icons";
import { useT } from "../../i18n/I18nContext";
import type { MeResult } from "../../utils/healthTestsApi";
import { PATIENT_TITLES, themeFor } from "./model";

import { groupAssessmentResults } from "../../utils/assessmentResults";

export function AssessmentResults({ results, error, onEnter, onCommunity }: {
  error: boolean;
  results: MeResult[];
  onEnter: () => void;
  onCommunity: () => void;
}) {
  const t = useT();
  const groups = useMemo(() => groupAssessmentResults(results), [results]);
  return (
    <div className="screen-scroll no-nav assessment-results">
      {error || groups.length === 0 ? (
        <div className="ar-empty" role={error ? "alert" : undefined}>
          <IonIcon icon={documentTextOutline} aria-hidden="true" />
          <h2>{t(error ? "No se pudieron cargar los resultados." : "Aún no hay resultados calculados disponibles.")}</h2>
        </div>
      ) : (
        <>
          <div className="ar-summary">
            <div className="ar-summary-icon"><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /></div>
            <div><strong>{t("Resultados guardados")}</strong><p>{t("{n} evaluaciones con resultados", { n: String(groups.length) })}</p></div>
          </div>
          <div className="ar-section"><h2>{t("Tus evaluaciones")}</h2><p>{t("Explora cada evaluación para ver sus puntuaciones y detalles.")}</p></div>
          <IonAccordionGroup className="ar-cards" multiple>
            {groups.map(({ id, score, details }) => {
              const theme = themeFor(score.code);
              const title = PATIENT_TITLES[score.code] ?? score.label;
              const classification = score.qualifier;
              return (
                <IonAccordion key={id} value={id} className="ar-card" style={{ "--ar-accent": theme.accent, "--ar-soft": theme.accentSoft } as CSSProperties}>
                  <IonItem slot="header" lines="none" className="ar-card-header">
                    <span slot="start" className="ar-card-icon" aria-hidden="true">{theme.emoji}</span>
                    <IonLabel className="ar-card-title"><h3>{t(title)}</h3>{title !== score.label && <p>{score.label}</p>}
                      <span className="ar-classification">{classification ? t(classification) : t("Puntuación registrada")}</span>
                    </IonLabel>
                    <div slot="end" className="ar-score"><strong>{score.value}</strong>{score.resultType !== "indicator" && <span>{t("puntos")}</span>}</div>
                  </IonItem>
                  <div slot="content" className="ar-card-details">
                    <div className="ar-detail-kicker">{t("Detalle de la evaluación")}</div>
                    {details.length > 0 ? <IonList lines="none" className="ar-detail-list">
                      {details.map(result => <IonItem key={result.id} className="ar-detail-row">
                        <IonLabel><h4>{result.label}</h4>{result.qualifier && <p>{t(result.qualifier)}</p>}</IonLabel>
                        <span slot="end" className="ar-detail-value">{result.value}</span>
                      </IonItem>)}
                    </IonList> : <p className="ar-no-details">{t("Sin resultados adicionales para esta evaluación.")}</p>}
                  </div>
                </IonAccordion>
              );
            })}
          </IonAccordionGroup>
          <p className="ar-scale-note"><IonIcon icon={documentTextOutline} aria-hidden="true" />{t("Cada evaluación tiene su propia escala. Revisa los resultados con tu equipo de salud.")}</p>
        </>
      )}
      <div className="ar-actions">
        <IonButton expand="block" className="ar-primary" onClick={onEnter}>{t("Volver a mi perfil")}</IonButton>
        <IonButton expand="block" fill="clear" className="ar-community" onClick={onCommunity}><IonIcon slot="start" icon={peopleOutline} />{t("Comunidad")}</IonButton>
      </div>
    </div>
  );
}
