import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IonBadge, IonButton, IonCheckbox, IonDatetime, IonDatetimeButton, IonIcon,
  IonInput, IonModal, IonSegment, IonSegmentButton, IonSelect, IonSelectOption,
  IonSkeletonText, IonTextarea,
} from "@ionic/react";
import {
  addOutline, calendarOutline, checkmarkCircleOutline, closeOutline, flaskOutline,
  leafOutline, medicalOutline, pauseOutline, playOutline,
  refreshOutline, timeOutline,
} from "ionicons/icons";
import { Screen, Scroll } from "../components/Screen";
import {PatientMedicationInventory} from "../components/medications/PatientMedicationInventory";
import {PatientMedicationEffects} from "../components/medications/PatientMedicationEffects";
import { LanguageToggle } from "../components/LanguageToggle";
import { useApp } from "../context/AppContext";
import { useI18n } from "../i18n/I18nContext";
import { useMedicationCapabilities } from "../hooks/useMedicationCapabilities";
import { ApiError } from "../utils/apiClient";
import { getAccessToken } from "../utils/authApi";
import { sessionUserId } from "../utils/sessionIdentity";
import { formatDateForDisplay, toLocalISODate } from "../utils/dates";
import {
  createMedicationRequestId, createMyMedication, fetchMyMedications, isRequiredMedication, recordMyMedicationDose, setMyMedicationStatus,
} from "../utils/medicationsApi";
import type {
  CreateMedicationRequest, MedicationDose, MedicationProductType, MedicationStatus,
  MedicationTreatment, RecordMedicationDoseRequest,
} from "../utils/medicationsApi";

const treatmentLabels = { active: "Activo", paused: "Pausado", completed: "Finalizado" } as const;
const doseLabels = { pending: "Pendiente", taken: "Tomado", omitted: "Omitido", cancelled: "Cancelado" } as const;
const productLabels = { medication: "Medicamento", vitamin: "Vitamina", supplement: "Suplemento" } as const;

function currentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function MedicationsPage() {
  const capabilities = useMedicationCapabilities();
  // Al cambiar de cuenta se desmontan también borradores y claves de operación.
  return <MedicationContent key={capabilities.owner ?? "no-session"} capabilities={capabilities} />;
}

