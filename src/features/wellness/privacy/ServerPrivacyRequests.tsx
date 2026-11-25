import { useEffect, useId, useState } from "react";
import { IonAlert, IonButton } from "@ionic/react";
import { useI18n } from "../../../i18n/I18nContext";
import { apiFetch, ApiError } from "../../../utils/apiClient";
import { getAccessToken } from "../../../utils/authApi";
import { formatDateForDisplay, toLocalISODate } from "../../../utils/dates";
import { savePrivacyFile } from "./save-privacy-file";
import { sessionUserId } from "../../../utils/sessionIdentity";

const path = "/api/auth/privacy/requests";
type Format = "json" | "csv";
type RequestBody = { kind: "export"; format: Format } | { kind: "deletion"; confirmed: true };
interface Receipt {
  id: string;
  kind: RequestBody["kind"];
  format: Format | null;
  receivedAt: string;
}
interface ReadyExport { requestId: string; format: Format; expiresAt: string }
type Pending = Record<RequestBody["kind"], Receipt | null> & {
  downloadAvailable?: boolean;
  fullExport?: ReadyExport | null;
};
interface PreparedDownload {
  scope: "profile_and_vitals" | "reviewed_full_copy";
  format: Format;
  content: string;
}

type ReadState =
  | { state: "loading" | "unavailable" | "error" }
  | { state: "ready"; pending: Pending };

export function ServerPrivacyRequests() {
  const userId = sessionUserId(getAccessToken());
  return userId ? <RequestsPanel key={userId} expectedUserId={userId} /> : null;
}

