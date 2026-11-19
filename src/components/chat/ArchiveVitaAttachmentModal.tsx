import { useEffect, useRef, useState } from "react";
import { IonButton, IonContent, IonHeader, IonInput, IonModal, IonNote, IonProgressBar, IonSelect, IonSelectOption, IonTitle, IonToolbar } from "@ionic/react";
import { useI18n } from "../../i18n/I18nContext";
import { archiveVitaAttachment, getVitaDocumentTypes } from "../../services/chat/vita-attachments-service";
import type { ArchivedVitaAttachment, PendingVitaAttachment } from "../../services/chat/vita-attachments-service";
import { ApiError } from "../../utils/apiClient";
import { isLegalConsentError, legalConsentMessage } from "../../utils/legalConsents";

interface Props {
  attachment: PendingVitaAttachment;
  onCancel: () => void;
  onSaved: (document: ArchivedVitaAttachment) => void;
}

export function ArchiveVitaAttachmentModal({ attachment, onCancel, onSaved }: Props) {
  const { t, lang } = useI18n();
  const [title, setTitle] = useState(attachment.name.trim().slice(0, 200));
  const [types, setTypes] = useState<Awaited<ReturnType<typeof getVitaDocumentTypes>>>([]);
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogStatus("loading");
    void getVitaDocumentTypes(attachment.contentType, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setTypes(result);
      setDocumentTypeId(result.length === 1 ? result[0].id : "");
      setCatalogStatus("ready");
    }).catch(() => { if (!controller.signal.aborted) setCatalogStatus("error"); });
    return () => controller.abort();
  }, [attachment.contentType, attempt]);

  useEffect(() => () => operation.current?.abort(), []);

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name || !documentTypeId || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setSaving(true);
    setError("");
    try {
      const document = await archiveVitaAttachment(attachment.attachmentId, name, documentTypeId, lang, controller.signal);
      if (!controller.signal.aborted) onSaved(document);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (isLegalConsentError(cause)) setError(t(legalConsentMessage(cause)));
      else if (cause instanceof ApiError && cause.status === 404) setError(t("El adjunto ya no está disponible. Vuelve a adjuntarlo en el chat."));
      else if (cause instanceof ApiError && cause.status === 422) setError(t("Ese tipo de documento no admite el archivo. Elige otro tipo si está disponible."));
      else setError(t("No se pudo guardar el documento. Inténtalo de nuevo."));
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <IonModal isOpen className="vita-archive-modal" aria-labelledby="vita-archive-title" canDismiss={!saving} onDidDismiss={onCancel}>
      <IonHeader>
        <IonToolbar>
          <IonTitle id="vita-archive-title">{t("Guardar documento")}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={event => void confirm(event)} className="vita-archive-form">
          <p>{t("Al confirmar, se guardará una copia del archivo en Mis documentos de tu historia clínica.")}</p>
          <IonInput label={t("Título del documento")} labelPlacement="stacked" value={title} maxlength={200}
            disabled={saving} onIonInput={event => setTitle(event.detail.value ?? "")} />
          <IonSelect label={t("Tipo de documento")} labelPlacement="stacked" placeholder={t("Elige un tipo de documento")}
            value={documentTypeId} disabled={saving || !types.length} interface="alert"
            cancelText={t("Cancelar")} okText={t("Aceptar")} onIonChange={event => setDocumentTypeId(event.detail.value)}>
            {types.map(type => <IonSelectOption key={type.id} value={type.id}>{t(type.name)}</IonSelectOption>)}
          </IonSelect>
          <div aria-live="polite" role="status" className="vita-archive-progress">
            {catalogStatus === "loading" && t("Cargando tipos de documento…")}
            {catalogStatus === "ready" && !types.length && t("No hay un tipo de documento compatible con este archivo.")}
            {saving && t("Guardando documento…")}
          </div>
          {catalogStatus === "error" && <div role="alert">
            <IonNote color="danger">{t("No se pudieron cargar los tipos de documento.")}</IonNote>
            <IonButton fill="clear" onClick={() => setAttempt(value => value + 1)}>{t("Reintentar")}</IonButton>
          </div>}
          {error && <IonNote color="danger" role="alert">{error}</IonNote>}
          {saving && <IonProgressBar type="indeterminate" aria-hidden="true" />}
          <IonButton type="submit" expand="block" disabled={saving || !title.trim() || !documentTypeId}>
            {t("Confirmar guardado")}
          </IonButton>
          <IonButton fill="clear" expand="block" disabled={saving} onClick={onCancel}>{t("Cancelar")}</IonButton>
        </form>
      </IonContent>
    </IonModal>
  );
}
