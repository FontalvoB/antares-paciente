import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { IonAlert, IonButton, IonCheckbox } from "@ionic/react";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { formatDateForDisplay, toLocalISODate } from "../../../utils/dates";
import { registerForPush, unregisterPushDevice } from "../../../utils/pushNotifications";
import { resetWellnessGeneration } from "../generation/generation-store";
import { wellnessOnboardingService } from "../services/wellness-onboarding-service";
import {
  deleteWellnessData, readWellnessConsent, requireWellnessConsent, saveWellnessConsent,
  WELLNESS_CONSENT_VERSIONS, wellnessPrivacyActor,
} from "./privacy-consent-store";
import type { WellnessConsentScope } from "./privacy-consent-store";
import { downloadWellnessExport } from "./wellness-export";
import "./wellness-privacy.css";

const DRAFT = "Borrador para revisión legal";
const SAVE_ERROR = "No pudimos guardar tu decisión. Intenta de nuevo.";
const PURPOSE = "Usamos estos datos para adaptar tu plan, guardar tus registros y mostrar tu progreso.";
const SHARING = "Esta versión guarda el plan y los registros de bienestar en el dispositivo. Si una función sincroniza datos, los recibe el servidor de COPP-ADRESD (ERP) y puede verlos el profesional autorizado que te acompaña. No vendemos tus datos de bienestar.";
const SENSITIVE = "Registramos tu edad, peso, cintura, las molestias o los cambios que notas en tu cuerpo, las respuestas a los cuestionarios PAR-Q y NQS, tus signos vitales y tus planes de bienestar.";
const SCOPES: Record<WellnessConsentScope, { title: string; label: string; description: string }> = {
  "sensitive-data": {
    title: "Datos sensibles",
    label: "Acepto el uso de mis datos sensibles para mi plan de bienestar.",
    description: "Puedes retirar este consentimiento al desmarcar la casilla.",
  },
  "apple-health": {
    title: "Apple Health",
    label: "Acepto conectar Apple Health para ver mi actividad y progreso.",
    description: "Al activar Apple Health, te pediremos acceso de lectura a pasos, distancia, energía de actividad, sueño, frecuencia cardíaca y frecuencia cardíaca en reposo. Podrás elegir qué compartir con la app. Los resúmenes que se sincronicen irán al servidor de COPP-ADRESD (ERP) para tu seguimiento.",
  },
  notifications: {
    title: "Notificaciones del dispositivo",
    label: "Acepto registrar este dispositivo para recibir notificaciones.",
    description: "Si activas las notificaciones, el servidor de COPP-ADRESD guarda un identificador del dispositivo para enviarte avisos. Puedes cambiar el permiso en los ajustes del dispositivo.",
  },
};

function ConsentChoice({ scope, actor, onChange }: {
  scope: WellnessConsentScope;
  actor: string;
  onChange?: () => void;
}) {
  const { t } = useI18n();
  const detail = useId();
  const [error, setError] = useState(false);
  const receipt = readWellnessConsent(scope, actor);
  const copy = SCOPES[scope];

  return (
    <div className="wellness-privacy-choice">
      <div id={detail}>
        <p>{t(copy.description)}</p>
        <p className="wellness-privacy-meta">
          {t("Versión {version}", { version: WELLNESS_CONSENT_VERSIONS[scope] })}
          {" · "}
          {receipt ? (
            <time dateTime={receipt.acceptedAt}>
              {t("Aceptado el {date}", { date: formatDateForDisplay(toLocalISODate(new Date(receipt.acceptedAt))) })}
            </time>
          ) : t("Pendiente de aceptación.")}
        </p>
      </div>
      <IonCheckbox
        checked={Boolean(receipt)}
        aria-describedby={detail}
        onIonChange={(event) => {
          try {
            saveWellnessConsent(scope, actor, event.detail.checked);
            if (scope === "notifications" && !event.detail.checked) void unregisterPushDevice();
            setError(false);
            onChange?.();
          } catch {
            setError(true);
            event.target.checked = Boolean(receipt);
          }
        }}
      >
        {t(copy.label)}
      </IonCheckbox>
      {error && <p role="alert" className="wellness-privacy-error">{t(SAVE_ERROR)}</p>}
    </div>
  );
}

