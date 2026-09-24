import { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonSpinner,
} from "@ionic/react";
import {
  accessibilityOutline,
  bluetoothOutline,
  bodyOutline,
  flaskOutline,
  manOutline,
  medkitOutline,
  personOutline,
  pulseOutline,
  scaleOutline,
  speedometerOutline,
} from "ionicons/icons";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { useI18n, useT } from "../i18n/I18nContext";
import { bodyMorphs, bodyState } from "../components/avatar/avatar-body-state";
import { AvatarCustomizer } from "../components/avatar/AvatarCustomizer";
import { AvatarStage } from "../components/avatar/AvatarStage";
import { WeightEvolutionSection } from "../components/avatar/WeightEvolutionSection";
import type { AvatarState } from "../components/avatar/avatar-state";
import type { AvatarMetrics } from "../components/avatar/avatar-validation";
import { useAvatarConfiguration } from "../hooks/useAvatarConfiguration";
import { useAvatarProgress } from "../hooks/useAvatarProgress";
import { useMyMeasurements } from "../hooks/useMyMeasurements";
import type { MeasurementItemDto } from "../services/measurements/types";
import { getAccessToken, getMe } from "../utils/authApi";

type BodyView = "composition" | "evolution" | "appearance";

/** Códigos corporales que muestra el Perfil corporal (el resto vive en Historia). */
const BODY_CODES = [
  "weight",
  "height",
  "waist",
  "hip",
  "wrist",
  "body_fat",
] as const;

/** Etiqueta fija por código (clave t(); el nombre del backend no se usa). */
const BODY_LABELS: Record<string, string> = {
  weight: "Peso",
  height: "Talla",
  waist: "Cintura",
  hip: "Cadera",
  wrist: "Muñeca",
  body_fat: "Grasa corporal",
};

/**
 * Etiqueta legible del origen (clave t(); el crudo viaja tal cual si aparece
 * un origen desconocido). Mismo mapa que Historia.
 */
const SOURCE_LABELS: Record<string, string> = {
  device: "Dispositivo",
  lab: "Laboratorio",
  patient: "Autorreporte",
  professional: "Profesional",
};

/**
 * Chip médico por origen (mismo sistema pastel que Historia; tokens
 * --hc-src-* en variables.css). Solo presentación.
 */
const SOURCE_META: Record<string, { className: string; icon: string }> = {
  device: { className: "hc-src-device", icon: bluetoothOutline },
  lab: { className: "hc-src-lab", icon: flaskOutline },
  patient: { className: "hc-src-patient", icon: personOutline },
  professional: { className: "hc-src-prof", icon: medkitOutline },
};

/** Icono temático por código corporal (presentación; el valor es del backend). */
const BODY_ICONS: Record<string, string> = {
  weight: scaleOutline,
  height: accessibilityOutline,
  waist: bodyOutline,
  hip: manOutline,
  wrist: pulseOutline,
  body_fat: speedometerOutline,
};

/** Rango de referencia estándar del IMC para la banda saludable (OMS). */
const BMI_REF_LO = 18.5;
const BMI_REF_HI = 24.9;
/** Ventana visible de la escala del IMC (solo presentación del marcador). */
const BMI_SCALE_MIN = 15;
const BMI_SCALE_MAX = 35;

/** Fecha ISO (YYYY-MM-DD) con el locale activo; nunca pasa por t(). */
function formatIsoDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** observedAt con offset del backend a dd/mm/aaaa; solo la fecha. */
function formatObservedAt(iso: string, locale: string): string {
  const datePart = iso.split("T")[0] ?? iso;
  return formatIsoDate(datePart, locale);
}

/** Valor numérico con el locale activo (máx. 2 decimales) + símbolo. */
function formatMeasurementValue(
  value: number,
  unitSymbol: string,
  locale: string,
): string {
  const num = value.toLocaleString(locale, { maximumFractionDigits: 2 });
  return unitSymbol ? `${num} ${unitSymbol}` : num;
}

/**
 * Altura a metros para el IMC estándar. El backend persiste cm; si la unidad
 * es ambigua, un valor > 3 solo puede ser cm.
 */
function heightToMeters(item: MeasurementItemDto): number | null {
  const unit = `${item.unitCode} ${item.unitSymbol}`.toLowerCase();
  if (unit.includes("mm")) return item.value / 1000;
  if (unit.includes("cm")) return item.value / 100;
  if (item.value > 3) return item.value / 100;
  return item.value;
}

