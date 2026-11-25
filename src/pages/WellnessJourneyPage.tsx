import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { IonButton, IonSpinner } from "@ionic/react";
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
  type PaidGeneration,
  type JourneyStatus,
} from "../features/wellness/generation/wellness-journey-api";
import { useI18n } from "../i18n/I18nContext";
import { ApiError } from "../utils/apiClient";
import { BRAND_NAME } from "../utils/brand";
import "../features/wellness/wellness.css";
import "../features/wellness/paid-journey.css";
import "../features/wellness/paid-journey-setup.css";

const PAID_TEST_GOALS = ["bajar"] as const;

function isPreparing(status: JourneyStatus | undefined) {
  return status === "pending" || status === "running";
}

export function WellnessJourneyPage({ userId, children }: {
  userId: string;
  children: (generation: PaidGeneration) => ReactNode;
}) {
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
  const job = generation.data;

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
              <div><strong>{BRAND_NAME}</strong><small>{t("Flujo de prueba")}</small></div>
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

  if (job) return children({
    job,
    retry: () => void updateGeneration("retry"),
    retrying: saving,
    retryError: actionError === "retry",
  });

  return (
    <Screen className="journey-page" hideNav>
      <Scroll className="journey-scroll" noNav>
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
      </Scroll>
    </Screen>
  );
}
