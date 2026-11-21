import { Browser } from "@capacitor/browser";
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonProgressBar,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  arrowBackOutline,
  arrowForwardOutline,
  bluetoothOutline,
  checkmarkCircleOutline,
  fitnessOutline,
  footstepsOutline,
  heartOutline,
  lockClosedOutline,
  moonOutline,
  phonePortraitOutline,
  pulseOutline,
  settingsOutline,
  speedometerOutline,
  watchOutline,
} from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, Scroll } from "../components/Screen";
import { WeightRecordModal } from "../components/avatar/WeightRecordModal";
import { useApp } from "../context/AppContext";
import { useHealth } from "../context/HealthContext";
import { programKeys } from "../hooks/queryKeys";
import { useI18n } from "../i18n/I18nContext";
import type { HealthMetric } from "../services/health/health-service";
import { formatLocalizedDate } from "../utils/dates";
import { WEARABLE_ENABLED } from "../utils/features";
import { PRIVACY_POLICY_URL } from "../utils/legalLinks";

const INSTALL_URL =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

const categories: {
  metric: HealthMetric;
  label: string;
  purpose: string;
  icon: string;
}[] = [
  {
    metric: "steps",
    label: "Pasos",
    purpose: "Para tu meta diaria de actividad.",
    icon: footstepsOutline,
  },
  {
    metric: "distance",
    label: "Distancia",
    purpose: "Para ver cuánto te moviste.",
    icon: speedometerOutline,
  },
  {
    metric: "active_energy",
    label: "Energía activa",
    purpose: "Para estimar tu actividad del día.",
    icon: fitnessOutline,
  },
  {
    metric: "heart_rate",
    label: "Frecuencia cardíaca",
    purpose: "Para seguir tu tendencia durante el día.",
    icon: heartOutline,
  },
  {
    metric: "resting_heart_rate",
    label: "Frecuencia cardíaca en reposo",
    purpose: "Para ver tu tendencia semanal de bienestar.",
    icon: pulseOutline,
  },
  {
    metric: "sleep",
    label: "Sueño",
    purpose: "Para acompañar tus hábitos de descanso.",
    icon: moonOutline,
  },
];