function MedicationContent({ capabilities }: { capabilities: ReturnType<typeof useMedicationCapabilities> }) {
  const { navigate, showToast } = useApp();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const owner = capabilities.owner;
  const [tab, setTab] = useState("today");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const eventOperations = useRef(new Map<string, RecordMedicationDoseRequest>());
  const date = toLocalISODate();
  const timeZone = currentTimeZone();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const query = useQuery({
    queryKey: ["medications", "workspace", owner, date, timeZone],
    queryFn: ({ signal }) => fetchMyMedications(owner!, date, timeZone, signal),
    enabled: Boolean(owner && capabilities.enabled),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const isCurrent = () => Boolean(owner && sessionUserId(getAccessToken()) === owner);
  const refresh = async () => {
    if (!isCurrent()) return;
    await queryClient.invalidateQueries({ queryKey: ["medications", "workspace", owner] });
  };
  const failure = (error: unknown) => {
    if (!isCurrent()) return;
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      setActionError(t("No tienes acceso a este módulo."));
      void queryClient.invalidateQueries({ queryKey: ["medications", "capabilities", owner] });
    } else if (error instanceof ApiError && error.status === 409) {
      setActionError(t("El registro cambió. Actualiza e inténtalo de nuevo."));
      void refresh();
    } else {
      setActionError(t("No pudimos guardar. Reintenta cuando tengas conexión."));
    }
  };
  const recordDose = async (dose: MedicationDose, status: "taken" | "omitted") => {
    if (!owner || busy || !capabilities.canManage || !isCurrent()) return;
    const key = `${dose.id}:${dose.revision}:${status}`;
    const operation = eventOperations.current.get(key) ?? {
      clientRequestId: createMedicationRequestId(), status, occurredAt: new Date().toISOString(),
      reason: null, expectedRevision: dose.revision, scheduledAt: dose.scheduledAt,
    };
    eventOperations.current.set(key, operation);
    setBusy(dose.id); setActionError(null);
    try {
      await recordMyMedicationDose(owner, dose.id, operation);
      if (!isCurrent()) return;
      await refresh();
      showToast(t("Toma guardada"), "ok");
    } catch (error) { failure(error); }
    finally { if (isCurrent()) setBusy(null); }
  };
  const changeStatus = async (treatment: MedicationTreatment, status: MedicationStatus) => {
    if (!owner || busy || !capabilities.canManage || treatment.origin !== "patient_reported" || !isCurrent()) return;
    setBusy(treatment.id); setActionError(null);
    try {
      await setMyMedicationStatus(owner, treatment, status);
      if (!isCurrent()) return;
      await refresh(); showToast(t("Tratamiento actualizado"), "ok");
    } catch (error) { failure(error); }
    finally { if (isCurrent()) setBusy(null); }
  };
  const workspace = query.data;
  const unavailable = !capabilities.isLoading && !capabilities.enabled;
  const accessDenied = query.error instanceof ApiError && [403, 404].includes(query.error.status);
  const loading = capabilities.isLoading || (capabilities.enabled && query.isLoading);
  const time = (value: string, zone?: string) => new Intl.DateTimeFormat(locale, {
    hour: "2-digit", minute: "2-digit", ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(value));

  const supplementIds = new Set(workspace?.treatments.filter(t => t.productType === "supplement").map(t => t.id));
  const assignedIds = new Set(workspace?.treatments.filter(isRequiredMedication).map(t => t.id));
  const mainDoses = workspace?.doses.filter(d => assignedIds.has(d.treatmentId) && d.status !== "cancelled") ?? [];
  const reportedDoses = workspace?.doses.filter(d => !assignedIds.has(d.treatmentId) && !supplementIds.has(d.treatmentId)) ?? [];
  const adherence = workspace?.adherence;
  const deviating = Boolean(adherence && adherence.offPlanTakenDoses > 0 && adherence.dueDoses > adherence.takenDoses);
  const extraDoses = workspace?.doses.filter(d => supplementIds.has(d.treatmentId)) ?? [];
  const hasExtra = workspace?.treatments.some(t => t.productType === "supplement" && t.status === "active");
  const renderDose = (dose: MedicationDose) => {
            const future = new Date(dose.scheduledAt).getTime() > Date.now();
            const pending = dose.status === "pending";
            return <article className={`medications-dose medications-dose-${dose.status}`} key={dose.id}>
              <div className="medications-dose-line"><span className="medications-time"><IonIcon icon={timeOutline} aria-hidden="true" />{time(dose.scheduledAt, dose.timeZone)}</span><IonBadge className={`medications-badge medications-badge-${dose.status}`}>{t(doseLabels[dose.status])}</IonBadge></div>
              <h3 title={dose.name}>{dose.name}</h3><p>{new Intl.NumberFormat(locale).format(dose.dosage)} {dose.unit}</p>
              {pending && capabilities.canManage ? <div className="medications-dose-actions"><IonButton fill="outline" disabled={Boolean(busy) || future} onClick={() => void recordDose(dose, "omitted")}>{t("Omitir")}</IonButton><IonButton disabled={Boolean(busy) || future} onClick={() => void recordDose(dose, "taken")}><IonIcon icon={checkmarkCircleOutline} slot="start" />{busy === dose.id ? t("Guardando…") : t("Ya lo tomé")}</IonButton></div> : dose.occurredAt ? <span className="medications-recorded"><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />{t("Registrado a las {time}", { time: time(dose.occurredAt, dose.timeZone) })}</span> : null}
            </article>;
            };

  return <Screen className="medications-page">
    <header className="medications-header">
      <div className="medications-heading-row">
        <span className="medications-heading-icon"><IonIcon icon={medicalOutline} aria-hidden="true" /></span>
        <h1>{t("Control de medicamentos")}</h1>
      </div>
      <div className="medications-header-actions"><LanguageToggle /><IonButton fill="clear" aria-label={t("Actualizar medicamentos")} disabled={loading || query.isFetching} onClick={() => { void capabilities.refresh(); void refresh(); }}><IonIcon slot="icon-only" icon={refreshOutline} /></IonButton></div>
    </header>
    <Scroll className="medications-scroll">
      {loading ? <section className="medications-loading" role="status" aria-label={t("Cargando medicamentos")}><IonSkeletonText animated style={{ width: "55%", height: 24 }} /><IonSkeletonText animated style={{ width: "100%", height: 122 }} /><IonSkeletonText animated style={{ width: "100%", height: 122 }} /></section> :
      unavailable ? <section className="medications-state"><IonIcon icon={medicalOutline} aria-hidden="true" /><h2>{t("Control de medicamentos no disponible")}</h2><IonButton onClick={() => navigate("prof")}>{t("Ir a mi perfil")}</IonButton></section> :
      query.isError || !workspace ? <section className="medications-state" role="alert"><IonIcon icon={refreshOutline} aria-hidden="true" /><h2>{t(accessDenied ? "No tienes acceso a este módulo." : "No pudimos cargar tus medicamentos")}</h2>{accessDenied ? <IonButton onClick={() => navigate("prof")}>{t("Ir a mi perfil")}</IonButton> : <IonButton onClick={() => { void query.refetch(); }}>{t("Reintentar")}</IonButton>}</section> :
      adding && owner ? <MedicationForm owner={owner} onCancel={() => setAdding(false)} onSaved={async () => { if (!isCurrent()) return; await refresh(); setAdding(false); setTab("today"); showToast(t("Medicamento guardado"), "ok"); }} onAccessError={() => { void capabilities.refresh(); }} /> : <>
        <div className="medications-topline"><div><span>{t("Tu seguimiento")}</span><strong>{workspace.summary.activeTreatments === 1 ? t("1 tratamiento activo") : t("{count} tratamientos activos", { count: String(workspace.summary.activeTreatments) })}</strong></div>{capabilities.canManage && <IonButton className="medications-add" size="small" onClick={() => setAdding(true)}><IonIcon slot="start" icon={addOutline} />{t("Añadir medicamento")}</IonButton>}</div>
        {adherence && <section className="medications-adherence" aria-label={t("Adherencia al plan")} aria-live="polite">
          <div><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /><strong>{t("Adherencia al plan")}</strong><IonBadge className="medications-badge">{adherence.percent === null ? "—" : `${adherence.percent}%`}</IonBadge></div>
          <p>{adherence.dueDoses > 0 ? t("{taken} de {total} tomas asignadas", {taken: String(adherence.takenDoses), total: String(adherence.dueDoses)}) : t("Sin tomas asignadas para evaluar")}</p>
          {deviating && <p className="medications-plan-warning">{t("No estás siguiendo el plan asignado")}</p>}
        </section>}
        <IonSegment className="medications-tabs" value={tab} onIonChange={event => { setTab(String(event.detail.value ?? "today")); setActionError(null); }} aria-label={t("Secciones de medicamentos")}>
          <IonSegmentButton value="today"><span>{t("Hoy")}</span></IonSegmentButton>
          <IonSegmentButton value="treatments"><span>{t("Mi lista")}</span></IonSegmentButton>
          <IonSegmentButton value="inventory"><span>{t("Inventario")}</span></IonSegmentButton>
          <IonSegmentButton value="effects"><span>{t("Reportes")}</span></IonSegmentButton>
          <IonSegmentButton value="history"><span>{t("Historial")}</span></IonSegmentButton>
        </IonSegment>
        {actionError && <p role="alert" className="medications-error">{actionError}</p>}
        {tab === "today" && <section className="medications-today" aria-label={t("Dosis de hoy")}>
          <div className="medications-section-heading"><div><IonIcon icon={calendarOutline} aria-hidden="true" /><h2>{t("Hoy")}</h2><span>{formatDateForDisplay(date)}</span></div>{mainDoses.length > 0 && <strong>{mainDoses.filter(d => d.status === "taken").length}/{mainDoses.length}</strong>}</div>
          <section aria-label={t("Plan asignado")}>
            <div className="medications-section-heading"><h2>{t("Plan asignado")}</h2></div>
            {mainDoses.length ? <div className="medications-dose-list">{mainDoses.map(renderDose)}</div> : <p>{t("Sin tomas asignadas para hoy")}</p>}
          </section>
          {reportedDoses.length > 0 && <section className="medications-reported" aria-label={t("Fuera del plan")}>
            <div className="medications-section-heading"><h2>{t("Fuera del plan")}</h2><IonBadge className="medications-badge">{t("Registrado por ti")}</IonBadge></div>
            <p>{t("Estas tomas no sustituyen tu plan.")}</p>
            <div className="medications-extra-list">{reportedDoses.map(renderDose)}</div>
          </section>}
        {hasExtra && <section className="medications-extra" aria-label={t("Nutracéutico")}><div className="medications-section-heading"><div><IonIcon icon={leafOutline} aria-hidden="true" /><h2>{t("Nutracéutico")}</h2><span>{t("Adicional")}</span></div></div>{extraDoses.length ? <div className="medications-extra-list">{extraDoses.map(renderDose)}</div> : <p>{t("Sin tomas programadas para hoy")}</p>}</section>}
        </section>}
        {tab === "treatments" && <section className="medications-treatment-list" aria-label={t("Mis medicamentos")}>
          {workspace.treatments.length ? workspace.treatments.map(treatment => <article className="medications-treatment" key={treatment.id}>
            <div className="medications-treatment-heading"><span className={`medications-product-icon medications-product-${treatment.productType}`}><IonIcon icon={treatment.productType === "medication" ? medicalOutline : treatment.productType === "vitamin" ? flaskOutline : leafOutline} aria-hidden="true" /></span><div><h3 title={treatment.name}>{treatment.name}</h3><span>{t(isRequiredMedication(treatment) ? "Plan asignado" : treatment.productType === "supplement" ? "Adicional" : "Fuera del plan")}</span></div><IonBadge className={`medications-badge medications-badge-${treatment.status}`}>{t(treatmentLabels[treatment.status])}</IonBadge></div>
            <p className="medications-treatment-dose">{new Intl.NumberFormat(locale).format(treatment.dosage)} {treatment.unit}{treatment.route ? ` · ${treatment.route}` : ""}</p>
            <div className="medications-times"><IonIcon icon={timeOutline} aria-hidden="true" />{treatment.times.join(" · ")}</div>
            {treatment.instructions && <p className="medications-instructions">{treatment.instructions}</p>}
            <div className="medications-treatment-meta"><span>{formatDateForDisplay(treatment.startDate)}{treatment.endDate ? ` — ${formatDateForDisplay(treatment.endDate)}` : ""}</span><span>{t(treatment.origin === "patient_reported" ? "Registrado por ti" : treatment.origin === "staff_recorded" ? "Registrado por tu equipo" : "Registro anterior")}</span></div>
            {capabilities.canManage && treatment.origin === "patient_reported" && treatment.status !== "completed" && <div className="medications-treatment-actions"><IonButton fill="clear" disabled={Boolean(busy)} onClick={() => void changeStatus(treatment, treatment.status === "paused" ? "active" : "paused")}><IonIcon icon={treatment.status === "paused" ? playOutline : pauseOutline} slot="start" />{t(treatment.status === "paused" ? "Reanudar" : "Pausar")}</IonButton><IonButton fill="clear" disabled={Boolean(busy)} onClick={() => void changeStatus(treatment, "completed")}>{t("Finalizar")}</IonButton></div>}
          </article>) : <section className="medications-state"><IonIcon icon={medicalOutline} aria-hidden="true" /><h3>{t("Aún no tienes medicamentos registrados")}</h3>{capabilities.canManage && <IonButton onClick={() => setAdding(true)}>{t("Añadir medicamento")}</IonButton>}</section>}
        </section>}
        {tab === "inventory" && owner && <PatientMedicationInventory owner={owner} canManage={capabilities.canManage}/>}
        {tab === "effects" && owner && <PatientMedicationEffects owner={owner} canManage={capabilities.canManage} treatments={workspace.treatments}/>}
        {tab === "history" && <section className="medications-history" aria-label={t("Historial de tomas")}>
          {workspace.history.length ? workspace.history.map(event => <article className="medications-history-row" key={event.id}><span className={`medications-history-icon medications-badge-${event.status}`}><IonIcon icon={event.status === "taken" ? checkmarkCircleOutline : closeOutline} aria-hidden="true" /></span><div><h3 title={event.name}>{event.name}</h3><span>{formatDateForDisplay(toLocalISODate(new Date(event.occurredAt)))} · {time(event.occurredAt)}</span>{event.reason && <p>{event.reason}</p>}</div><IonBadge className={`medications-badge medications-badge-${event.status}`}>{t(doseLabels[event.status])}</IonBadge></article>) : <section className="medications-state"><IonIcon icon={timeOutline} aria-hidden="true" /><h3>{t("Tu historial aparecerá aquí")}</h3></section>}
        </section>}
      </>}
    </Scroll>
  </Screen>;
}

function MedicationForm({ owner, onCancel, onSaved, onAccessError }: { owner: string; onCancel: () => void; onSaved: () => Promise<void>; onAccessError: () => void }) {
  const { t, lang } = useI18n();
  const dateId = useId().replace(/:/g, "");
  const [name, setName] = useState("");
  const [productType, setProductType] = useState<MedicationProductType>("medication");
  const [dosage, setDosage] = useState("");
  const [unit, setUnit] = useState("");
  const [route, setRoute] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState("08:00");
  const [timeZone, setTimeZone] = useState(currentTimeZone);
  const [startDate, setStartDate] = useState(toLocalISODate);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<{ signature: string; body: CreateMedicationRequest } | null>(null);
  const isCurrent = () => sessionUserId(getAccessToken()) === owner;
  const save = async () => {
    if (saving || !isCurrent()) return;
    const quantity = Number(dosage.replace(",", "."));
    const schedule = times.split(",").map(value => value.trim()).filter(Boolean).sort();
    let validZone = true;
    try { new Intl.DateTimeFormat("es", { timeZone }); } catch { validZone = false; }
    if (!name.trim() || !Number.isFinite(quantity) || quantity <= 0 || !unit.trim() || !validZone || schedule.length < 1 || schedule.length > 8 || new Set(schedule).size !== schedule.length || schedule.some(value => !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || (endDate && endDate < startDate)) {
      setError(t("Revisa la dosis, los horarios y las fechas.")); return;
    }
    const body = { medicationId: null, name: name.trim(), productType, dosage: quantity, unit: unit.trim(), route: route.trim(), instructions: instructions.trim(), times: schedule, timeZone: timeZone.trim(), startDate, endDate };
    const signature = JSON.stringify(body);
    if (!operation.current || operation.current.signature !== signature) operation.current = { signature, body: { ...body, clientRequestId: createMedicationRequestId() } };
    setSaving(true); setError(null);
    try {
      await createMyMedication(owner, operation.current.body);
      if (isCurrent()) await onSaved();
    } catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) {
        setError(t("No tienes acceso a este módulo.")); onAccessError();
      } else if (failure instanceof ApiError && failure.status === 400) setError(t("Revisa la dosis, los horarios y las fechas."));
      else if (failure instanceof ApiError && failure.status === 409) setError(t("El registro cambió. Actualiza e inténtalo de nuevo."));
      else setError(t("No pudimos guardar. Reintenta cuando tengas conexión."));
    } finally { if (isCurrent()) setSaving(false); }
  };
  return <section className="medications-form-section">
    <div className="medications-section-heading"><h2>{t("Añadir fuera del plan")}</h2><IonButton fill="clear" disabled={saving} onClick={onCancel}>{t("Cancelar")}</IonButton></div>
    <form className="medications-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <IonInput label={t("Nombre del medicamento")} labelPlacement="stacked" value={name} maxlength={200} required disabled={saving} onIonInput={event => setName(event.detail.value ?? "")} autocomplete="off" enterkeyhint="next" />
      <IonSelect label={t("Tipo de producto")} labelPlacement="stacked" value={productType} disabled={saving} interface="popover" onIonChange={event => setProductType(event.detail.value)}>{Object.entries(productLabels).map(([value, label]) => <IonSelectOption key={value} value={value}>{t(label)}</IonSelectOption>)}</IonSelect>
      <div className="medications-form-pair"><IonInput label={t("Cantidad por toma")} labelPlacement="stacked" inputmode="decimal" value={dosage} required disabled={saving} onIonInput={event => setDosage(event.detail.value ?? "")} placeholder="1" /><IonInput label={t("Unidad")} labelPlacement="stacked" value={unit} maxlength={40} required disabled={saving} onIonInput={event => setUnit(event.detail.value ?? "")} placeholder={t("tableta, ml…")} /></div>
      <IonInput label={t("Vía de administración")} labelPlacement="stacked" value={route} maxlength={80} disabled={saving} onIonInput={event => setRoute(event.detail.value ?? "")} />
      <IonInput label={t("Horarios")} labelPlacement="stacked" value={times} required disabled={saving} onIonInput={event => setTimes(event.detail.value ?? "")} placeholder="08:00, 20:00" />
      <IonInput label={t("Zona horaria")} labelPlacement="stacked" value={timeZone} required disabled={saving} onIonInput={event => setTimeZone(event.detail.value ?? "")} />
      <div className="medications-date-row"><span>{t("Fecha de inicio")}</span><IonDatetimeButton datetime={`${dateId}-start`} disabled={saving} /></div>
      <IonModal keepContentsMounted className="medications-date-modal"><IonDatetime id={`${dateId}-start`} presentation="date" locale={lang === "en" ? "en-US" : "es-ES"} value={startDate} showDefaultButtons doneText={t("Listo")} cancelText={t("Cancelar")} onIonChange={event => { const value = event.detail.value; if (typeof value === "string") setStartDate(value.slice(0, 10)); }} /></IonModal>
      <IonCheckbox checked={Boolean(endDate)} disabled={saving} onIonChange={event => setEndDate(event.detail.checked ? startDate : null)}>{t("Añadir fecha de finalización")}</IonCheckbox>
      {endDate && <><div className="medications-date-row"><span>{t("Fecha de finalización")}</span><IonDatetimeButton datetime={`${dateId}-end`} disabled={saving} /></div><IonModal keepContentsMounted className="medications-date-modal"><IonDatetime id={`${dateId}-end`} presentation="date" locale={lang === "en" ? "en-US" : "es-ES"} value={endDate} min={startDate} showDefaultButtons doneText={t("Listo")} cancelText={t("Cancelar")} onIonChange={event => { const value = event.detail.value; if (typeof value === "string") setEndDate(value.slice(0, 10)); }} /></IonModal></>}
      <IonTextarea label={t("Indicaciones")} labelPlacement="stacked" value={instructions} maxlength={2000} disabled={saving} autoGrow rows={3} onIonInput={event => setInstructions(event.detail.value ?? "")} />
      {error && <p role="alert" className="medications-error">{error}</p>}
      <IonButton type="submit" expand="block" disabled={saving}>{saving ? t("Guardando…") : t("Guardar medicamento")}</IonButton>
    </form>
  </section>;
}
