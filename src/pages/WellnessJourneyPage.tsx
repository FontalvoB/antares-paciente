import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonProgressBar, IonSpinner } from "@ionic/react";
import { alertCircleOutline, barbellOutline, checkmarkCircleOutline, chevronForwardOutline, leafOutline, mailOpenOutline, refreshOutline, sparklesOutline, timeOutline } from "ionicons/icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { LanguageToggle } from "../components/LanguageToggle";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { ObjectiveWizard } from "../features/wellness/components/objective";
import { EMPTY_OBJECTIVE_DRAFT } from "../features/wellness/domain";
import type { ObjectiveDraft } from "../features/wellness/domain";
import {
  latestJourneyGeneration,
  retryJourneyGeneration,
  submitJourneyGoal,
  type JourneyGeneration,
  type JourneyPlan,
  type JourneyStatus,
} from "../features/wellness/generation/wellness-journey-api";
import { useI18n, useT } from "../i18n/I18nContext";
import { ApiError } from "../utils/apiClient";
import "../features/wellness/wellness.css";
import "../features/wellness/paid-journey.css";
import "../features/wellness/paid-journey-setup.css";

const PAID_TEST_GOALS = ["bajar"] as const;

function isPreparing(status: JourneyStatus | undefined) {
  return status === "pending" || status === "running";
}

