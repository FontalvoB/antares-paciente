import { useEffect, useState } from "react";
import {
  IonButton,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from "@ionic/react";
import { PageHeader } from "../components/PageHeader";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import type { AvatarMetrics } from "../components/avatar/avatar-validation";
import { bodyMorphs, bodyState } from "../components/avatar/avatar-body-state";
import { useAvatarProgress } from "../hooks/useAvatarProgress";
import { AvatarCustomizer } from "../components/avatar/AvatarCustomizer";
import { AvatarStage } from "../components/avatar/AvatarStage";
import { WeightEvolutionSection } from "../components/avatar/WeightEvolutionSection";
import type { AvatarState } from "../components/avatar/avatar-state";
import { useAvatarConfiguration } from "../hooks/useAvatarConfiguration";
import { getAccessToken, getMe } from "../utils/authApi";

export function AvatarPage() {
  const t = useT(),
    { navigate, showToast, authLoading } = useApp();
  const [view, setView] = useState("appearance");
  const customization = useAvatarConfiguration(!authLoading);
  const progress = useAvatarProgress(
    !authLoading && customization.status === "ready",
  );
  const [canRecordWeight, setCanRecordWeight] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    setCanRecordWeight(false);
    if (!authLoading && token)
      void getMe().then((me) => {
        if (!cancelled && token === getAccessToken())
          setCanRecordWeight(me?.roles.includes("Admin") === true);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, progress.owner]);
  const configuration = customization.value;
  const gender = configuration?.gender;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const reference = progress.records[0];
  const latest = progress.records.at(-1);
  const selected =
    (view === "evolution"
      ? progress.records.find((r) => r.date === selectedDate)
      : undefined) ?? latest;
  const state = progress.resolved
    ? bodyState(reference?.value ?? 0, selected?.value ?? 0)
    : null;
  const avatar: AvatarState | null =
    state && configuration ? { ...configuration, body: state } : null;
  const weights = state ? bodyMorphs(state) : null;
  const [metrics, setMetrics] = useState<AvatarMetrics | null>(null);
  // Al cambiar de género se desmonta el viewer (ownerKey) y se descartan métricas previas.
  useEffect(() => {
    setMetrics(null);
  }, [gender]);
  const dataError =
    !authLoading &&
    (customization.status === "error" ||
      customization.status === "session-required" ||
      ["error", "unavailable", "session-required"].includes(progress.status));
  const dataPhase = dataError
    ? "ERROR"
    : authLoading ||
        customization.status === "loading" ||
        progress.status === "loading"
      ? "LOADING_USER_DATA"
      : progress.status === "empty"
        ? "NO_DATA"
        : "USER_DATA_READY";
  const ownerKey = `${progress.owner}:${gender}`;
  const handleSavedWeight = () => {
    setSelectedDate(null);
    progress.refresh();
    showToast(t("Peso guardado correctamente."), "ok");
  };
  const handleRefreshWeight = () => {
    setSelectedDate(null);
    progress.refresh();
  };
  return (
    <Screen className="avatar-experience">
      <PageHeader
        title={view === "appearance" ? t("Mi Avatar") : t("Mi evolución")}
        sub={
          view === "appearance"
            ? t("Tu estilo, tu evolución.")
            : t("Representación visual de tu progreso registrado")
        }
        trailing={
          <IonButton fill="clear" onClick={() => navigate("prof")}>
            {t("Volver")}
          </IonButton>
        }
      />
      <IonSegment
        className="avatar-view-tabs"
        value={view}
        aria-label={t("Vista del avatar")}
        onIonChange={(e) => {
          if (e.detail.value === "appearance" || e.detail.value === "evolution")
            setView(e.detail.value);
        }}
      >
        <IonSegmentButton value="appearance">
          <IonLabel>{t("Mi Avatar")}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="evolution">
          <IonLabel>{t("Mi evolución")}</IonLabel>
        </IonSegmentButton>
      </IonSegment>
      <Scroll className="avatar-scroll">
        <div className="avatar-layout">
          <div className="avatar-preview">
            <AvatarStage
              avatar={avatar}
              weights={weights}
              ownerKey={ownerKey}
              disabled={dataError}
              dataPhase={dataPhase}
              historyMs={progress.historyMs}
              bodyState={state}
              isPersonalizationLoading={
                authLoading || customization.status === "loading"
              }
              onMetrics={setMetrics}
            />
            {customization.status === "error" && (
              <div role="alert">
                <p>{t("No se pudo cargar tu personalización.")}</p>
                <IonButton
                  style={{ minHeight: 44 }}
                  onClick={customization.retry}
                >
                  {t("Reintentar personalización")}
                </IonButton>
              </div>
            )}
          </div>
          <div className="avatar-panel">
            <section
              hidden={view !== "appearance"}
              aria-label={t("Personalización del avatar")}
            >
              {configuration && (
                <AvatarCustomizer
                  value={configuration}
                  disabled={customization.saving || dataError}
                  onChange={(next) => {
                    customization.change(next);
                  }}
                />
              )}
              {configuration && (
                <div
                  className="avatar-save"
                  data-avatar-configuration={JSON.stringify(configuration)}
                >
                  <IonButton
                    expand="block"
                    disabled={
                      !customization.dirty || customization.saving || dataError
                    }
                    onClick={() => void customization.save()}
                  >
                    {customization.saving
                      ? t("Guardando…")
                      : customization.saveError
                        ? t("Reintentar guardado")
                        : t("Guardar avatar")}
                  </IonButton>
                  <p role={customization.saveError ? "alert" : "status"}>
                    {customization.saveError
                      ? t(
                          "No se pudo guardar. Tu selección se conserva; vuelve a intentarlo.",
                        )
                      : customization.dirty
                        ? t("Tienes cambios sin guardar.")
                        : t("Personalización sincronizada.")}
                  </p>
                </div>
              )}
            </section>
            <WeightEvolutionSection
              records={progress.records}
              status={progress.status}
              error={progress.error}
              canRecordWeight={canRecordWeight}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onRefresh={handleRefreshWeight}
              onSaved={handleSavedWeight}
              showEvolution={view === "evolution"}
              onSeeEvolution={
                view === "appearance" ? () => setView("evolution") : undefined
              }
            />
          </div>
        </div>
        {metrics && (
          <div hidden data-avatar-metrics={JSON.stringify(metrics)} />
        )}
      </Scroll>
    </Screen>
  );
}
