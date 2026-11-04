import { useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { sparklesOutline, checkmarkCircleOutline, chatbubbleEllipsesOutline } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { useApp } from "../../context/AppContext";
import { generateProfileGuidance, getProfileGuidance, type AssessmentProfileGuidance } from "../../services/assessments/profile-analysis-service";
import { formatDateForDisplay } from "../../utils/dates";
import type { MeResult } from "../../utils/healthTestsApi";

export function AssessmentProfileAnalysis({ results }: { results: MeResult[] }) {
  const { t, lang } = useI18n();
  const { user, realMode } = useApp();
  const key = `${user?.id ?? ''}:${lang}:${JSON.stringify(results)}`;
  const currentKey = useRef(key); currentKey.current = key;
  const generation = useRef<AbortController | null>(null);
  const cachedRequest = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ key: string; guidance: AssessmentProfileGuidance | null; loading: boolean; error: boolean }>({ key: '', guidance: null, loading: false, error: false });
  const labels = useMemo(() => new Map(results.map(result => [result.code, result.label])), [results]);
  const guidance = state.key === key ? state.guidance : null;
  const loading = state.key === key && state.loading;
  const failed = state.key === key && state.error;
  useEffect(() => {
    if (!realMode || !results.length) return;
    const request = new AbortController();
    cachedRequest.current = request;
    void getProfileGuidance(lang, request.signal).then(guidance => {
      if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance, loading: false, error: false });
    }).catch(() => { if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance: null, loading: false, error: true }); });
    return () => { request.abort(); generation.current?.abort(); };
  }, [key, lang, realMode, results.length]);
  async function generate() {
    cachedRequest.current?.abort();
    generation.current?.abort();
    const request = new AbortController(); generation.current = request;
    setState({ key, guidance: null, loading: true, error: false });
    try {
      const next = await generateProfileGuidance(lang, request.signal);
      if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance: next, loading: false, error: false });
    } catch { if (!request.signal.aborted && currentKey.current === key) setState({ key, guidance: null, loading: false, error: true }); }
  }
  if (!results.length) return null;
  return <section className="assessment-profile-analysis" aria-label={t("Análisis de mi perfil")}>
    <div className="apa-heading"><IonIcon icon={sparklesOutline} aria-hidden="true" /><div><span>{t("ANÁLISIS CON IA")}</span><h2>{t("Vita te explica tus resultados")}</h2></div></div>
    {guidance ? <div className="assessment-ai-narrative">
      <p className="assessment-ai-summary">{guidance.summary}</p>
      <ol className="assessment-ai-priorities">{guidance.priorities.map((priority, index) => <li key={`${index}:${priority.title}`}>
        <div className="assessment-ai-priority-title"><span>{String(index + 1).padStart(2, '0')}</span><h3>{priority.title}</h3></div>
        <p>{priority.explanation}</p><div className="assessment-ai-action"><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /><div><strong>{t('Un paso para hoy')}</strong><p>{priority.action}</p></div></div>
        <small>{t('Basado en')}: {priority.evidenceCodes.map(code => t(labels.get(code) ?? t('Tus evaluaciones'))).join(' · ')}</small>
      </li>)}</ol>
      <p className="assessment-ai-encouragement">{guidance.encouragement}</p>
      {guidance.questions.length > 0 && <section className="assessment-ai-questions"><h3><IonIcon icon={chatbubbleEllipsesOutline} aria-hidden="true" />{t('Para tu próxima conversación')}</h3><ul>{guidance.questions.map(question => <li key={question}>{question}</li>)}</ul></section>}
      <small className="assessment-ai-date">{t('Análisis generado el {date}', { date: formatDateForDisplay(guidance.generatedAt.slice(0, 10)) })}</small>
    </div> : <>
      <p>{t('Tus respuestas tienen pistas para cuidarte mejor. Vita puede explicarlas en palabras sencillas y sugerirte por dónde empezar.')}</p>
      {failed && <p role="alert">{t('Vita no pudo preparar el análisis. Tus resultados siguen disponibles; intenta de nuevo.')}</p>}
      <IonButton expand="block" className="bt bt-primary" disabled={loading || !realMode} onClick={() => void generate()}>
        {loading ? <><IonSpinner slot="start" name="crescent" />{t('Vita está leyendo tus evaluaciones…')}</> : t('Analizar mis resultados con Vita')}
      </IonButton>
    </>}
    <p className="apa-note">{t('Es una orientación de Vita basada en tus evaluaciones, no un diagnóstico. Tu equipo valida las decisiones clínicas y tu plan.')}</p>
  </section>;
}
