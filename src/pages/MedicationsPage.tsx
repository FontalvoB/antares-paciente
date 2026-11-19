import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IonActionSheet, IonAlert, IonBadge, IonButton, IonCheckbox, IonDatetime, IonDatetimeButton, IonIcon,
  IonInput, IonModal, IonSegment, IonSegmentButton, IonSelect, IonSelectOption,
  IonSkeletonText, IonSpinner, IonTextarea, IonContent,
} from "@ionic/react";
import {
  addOutline, cameraOutline, cubeOutline, warningOutline, sunnyOutline, partlySunnyOutline, moonOutline, checkmarkCircleOutline, closeOutline, flaskOutline,
  createOutline, leafOutline, medicalOutline, pauseOutline, playOutline,
  notificationsOutline, refreshOutline, timeOutline,
} from "ionicons/icons";
import { Capacitor } from "@capacitor/core";
import { captureMedicationLabel, matchesMedicationLabel } from "../services/media/medication-label";
import { FoodPhotoStage } from "../components/nutrition/FoodPhotoStage";
import { Screen, Scroll } from "../components/Screen";
import {PatientMedicationInventory} from "../components/medications/PatientMedicationInventory";
import { MedicationReminderSettings } from "../components/medications/MedicationReminderSettings";
import { PatientMedicationHistory } from "../components/medications/PatientMedicationHistory";
import {PatientMedicationEffects} from "../components/medications/PatientMedicationEffects";
import { LanguageToggle } from "../components/LanguageToggle";
import { useApp } from "../context/AppContext";
import { useI18n } from "../i18n/I18nContext";
import { fetchMyInventory, isLowMedicationStock } from "../utils/medicationMonitoringApi";
import { useMedicationLiveRefresh } from "../hooks/useDailyMedications";
import { useMedicationCapabilities } from "../hooks/useMedicationCapabilities";
import { ApiError } from "../utils/apiClient";
import { getAccessToken } from "../utils/authApi";
import { sessionUserId } from "../utils/sessionIdentity";
import { formatDateForDisplay, toLocalISODate } from "../utils/dates";
import {
  createMedicationRequestId, createMyMedication, fetchMyMedications, isRequiredMedication, recordMyMedicationDose, setMyMedicationStatus, snoozeMyMedicationDose,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDose, setSelectedDose] = useState<MedicationDose | null>(null);
  const [captureState, setCaptureState] = useState<"ready" | "reading" | "no-match" | "unavailable" | "matched" | "manual">("ready");
  const [omittingDose, setOmittingDose] = useState<MedicationDose | null>(null);
  const [snoozingDose, setSnoozingDose] = useState<MedicationDose | null>(null);
  const [snoozedDoses, setSnoozedDoses] = useState<ReadonlySet<string>>(() => new Set());
  const scanInProgress = useRef(false);
  const savingDose = useRef(false);
  const eventOperations = useRef(new Map<string, RecordMedicationDoseRequest>());
  const today = toLocalISODate(new Date(now));
  const date = selectedDate ?? today;
  const isToday = date === today;
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
  useMedicationLiveRefresh(owner, capabilities.enabled ? query.data?.version : undefined);
  const inventory = useQuery({
    queryKey: ["medications", "inventory", owner, 1],
    queryFn: ({ signal }) => fetchMyInventory(owner!, 1, signal),
    enabled: Boolean(owner && capabilities.enabled && tab === "today"),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const isCurrent = () => Boolean(owner && sessionUserId(getAccessToken()) === owner);
  const refresh = async () => {
    if (!isCurrent()) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["medications", "workspace", owner] }),
      queryClient.invalidateQueries({ queryKey: ["medications", "inventory", owner] }),
    ]);
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
  const recordDose = async (dose: MedicationDose, status: RecordMedicationDoseRequest["status"]) => {
    if (!owner || busy || savingDose.current || !capabilities.canManage || !isCurrent() ||
        !query.data?.doses.some(current => current.id === dose.id && current.revision === dose.revision && current.status === (status === "pending" ? "taken" : "pending")) ||
        Date.parse(dose.scheduledAt) > Date.now()) return;
    const key = `${dose.id}:${dose.revision}:${status}`;
    const operation = eventOperations.current.get(key) ?? {
      clientRequestId: createMedicationRequestId(), status, occurredAt: new Date().toISOString(),
      reason: null, expectedRevision: dose.revision, scheduledAt: dose.scheduledAt,
    };
    eventOperations.current.set(key, operation);
    savingDose.current = true;
    setBusy(dose.id); setActionError(null);
    try {
      await recordMyMedicationDose(owner, dose.id, operation);
      if (!isCurrent()) return;
      setSelectedDose(null);
      await refresh();
      showToast(t(status === "pending" ? "Toma deshecha" : "Toma guardada"), "ok");
    } catch (error) { failure(error); }
    finally {
      savingDose.current = false;
      if (isCurrent()) setBusy(null);
    }
  };
  const snoozeDose = async (dose: MedicationDose, minutes: 15 | 30) => {
    if (!owner || busy || savingDose.current || !capabilities.canSnooze || !isCurrent()) return;
    savingDose.current = true;
    setBusy(dose.id);
    setActionError(null);
    try {
      await snoozeMyMedicationDose(owner, dose, minutes);
      if (isCurrent()) {
        if (quickDoseActions) await refresh();
        else setSnoozedDoses(previous => new Set([...previous, dose.id]));
        showToast(t("Recordatorio pospuesto"), "ok");
      }
    } catch (error) {
      failure(error);
    } finally {
      savingDose.current = false;
      if (isCurrent()) setBusy(null);
    }
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
  const quickDoseActions = Boolean(workspace?.version);
  const canScan = Capacitor.isPluginAvailable("MedicationLabel");
  const doseStillPending = selectedDose && workspace?.doses.some(dose =>
    dose.id === selectedDose.id && dose.revision === selectedDose.revision && dose.status === "pending",
  );
  const scan = async () => {
    if (!selectedDose || !workspace || scanInProgress.current || !isCurrent()) return;
    const selected = workspace.treatments.find(treatment => treatment.id === selectedDose.treatmentId);
    if (!selected) { setCaptureState("no-match"); return; }
    scanInProgress.current = true;
    setPhotoPreview(null);
    setCaptureState("reading");
    try {
      const photo = await captureMedicationLabel();
      if (!isCurrent()) return;
      if (!photo) { setCaptureState("ready"); return; }
      setPhotoPreview(photo.dataUrl);
      // Deja pintar la foto y el barrido antes de invocar OCR nativo.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const text = await photo.read();
      if (isCurrent()) setCaptureState(matchesMedicationLabel(text, selected, workspace.treatments) ? "matched" : "no-match");
    } catch {
      if (isCurrent()) setCaptureState("unavailable");
    } finally {
      scanInProgress.current = false;
    }
  };
  const unavailable = !capabilities.isLoading && !capabilities.enabled;
  const accessDenied = query.error instanceof ApiError && [403, 404].includes(query.error.status);
  const loading = capabilities.isLoading || (capabilities.enabled && query.isLoading);
  const time = (value: string, zone?: string) => new Intl.DateTimeFormat(locale, {
    hour: "2-digit", minute: "2-digit", ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(value));

  const supplementIds = new Set(workspace?.treatments.filter(t => t.productType === "supplement").map(t => t.id));
  const assignedIds = new Set(workspace?.treatments.filter(isRequiredMedication).map(t => t.id));
  const mainDoses = (workspace?.doses.filter(d => assignedIds.has(d.treatmentId) && d.status !== "cancelled") ?? [])
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
  const nextDose = mainDoses.find(dose => dose.status === "pending");
  const reportedDoses = workspace?.doses.filter(d => !assignedIds.has(d.treatmentId) && !supplementIds.has(d.treatmentId)) ?? [];
  const adherence = workspace?.adherence;
  const deviating = Boolean(adherence && adherence.offPlanTakenDoses > 0 && adherence.dueDoses > adherence.takenDoses);
  const extraDoses = workspace?.doses.filter(d => supplementIds.has(d.treatmentId)) ?? [];
  const hasExtra = workspace?.treatments.some(t => t.productType === "supplement" && t.status === "active");
  const renderDose = (dose: MedicationDose) => {
    const scheduledAt = Date.parse(dose.scheduledAt);
    const future = scheduledAt > now;
    const pending = dose.status === "pending";
    const isNext = dose.id === nextDose?.id;
    const overdue = quickDoseActions && pending && scheduledAt + 60 * 60_000 < now;
    const snoozed = snoozedDoses.has(dose.id) || (dose.snoozedUntil != null && Date.parse(dose.snoozedUntil) > now);
    const showPhoto = () => {
      setActionError(null);
      setPhotoPreview(null);
      setCaptureState(canScan ? "ready" : "unavailable");
      setSelectedDose(dose);
    };
    const treatment = workspace?.treatments.find(treatment => treatment.id === dose.treatmentId);
    const kind = treatment?.productType ?? "medication";
    const instructions = dose.instructions ?? treatment?.instructions;
    return <article className={`medications-dose medications-dose-${dose.status}${isNext ? " medications-dose-next" : ""}`} key={dose.id}>
      {isNext && <span className="medications-next-label">{t(future ? "Próxima toma" : "Toma pendiente")}</span>}
      <div className="medications-dose-line"><span className="medications-time"><IonIcon icon={timeOutline} aria-hidden="true" />{time(dose.scheduledAt, dose.timeZone)}</span><IonBadge className={`medications-badge medications-badge-${overdue ? "overdue" : dose.status}`}>{t(overdue ? "Atrasada" : doseLabels[dose.status])}</IonBadge></div>
      <div className="medications-dose-product">
        <span className={`medications-product-icon medications-product-${kind}`}><IonIcon icon={kind === "vitamin" ? sunnyOutline : kind === "supplement" ? leafOutline : medicalOutline} aria-hidden="true" /></span>
        <div><h3 title={dose.name}>{dose.name}</h3>
          <span className="medications-dose-quantity">{new Intl.NumberFormat(locale).format(dose.dosage)} {dose.unit}</span>
        </div>
      </div>
      {instructions && <p>{instructions}</p>}
      {pending && capabilities.canManage ? <div className="medications-dose-actions">
        <IonButton fill="outline" disabled={Boolean(busy) || future} onClick={() => {
          if (quickDoseActions) void recordDose(dose, "omitted");
          else setOmittingDose(dose);
        }}>
          {t("Omitir")}
        </IonButton>
        <IonButton className={quickDoseActions ? undefined : "medications-photo-action"}
          disabled={Boolean(busy) || future} onClick={() => {
            if (quickDoseActions) void recordDose(dose, "taken");
            else showPhoto();
          }}>
          <IonIcon icon={quickDoseActions || !canScan ? checkmarkCircleOutline : cameraOutline} slot="start" />
          {t(quickDoseActions ? "Ya lo tomé" : "Registrar toma")}
        </IonButton>
        {quickDoseActions && canScan && <IonButton className="medications-photo-optional" fill="outline"
          disabled={Boolean(busy) || future} onClick={showPhoto}>
          <IonIcon icon={cameraOutline} slot="start" />
          {t("Registrar con foto")}
        </IonButton>}
      </div> : dose.occurredAt ? <span className="medications-recorded">
        <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
        {t("Registrado a las {time}", { time: time(dose.occurredAt, dose.timeZone) })}
      </span> : null}
      {dose.status === "taken" && capabilities.canManage && dose.undoUntil && Date.parse(dose.undoUntil) > now && (
        <IonButton fill="clear" size="small" disabled={Boolean(busy)} onClick={() => void recordDose(dose, "pending")}>
          {t("Deshacer toma")}
        </IonButton>
      )}
      {pending && !future && capabilities.canSnooze &&
        Date.now() - Date.parse(dose.scheduledAt) < 100 * 60_000 && (
        <IonButton className="medications-snooze" fill="clear" size="small"
          disabled={Boolean(busy) || snoozed} onClick={() => {
            if (quickDoseActions) void snoozeDose(dose, 15);
            else setSnoozingDose(dose);
          }}>
          {t(snoozed ? "Recordatorio pospuesto" : quickDoseActions ? "Posponer 15 min" : "Posponer recordatorio")}
        </IonButton>
      )}
      {pending && !future && capabilities.canSnooze && quickDoseActions && !snoozed &&
        now - scheduledAt < 100 * 60_000 && (
        <IonButton className="medications-snooze" fill="clear" size="small"
          disabled={Boolean(busy)} onClick={() => void snoozeDose(dose, 30)}>
          {t("Posponer 30 min")}
        </IonButton>
      )}
    </article>;
  };

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${today}T12:00:00`);
    day.setDate(day.getDate() + index - 3);
    return { day, key: toLocalISODate(day) };
  });
  const visibleDoses = [...mainDoses, ...reportedDoses, ...extraDoses].filter(dose => dose.status !== "cancelled");
  const taken = visibleDoses.filter(dose => dose.status === "taken").length;
  const due = visibleDoses.filter(dose => dose.status === "pending" && Date.parse(dose.scheduledAt) <= Date.now()).length;
  const progress = visibleDoses.length ? (taken / visibleDoses.length) * 100 : 0;
  const lowStock = (inventory.data?.items ?? []).filter(isLowMedicationStock);
  const firstLowStock = lowStock[0];
  const lowStockCount = inventory.data && inventory.data.total === inventory.data.items.length
    ? lowStock.length : "—";
  const agenda = new Map<string, MedicationDose[]>();
  for (const dose of mainDoses) {
    const group = agenda.get(dose.scheduledAt) ?? [];
    group.push(dose);
    agenda.set(dose.scheduledAt, group);
  }
  return <Screen className="medications-page">
    <header className="medications-header">
      <div className="medications-heading-row">
        <span className="medications-heading-icon"><IonIcon icon={medicalOutline} aria-hidden="true" /></span>
        <h1>{t("Mi medicación")}</h1>
      </div>
      <div className="medications-header-actions"><LanguageToggle />
        {quickDoseActions && capabilities.canManage && (
          <IonButton fill="clear" aria-label={t("Recordatorios de medicación")} onClick={() => setSettingsOpen(true)}>
            <IonIcon slot="icon-only" icon={notificationsOutline} />
          </IonButton>
        )}
        <IonButton fill="clear" aria-label={t("Actualizar medicamentos")} disabled={loading || query.isFetching} onClick={() => { void capabilities.refresh(); void refresh(); }}><IonIcon slot="icon-only" icon={refreshOutline} /></IonButton></div>
    </header>
    <Scroll className="medications-scroll">
      {loading ? <section className="medications-loading" role="status" aria-label={t("Cargando medicamentos")}><IonSkeletonText animated style={{ width: "55%", height: 24 }} /><IonSkeletonText animated style={{ width: "100%", height: 122 }} /><IonSkeletonText animated style={{ width: "100%", height: 122 }} /></section> :
      unavailable ? <section className="medications-state"><IonIcon icon={medicalOutline} aria-hidden="true" /><h2>{t("Control de medicamentos no disponible")}</h2><IonButton onClick={() => navigate("prof")}>{t("Ir a mi perfil")}</IonButton></section> :
      query.isError || !workspace ? <section className="medications-state" role="alert"><IonIcon icon={refreshOutline} aria-hidden="true" /><h2>{t(accessDenied ? "No tienes acceso a este módulo." : "No pudimos cargar tus medicamentos")}</h2>{accessDenied ? <IonButton onClick={() => navigate("prof")}>{t("Ir a mi perfil")}</IonButton> : <IonButton onClick={() => { void query.refetch(); }}>{t("Reintentar")}</IonButton>}</section> :
      adding && owner ? <MedicationForm owner={owner} onCancel={() => setAdding(false)} onSaved={async () => { if (!isCurrent()) return; await refresh(); setAdding(false); setSelectedDate(null); setTab("today"); showToast(t("Medicamento guardado"), "ok"); }} onAccessError={() => { void capabilities.refresh(); }} /> : <>
        <IonSegment className="medications-tabs" value={tab} onIonChange={event => { setTab(String(event.detail.value ?? "today")); setActionError(null); }} aria-label={t("Secciones de medicamentos")}>
          <IonSegmentButton value="today"><span>{t("Hoy")}</span></IonSegmentButton>
          <IonSegmentButton value="treatments"><span>{t("Mi lista")}</span></IonSegmentButton>
          <IonSegmentButton value="inventory"><span>{t("Inventario")}</span></IonSegmentButton>
          <IonSegmentButton value="effects"><span>{t("Reportes")}</span></IonSegmentButton>
          <IonSegmentButton value="history"><span>{t("Historial")}</span></IonSegmentButton>
        </IonSegment>
        {tab === "today" && <>
          <div className="medications-calendar">
            <p>{new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(`${date}T12:00:00`))}</p>
            <div className="medications-week">
              {week.map(({ day, key }) => <button key={key} type="button" aria-pressed={date === key}
                aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(day)}
                className={date === key ? "medications-day is-selected" : "medications-day"}
                onClick={() => setSelectedDate(key)}>
                <span><small>{new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(day)}</small><strong>{day.getDate()}</strong></span>
              </button>)}
            </div>
          </div>
          <section className="medications-overview">
            <div className="medications-overview-main">
              <div className="medications-progress-ring" role="img" style={{ "--med-progress": `${progress}%` } as React.CSSProperties}
                aria-label={t("{taken} de {total} tomas", { taken: String(taken), total: String(visibleDoses.length) })}>
                <span>{taken}/{visibleDoses.length}</span>
              </div>
              <div><p>{t(isToday ? "Tomas de hoy" : "Tomas programadas")}</p>
                <strong>{t("{count} por registrar", { count: String(due) })}</strong>
                {nextDose && <small>{nextDose.name} · {time(nextDose.scheduledAt, nextDose.timeZone)}</small>}
              </div>
            </div>
            <div className="medications-metrics">
              <div><IonIcon icon={cubeOutline} aria-hidden="true" /><strong>{workspace.summary.activeTreatments}</strong><span>{t("Tratamientos")}</span></div>
              <div><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /><strong>{adherence?.percent == null ? "—" : `${adherence.percent}%`}</strong><span>{t("Adherencia al plan")}</span></div>
              <div className="medications-metric-stock"><IonIcon icon={warningOutline} aria-hidden="true" /><strong>{lowStockCount}</strong><span>{t("Por agotarse")}</span></div>
            </div>
            {deviating && <p>{t("No estás siguiendo el plan asignado")}</p>}
          </section>
        </>}
        {capabilities.canManage && <IonButton className="medications-add" size="small" onClick={() => setAdding(true)}><IonIcon slot="start" icon={addOutline} />{t("Añadir medicamento")}</IonButton>}
        {actionError && !selectedDose && <p role="alert" className="medications-error">{actionError}</p>}
        {tab === "today" && <section className="medications-today" aria-label={t(isToday ? "Dosis de hoy" : "Tomas programadas")}>
          {firstLowStock && <div className="medications-low-stock">
            <span><IonIcon icon={cubeOutline} aria-hidden="true" /></span>
            <div><strong>{firstLowStock.name}</strong><small>{lowStock.length > 1
              ? t("{count} productos por agotarse", { count: String(lowStock.length) })
              : t("Por agotarse")}</small></div>
            <IonButton fill="clear" size="small" onClick={() => setTab("inventory")}>{t("Ver inventario")}</IonButton>
          </div>}
          <section aria-label={t("Plan asignado")}>
            <div className="medications-section-heading"><h2>{t("Plan asignado")}</h2></div>
            {mainDoses.length ? <div className="medications-dose-list">{Array.from(agenda).map(([scheduledAt, doses]) => {
              if (!doses?.length) return null;
              const zone = doses[0].timeZone;
              const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: zone }).format(new Date(scheduledAt)));
              return <section className="medications-time-group" key={scheduledAt}>
                <h3><span><IonIcon icon={hour < 12 ? sunnyOutline : hour < 18 ? partlySunnyOutline : moonOutline} aria-hidden="true" /></span>
                  {time(scheduledAt, zone)} <small>{t(hour < 12 ? "Mañana" : hour < 18 ? "Tarde" : "Noche")}</small></h3>
                {doses.map(renderDose)}
              </section>;
            })}</div> : <p>{t(isToday ? "Sin tomas asignadas para hoy" : "Sin tomas asignadas para esta fecha")}</p>}
          </section>
          {reportedDoses.length > 0 && <section className="medications-reported" aria-label={t("Fuera del plan")}>
            <div className="medications-section-heading"><h2>{t("Fuera del plan")}</h2><IonBadge className="medications-badge">{t("Registrado por ti")}</IonBadge></div>
            <p>{t("Estas tomas no sustituyen tu plan.")}</p>
            <div className="medications-extra-list">{reportedDoses.map(renderDose)}</div>
          </section>}
        {hasExtra && <section className="medications-extra" aria-label={t("Nutracéutico")}><div className="medications-section-heading"><div><IonIcon icon={leafOutline} aria-hidden="true" /><h2>{t("Nutracéutico")}</h2><span>{t("Adicional")}</span></div></div>{extraDoses.length ? <div className="medications-extra-list">{extraDoses.map(renderDose)}</div> : <p>{t(isToday ? "Sin tomas programadas para hoy" : "Sin tomas programadas para esta fecha")}</p>}</section>}
        </section>}
        {tab === "treatments" && <section className="medications-treatment-list" aria-label={t("Mis medicamentos")}>
          {workspace.treatments.length ? workspace.treatments.map(treatment => <article className="medications-treatment" key={treatment.id}>
            <div className="medications-treatment-heading"><span className={`medications-product-icon medications-product-${treatment.productType}`}><IonIcon icon={treatment.productType === "medication" ? medicalOutline : treatment.productType === "vitamin" ? flaskOutline : leafOutline} aria-hidden="true" /></span><div><h3 title={treatment.name}>{treatment.name}</h3><span>{t(isRequiredMedication(treatment) ? "Plan asignado" : treatment.productType === "supplement" ? "Adicional" : "Fuera del plan")}</span></div><IonBadge className={`medications-badge medications-badge-${treatment.status}`}>{t(treatmentLabels[treatment.status])}</IonBadge></div>
            <p className="medications-treatment-dose">{new Intl.NumberFormat(locale).format(treatment.dosage)} {treatment.unit}{treatment.route ? ` · ${treatment.route}` : ""}</p>
            <div className="medications-times"><IonIcon icon={timeOutline} aria-hidden="true" />{treatment.intervalHours
              ? t("Cada {hours} horas desde las {time}", { hours: String(treatment.intervalHours), time: treatment.times[0] })
              : treatment.times.join(" · ")}
              {treatment.weekdayMask && <span> · {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
                .filter((_, i) => Boolean(treatment.weekdayMask! & (1 << i))).map(label => t(label)).join(", ")}</span>}
            </div>
            {treatment.instructions && <p className="medications-instructions">{treatment.instructions}</p>}
            <div className="medications-treatment-meta"><span>{formatDateForDisplay(treatment.startDate)}{treatment.endDate ? ` — ${formatDateForDisplay(treatment.endDate)}` : ""}</span><span>{t(treatment.origin === "patient_reported" ? "Registrado por ti" : treatment.origin === "staff_recorded" ? "Registrado por tu equipo" : "Registro anterior")}</span></div>
            {capabilities.canManage && treatment.origin === "patient_reported" && treatment.status !== "completed" && <div className="medications-treatment-actions"><IonButton fill="clear" disabled={Boolean(busy)} onClick={() => void changeStatus(treatment, treatment.status === "paused" ? "active" : "paused")}><IonIcon icon={treatment.status === "paused" ? playOutline : pauseOutline} slot="start" />{t(treatment.status === "paused" ? "Reanudar" : "Pausar")}</IonButton><IonButton fill="clear" disabled={Boolean(busy)} onClick={() => void changeStatus(treatment, "completed")}>{t("Finalizar")}</IonButton></div>}
          </article>) : <section className="medications-state"><IonIcon icon={medicalOutline} aria-hidden="true" /><h3>{t("Aún no tienes medicamentos registrados")}</h3>{capabilities.canManage && <IonButton onClick={() => setAdding(true)}>{t("Añadir medicamento")}</IonButton>}</section>}
        </section>}
        {tab === "inventory" && owner && <PatientMedicationInventory owner={owner} canManage={capabilities.canManage}/>}
        {tab === "effects" && owner && <PatientMedicationEffects owner={owner} canManage={capabilities.canManage} treatments={workspace.treatments}/>}
        {tab === "history" && owner && <PatientMedicationHistory
          owner={owner} today={today} date={date} timeZone={timeZone} locale={locale} workspace={workspace}
        />}
      </>}
    </Scroll>
    {owner && settingsOpen && <MedicationReminderSettings owner={owner} onClose={() => setSettingsOpen(false)} />}
    <IonAlert
      isOpen={Boolean(omittingDose)}
      header={t("¿Seguro que quieres omitir esta toma?")}
      subHeader={omittingDose?.name}
      message={t("Se registrará como omitida en tu historial.")}
      buttons={[
        { text: t("Cancelar"), role: "cancel" },
        { text: t("Omitir toma"), role: "destructive" },
      ]}
      onDidDismiss={event => {
        setOmittingDose(null);
        if (event.detail.role === "destructive" && omittingDose) void recordDose(omittingDose, "omitted");
      }}
    />
    <IonActionSheet isOpen={Boolean(snoozingDose)} header={t("Posponer recordatorio")}
      onDidDismiss={() => setSnoozingDose(null)}
      buttons={[
        { text: t("15 minutos"), handler: () => { if (snoozingDose) void snoozeDose(snoozingDose, 15); } },
        { text: t("30 minutos"), handler: () => { if (snoozingDose) void snoozeDose(snoozingDose, 30); } },
        { text: t("Cancelar"), role: "cancel" },
      ]} />
    <IonModal isOpen={Boolean(selectedDose)} className={`medications-capture-modal${photoPreview && (captureState === "reading" || captureState === "matched") ? " is-processing" : ""}`}
      aria-label={t("Registrar toma")} backdropDismiss={false}
      onDidDismiss={() => { setSelectedDose(null); setPhotoPreview(null); }}>
      {selectedDose && <IonContent>
        {photoPreview && captureState === "reading" ? <div className="medications-scan-stage">
          <FoodPhotoStage src={photoPreview} analyzing variant="medication" />
        </div> : <section className="medications-capture">
          <IonButton className="medications-capture-close" fill="clear" aria-label={t("Cerrar")}
            disabled={captureState === "reading" || Boolean(busy)} onClick={() => setSelectedDose(null)}>
            <IonIcon icon={closeOutline} slot="icon-only" />
          </IonButton>
          <span className="medications-capture-icon">
            <IonIcon icon={captureState === "manual" || !canScan ? createOutline : cameraOutline} aria-hidden="true" />
          </span>
          <h2>{t("Registrar toma")}</h2>
          <div className="medications-capture-dose">
            <strong>{selectedDose.name}</strong>
            <span>{new Intl.NumberFormat(locale).format(selectedDose.dosage)} {selectedDose.unit} · {time(selectedDose.scheduledAt, selectedDose.timeZone)}</span>
          </div>
          {captureState === "matched" || captureState === "manual" ? <>
            {photoPreview && captureState === "matched" && <FoodPhotoStage src={photoPreview} variant="medication" />}
            <p role="status">{captureState === "matched"
              ? t("El nombre coincide con tu registro. Verifica el empaque y confirma solo si ya tomaste esta dosis.")
              : t("Confirma solo si ya tomaste la dosis indicada arriba.")}</p>
            <IonButton expand="block" disabled={Boolean(busy) || !capabilities.canManage || !doseStillPending}
              onClick={() => void recordDose(selectedDose, "taken")}>
              {busy ? t("Guardando…") : t("Confirmar toma")}
            </IonButton>
            {captureState === "matched" && <IonButton fill="clear" expand="block" disabled={Boolean(busy)} onClick={() => void scan()}>{t("Repetir foto")}</IonButton>}
          </> : <>
            <p role="status">{t(captureState === "reading" ? "Leyendo la etiqueta…"
              : captureState === "no-match" ? "No hubo una coincidencia clara. Repite la foto o registra la toma manualmente."
              : !canScan ? "Puedes registrar esta toma manualmente."
              : captureState === "unavailable" ? "No pudimos usar la cámara o leer la etiqueta."
              : "Fotografía el empaque con el nombre y la concentración visibles.")}</p>
            {canScan && <IonButton expand="block" disabled={captureState === "reading"} onClick={() => void scan()}>
              {captureState === "reading" ? <IonSpinner name="crescent" aria-hidden="true" /> : <IonIcon icon={cameraOutline} slot="start" />}
              {t(captureState === "reading" ? "Leyendo la etiqueta…" : captureState === "ready" ? "Tomar foto" : "Repetir foto")}
            </IonButton>}
            <IonButton className="medications-capture-manual" expand="block" fill={canScan ? "outline" : "solid"}
              disabled={captureState === "reading"} onClick={() => {
                setPhotoPreview(null);
                setCaptureState("manual");
              }}>
              <IonIcon icon={createOutline} slot="start" aria-hidden="true" />
              {t("Registrar manualmente")}
            </IonButton>
          </>}
          {(actionError || !doseStillPending) && <p role="alert" className="medications-error">
            {actionError ?? t("El registro cambió. Actualiza e inténtalo de nuevo.")}
          </p>}
        </section>}
      </IonContent>}
    </IonModal>
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