export function HealthAccessoryPage() {
  const { t, lang } = useI18n();
  const { navigate, healthReturnTo, showToast } = useApp();
  const health = useHealth();
  const queryClient = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const authorizeButton = useRef<HTMLIonButtonElement>(null);
  const confirmed = useRef(false);
  const actionInProgress = useRef(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const locale = lang === "en" ? "en-US" : "es-CO";
  const ios = health?.source === "apple-health";
  const native = Boolean(health?.source);
  const available = health?.availability === "available";
  const denied = health?.permission === "denied";
  const settingsRequired = denied && health.permissionRequests >= 2;
  const needsPermission = health?.permission === "not-requested";
  const platform = ios ? t("Apple Health") : t("Health Connect");
  const busy = health?.syncing || health?.availability === null;
  const install = health?.availability === "not-installed";
  const unavailable = !native || health?.availability === "unavailable";
  const hasData = Boolean(health?.summary.length);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const steps = [
    {
      title: t("Abre la app de tu accesorio"),
      body: t("Comprueba que tiene datos recientes de hoy o de anoche."),
    },
    {
      title: ios
        ? t("Activa la sincronización con Apple Health")
        : t("Activa la sincronización con Health Connect"),
      body: ios
        ? t(
            'En los ajustes de esa app, busca Apple Health o "Apps conectadas" y permite que escriba datos.',
          )
        : t(
            "En los ajustes de esa app, busca Health Connect y permite que escriba datos.",
          ),
    },
    {
      title: t("Vuelve y autoriza la lectura"),
      body: t("Elige las categorías que quieres compartir con Copp Adresd."),
    },
  ];
  const guides = [
    [
      t("Oura"),
      ios
        ? t("En Oura, ve a Ajustes > Intercambio de datos > Apple Health.")
        : t("En Oura, ve a Ajustes > Intercambio de datos > Health Connect."),
    ],
    [
      t("Ultrahuman"),
      ios
        ? t(
            "En Ultrahuman, ve a Perfil > Ajustes > Conectar con otras apps y busca Apple Health.",
          )
        : t(
            "En Ultrahuman, ve a Perfil > Ajustes > Conectar con otras apps y busca Health Connect.",
          ),
    ],
    [
      t("Garmin"),
      ios
        ? t(
            "En Garmin Connect, ve a Más > Ajustes > Apps conectadas y busca Apple Health.",
          )
        : t(
            "En Garmin Connect, ve a Más > Ajustes > Apps conectadas y busca Health Connect.",
          ),
    ],
    ...(ios
      ? [
          [
            t("Apple Watch"),
            t(
              "Tu Apple Watch ya guarda datos en Apple Health. Solo falta el paso 3.",
            ),
          ],
          [
            t("Fitbit"),
            t(
              "Si tu app de Fitbit no ofrece compartir datos con Apple Health, puedes registrar a mano.",
            ),
          ],
        ]
      : [
          [
            t("Fitbit"),
            t(
              "En la app de Fitbit, busca Health Connect en las opciones de conexión de apps.",
            ),
          ],
          [
            t("Samsung Health"),
            t(
              "En Samsung Health, ve a Ajustes > Health Connect y habilita las categorías para compartir.",
            ),
          ],
        ]),
  ];

  let title = t("Conecta tu anillo o banda en 3 pasos");
  let detail = "";
  if (unavailable) {
    title = t("No disponible en este dispositivo");
    detail = t("Puedes seguir tu programa registrando tus datos a mano.");
  } else if (install) {
    title = t("Necesitas Health Connect");
    detail = t(
      "Instala o actualiza Health Connect desde Google Play y vuelve aquí.",
    );
  } else if (busy) {
    title = t("Sincronizando tus datos…");
  } else if (denied) {
    title = t("No tenemos permiso de lectura");
    detail = settingsRequired
      ? t("Activa el permiso en Health Connect > Permisos de apps > Copp Adresd.")
      : t("Puedes activarlo en Health Connect o seguir a mano.");
  } else if (health?.error === "no-data") {
    title = t("Todavía no encontramos datos");
    detail = ios
      ? t(
          "Revisa el permiso en Salud y comprueba que la app de tu accesorio haya sincronizado datos recientes.",
        )
      : t("Abre la app de tu accesorio, sincronízala y toca Actualizar.");
  } else if (health?.error === "save-failed") {
    title = t("Leímos tus datos, pero faltan por guardar en el programa");
    detail = t("Toca Reintentar para guardar los datos pendientes.");
  } else if (health?.error === "save-unavailable") {
    title = t("Tus datos se muestran aquí. Se guardarán en tu programa cuando esté activo.");
  } else if (health?.error === "save-rejected") {
    title = t("Estos datos están disponibles aquí. No pudimos guardarlos en el programa.");
  } else if (health?.error === "settings-failed") {
    title = t("No pudimos abrir los ajustes");
  } else if (health?.error === "permission-unknown") {
    title = t("No pudimos comprobar el permiso de lectura");
  } else if (health?.error) {
    title = t("No pudimos leer tus datos");
    detail = t("Inténtalo de nuevo en un momento.");
  } else if (hasData) {
    title = t("Datos de bienestar actualizados");
  }

  const openLink = async (url: string) => {
    try {
      await Browser.open({ url });
    } catch {
      showToast(
        t("No se pudo abrir el sitio web. Inténtalo más tarde."),
        "err",
      );
    }
  };

  return (
    <Screen hideNav className="health-accessory">
      <header className="health-header">
        <IonButton
          fill="clear"
          aria-label={t("Volver")}
          onClick={() => navigate(healthReturnTo ?? "home")}
        >
          <IonIcon
            slot="icon-only"
            icon={arrowBackOutline}
            aria-hidden="true"
          />
        </IonButton>
        <h1 ref={heading} tabIndex={-1}>
          {t("Conecta tu accesorio")}
        </h1>
      </header>
      <Scroll noNav className="health-scroll">
        {native && (
          <section className="health-hero">
            <p>
              {ios
                ? t("Tus datos llegan a Copp Adresd a través de Apple Health.")
                : t(
                    "Tus datos llegan a Copp Adresd a través de Health Connect.",
                  )}
            </p>
            <div
              className="health-diagram"
              role="img"
              aria-label={
                ios
                  ? t(
                      "Tu accesorio guarda datos en Apple Health y Copp Adresd los lee con tu permiso.",
                    )
                  : t(
                      "Tu accesorio guarda datos en Health Connect y Copp Adresd los lee con tu permiso.",
                    )
              }
            >
              <span>
                <IonIcon icon={watchOutline} />
                <b>{t("Tu accesorio")}</b>
              </span>
              <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
              <span>
                <IonIcon icon={phonePortraitOutline} />
                <b>{platform}</b>
              </span>
              <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
              <span>
                <IonIcon icon={fitnessOutline} />
                <b>{t("Copp Adresd")}</b>
              </span>
            </div>
          </section>
        )}

        {native && !unavailable && (
          <section className="health-panel">
            <ol className="health-steps">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span aria-hidden="true">{index + 1}</span>
                  <div>
                    <h2>{step.title}</h2>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <IonAccordionGroup className="health-guide">
              <IonAccordion value="apps">
                <IonItem slot="header" lines="none">
                  <IonLabel className="ion-text-wrap">
                    {t("Ver guía de mi app")}
                  </IonLabel>
                </IonItem>
                <IonList slot="content">
                  {guides.map(([name, instructions]) => (
                    <IonItem key={name}>
                      <IonLabel className="ion-text-wrap">
                        <h3>{name}</h3>
                        <p>{instructions}</p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </IonAccordion>
            </IonAccordionGroup>
          </section>
        )}

        <section
          className="health-panel health-platform"
          aria-labelledby="health-status"
        >
          {native && (
            <p className="health-platform-name">
              <IonIcon icon={heartOutline} aria-hidden="true" />
              {platform}
            </p>
          )}
          <div aria-live="polite" aria-atomic="true">
            <h2 id="health-status">{title}</h2>
            {detail && <p>{detail}</p>}
            {health?.lastSync && (
              <p>
                {t("Última sincronización: {when}", {
                  when: new Intl.DateTimeFormat(locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(health.lastSync),
                })}
              </p>
            )}
          </div>
          {busy && <IonProgressBar type="indeterminate" aria-hidden="true" />}
          {available && !hasData && (
            <div className="health-chips">
              {categories.map(({ metric, label }) => (
                <IonChip key={metric}>{t(label)}</IonChip>
              ))}
            </div>
          )}
          {hasData && health && (
            <dl className="health-results">
              {categories.map(({ metric, label }) => {
                const recent = [...health.summary]
                  .reverse()
                  .find((day) => day.values[metric] != null);
                if (!recent) return null;
                const value = recent.values[metric]!;
                const unit =
                  metric === "sleep"
                    ? t("min")
                    : metric === "distance"
                      ? t("km")
                      : metric === "active_energy"
                        ? t("kcal")
                        : metric === "steps"
                          ? ""
                          : t("lpm");
                const formatted = new Intl.NumberFormat(locale, {
                  maximumFractionDigits: metric === "distance" ? 2 : 0,
                }).format(metric === "distance" ? value / 1_000 : value);
                return (
                  <div key={metric}>
                    <dt>{t(label)}</dt>
                    <dd>
                      {formatted} {unit}
                      <small>{formatLocalizedDate(recent.date, locale)}</small>
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {install && (
            <IonButton
              expand="block"
              onClick={() => void openLink(INSTALL_URL)}
            >
              {t("Instalar Health Connect")}
            </IonButton>
          )}
          {available && (
            <div className="health-actions">
              {!settingsRequired && (needsPermission || denied || health.error === "permission-unknown") && (
                <IonButton
                  ref={authorizeButton}
                  expand="block"
                  disabled={busy}
                  onClick={() => setPermissionsOpen(true)}
                >
                  {denied ? t("Autorizar de nuevo") : t("Autorizar lectura")}
                </IonButton>
              )}
              {!needsPermission && !denied && health.error !== "permission-unknown" && (
                <IonButton
                  expand="block"
                  disabled={busy}
                  onClick={() => void health.sync(health.error === "save-failed" ? "retry" : "manual")}
                >
                  <IonIcon
                    slot="start"
                    icon={checkmarkCircleOutline}
                    aria-hidden="true"
                  />
                  {health.error === "save-failed" || health.error === "read-failed"
                    ? t("Reintentar")
                    : t("Actualizar")}
                </IonButton>
              )}
              <IonButton
                fill={settingsRequired ? "solid" : "outline"}
                expand="block"
                onClick={() => void health.openSettings()}
              >
                <IonIcon
                  slot="start"
                  icon={settingsOutline}
                  aria-hidden="true"
                />
                {ios
                  ? t("Revisar permisos en Salud")
                  : t("Abrir Health Connect")}
              </IonButton>
              <p>
                {ios
                  ? t(
                      "Puedes quitar el permiso cuando quieras en Ajustes > Salud > Acceso a datos y dispositivos > Copp Adresd.",
                    )
                  : t(
                      "Puedes quitar el permiso cuando quieras en Health Connect > Permisos de apps > Copp Adresd.",
                    )}
              </p>
            </div>
          )}
          {!available && !install && native && !unavailable && !busy && (
            <IonButton expand="block" onClick={() => void health?.sync()}>
              {t("Reintentar")}
            </IonButton>
          )}
        </section>

        <section className="health-panel health-manual">
          <h2>{t("Registrar a mano")}</h2>
          <p>
            {native
              ? t(
                  "Si la app de tu accesorio no comparte datos con {platform}, puedes seguir el programa con registro manual.",
                  { platform },
                )
              : t("Puedes seguir tu programa registrando tus datos a mano.")}
          </p>
          <IonButton
            fill="outline"
            expand="block"
            onClick={() => setManualOpen(true)}
          >
            {t("Registrar peso")}
          </IonButton>
          <IonButton fill="clear" expand="block" onClick={() => navigate("program-emocional")}>
            {t("Registrar mi descanso")}
          </IonButton>
        </section>

        {native && (
          <section className="health-privacy">
            <h2>
              <IonIcon icon={lockClosedOutline} aria-hidden="true" />
              {t("Solo leemos. Tú decides.")}
            </h2>
            <p>
              {t(
                "Copp Adresd solo lee los datos que autorices. No vendemos tus datos ni los usamos para publicidad.",
              )}
            </p>
            <IonButton
              fill="clear"
              onClick={() => void openLink(PRIVACY_POLICY_URL)}
            >
              {t("Política de privacidad")}
            </IonButton>
          </section>
        )}
        {WEARABLE_ENABLED && (
          <IonButton fill="clear" expand="block" onClick={() => navigate("bt")}>
            <IonIcon icon={bluetoothOutline} slot="start" aria-hidden="true" />
            {t("Conectar por Bluetooth")}
          </IonButton>
        )}
      </Scroll>

      {manualOpen && (
        <WeightRecordModal
          onClose={() => setManualOpen(false)}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: programKeys.metricsHistory,
            });
          }}
        />
      )}
      <IonModal
        isOpen={permissionsOpen}
        className="health-permission-sheet"
        breakpoints={[0, 0.82, 1]}
        initialBreakpoint={0.82}
        aria-labelledby="health-permission-title"
        onDidDismiss={() => {
          setPermissionsOpen(false);
          actionInProgress.current = false;
          if (confirmed.current) {
            confirmed.current = false;
            void health?.sync("request");
          }
          authorizeButton.current?.focus();
        }}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle id="health-permission-title">
              {t("Esto es lo que leeremos")}
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p>
            {ios
              ? t(
                  "Después verás la ventana de Apple Health. Puedes activar solo las categorías que quieras.",
                )
              : t(
                  "Después verás la ventana de Health Connect. Puedes activar solo los permisos que quieras.",
                )}
          </p>
          <IonList>
            {categories.map(({ metric, label, purpose, icon }) => (
              <IonItem key={metric}>
                <IonIcon slot="start" icon={icon} aria-hidden="true" />
                <IonLabel className="ion-text-wrap">
                  <h3>{t(label)}</h3>
                  <p>{t(purpose)}</p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
          <p>
            {t(
              "Guardamos tus pasos, distancia, energía activa y sueño en Copp Adresd para mostrar tu progreso. Las lecturas de frecuencia cardíaca se muestran en este dispositivo.",
            )}
          </p>
          <IonButton
            fill="clear"
            onClick={() => void openLink(PRIVACY_POLICY_URL)}
          >
            {t("Política de privacidad")}
          </IonButton>
          <IonButton
            expand="block"
            onClick={() => {
              if (actionInProgress.current) return;
              actionInProgress.current = true;
              confirmed.current = true;
              setPermissionsOpen(false);
            }}
          >
            {t("Continuar")}
          </IonButton>
          <IonButton
            fill="clear"
            expand="block"
            onClick={() => setPermissionsOpen(false)}
          >
            {t("Ahora no")}
          </IonButton>
        </IonContent>
      </IonModal>
    </Screen>
  );
}
