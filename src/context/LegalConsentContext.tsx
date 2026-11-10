import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { IonButton, IonCheckbox, IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonSpinner, IonTitle, IonToolbar } from "@ionic/react";
import { useI18n } from "../i18n/I18nContext";
import { getAccessToken, onSessionInvalid } from "../utils/authApi";
import { sessionUserId } from "../utils/sessionIdentity";
import {
  acceptLegalConsent, availableLegalDocument, createConsentRequestKey, getLegalConsents, legalConsentMessage,
  onLegalConsentChange, registerLegalConsentPrompt, withdrawLegalConsent,
  type ConsentLocale, type LegalConsentScope, type LegalConsentStatus,
} from "../utils/legalConsents";

const consentScopeLabels: Record<LegalConsentScope, string> = {
  program: "Participación en el programa", chat: "Chat con IA", voice: "Asistente de voz",
  food: "Análisis de fotos de alimentos", lab: "Análisis de exámenes de laboratorio",
  "patient-ai": "Análisis y planes personalizados con IA", sos: "Ubicación y servicios SOS",
};
const LegalConsentContext = createContext<{ openPrivacyChoices: () => void }>({ openPrivacyChoices: () => {} });
export const useLegalConsents = () => useContext(LegalConsentContext);

type PendingDecision = { scope: LegalConsentScope; locale: ConsentLocale; resolve: (accepted: boolean) => void };

