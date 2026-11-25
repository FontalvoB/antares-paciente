import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Browser } from "@capacitor/browser";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { openOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { useI18n } from "../i18n/I18nContext";
import { onSessionInvalid } from "../utils/authApi";
import { PRIVACY_POLICY_URL } from "../utils/legalLinks";
import {
  acceptAiDisclosure,
  aiDisclosureAccepted,
  aiDisclosureAcceptedAt,
  aiDisclosureUserId,
  registerAiDisclosurePrompt,
  withdrawAiDisclosure,
  type AiDisclosureScope,
} from "../utils/aiDisclosure";

interface AiDisclosureContextValue {
  /** Abre el aviso para revisar el estado o retirar el permiso desde Perfil. */
  openAiDisclosure: () => void;
  accepted: boolean;
}

const AiDisclosureContext = createContext<AiDisclosureContextValue>({
  openAiDisclosure: () => {},
  accepted: false,
});
export const useAiDisclosure = () => useContext(AiDisclosureContext);

type PendingDecision = { resolve: (accepted: boolean) => void };

const scopeLabels: Record<AiDisclosureScope, string> = {
  chat: "Chat con IA",
  voice: "Asistente de voz",
  food: "Análisis de fotos de alimentos",
  lab: "Análisis de exámenes de laboratorio",
  "patient-ai": "Análisis y planes personalizados con IA",
};

export function AiDisclosureProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [presentation, setPresentation] = useState(0);
  const [scope, setScope] = useState<AiDisclosureScope | null>(null);
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState(() => aiDisclosureAccepted());
  const [acceptedAt, setAcceptedAt] = useState<string | null>(() =>
    aiDisclosureAcceptedAt(),
  );
  const pending = useRef<PendingDecision | null>(null);
  const openRef = useRef(false);
  const subject = useRef<string | null>(null);
  const presentationRef = useRef(0);

  const close = useCallback((acceptedDecision?: boolean) => {
    pending.current?.resolve(acceptedDecision === true);
    pending.current = null;
    openRef.current = false;
    setOpen(false);
    setChecked(false);
    setScope(null);
  }, []);

  const refresh = useCallback(() => {
    setAccepted(aiDisclosureAccepted());
    setAcceptedAt(aiDisclosureAcceptedAt());
  }, []);

  useEffect(
    () =>
      registerAiDisclosurePrompt(async (requestedScope, _locale, signal) => {
        if (openRef.current || signal?.aborted) return false;
        const identity = aiDisclosureUserId();
        if (!identity) return false;
        if (aiDisclosureAccepted(identity)) return true;
        subject.current = identity;
        openRef.current = true;
        setPresentation(++presentationRef.current);
        setScope(requestedScope);
        setChecked(false);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
          const onAbort = () => close();
          pending.current = {
            resolve: (decision) => {
              signal?.removeEventListener("abort", onAbort);
              resolve(decision);
            },
          };
          signal?.addEventListener("abort", onAbort, { once: true });
        });
      }),
    [close],
  );

  useEffect(() => {
    const reset = () => {
      close();
      refresh();
    };
    const stopSession = onSessionInvalid(reset);
    return () => {
      stopSession();
      reset();
    };
  }, [close, refresh]);

  const openAiDisclosure = useCallback(() => {
    if (openRef.current) return;
    subject.current = aiDisclosureUserId();
    openRef.current = true;
    setPresentation(++presentationRef.current);
    setScope(null);
    setChecked(false);
    setOpen(true);
    refresh();
  }, [refresh]);

  const identityMatches = () => subject.current === aiDisclosureUserId();

  const accept = () => {
    if (!checked || !identityMatches()) return;
    acceptAiDisclosure();
    refresh();
    if (pending.current) close(true);
    else setOpen(false);
  };

  const decline = () => close(false);
  const withdraw = () => {
    if (!identityMatches()) return;
    withdrawAiDisclosure();
    refresh();
    setChecked(false);
  };

  const openPrivacyPolicy = async () => {
    try {
      await Browser.open({
        url: PRIVACY_POLICY_URL,
        presentationStyle: "popover",
      });
    } catch {
      // El enlace también está disponible en Perfil; no se bloquea la decisión.
    }
  };

  return (
    <AiDisclosureContext.Provider value={{ openAiDisclosure, accepted }}>
      {children}
      <IonModal
        key={presentation}
        isOpen={open}
        backdropDismiss={!pending.current}
        onDidDismiss={() => {
          if (presentationRef.current === presentation) close(false);
        }}
        aria-label={t("Uso de inteligencia artificial")}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t("Uso de inteligencia artificial")}</IonTitle>
            <IonButton slot="end" fill="clear" onClick={() => close(false)}>
              {t("Cerrar")}
            </IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p>
            {t(
              "Antes de usar las funciones de IA, queremos que sepas qué datos se envían y quién los recibe.",
            )}
          </p>
          {scope && (
            <p role="status">
              <strong>
                {t("Vas a usar: {scope}", { scope: t(scopeLabels[scope]) })}
              </strong>
            </p>
          )}

          <h2>{t("Qué datos se envían")}</h2>
          <p>
            {t(
              "Los mensajes que escribes en el chat, el audio de tu voz cuando usas el asistente, las fotos de comidas o de exámenes de laboratorio que decidas analizar y el contexto de tu perfil y plan necesario para responderte. No enviamos tu documento, correo ni teléfono; el contexto de tu perfil se limita a lo necesario para responder.",
            )}
          </p>
          <p>
            {t("Si sincronizas datos de bienestar desde Apple Health o Health Connect y usas Vita, el contexto puede incluir pasos, distancia, energía activa y sueño para personalizar la respuesta.")}
          </p>

          <h2>{t("A quién se envían")}</h2>
          <p>
            {t(
              "A proveedores de servicios de IA que procesan los datos por cuenta de Agentic Wellness IA:",
            )}
          </p>
          <IonList>
            <IonItem>
              <IonLabel className="ion-text-wrap">
                <h3>Anthropic, PBC</h3>
                <p>{t("Modelos Claude para texto y análisis")}</p>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonLabel className="ion-text-wrap">
                <h3>OpenAI, L.L.C.</h3>
                <p>{t("Modelos GPT para texto y análisis de imágenes")}</p>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonLabel className="ion-text-wrap">
                <h3>ElevenLabs, Inc.</h3>
                <p>{t("Voz del asistente")}</p>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonLabel className="ion-text-wrap">
                <h3>Amazon Web Services</h3>
                <p>{t("Alojamiento y almacenamiento en Estados Unidos")}</p>
              </IonLabel>
            </IonItem>
          </IonList>

          <h2>{t("Para qué y cuánto tiempo")}</h2>
          <p>
            {t(
              "Para generar respuestas, transcribir voz, analizar imágenes y apoyar tu plan. Las conversaciones quedan en tu historial y puedes borrarlas. No se usan para publicidad ni se venden.",
            )}
          </p>

          <h2>{t("Tus derechos")}</h2>
          <p>
            {t(
              "Puedes rechazar este permiso y seguir usando la app sin las funciones de IA. Puedes retirarlo cuando quieras en Perfil > Privacidad de IA.",
            )}
          </p>
          <p>
            <strong>
              {t(
                "La IA no diagnostica, no prescribe ni sustituye a tu equipo de salud.",
              )}
            </strong>
          </p>

          <IonButton
            fill="clear"
            expand="block"
            onClick={() => void openPrivacyPolicy()}
          >
            <IonIcon slot="start" icon={openOutline} aria-hidden="true" />
            {t("Leer la política de privacidad")}
          </IonButton>

          {accepted ? (
            <>
              <p role="status">
                <IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />{" "}
                {acceptedAt
                  ? t("Permiso concedido el {date}", {
                      date: new Date(acceptedAt).toLocaleDateString(),
                    })
                  : t("Permiso concedido")}
              </p>
              <IonButton
                expand="block"
                fill="outline"
                color="danger"
                onClick={withdraw}
              >
                {t("Retirar permiso de IA")}
              </IonButton>
            </>
          ) : (
            <>
              <IonCheckbox
                checked={checked}
                onIonChange={(event) => setChecked(event.detail.checked)}
                labelPlacement="end"
                style={{ minHeight: 48, marginBlock: 16 }}
              >
                {t(
                  "Entiendo qué datos se envían y quién los recibe, y doy mi permiso para usar las funciones de IA.",
                )}
              </IonCheckbox>
              <IonButton
                expand="block"
                className="bt bt-primary"
                disabled={!checked}
                onClick={accept}
              >
                {t("Aceptar y continuar")}
              </IonButton>
            </>
          )}
          {!accepted && (
            <IonButton expand="block" fill="clear" onClick={decline}>
              {t("No permitir")}
            </IonButton>
          )}
        </IonContent>
      </IonModal>
    </AiDisclosureContext.Provider>
  );
}
