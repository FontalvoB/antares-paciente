import { useEffect, useRef, useState } from "react";
import { Browser } from "@capacitor/browser";
import { IonAccordion, IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSkeletonText, IonSpinner } from "@ionic/react";
import { documentTextOutline } from "ionicons/icons";
import { useI18n } from "../i18n/I18nContext";
import { useMyDocuments } from "../hooks/useMyDocuments";
import { getMyDocumentUrl } from "../services/documents/my-documents-service";
import { formatDateForDisplay, toLocalISODate } from "../utils/dates";

/** Sección del expediente: compone el acordeón/lista Ionic existente y abre el
 * original solo por petición expresa. La firma temporal nunca se persiste. */
export function MyDocumentsSection({ ownerId }: { ownerId?: string }) {
  const { t } = useI18n();
  const documents = useMyDocuments(ownerId);
  const [operation, setOperation] = useState<{ owner: string; id: string | null; error: boolean } | null>(null);
  const opening = operation && operation.owner === ownerId ? operation.id : null;
  const openError = Boolean(operation && operation.owner === ownerId && operation.error);
  const currentOwner = useRef(ownerId); currentOwner.current = ownerId;
  const download = useRef<AbortController | null>(null);
  useEffect(() => {
    currentOwner.current = ownerId;
    return () => { currentOwner.current = undefined; download.current?.abort(); download.current = null; };
  }, [ownerId]);

  async function open(id: string) {
    if (!ownerId || opening || download.current) return;
    const owner = ownerId;
    const request = new AbortController(); download.current = request;
    setOperation({ owner, id, error: false });
    try {
      const url = await getMyDocumentUrl(id, request.signal);
      if (!request.signal.aborted && currentOwner.current === owner) await Browser.open({ url });
    } catch {
      if (!request.signal.aborted && currentOwner.current === owner) setOperation({ owner, id: null, error: true });
    } finally {
      if (download.current === request) download.current = null;
      if (!request.signal.aborted && currentOwner.current === owner) setOperation(previous => previous?.owner === owner && previous.id === id ? { ...previous, id: null } : previous);
    }
  }

  if (!ownerId) return null;
  return <IonAccordion value="documents">
    <IonItem slot="header" lines="none">
      <span className="hc-acc-ico" aria-hidden="true"><IonIcon icon={documentTextOutline} /></span>
      <IonLabel>{t("Mis documentos")}</IonLabel>
    </IonItem>
    <div slot="content" className="hc-acc-body">
      {documents.loading ? <div aria-busy="true"><IonSkeletonText animated /><IonSkeletonText animated /></div> : <>
        {documents.items.length > 0 ? <IonList lines="inset">
          {documents.items.map(document => <IonItem key={document.id}>
            <IonLabel className="ion-text-wrap">
              <h3>{document.title}</h3>
              <p>{formatDateForDisplay(toLocalISODate(new Date(document.createdAt)))}</p>
            </IonLabel>
            <IonButton slot="end" fill="clear" style={{ minHeight: 44 }} disabled={opening !== null} aria-label={t("Abrir documento: {title}", { title: document.title })} onClick={() => void open(document.id)}>
              {opening === document.id ? <IonSpinner name="crescent" /> : t("Abrir")}
            </IonButton>
          </IonItem>)}
        </IonList> : !documents.error && <IonNote>{t("Aún no tienes documentos guardados.")}</IonNote>}
        {documents.error && <div role="alert" className="hc-err">
          <IonNote color="danger">{t("No se pudieron cargar tus documentos.")}</IonNote>
          <IonButton fill="outline" style={{ minHeight: 44 }} onClick={() => void documents.reload()}>{t("Reintentar")}</IonButton>
        </div>}
        {documents.hasMore && <IonButton expand="block" fill="outline" style={{ minHeight: 44 }} disabled={documents.fetchingMore} onClick={() => void documents.loadMore()}>
          {documents.fetchingMore ? <IonSpinner name="crescent" /> : t("Cargar más documentos")}
        </IonButton>}
      </>}
      {openError && <IonNote color="danger" role="alert">{t("No se pudo abrir el documento. Inténtalo de nuevo.")}</IonNote>}
    </div>
  </IonAccordion>;
}
