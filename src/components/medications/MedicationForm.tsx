import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import {
  IonButton, IonButtons, IonCheckbox, IonContent, IonDatetime, IonDatetimeButton, IonFooter, IonHeader, IonIcon,
  IonInput, IonItem, IonLabel, IonList, IonModal, IonSearchbar, IonSelect, IonSelectOption, IonSpinner,
  IonTextarea, IonTitle, IonToolbar,
} from "@ionic/react";
import {
  calendarOutline, cameraOutline, checkmarkCircleOutline, checkmarkOutline, chevronForwardOutline, closeOutline,
  documentTextOutline, flaskOutline, medkitOutline, pricetagOutline, timeOutline,
} from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { captureMedicationLabel, medicationLabelSearchTerms } from "../../services/media/medication-label";
import { ApiError } from "../../utils/apiClient";
import { getAccessToken } from "../../utils/authApi";
import { toLocalISODate } from "../../utils/dates";
import { createMedicationRequestId, createMyMedication, searchMedicationCatalog } from "../../utils/medicationsApi";
import type { CreateMedicationRequest, MedicationCatalogItem, MedicationProductType } from "../../utils/medicationsApi";
import { sessionUserId } from "../../utils/sessionIdentity";

const productLabels = { medication: "Medicamento", vitamin: "Vitamina", supplement: "Suplemento" } as const;