export function LegalConsentProvider({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [presentation, setPresentation] = useState(0);
  const presentationRef = useRef(0);
  const [selected, setSelected] = useState<LegalConsentScope | null>(null);
  const [locale, setLocale] = useState<ConsentLocale>(lang);
  const [status, setStatus] = useState<LegalConsentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<PendingDecision | null>(null);
  const requestGeneration = useRef(0);
  const openRef = useRef(false);
  const acceptanceKey = useRef<{ signature: string; key: string } | null>(null);
  const decisionRequest = useRef<AbortController | null>(null);
  const subject = useRef<string | null>(null);

  const close = useCallback(() => {
    if (!openRef.current && !pending.current) return;
    requestGeneration.current += 1;
    decisionRequest.current?.abort(); decisionRequest.current = null;
    pending.current?.resolve(false);
    pending.current = null;
    openRef.current = false;
    setOpen(false); setChecked(false); setSaving(false); setLoading(false);
    setStatus(null); setError(null); acceptanceKey.current = null;
  }, []);

  const load = useCallback(async (nextLocale: ConsentLocale) => {
    const generation = ++requestGeneration.current;
    setLoading(true); setChecked(false); setError(null);
    acceptanceKey.current = null;
    try {
      const result = await getLegalConsents(nextLocale);
      if (generation === requestGeneration.current) setStatus(result);
    } catch (failure) {
      if (generation === requestGeneration.current) {
        setStatus(null); setError(legalConsentMessage(failure));
      }
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, []);

  useEffect(() => registerLegalConsentPrompt(async (scope, requestedLocale, signal) => {
    // No superponer decisiones ni reutilizar una elección de otra función/cuenta.
    if (openRef.current || signal?.aborted) return false;
    const generation = requestGeneration.current;
    const identity = sessionUserId(getAccessToken());
    let current: LegalConsentStatus | null = null;
    let failureMessage: string | null = null;
    try {
      current = await getLegalConsents(requestedLocale, signal);
      if (generation !== requestGeneration.current || signal?.aborted || identity !== sessionUserId(getAccessToken())) return false;
      const requirement = current.scopes.find(item => item.scope === scope);
      if (requirement?.accepted && requirement.receiptId && availableLegalDocument(requirement, requestedLocale)) return true;
    } catch (failure) { failureMessage = legalConsentMessage(failure); }
    if (generation !== requestGeneration.current || signal?.aborted || openRef.current) return false;
    subject.current = identity;
    openRef.current = true;
    setPresentation(++presentationRef.current);
    setLocale(requestedLocale); setSelected(scope); setStatus(current);
    setChecked(false); setError(failureMessage); setOpen(true);
    return new Promise<boolean>(resolve => {
      const onAbort = () => close();
      const settle = (accepted: boolean) => { signal?.removeEventListener("abort", onAbort); resolve(accepted); };
      pending.current = { scope, locale: requestedLocale, resolve: settle };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }), [close]);

  useEffect(() => {
    const reset = () => { requestGeneration.current += 1; close(); };
    const stopSession = onSessionInvalid(reset);
    const stopChanges = onLegalConsentChange(scope => { if (scope === null) reset(); });
    return () => { stopSession(); stopChanges(); reset(); };
  }, [close]);
  useEffect(() => {
    // Un documento legal no se traduce ni hereda la aceptación de otro idioma.
    if (openRef.current && locale !== lang) close();
  }, [lang, locale, close]);

  const openPrivacyChoices = useCallback(() => {
    if (openRef.current) return;
    subject.current = sessionUserId(getAccessToken());
    openRef.current = true;
    setPresentation(++presentationRef.current);
    setLocale(lang); setSelected(null); setOpen(true);
    void load(lang);
  }, [lang, load]);
  const requirement = status?.scopes.find(item => item.scope === selected);
  const document = availableLegalDocument(requirement, locale);

  async function accept() {
    if (!checked || !requirement || !document || saving || loading) return;
    if (subject.current !== sessionUserId(getAccessToken())) { close(); return; }
    const generation = requestGeneration.current;
    const signature = `${selected}:${locale}:${document.versionId}:${requirement.disclosureId}`;
    // El reintento de la misma decisión conserva su clave; una versión nueva no.
    if (acceptanceKey.current?.signature !== signature) acceptanceKey.current = { signature, key: createConsentRequestKey() };
    setSaving(true); setError(null);
    const controller = new AbortController(); decisionRequest.current = controller;
    try {
      const current = await acceptLegalConsent(requirement, locale, acceptanceKey.current.key, controller.signal);
      if (generation !== requestGeneration.current || subject.current !== sessionUserId(getAccessToken())) return;
      setStatus(current); setChecked(false);
      if (pending.current) {
        pending.current.resolve(true); pending.current = null; close();
      }
    } catch (failure) {
      if (generation !== requestGeneration.current) return;
      if (typeof failure === "object" && failure && "status" in failure && failure.status === 409) {
        await load(locale);
      }
      setError(legalConsentMessage(failure));
    } finally { setSaving(false); }
  }
  async function withdraw() {
    if (!requirement?.receiptId || saving || loading) return;
    if (subject.current !== sessionUserId(getAccessToken())) { close(); return; }
    const generation = requestGeneration.current;
    setSaving(true); setError(null);
    const controller = new AbortController(); decisionRequest.current = controller;
    try {
      await withdrawLegalConsent(requirement.receiptId, requirement.scope, controller.signal);
      if (generation === requestGeneration.current) await load(locale);
    } catch (failure) { if (generation === requestGeneration.current) setError(legalConsentMessage(failure)); }
    finally { setSaving(false); }
  }

  return <LegalConsentContext.Provider value={{ openPrivacyChoices }}>
    {children}
    <IonModal key={presentation} isOpen={open} onDidDismiss={() => {
      if (presentationRef.current === presentation) close();
    }} aria-label={t("Autorizaciones y privacidad")}>
      <IonHeader><IonToolbar><IonTitle>{t("Autorizaciones y privacidad")}</IonTitle>
        <IonButton slot="end" fill="clear" onClick={close}>{t("Cancelar")}</IonButton>
      </IonToolbar></IonHeader>
      <IonContent className="ion-padding">
        {loading && <p role="status"><IonSpinner name="crescent" /> {t("Comprobando autorización…")}</p>}
        {error && <p role="alert" style={{ color: "var(--red)", lineHeight: 1.6 }}>{t(error)}</p>}
        {!selected ? <>
          <p>{t("Elige qué funciones autorizas. Puedes cambiar tu decisión aquí.")}</p>
          <IonList>{status?.scopes.map(item => <IonItem key={item.scope} button detail
            onClick={() => { setSelected(item.scope); setChecked(false); setError(null); acceptanceKey.current = null; }}>
            <IonLabel className="ion-text-wrap"><h2>{t(consentScopeLabels[item.scope])}</h2>
              <p>{t(item.accepted ? "Autorizado" : item.available ? "Sin autorizar" : "Documento aprobado no disponible")}</p>
            </IonLabel>
          </IonItem>)}</IonList>
        </> : <>
          {!pending.current && <IonButton fill="clear" onClick={() => { setSelected(null); setChecked(false); setError(null); }}>{t("Volver")}</IonButton>}
          <h2>{t(consentScopeLabels[selected])}</h2>
          {requirement?.accepted && <p role="status">{t("Autorizado")}</p>}
          {document ? <>
            <h3>{document.title}</h3>
            <p>{t("Versión del documento: {version}", { version: document.version })}</p>
            {/* El contenido del CMS se presenta como texto: nunca ejecuta HTML ni enlaces embebidos. */}
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.65 }}>{document.content}</div>
            {requirement!.providers.length > 0 && <section aria-label={t("Proveedores indicados en esta autorización")}>
              <h3>{t("Proveedores indicados en esta autorización")}</h3>
              <IonList>{requirement!.providers.map((provider, index) => <IonItem key={`${index}:${provider}`}><IonLabel className="ion-text-wrap">{provider}</IonLabel></IonItem>)}</IonList>
            </section>}
            {!requirement!.accepted && <>
              <IonCheckbox checked={checked} disabled={saving || loading} onIonChange={event => setChecked(event.detail.checked)}
                labelPlacement="end" style={{ minHeight: 48, marginBlock: 16 }}>
                {t("He leído y acepto el documento mostrado.")}
              </IonCheckbox>
              <IonButton expand="block" className="bt bt-primary" disabled={!checked || saving || loading} onClick={() => void accept()}>
                {t(saving ? "Guardando…" : "Aceptar autorización")}
              </IonButton>
            </>}
          </> : !loading && <p role="status">{t("La autorización aprobada todavía no está disponible. Esta función no puede iniciarse.")}</p>}
          {document && requirement?.accepted && pending.current && <IonButton expand="block" className="bt bt-primary" disabled={saving || loading} onClick={() => {
            pending.current?.resolve(true); pending.current = null; close();
          }}>{t("Continuar")}</IonButton>}
          {requirement?.receiptId && <IonButton expand="block" fill="outline" color="danger" disabled={saving || loading} onClick={() => void withdraw()}>
            {t("Retirar autorización")}
          </IonButton>}
        </>}
        <IonButton expand="block" fill="clear" disabled={saving || loading} onClick={() => void load(locale)}>{t("Volver a comprobar")}</IonButton>
        <IonButton expand="block" className="bt bt-ghost" onClick={close}>{t("Cancelar")}</IonButton>
      </IonContent>
    </IonModal>
  </LegalConsentContext.Provider>;
}