function JourneyPlanCard({ kind, plan }: { kind: "exercise" | "nutrition"; plan: JourneyPlan }) {
  const t = useT();
  const heading = useId();
  const exercise = kind === "exercise";
  const title = exercise ? t("Plan de ejercicio") : t("Plan de nutrición");
  const demoTitle = exercise ? t("Plan de ejercicio de demostración") : t("Plan de nutrición de demostración");
  return (
    <section className={`journey-card journey-card--${kind}`} aria-labelledby={heading}>
      <div className="journey-card-head">
        <span className="journey-icon"><IonIcon icon={exercise ? barbellOutline : leafOutline} aria-hidden="true" /></span>
        <h2 id={heading}>{title}</h2>
      </div>
      {isPreparing(plan.status) && (
        <>
          <p>{t("En preparación")}</p>
          <IonProgressBar type="indeterminate" aria-labelledby={heading} />
        </>
      )}
      {plan.status === "failed" && <p>{t("No pudimos preparar este plan.")}</p>}
      {plan.status === "ready" && plan.result && (
        <>
          {plan.result.title !== demoTitle && plan.result.title !== title && <h3>{plan.result.title}</h3>}
          <ul className="journey-plan-items">
            {plan.result.items.map((item, index) => (
              <li key={index}><IonIcon icon={chevronForwardOutline} aria-hidden="true" /><span>{item}</span></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function JourneyInbox({ inbox }: { inbox: JourneyGeneration["inbox"] }) {
  const { t, lang } = useI18n();
  const heading = useId();
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
  return (
    <section className="journey-card journey-card--inbox" aria-labelledby={heading}>
      <div className="journey-card-head">
        <span className="journey-icon"><IonIcon icon={mailOpenOutline} aria-hidden="true" /></span>
        <h2 id={heading}>{t("Bandeja de entrada")}</h2>
      </div>
      {isPreparing(inbox.status) && <p>{t("Preparando tu bandeja")}</p>}
      {inbox.status === "failed" && <p>{t("No pudimos preparar tu bandeja")}</p>}
      {inbox.status === "ready" && (inbox.items.length ? (
        <IonList lines="none" className="journey-inbox">
          {inbox.items.map((item) => (
            <IonItem key={item.id}>
              <IonLabel className="ion-text-wrap">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <time dateTime={item.createdAt}>{date.format(new Date(item.createdAt))}</time>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      ) : <p>{t("No tienes mensajes nuevos")}</p>)}
    </section>
  );
}

export function WellnessJourneyPage({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const { user, logout } = useApp();
  const client = useQueryClient();
  const generationKey = ["wellness-journey", userId, lang];
  const generation = useQuery({
    queryKey: generationKey,
    queryFn: ({ signal }) => latestJourneyGeneration(userId, signal),
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => isPreparing(query.state.data?.status) ? 1000 : false,
  });
  const [draft, setDraft] = useState<ObjectiveDraft>(() => ({
    ...EMPTY_OBJECTIVE_DRAFT, name: user.nombre, email: user.email,
  }));
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<"submit" | "retry" | null>(null);
  const locked = useRef(false);
  const submissionId = useRef<string | null>(null);
  const homeHeading = useRef<HTMLHeadingElement>(null);
  const job = generation.data;
  const showingHome = Boolean(job);

  useEffect(() => {
    if (showingHome) homeHeading.current?.focus();
  }, [showingHome]);

  const changeDraft = (patch: Partial<ObjectiveDraft>) => {
    submissionId.current = null;
    setActionError(null);
    setDraft((previous) => ({ ...previous, ...patch }));
  };

  async function updateGeneration(action: "submit" | "retry") {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setActionError(null);
    try {
      let next: JourneyGeneration;
      if (action === "submit") {
        submissionId.current ??= crypto.randomUUID();
        // Ante una respuesta perdida, el mismo borrador conserva su identidad.
        next = await submitJourneyGoal(userId, submissionId.current, draft);
      } else {
        if (!job) return;
        next = await retryJourneyGeneration(userId, job);
      }
      await client.cancelQueries({ queryKey: generationKey, exact: true });
      client.setQueryData(generationKey, next);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const current = await generation.refetch();
        if (current.data) return;
      }
      setActionError(action);
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  if (job === null && !generation.isError) {
    return (
      <Screen className="journey-page journey-setup" hideNav>
        <Scroll className="journey-scroll" noNav>
          <header className="journey-masthead">
            <div className="journey-brand">
              <img src={`${import.meta.env.BASE_URL}LogoIndividual.png`} alt="" width={25} height={25} />
              <div><strong>Copp Adresd</strong><small>{t("Flujo de prueba")}</small></div>
            </div>
            <LanguageToggle />
          </header>
          <div className="onb-stack">
            <ObjectiveWizard
              presentation="paid"
              allowedGoals={PAID_TEST_GOALS}
              draft={draft}
              onChange={changeDraft}
              gate={null}
              generating={saving}
              onGenerate={() => void updateGeneration("submit")}
            />
            {actionError === "submit" && (
              <p className="wl-note wl-note-danger" role="alert">{t("No pudimos guardar tu cuestionario. Revisa tus respuestas e intenta de nuevo.")}</p>
            )}
          </div>
        </Scroll>
      </Screen>
    );
  }

  return (
    <Screen className="journey-page" hideNav>
      <Scroll className="journey-scroll" noNav>
        <header className="journey-hero">
          <div className="journey-hero-top"><span>Copp Adresd</span><LanguageToggle /></div>
          <IonIcon className="journey-hero-art" icon={sparklesOutline} aria-hidden="true" />
          <h1 ref={homeHeading} tabIndex={-1}>{t("Inicio")}</h1>
          <p>{t("Flujo de prueba")}</p>
        </header>
        {generation.isPending && (
          <div className="journey-status" role="status"><IonSpinner name="crescent" aria-hidden="true" /> {t("Consultando tu plan…")}</div>
        )}
        {generation.isError && (
          <div className="journey-status" data-status="failed">
            <p role="alert">
              {t(generation.error instanceof ApiError &&
                (generation.error.code === "journey_unavailable" || generation.error.code === "consent_required")
                ? "Confirma tu membresía y acepta la versión vigente de los documentos para continuar."
                : "No pudimos consultar tu plan. Intenta de nuevo.")}
            </p>
            <IonButton fill="outline" disabled={generation.isFetching} onClick={() => void generation.refetch()}>{t("Reintentar conexión")}</IonButton>
            <IonButton fill="clear" onClick={logout}>{t("Cerrar sesión")}</IonButton>
          </div>
        )}
        {job && (
          <>
            <section className="journey-status" data-status={job.status}>
              <div className="journey-status-main">
                <IonIcon icon={job.status === "ready" ? checkmarkCircleOutline : job.status === "failed" ? alertCircleOutline : timeOutline} aria-hidden="true" />
                <p role="status">
                {job.status === "ready" ? t("Tu plan y tu bandeja están listos")
                  : job.status === "failed" ? t("Tus respuestas están guardadas")
                    : t("Estamos preparando tu plan")}
                </p>
              </div>
              {job.status === "failed" && (
                <>
                  <p>{t("Vuelve a intentarlo sin repetir el cuestionario.")}</p>
                  <IonButton fill="outline" disabled={saving} onClick={() => void updateGeneration("retry")}>
                    <IonIcon slot="start" icon={refreshOutline} aria-hidden="true" />
                    {t("Reintentar generación")}
                  </IonButton>
                </>
              )}
              {actionError === "retry" && <p role="alert">{t("No pudimos reintentar la generación.")}</p>}
            </section>
            <JourneyPlanCard kind="exercise" plan={job.exercise} />
            <JourneyPlanCard kind="nutrition" plan={job.nutrition} />
            <JourneyInbox inbox={job.inbox} />
          </>
        )}
      </Scroll>
    </Screen>
  );
}