export function MedicationForm({ owner, timeZone: initialTimeZone, onCancel, onSaved, onAccessError }: {
  owner: string;
  timeZone: string;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onAccessError: () => void;
}) {
  const { t, lang } = useI18n();
  const searchLabel = t("Buscar medicamentos");
  const labelSearch = useCallback((bar: HTMLIonSearchbarElement | null) => {
    // Ionic aplica su etiqueta por defecto al input interno.
    if (bar) void bar.getInputElement().then(input => input.setAttribute("aria-label", searchLabel));
  }, [searchLabel]);
  const formId = useId().replace(/:/g, "");
  const modal = useRef<HTMLIonModalElement>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [product, setProduct] = useState<MedicationCatalogItem | null>(null);
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [productType, setProductType] = useState<MedicationProductType>("medication");
  const [dosage, setDosage] = useState("");
  const [unit, setUnit] = useState("");
  const [route, setRoute] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState("08:00");
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const [startDate, setStartDate] = useState(toLocalISODate);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [photo, setPhoto] = useState<{ src: string; terms: string[] } | null>(null);
  const [scanError, setScanError] = useState(false);
  const reading = useRef(false);
  const writing = useRef(false);
  const operation = useRef<{ signature: string; body: CreateMedicationRequest } | null>(null);
  const isCurrent = () => active.current && sessionUserId(getAccessToken()) === owner;
  const canScan = Capacitor.isPluginAvailable("MedicationLabel");
  const queryText = search.trim();
  const querying = !product && !custom && !scanning && queryText.length >= 2;
  useEffect(() => {
    if (!querying) return;
    const timer = window.setTimeout(() => setSearchTerm(queryText), 275);
    return () => window.clearTimeout(timer);
  }, [queryText, querying]);
  const catalog = useQuery({
    queryKey: ["medications", "catalog", owner, lang, searchTerm],
    queryFn: ({ signal }) => searchMedicationCatalog(owner, searchTerm, signal),
    enabled: querying && queryText === searchTerm,
    retry: false,
    gcTime: 0,
  });

  const scan = async () => {
    if (!canScan || reading.current || writing.current || !isCurrent()) return;
    reading.current = true;
    setScanning(true);
    setScanError(false);
    try {
      const label = await captureMedicationLabel();
      if (!label || !isCurrent()) return;
      setPhoto({ src: label.dataUrl, terms: [] });
      const terms = medicationLabelSearchTerms(await label.read());
      if (!isCurrent()) return;
      setPhoto({ src: label.dataUrl, terms });
      if (terms.length) setSearch(terms[0]);
      else setScanError(true);
    } catch (failure) {
      if (isCurrent() && !(failure instanceof Error && failure.message === "User cancelled photos app")) {
        setScanError(true);
      }
    } finally {
      reading.current = false;
      if (isCurrent()) setScanning(false);
    }
  };

  const save = async () => {
    if (writing.current || reading.current || (!product && !custom) || !isCurrent()) return;
    const productName = product?.name ?? name.trim();
    const quantity = Number(dosage.replace(",", "."));
    const schedule = times.split(",").map(value => value.trim()).filter(Boolean).sort();
    const zone = timeZone.trim();
    let validZone = Boolean(zone);
    try { new Intl.DateTimeFormat("es", { timeZone: zone }); } catch { validZone = false; }
    if (!productName || !Number.isFinite(quantity) || quantity <= 0 || !unit.trim() || !validZone || schedule.length < 1 || schedule.length > 8 || new Set(schedule).size !== schedule.length || schedule.some(value => !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || (endDate && endDate < startDate)) {
      setError(t("Revisa la dosis, los horarios y las fechas."));
      return;
    }
    const body = {
      medicationId: product?.id ?? null, name: productName, productType, dosage: quantity,
      unit: unit.trim(), route: route.trim(), instructions: instructions.trim(),
      times: schedule, timeZone: zone, startDate, endDate,
    };
    const signature = JSON.stringify(body);
    if (!operation.current || operation.current.signature !== signature) {
      operation.current = { signature, body: { ...body, clientRequestId: createMedicationRequestId() } };
    }
    writing.current = true;
    setSaving(true);
    setError(null);
    try {
      await createMyMedication(owner, operation.current.body);
      if (isCurrent()) await onSaved();
    } catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) {
        setError(t("No tienes acceso a este módulo."));
        onAccessError();
      } else if (failure instanceof ApiError && failure.status === 422 && product) {
        setProduct(null);
        setError(t("El producto seleccionado ya no está disponible. Busca otra presentación."));
        void catalog.refetch();
      } else if (failure instanceof ApiError && failure.status === 400) {
        setError(t("Revisa la dosis, los horarios y las fechas."));
      } else if (failure instanceof ApiError && failure.status === 409) {
        setError(t("El registro cambió. Actualiza e inténtalo de nuevo."));
      } else {
        setError(t("No pudimos guardar. Reintenta cuando tengas conexión."));
      }
    } finally {
      writing.current = false;
      if (isCurrent()) setSaving(false);
    }
  };

  return (
    <IonModal ref={modal} isOpen className="medications-entry-modal" aria-labelledby={`${formId}-title`}
      canDismiss={async () => !writing.current} onDidDismiss={event => {
        if (event.target === modal.current) onCancel();
      }}>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle id={`${formId}-title`}>
            <span className="medications-entry-title">
              <span className="medications-entry-title-icon"><IonIcon icon={medkitOutline} aria-hidden="true" /></span>
              <span className="medications-entry-title-copy">
                <strong>{t("Añadir medicamento")}</strong>
                <small>{t("Fuera del plan")}</small>
              </span>
            </span>
          </IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label={t("Cancelar")} disabled={saving} onClick={() => void modal.current?.dismiss()}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="medications-entry-content">
        <form id={`${formId}-form`} className="medications-entry" onSubmit={event => { event.preventDefault(); void save(); }}>
          <section className="medications-entry-panel medications-entry-product" aria-labelledby={`${formId}-product`}>
            <header className="medications-entry-heading">
              <span className="medications-entry-icon"><IonIcon icon={pricetagOutline} aria-hidden="true" /></span>
              <h2 id={`${formId}-product`}>{t("Producto")}</h2>
            </header>
            {product ? <div className="medications-entry-selection">
              <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
              <div><strong>{product.name}</strong>{(product.description || product.code) && <p>{[product.description, product.code].filter(Boolean).join(" · ")}</p>}</div>
              <IonButton fill="clear" disabled={saving} onClick={() => { setProduct(null); setError(null); }}>{t("Cambiar")}</IonButton>
            </div> : custom ? <>
              <IonInput label={t("Nombre del medicamento")} labelPlacement="stacked" value={name} maxlength={200}
                required disabled={saving} onIonInput={event => setName(event.detail.value ?? "")} autocomplete="off" />
              <IonButton fill="clear" disabled={saving} onClick={() => setCustom(false)}>{t("Usar catálogo")}</IonButton>
            </> : <>
              {canScan && <IonButton className="medications-entry-scan" expand="block" disabled={scanning} onClick={() => void scan()}>
                <span className="medications-entry-scan-icon"><IonIcon icon={cameraOutline} aria-hidden="true" /></span>
                <span className="medications-entry-scan-text">{t(photo ? "Repetir foto" : "Tomar foto del empaque")}</span>
                <IonIcon className="medications-entry-scan-arrow" icon={chevronForwardOutline} aria-hidden="true" />
              </IonButton>}
              {scanning && <p className="medications-entry-status" role="status">
                <IonSpinner name="crescent" aria-hidden="true" />{t("Leyendo la etiqueta…")}
              </p>}
              {photo && <div className="medications-entry-photo">
                <img src={photo.src} alt={t("Fotografía del empaque")} />
                <p>{t("Comprueba el nombre en el empaque.")}</p>
              </div>}
              {scanError && <p className="medications-entry-status" role="status">{t("No pudimos leer la etiqueta. Busca el nombre o repite la foto.")}</p>}
              {photo && photo.terms.length > 1 && <div className="medications-entry-terms">
                {photo.terms.map(term => <IonButton key={term} fill="outline" size="small" disabled={scanning}
                  aria-pressed={search === term} onClick={() => setSearch(term)}>{term}</IonButton>)}
              </div>}
              <div className="medications-entry-search-field">
                <span aria-hidden="true">{t("Catálogo de medicamentos")}</span>
                <IonSearchbar className="medications-entry-search" ref={labelSearch}
                  placeholder={t("Buscar por nombre")} value={search} maxlength={200} disabled={scanning}
                  onIonInput={event => setSearch(event.detail.value ?? "")} />
              </div>
              {querying && (queryText !== searchTerm || catalog.isPending || catalog.isFetching ?
                <p className="medications-entry-status" role="status"><IonSpinner name="crescent" aria-hidden="true" />{t("Buscando en el catálogo…")}</p> :
                catalog.isError ? <div className="medications-error" role="alert">
                  {t("No pudimos consultar el catálogo.")} <IonButton fill="clear" onClick={() => void catalog.refetch()}>{t("Reintentar")}</IonButton>
                </div> : catalog.data?.length ? <IonList className="medications-entry-results" aria-label={t("Resultados del catálogo")}>
                  {catalog.data.map(item => <IonItem key={item.id} button type="button" detail
                    onClick={() => { setProduct(item); setPhoto(null); setScanError(false); setError(null); }}>
                    <IonLabel className="ion-text-wrap"><strong>{item.name}</strong>{(item.description || item.code) && <p>{[item.description, item.code].filter(Boolean).join(" · ")}</p>}</IonLabel>
                  </IonItem>)}
                </IonList> : <div className="medications-entry-status">
                  <span role="status">{t("Sin resultados en el catálogo")}</span>
                  <IonButton fill="clear" onClick={() => { setName(queryText); setCustom(true); setError(null); }}>{t("Añadir sin catálogo")}</IonButton>
                </div>)}
            </>}
            <IonSelect label={t("Tipo de producto")} labelPlacement="stacked" value={productType}
              disabled={saving} interface="popover" onIonChange={event => setProductType(event.detail.value)}>
              {Object.entries(productLabels).map(([value, label]) => <IonSelectOption key={value} value={value}>{t(label)}</IonSelectOption>)}
            </IonSelect>
          </section>
          <section className="medications-entry-panel medications-entry-dose" aria-labelledby={`${formId}-dose`}>
            <header className="medications-entry-heading">
              <span className="medications-entry-icon"><IonIcon icon={flaskOutline} aria-hidden="true" /></span>
              <h2 id={`${formId}-dose`}>{t("Dosis y administración")}</h2>
            </header>
            <div className="medications-form-pair">
              <IonInput label={t("Cantidad por toma")} labelPlacement="stacked" inputmode="decimal" value={dosage}
                required disabled={saving} onIonInput={event => setDosage(event.detail.value ?? "")} placeholder="1" />
              <IonInput label={t("Unidad")} labelPlacement="stacked" value={unit} maxlength={40}
                required disabled={saving} onIonInput={event => setUnit(event.detail.value ?? "")} placeholder={t("tableta, ml…")} />
            </div>
            <IonInput label={t("Vía de administración")} labelPlacement="stacked" value={route}
              maxlength={80} disabled={saving} onIonInput={event => setRoute(event.detail.value ?? "")} />
          </section>
          <section className="medications-entry-panel medications-entry-schedule" aria-labelledby={`${formId}-schedule`}>
            <header className="medications-entry-heading">
              <span className="medications-entry-icon"><IonIcon icon={timeOutline} aria-hidden="true" /></span>
              <h2 id={`${formId}-schedule`}>{t("Horario y fechas")}</h2>
            </header>
            <IonInput label={t("Horarios")} labelPlacement="stacked" value={times} required disabled={saving}
              onIonInput={event => setTimes(event.detail.value ?? "")} placeholder="08:00, 20:00" />
            <div className="medications-date-row">
              <span><IonIcon icon={calendarOutline} aria-hidden="true" />{t("Fecha de inicio")}</span>
              <IonDatetimeButton datetime={`${formId}-start`} disabled={saving} />
            </div>
            <IonModal keepContentsMounted className="medications-date-modal">
              <IonDatetime id={`${formId}-start`} presentation="date" locale={lang === "en" ? "en-US" : "es-ES"}
                value={startDate} max={endDate ?? undefined} showDefaultButtons doneText={t("Listo")} cancelText={t("Cancelar")}
                onIonChange={event => {
                  const value = event.detail.value;
                  if (typeof value === "string") setStartDate(value.slice(0, 10));
                }} />
            </IonModal>
            <IonCheckbox checked={Boolean(endDate)} disabled={saving}
              onIonChange={event => setEndDate(event.detail.checked ? startDate : null)}>
              {t("Añadir fecha de finalización")}
            </IonCheckbox>
            {endDate && <>
              <div className="medications-date-row">
                <span><IonIcon icon={calendarOutline} aria-hidden="true" />{t("Fecha de finalización")}</span>
                <IonDatetimeButton datetime={`${formId}-end`} disabled={saving} />
              </div>
              <IonModal keepContentsMounted className="medications-date-modal">
                <IonDatetime id={`${formId}-end`} presentation="date" locale={lang === "en" ? "en-US" : "es-ES"}
                  value={endDate} min={startDate} showDefaultButtons doneText={t("Listo")} cancelText={t("Cancelar")}
                  onIonChange={event => {
                    const value = event.detail.value;
                    if (typeof value === "string") setEndDate(value.slice(0, 10));
                  }} />
              </IonModal>
            </>}
            <IonInput label={t("Zona horaria")} labelPlacement="stacked" value={timeZone} required disabled={saving}
              onIonInput={event => setTimeZone(event.detail.value ?? "")} />
          </section>
          <section className="medications-entry-panel medications-entry-notes" aria-labelledby={`${formId}-notes`}>
            <header className="medications-entry-heading">
              <span className="medications-entry-icon"><IonIcon icon={documentTextOutline} aria-hidden="true" /></span>
              <h2 id={`${formId}-notes`}>{t("Indicaciones")}</h2>
              <small>{t("Opcional")}</small>
            </header>
            <IonTextarea aria-label={t("Indicaciones")} value={instructions} maxlength={2000}
              disabled={saving} autoGrow rows={3} onIonInput={event => setInstructions(event.detail.value ?? "")} />
          </section>
        </form>
      </IonContent>
      <IonFooter className="medications-entry-footer ion-no-border">
        {error && <p role="alert" className="medications-error">{error}</p>}
        <IonButton type="submit" form={`${formId}-form`} expand="block" disabled={saving || scanning || (!product && !custom)}>
          <IonIcon slot="start" icon={checkmarkOutline} aria-hidden="true" />
          {saving ? t("Guardando…") : t("Guardar medicamento")}
        </IonButton>
      </IonFooter>
    </IonModal>
  );
}