function RequestsPanel({ expectedUserId }: { expectedUserId: string }) {
  const { t } = useI18n();
  const title = useId();
  const [read, setRead] = useState<ReadState>({ state: "loading" });
  const [retry, setRetry] = useState(0);
  const [dialog, setDialog] = useState<RequestBody["kind"] | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<Pending>(path, { expectedUserId, signal: controller.signal })
      .then(pending => {
        if (!controller.signal.aborted) setRead({ state: "ready", pending });
      })
      .catch(error => {
        if (controller.signal.aborted || sessionUserId(getAccessToken()) !== expectedUserId) return;
        setRead({ state: error instanceof ApiError && error.status === 404 ? "unavailable" : "error" });
      });
    return () => controller.abort();
  }, [expectedUserId, retry]);

  const submit = async (body: RequestBody) => {
    if (sending) return;
    setSending(true);
    setSendError(false);
    try {
      const receipt = await apiFetch<Receipt>(path, { body, expectedUserId });
      setRead(value => value.state === "ready"
        ? { state: "ready", pending: { ...value.pending, [receipt.kind]: receipt } }
        : value);
    } catch (error) {
      if (sessionUserId(getAccessToken()) !== expectedUserId) return;
      if (error instanceof ApiError && error.status === 404) setRead({ state: "unavailable" });
      else setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const download = async (requestId: string, format: Format | null, full = false) => {
    if (downloading) return;
    setDownloadError(false);
    setDownloading(true);
    try {
      const file = await apiFetch<PreparedDownload>(
        `${path}/${requestId}/${full ? "full-download" : "download"}`, { expectedUserId });
      if (sessionUserId(getAccessToken()) !== expectedUserId) return;
      const scope = full ? "reviewed_full_copy" : "profile_and_vitals";
      if (file.scope !== scope || file.format !== format) throw new Error("Unknown export");
      if (full) {
        setRead(value => value.state === "ready" && value.pending.export?.id === requestId
          ? { state: "ready", pending: { ...value.pending, export: null } }
          : value);
      }
      await savePrivacyFile(file.content, `${full ? "copia-de-mis-datos" : "perfil-y-vitales"}.${file.format}`,
        file.format === "csv" ? "text/csv;charset=utf-8" : "application/json");
    } catch {
      if (sessionUserId(getAccessToken()) === expectedUserId) setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  if (read.state === "unavailable") return null;

  const exportReceipt = read.state === "ready" ? read.pending.export : null;
  const fullExport = read.state === "ready" ? read.pending.fullExport : null;

  const open = (kind: RequestBody["kind"]) => {
    setSendError(false);
    setDialog(kind);
  };

  return (
    <section className="wellness-privacy-card" aria-labelledby={title} aria-busy={sending || downloading || read.state === "loading"}>
      <h2 id={title}>{t("Tus datos en el servidor")}</h2>
      {read.state === "loading" && <p>{t("Cargando tus solicitudes…")}</p>}
      {read.state === "error" && (
        <>
          <p className="wellness-privacy-error" role="alert">{t("No pudimos consultar tus solicitudes.")}</p>
          <IonButton fill="outline" onClick={() => { setRead({ state: "loading" }); setRetry(value => value + 1); }}>
            {t("Reintentar")}
          </IonButton>
        </>
      )}
      {read.state === "ready" && (
        <>
          <p>{t("Puedes solicitar una copia o el borrado de tus datos del servidor. El comprobante solo confirma que recibimos tu solicitud.")}</p>
          <div className="wellness-privacy-actions">
            {!read.pending.export && (
              <IonButton expand="block" disabled={sending} onClick={() => open("export")}>
                {t("Solicitar copia de mis datos")}
              </IonButton>
            )}
            {!read.pending.deletion && (
              <IonButton expand="block" fill="outline" disabled={sending} onClick={() => open("deletion")}>
                {t("Solicitar borrado de mis datos")}
              </IonButton>
            )}
          </div>
          <div role="status" aria-atomic="true">
            {!read.pending.export && !read.pending.deletion && <p>{t("No tienes solicitudes pendientes.")}</p>}
            {[read.pending.export, read.pending.deletion].filter((receipt): receipt is Receipt => receipt !== null).map(receipt => (
              <p className="wellness-privacy-receipt" key={receipt.id}>
                <strong>{receipt.kind === "export"
                  ? t("Copia solicitada ({format})", { format: receipt.format?.toUpperCase() ?? "" })
                  : t("Borrado solicitado")}</strong>
                {" · "}<time dateTime={receipt.receivedAt}>{formatDateForDisplay(toLocalISODate(new Date(receipt.receivedAt)))}</time>
                <br />{t("Comprobante {id}", { id: receipt.id })}
              </p>
            ))}
          </div>
          {fullExport && (
            <>
              <p>{t("Tu copia completa está lista. Disponible hasta el {date}.", {
                date: formatDateForDisplay(toLocalISODate(new Date(fullExport.expiresAt))),
              })}</p>
              <IonButton expand="block" disabled={downloading} onClick={() => void download(fullExport.requestId, fullExport.format, true)}>
                {t("Descargar mi copia completa")}
              </IonButton>
            </>
          )}
          {!fullExport && exportReceipt && read.pending.downloadAvailable && (
            <>
              <p>{t("Esta descarga incluye tu perfil y signos vitales. No es la copia completa que solicitaste.")}</p>
              <IonButton expand="block" fill="outline" disabled={downloading} onClick={() => void download(exportReceipt.id, exportReceipt.format)}>
                {t("Descargar perfil y signos vitales")}
              </IonButton>
            </>
          )}
          {downloadError && <p role="alert" className="wellness-privacy-error">{t("No pudimos completar la descarga. Intenta de nuevo.")}</p>}
          {sendError && <p className="wellness-privacy-error" role="alert">{t("No pudimos enviar tu solicitud. Intenta de nuevo.")}</p>}
        </>
      )}
      <IonAlert
        isOpen={dialog === "export"}
        header={t("Elige el formato de tu copia")}
        inputs={[
          { type: "radio", label: "JSON", value: "json", checked: true },
          { type: "radio", label: "CSV", value: "csv" },
        ]}
        onDidDismiss={() => setDialog(null)}
        buttons={[
          { text: t("Cancelar"), role: "cancel" },
          { text: t("Enviar solicitud"), handler: (format: Format) => { void submit({ kind: "export", format }); } },
        ]}
      />
      <IonAlert
        className="wellness-privacy-alert"
        isOpen={dialog === "deletion"}
        header={t("¿Solicitar el borrado de tus datos del servidor?")}
        message={t("Esto envía una solicitud para revisión. No borra tus datos ni cierra tu cuenta en este momento.")}
        backdropDismiss={false}
        onDidPresent={event => {
          const alert = event.target;
          requestAnimationFrame(() => alert.querySelector<HTMLElement>("button.alert-button-role-cancel")?.focus());
        }}
        onDidDismiss={() => setDialog(null)}
        buttons={[
          { text: t("Cancelar"), role: "cancel" },
          { text: t("Enviar solicitud"), handler: () => { void submit({ kind: "deletion", confirmed: true }); } },
        ]}
      />
    </section>
  );
}
