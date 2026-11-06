import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IonAccordion, IonAccordionGroup, IonAvatar, IonButton, IonIcon, IonItem, IonLabel, IonList, IonSpinner } from "@ionic/react";
import { sparklesOutline, checkmarkCircleOutline, chatbubbleEllipsesOutline, informationCircleOutline, documentsOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { useApp } from "../../context/AppContext";
import { generateProfileGuidance, getProfileGuidance, type AssessmentProfileGuidance } from "../../services/assessments/profile-analysis-service";
import { formatDateForDisplay, toLocalISODate } from "../../utils/dates";
import type { MeResult } from "../../utils/healthTestsApi";
import { ApiError } from "../../utils/apiClient";
import vitaPortrait from "../../assets/vita-coach.png";

export function AssessmentProfileAnalysis({ results }: { results: MeResult[] }) {
  const { t, lang } = useI18n();
  const summaryId = useId();
  const [expandedSummaryKey, setExpandedSummaryKey] = useState<string | null>(null);
  const { user, realMode } = useApp();
  const key = `${user?.id ?? ''}:${lang}:${JSON.stringify(results)}`;
  const currentKey = useRef(key); currentKey.current = key;
  const generation = useRef<AbortController | null>(null);
  const cachedRequest = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ key: string; guidance: AssessmentProfileGuidance | null; loading: boolean; error: boolean; rateLimited?: boolean }>({ key: '', guidance: null, loading: false, error: false });
  const [checkingKey, setCheckingKey] = useState<string | null>(null);
  const labels = useMemo(() => new Map(results.map(result => [result.code, result.label])), [results]);
  const guidance = state.key === key ? state.guidance : null;
  const loading = state.key === key && state.loading;
  const failed = state.key === key && state.error;
  const checking = checkingKey === key;
  const sourceLabels = new Map(guidance?.sources?.map(source => [source.evidenceCode, source.testName]));
  const number = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-CO', { maximumFractionDigits: 2 });
  useEffect(() => {
    if (!realMode || !results.length) return;
    const request = new AbortController();
    cachedRequest.current = request;
    setCheckingKey(key);
    void getProfileGuidance(lang, request.signal).then(guidance => {
      if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance, loading: false, error: false });
    }).catch(() => { if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance: null, loading: false, error: true }); })
      .finally(() => { if (!request.signal.aborted && currentKey.current === key) setCheckingKey(null); });
    return () => { request.abort(); generation.current?.abort(); };
  }, [key, lang, realMode, results.length]);
  async function generate() {
    cachedRequest.current?.abort();
    setCheckingKey(null);
    generation.current?.abort();
    const request = new AbortController(); generation.current = request;
    setState({ key, guidance: null, loading: true, error: false });
    try {
      const next = await generateProfileGuidance(lang, request.signal);
      if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance: next, loading: false, error: false });
    } catch (error) { if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance: null, loading: false, error: true, rateLimited: error instanceof ApiError && error.status === 429 }); }
  }
  const sourceCount = new Set(guidance?.sources?.map(source => source.testCode)).size;
  const summaryExpanded = expandedSummaryKey === key;
  const longSummary = (guidance?.summary.length ?? 0) > 260;
  const summaryToggle = useRef<HTMLIonButtonElement | null>(null);
  useEffect(() => {
    const button = summaryToggle.current;
    if (!button) return;
    // Ionic 8 hereda aria-expanded al hidratar, pero solo observa cambios
    // de aria-label/checked/pressed. Mantener el botón nativo sincronizado.
    const frame = window.requestAnimationFrame(() => {
      button.shadowRoot?.querySelector('button')?.setAttribute('aria-expanded', String(summaryExpanded));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [summaryExpanded, longSummary, guidance?.sourceRevision]);
  const citationLabels = (codes: string[]) => [...new Set(codes.map(code =>
    sourceLabels.get(code) ?? t(labels.get(code) ?? 'Tus evaluaciones')))];

  if (!results.length) return null;
  return (
    <section className="assessment-profile-analysis" aria-label={t("Análisis de mi perfil")}>
      <div className="apa-heading">
        <IonAvatar className="apa-avatar"><img src={vitaPortrait} alt={t('Vita, tu coach de bienestar')} /></IonAvatar>
        <div className="apa-heading-copy">
          <span className="apa-kicker">{t('VITA · TU COACH')}</span>
          <h2>{t('Empecemos por ti')}</h2>
          <span className="apa-ai-label"><IonIcon icon={sparklesOutline} aria-hidden="true" />{t('ANÁLISIS CON IA')}</span>
        </div>
      </div>

      {guidance ? <div className="assessment-ai-narrative">
        <div className="assessment-ai-overview">
          <div className="assessment-ai-overview-top">
            <h3>{t('Lo que dicen tus respuestas')}</h3>
            {sourceCount > 0 && <span className="apa-source-count">{sourceCount === 1 ? t('1 evaluación analizada') : t('{n} evaluaciones analizadas', { n: String(sourceCount) })}</span>}
          </div>
          <p id={summaryId} className="assessment-ai-summary" data-collapsed={longSummary && !summaryExpanded ? 'true' : undefined}>{guidance.summary}</p>
          {longSummary && <IonButton ref={summaryToggle} fill="clear" className="apa-read-more" aria-expanded={summaryExpanded} aria-controls={summaryId}
            onClick={() => setExpandedSummaryKey(summaryExpanded ? null : key)}>{t(summaryExpanded ? 'Ver menos' : 'Leer análisis completo')}</IonButton>}
          {guidance.isPartial && <div className="assessment-ai-partial">
            <IonIcon icon={informationCircleOutline} aria-hidden="true" />
            <div><strong>{t('Análisis parcial')}</strong><span>{t('Puedes ampliarlo al completar tus evaluaciones.')}</span></div>
          </div>}
        </div>

        <div className="assessment-ai-section-heading"><h3>{t('Pequeños pasos para hoy')}</h3><p>{t('Elige por dónde quieres empezar.')}</p></div>
        <ol className="assessment-ai-priorities">
          {guidance.priorities.map((priority, index) => <li className="assessment-ai-step" key={`${guidance.sourceRevision}:${index}:${priority.title}`}>
            <div className="assessment-ai-priority-title"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{priority.title}</h3></div>
            <div className="assessment-ai-action"><strong>{t('Un paso para hoy')}</strong><p>{priority.action}</p></div>
            <IonAccordionGroup className="assessment-ai-reasons">
              <IonAccordion className="assessment-ai-reason" value={`reason-${index}`}>
                <IonItem slot="header" lines="none"><IonLabel>{t('Por qué te lo sugiero')}</IonLabel></IonItem>
                <div slot="content" className="assessment-ai-reason-body">
                  <p>{priority.explanation}</p>
                  <div className="assessment-ai-citations"><span>{t('Basado en')}</span>{citationLabels(priority.evidenceCodes).map(label => <span className="assessment-ai-citation" key={label}>{label}</span>)}</div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </li>)}
        </ol>

        <div className="assessment-ai-encouragement"><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /><p>{guidance.encouragement}</p></div>

        {guidance.questions.length > 0 && <IonAccordionGroup className="assessment-ai-questions">
          <IonAccordion value="questions">
            <IonItem slot="header" lines="none"><IonIcon slot="start" icon={chatbubbleEllipsesOutline} aria-hidden="true" /><IonLabel><h3>{t('Para tu próxima conversación')}</h3><p>{t('Ideas para compartir con tu equipo')}</p></IonLabel></IonItem>
            <div slot="content"><ul>{guidance.questions.map(question => <li key={question}>{question}</li>)}</ul></div>
          </IonAccordion>
        </IonAccordionGroup>}

        {!!guidance.sources?.length && <IonAccordionGroup className="assessment-ai-evidence">
          <IonAccordion value="sources">
            <IonItem slot="header" lines="none"><IonIcon slot="start" icon={documentsOutline} aria-hidden="true" /><IonLabel><h3>{t('Resultados que Vita tuvo en cuenta')}</h3><p>{t('Consulta los datos detrás de esta lectura')}</p></IonLabel></IonItem>
            <div slot="content">
              <p className="assessment-ai-evidence-intro">{t('Se usa la última evaluación completada de cada test. Cada puntuación conserva su propia escala.')}</p>
              <IonList lines="none">{guidance.sources.map(source => <IonItem key={source.evidenceCode}>
                <IonLabel><h3>{source.testName}</h3>{source.label !== source.testName && <p>{source.label}</p>}
                  {source.qualifier && <p className="assessment-ai-qualifier">{source.qualifier}</p>}
                  {source.completedAt && <p className="assessment-ai-source-date">{formatDateForDisplay(toLocalISODate(new Date(source.completedAt)))}</p>}
                </IonLabel>
                <div slot="end" className="assessment-ai-source-value"><span>{t('Valor')}</span><strong>{number.format(source.value)}</strong></div>
              </IonItem>)}</IonList>
            </div>
          </IonAccordion>
        </IonAccordionGroup>}
        <small className="assessment-ai-date">{t('Análisis generado el {date}', { date: formatDateForDisplay(toLocalISODate(new Date(guidance.generatedAt))) })}</small>
      </div> : <div className="assessment-ai-start">
        <h3>{t('Descubre tu punto de partida')}</h3>
        <p>{t('Tus respuestas tienen pistas para cuidarte mejor. Vita puede explicarlas en palabras sencillas y sugerirte por dónde empezar.')}</p>
        <div className="assessment-ai-start-hints"><span><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />{t('Una lectura personal')}</span><span><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />{t('Pasos para hoy')}</span></div>
        {failed && <p className="assessment-ai-error" role="alert">{t(state.rateLimited ? 'Has solicitado varios análisis. Espera un minuto e intenta de nuevo.' : 'Vita no pudo preparar el análisis. Tus resultados siguen disponibles; intenta de nuevo.')}</p>}
        <IonButton expand="block" className="apa-generate" disabled={checking || loading || !realMode} onClick={() => void generate()}>
          {checking || loading ? <><IonSpinner slot="start" name="crescent" />{t(checking ? 'Buscando tu análisis guardado…' : 'Vita está leyendo tus evaluaciones…')}</> : <><IonIcon slot="start" icon={sparklesOutline} aria-hidden="true" />{t('Analizar mis resultados con Vita')}</>}
        </IonButton>
      </div>}
      <p className="apa-note"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /><span>{t('Es una orientación de Vita basada en tus evaluaciones, no un diagnóstico. Tu equipo valida las decisiones clínicas y tu plan.')}</span></p>
    </section>
  );
}
