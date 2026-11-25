import { IonButton, IonCheckbox, IonSpinner } from "@ionic/react";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Screen, Scroll } from "../../../components/Screen";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { ApiError, apiFetch } from "../../../utils/apiClient";
import { getAccessToken } from "../../../utils/authApi";
import { createConsentRequestKey } from "../../../utils/legalConsents";
import { sessionUserId } from "../../../utils/sessionIdentity";

interface AccountDocument {
  scope: "account-terms" | "account-privacy";
  document: { versionId: string; version: string; title: string; content: string; locale: "es" | "en" };
  receiptId: string | null;
  acceptedAt: string | null;
}

interface AccountLegalStatus {
  locale: "es" | "en";
  enforcementEnabled: boolean;
  acceptanceRequired: boolean;
  documents: AccountDocument[];
}

const path = "/api/v1/me/account-legal-consents";
export const AccountLegalStatusContext = createContext<AccountLegalStatus | null>(null);

export function useAccountLegalAccess(active: boolean) {
  const { lang } = useI18n();
  const enabled = active && import.meta.env.VITE_ENFORCE_ACCOUNT_LEGAL_CONSENTS === "true";
  const accountId = enabled ? sessionUserId(getAccessToken()) : null;
  const status = useQuery({
    queryKey: ["account-legal-consents", accountId, lang],
    enabled: enabled && Boolean(accountId),
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) => apiFetch<AccountLegalStatus>(path + "?locale=" + lang, {
      expectedUserId: accountId ?? undefined, signal,
    }),
  });

  const verified = status.isFetchedAfterMount && !status.isError ? status.data : undefined;
  return {
    accountId,
    status: enabled ? verified ?? null : null,
    canEnter: !enabled || (verified !== undefined && !verified.acceptanceRequired),
    loading: Boolean(accountId) && (status.isFetching || status.isPending),
    reload: status.refetch,
  };
}

type Access = ReturnType<typeof useAccountLegalAccess>;

export function AccountLegalPrompt({ access }: { access: Access }) {
  const { logout } = useApp();
  const { t } = useI18n();
  const title = useRef<HTMLHeadingElement>(null);
  const pending = access.status?.documents.find(item => !item.receiptId);
  const pendingVersion = pending?.document.versionId;
  useEffect(() => { title.current?.focus(); }, [pendingVersion]);

  return (
    <Screen hideNav>
      <Scroll className="wellness-privacy-scroll" noNav>
        <main className="wellness-privacy">
          <h1 ref={title} tabIndex={-1}>{t("Documentos de la cuenta")}</h1>
          {pending && access.accountId && access.status ? (
            <PendingDocument
              key={access.accountId + ":" + pending.document.versionId}
              item={pending}
              locale={access.status.locale}
              accountId={access.accountId}
              reload={access.reload}
            />
          ) : access.loading ? (
            <p role="status"><IonSpinner name="crescent" /> {t("Comprobando los documentos de tu cuenta…")}</p>
          ) : (
            <>
              <p role="alert">{t("No pudimos comprobar los documentos de tu cuenta. Intenta de nuevo.")}</p>
              {access.accountId && <IonButton onClick={() => void access.reload()}>{t("Reintentar")}</IonButton>}
            </>
          )}
          <IonButton fill="clear" onClick={() => void logout()}>{t("Cerrar sesión")}</IonButton>
        </main>
      </Scroll>
    </Screen>
  );
}

function PendingDocument({ item, locale, accountId, reload }: {
  item: AccountDocument;
  locale: AccountLegalStatus["locale"];
  accountId: string;
  reload: Access["reload"];
}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const currentRequest = useRef<AbortController | null>(null);
  const document = item.document;
  useEffect(() => () => currentRequest.current?.abort(), []);

  const accept = async () => {
    if (currentRequest.current || !checked) return;
    const request = new AbortController();
    currentRequest.current = request;
    setSaving(true);
    setError(false);
    try {
      idempotencyKey.current ??= createConsentRequestKey();
      await apiFetch(path + "/acceptances", {
        body: { versionId: document.versionId, locale, idempotencyKey: idempotencyKey.current },
        expectedUserId: accountId, signal: request.signal,
      });
      await reload();
    } catch (failure) {
      if (request.signal.aborted) return;
      if (failure instanceof ApiError && failure.code === "ACCOUNT_LEGAL_VERSION_CHANGED") {
        setChecked(false);
        idempotencyKey.current = null;
        await reload();
      } else {
        setError(true);
      }
    } finally {
      currentRequest.current = null;
      if (!request.signal.aborted) setSaving(false);
    }
  };

  return (
    <section className="wellness-privacy-card" aria-labelledby="account-legal-document">
      <h2 id="account-legal-document">{document.title}</h2>
      <p>{t("Versión {version}", { version: document.version })}</p>
      <div lang={document.locale} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{document.content}</div>
      <IonCheckbox checked={checked} disabled={saving} onIonChange={event => setChecked(event.detail.checked)}>
        {t("He leído y acepto el documento mostrado.")}
      </IonCheckbox>
      <IonButton expand="block" disabled={!checked || saving} onClick={() => void accept()}>
        {t(saving ? "Guardando…" : "Aceptar y continuar")}
      </IonButton>
      {error && <p role="alert">{t("No pudimos guardar tu decisión. Intenta de nuevo.")}</p>}
    </section>
  );
}

export function AccountLegalSummary() {
  const status = useContext(AccountLegalStatusContext);
  const { lang, t } = useI18n();
  if (!status?.enforcementEnabled) return null;
  const displayDate = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
  return (
    <section className="wellness-privacy-card">
      <h2>{t("Documentos de la cuenta")}</h2>
      {status.documents.map(({ scope, document, acceptedAt }) => (
        <div className="wellness-privacy-choice" key={scope}>
          <p>{document.title}</p>
          <p>{t("Versión {version}", { version: document.version })}</p>
          {acceptedAt ? (
            <time dateTime={acceptedAt}>{t("Aceptado el {date}", { date: displayDate.format(new Date(acceptedAt)) })}</time>
          ) : <p>{t("Pendiente de aceptación.")}</p>}
        </div>
      ))}
    </section>
  );
}