/**
 * Perfil corporal unificado: avatar 3D (solo evolución de peso) +
 * mediciones corporales reales + evolución + personalización.
 * Sin BodyMap ni cifras fabricadas: lo que no está persistido no se muestra.
 */
export function BodyProfilePage() {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const { showToast, authLoading } = useApp();
  const [view, setView] = useState<BodyView>("composition");

  // Avatar y evolución de peso: misma fuente que AvatarPage.
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
  const latestWeight = progress.records.at(-1);
  const selected =
    progress.records.find((r) => r.date === selectedDate) ?? latestWeight;
  const state = progress.resolved
    ? bodyState(reference?.value ?? 0, selected?.value ?? 0)
    : null;
  // Pose neutral: con configuración pero sin registros de peso, el avatar se
  // muestra sin morfología inventada junto al estado vacío de mediciones.
  const isEmptyWeight = progress.status === "empty";
  const neutralBody = bodyState(0, 0);
  const avatar: AvatarState | null =
    state && configuration
      ? { ...configuration, body: state }
      : configuration && isEmptyWeight
        ? { ...configuration, body: neutralBody }
        : null;
  const weights = state
    ? bodyMorphs(state)
    : configuration && isEmptyWeight
      ? bodyMorphs(neutralBody)
      : null;
  const [metrics, setMetrics] = useState<AvatarMetrics | null>(null);
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

  // Mediciones corporales reales: última fila persistida por código.
  const {
    items,
    isLoading: mLoading,
    error: mError,
    reload: mReload,
  } = useMyMeasurements({ codes: [...BODY_CODES], pageSize: 100 });
  const latestByCode = useMemo(() => {
    const out: Record<string, MeasurementItemDto> = {};
    for (const item of items) {
      const code = item.metricCode.trim().toLowerCase();
      const prev = out[code];
      if (!prev || Date.parse(item.observedAt) >= Date.parse(prev.observedAt))
        out[code] = item;
    }
    return out;
  }, [items]);
  const ordered = BODY_CODES.map((code) => latestByCode[code]).filter(
    (m): m is MeasurementItemDto => Boolean(m),
  );
  // IMC estándar con peso y talla registrados (sin estimaciones).
  const bmi = useMemo(() => {
    const weight = latestByCode["weight"];
    const height = latestByCode["height"];
    if (!weight || !height) return null;
    const wUnit = `${weight.unitCode} ${weight.unitSymbol}`.toLowerCase();
    if (!wUnit.includes("kg")) return null;
    const meters = heightToMeters(height);
    if (!meters || meters <= 0) return null;
    const value = weight.value / (meters * meters);
    return Number.isFinite(value) ? value : null;
  }, [latestByCode]);
  const headerDate = ordered.length
    ? formatObservedAt(
        ordered.reduce((a, b) =>
          Date.parse(a.observedAt) >= Date.parse(b.observedAt) ? a : b,
        ).observedAt,
        locale,
      )
    : null;

  return (
    <Screen>
      <Scroll className="bp">
        <header className="bp-head">
          <div className="bp-head-top">
            <div>
              <span className="bp-kicker">{t("Composición corporal")}</span>
              <h1 className="bp-title">{t("Perfil corporal")}</h1>
              {headerDate && (
                <p className="bp-date">
                  {t("Último registro disponible")}: {headerDate}
                </p>
              )}
            </div>
            <span className="bp-badge" aria-hidden="true">
              <IonIcon icon={bodyOutline} />
            </span>
          </div>
        </header>

        <IonSegment
          className="bp-seg"
          value={view}
          aria-label={t("Perfil corporal")}
          onIonChange={(e) => {
            const next = e.detail.value;
            if (
              next === "composition" ||
              next === "evolution" ||
              next === "appearance"
            )
              setView(next);
          }}
        >
          <IonSegmentButton value="composition" style={{ minHeight: 44 }}>
            <IonLabel>{t("Composición")}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="evolution" style={{ minHeight: 44 }}>
            <IonLabel>{t("Mi evolución")}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="appearance" style={{ minHeight: 44 }}>
            <IonLabel>{t("Personalización")}</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {view === "composition" && (
          <>
            <div className="avatar-preview">
              <AvatarStage
                avatar={avatar}
                weights={weights}
                ownerKey={ownerKey}
                disabled={dataError}
                dataPhase={dataPhase}
                historyMs={progress.historyMs}
                bodyState={state ?? (isEmptyWeight ? neutralBody : null)}
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
            <p className="bp-avatar-note">
              {t("El avatar refleja solo tu evolución de peso.")}
            </p>
            {isEmptyWeight && (
              <p role="status">
                {t(
                  "No hay registros de peso suficientes para mostrar tu evolución.",
                )}
              </p>
            )}

            <div className="sec">{t("Mediciones corporales")}</div>
            {mLoading && (
              <div aria-busy="true" role="status">
                <IonSpinner aria-hidden="true" />
                <IonSkeletonText animated style={{ width: "100%" }} />
                <IonSkeletonText animated style={{ width: "100%" }} />
                <IonSkeletonText animated style={{ width: "80%" }} />
              </div>
            )}
            {mError && !mLoading && (
              <>
                <p role="alert">{t("No se pudieron cargar las mediciones")}</p>
                <IonButton
                  style={{ minHeight: 44 }}
                  fill="clear"
                  onClick={() => void mReload()}
                >
                  {t("Reintentar")}
                </IonButton>
              </>
            )}
            {!mLoading && !mError && ordered.length === 0 && (
              <p role="status">
                {t("Aún no hay mediciones corporales registradas.")}
              </p>
            )}
            {!mLoading && !mError && ordered.length > 0 && (
              <>
                <IonList className="bp-list" lines="none">
                  {ordered.map((m) => {
                    const code = m.metricCode.trim().toLowerCase();
                    const meta = SOURCE_META[m.source];
                    return (
                      <IonItem key={m.id} lines="none" className="bp-meas">
                        <span className="bp-meas-ico" aria-hidden="true">
                          <IonIcon icon={BODY_ICONS[code] ?? pulseOutline} />
                        </span>
                        <IonLabel>
                          <h3>{t(BODY_LABELS[code] ?? m.metricName)}</h3>
                          <p>
                            <IonBadge
                              className={`hc-src ${meta?.className ?? "hc-src-prof"}`}
                            >
                              {meta ? (
                                <IonIcon icon={meta.icon} aria-hidden="true" />
                              ) : null}
                              {SOURCE_LABELS[m.source]
                                ? t(SOURCE_LABELS[m.source])
                                : m.source}
                            </IonBadge>
                          </p>
                        </IonLabel>
                        <IonNote slot="end" className="bp-note">
                          <b>
                            {formatMeasurementValue(
                              m.value,
                              m.unitSymbol,
                              locale,
                            )}
                          </b>
                          <span>{formatObservedAt(m.observedAt, locale)}</span>
                        </IonNote>
                      </IonItem>
                    );
                  })}
                </IonList>
                {bmi != null && (
                  <div className="bp-bmi">
                    <div className="bp-bmi-top">
                      <span className="bp-bmi-ico" aria-hidden="true">
                        <IonIcon icon={speedometerOutline} />
                      </span>
                      <div className="bp-bmi-id">
                        <small>{t("IMC")}</small>
                        <strong>
                          {bmi.toLocaleString(locale, {
                            maximumFractionDigits: 1,
                          })}
                          <i>kg/m²</i>
                        </strong>
                      </div>
                    </div>
                    <div className="bp-bmi-scale" aria-hidden="true">
                      <div className="bp-bmi-track">
                        <span
                          className="bp-bmi-healthy"
                          style={{
                            left: `${((BMI_REF_LO - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100}%`,
                            width: `${((BMI_REF_HI - BMI_REF_LO) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100}%`,
                          }}
                        />
                        <span
                          className="bp-bmi-pin"
                          style={{
                            left: `${Math.min(100, Math.max(0, ((bmi - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="bp-bmi-legend">
                        <span>{BMI_SCALE_MIN}</span>
                        <span>
                          {t("Rango de referencia")}{" "}
                          {BMI_REF_LO.toLocaleString(locale, {
                            maximumFractionDigits: 1,
                          })}
                          –
                          {BMI_REF_HI.toLocaleString(locale, {
                            maximumFractionDigits: 1,
                          })}
                        </span>
                        <span>{BMI_SCALE_MAX}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {view === "evolution" && (
          <WeightEvolutionSection
            records={progress.records}
            status={progress.status}
            error={progress.error}
            canRecordWeight={canRecordWeight}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onRefresh={handleRefreshWeight}
            onSaved={handleSavedWeight}
            showEvolution
          />
        )}

        {view === "appearance" && (
          <section aria-label={t("Personalización del avatar")}>
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
                  style={{ minHeight: 44 }}
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
        )}

        {metrics && (
          <div hidden data-avatar-metrics={JSON.stringify(metrics)} />
        )}
      </Scroll>
    </Screen>
  );
}