export function SensitiveDataGate({ actor, onBack, standalone = false, children }: {
  actor: string;
  onBack: () => void;
  standalone?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [ready, setReady] = useState(() => Boolean(readWellnessConsent("sensitive-data", actor)));
  const [, refresh] = useState(0);
  const receipt = readWellnessConsent("sensitive-data", actor);
  if (ready && receipt) return children;
  const content = (
    <section className="wellness-privacy-card">
      {standalone ? <h1>{t("Datos sensibles")}</h1> : <h2>{t("Datos sensibles")}</h2>}
      <p className="wellness-privacy-draft">{t(DRAFT)}</p>
      <p>{t(SENSITIVE)}</p>
      <p>{t(PURPOSE)}</p>
      <p>{t(SHARING)}</p>
      <ConsentChoice scope="sensitive-data" actor={actor} onChange={() => refresh((value) => value + 1)} />
      <IonButton expand="block" disabled={!receipt} onClick={() => setReady(true)}>{t("Continuar")}</IonButton>
      <IonButton fill="clear" onClick={onBack}>{t("Volver")}</IonButton>
    </section>
  );
  return standalone ? (
    <Screen>
      <Scroll className="wellness-privacy-scroll">
        <main className="wellness-privacy">{content}</main>
      </Scroll>
    </Screen>
  ) : content;
}

export function SensitiveDataScreen({ children }: { children: ReactNode }) {
  const { user, navigate } = useApp();
  const actor = wellnessPrivacyActor(user);
  return (
    <SensitiveDataGate key={actor} standalone actor={actor} onBack={() => navigate("home")}>
      {children}
    </SensitiveDataGate>
  );
}

export function WellnessPrivacy() {
  const { user, navigate } = useApp();
  const actor = wellnessPrivacyActor(user);
  const { t, lang } = useI18n();
  const title = useRef<HTMLHeadingElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [, refresh] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const native = Capacitor.isNativePlatform();

  useEffect(() => { title.current?.focus(); }, []);

  const update = () => refresh((value) => value + 1);
  const exportData = async () => {
    setExporting(true);
    setStatus("");
    setError("");
    try {
      await downloadWellnessExport(actor);
      if (!native) setStatus(t("Tu archivo JSON está listo."));
    } catch {
      setError(t("No pudimos exportar tus datos. Intenta de nuevo."));
    } finally {
      setExporting(false);
    }
  };

  const deleteData = () => {
    setStatus("");
    setError("");
    try {
      deleteWellnessData(actor);
      wellnessOnboardingService.clearDraft();
      resetWellnessGeneration();
      if (native) void unregisterPushDevice();
      setStatus(t("Se borraron los datos de bienestar de este dispositivo. Tu sesión sigue abierta."));
    } catch {
      setError(t("No pudimos borrar todos tus datos. Intenta de nuevo."));
    } finally {
      update();
    }
  };

  return (
    <Screen>
      <Scroll className="wellness-privacy-scroll">
        <main className="wellness-privacy">
          <header>
            <IonButton fill="outline" onClick={() => navigate("prof")}>{t("Volver al perfil")}</IonButton>
            <h1 ref={title} tabIndex={-1}>{t("Privacidad y datos")}</h1>
            <p className="wellness-privacy-draft">{t(DRAFT)}</p>
          </header>

          <section className="wellness-privacy-card">
            <h2>{t("Qué recogemos")}</h2>
            <p>{t(SENSITIVE)}</p>
            <h2>{t("Para qué los usamos")}</h2>
            <p>{t(PURPOSE)}</p>
            <h2>{t("Con quién los compartimos")}</h2>
            <p>{t(SHARING)}</p>
          </section>

          <section className="wellness-privacy-card">
            <h2>{t("Consentimientos y permisos")}</h2>
            <p>{t("La app solicita cada permiso cuando eliges usar la función que lo necesita.")}</p>
            {(Object.keys(SCOPES) as WellnessConsentScope[]).filter((scope) => native || scope !== "notifications").map((scope) => (
              <div key={scope} className="wellness-privacy-scope">
                <h3>{t(SCOPES[scope].title)}</h3>
                <ConsentChoice scope={scope} actor={actor} onChange={update} />
                {scope === "notifications" && readWellnessConsent(scope, actor) && (
                  <IonButton fill="outline" expand="block" onClick={() => {
                    if (!requireWellnessConsent(scope, actor, update)) return;
                    void registerForPush({ language: lang, onOpenHome: () => navigate("home"), canPrompt: () => Boolean(readWellnessConsent(scope, actor)) });
                  }}>
                    {t("Activar notificaciones")}
                  </IonButton>
                )}
              </div>
            ))}
          </section>

          <section className="wellness-privacy-card">
            <h2>{t("Tus datos en este dispositivo")}</h2>
            <p>{t("Puedes descargar los registros locales en JSON o borrarlos de este dispositivo. Para datos ya enviados al ERP o a tu profesional, solicita la copia o el borrado a COPP-ADRESD.")}</p>
            <p>{t("El archivo puede contener información sensible. Guárdalo en un lugar seguro.")}</p>
            <div className="wellness-privacy-actions">
              <IonButton expand="block" disabled={exporting} onClick={() => void exportData()}>
                {t("Exportar mis datos")}
              </IonButton>
              <IonButton expand="block" fill="outline" className="wellness-privacy-delete" onClick={() => setConfirm(true)}>
                {t("Borrar mis datos")}
              </IonButton>
            </div>
            <p role="status" aria-atomic="true">{status}</p>
            {error && <p role="alert" className="wellness-privacy-error">{error}</p>}
          </section>
        </main>
      </Scroll>
      <IonAlert
        className="wellness-privacy-alert"
        isOpen={confirm}
        header={t("¿Borrar los datos de bienestar?")}
        message={t("Se borrarán los datos de bienestar de este dispositivo. El registro local conservará tus decisiones de consentimiento y la fecha del borrado. Tu sesión seguirá abierta.")}
        backdropDismiss={false}
        onDidPresent={(event) => {
          const alert = event.target;
          requestAnimationFrame(() => alert.querySelector<HTMLElement>("button.alert-button-role-cancel")?.focus());
        }}
        onDidDismiss={() => setConfirm(false)}
        buttons={[
          { text: t("Cancelar"), role: "cancel" },
          { text: t("Borrar datos"), role: "destructive", handler: deleteData },
        ]}
      />
    </Screen>
  );
}
