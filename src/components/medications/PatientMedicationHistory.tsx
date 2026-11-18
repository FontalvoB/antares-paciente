import { IonBadge, IonButton, IonIcon, IonProgressBar, IonSkeletonText } from "@ionic/react";
import { useQueries } from "@tanstack/react-query";
import {
  calendarOutline, checkmarkCircleOutline, closeOutline, leafOutline,
  medicalOutline, shieldCheckmarkOutline, sunnyOutline, timeOutline,
} from "ionicons/icons";
import type { CSSProperties } from "react";
import { useT } from "../../i18n/I18nContext";
import { addDaysToISO, formatDateForDisplay, toLocalISODate } from "../../utils/dates";
import { fetchMyMedications, isRequiredMedication } from "../../utils/medicationsApi";
import type { MedicationTreatment, MedicationWorkspace } from "../../utils/medicationsApi";

type Props = {
  owner: string;
  today: string;
  date: string;
  timeZone: string;
  locale: string;
  workspace: MedicationWorkspace;
};

function adherenceCounts(workspace: MedicationWorkspace) {
  if (workspace.adherence) return workspace.adherence;
  // Las versiones anteriores de la API tampoco contaban suplementos ni tomas futuras.
  const required = new Set(workspace.treatments.filter(isRequiredMedication).map(treatment => treatment.id));
  const now = Date.now();
  const due = workspace.doses.filter(dose => required.has(dose.treatmentId)
    && dose.status !== "cancelled" && Date.parse(dose.scheduledAt) <= now);
  return { dueDoses: due.length, takenDoses: due.filter(dose => dose.status === "taken").length };
}

function courseProgress(treatment: MedicationTreatment, today: string) {
  if (!treatment.endDate) return null;
  const total = Date.parse(addDaysToISO(treatment.endDate, 1)) - Date.parse(treatment.startDate);
  const elapsed = Date.parse(addDaysToISO(today, 1)) - Date.parse(treatment.startDate);
  return total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : null;
}

export function PatientMedicationHistory({ owner, today, date, timeZone, locale, workspace }: Props) {
  const t = useT();
  const dates = Array.from({ length: 7 }, (_, index) => addDaysToISO(today, index - 6));
  const daily = useQueries({
    queries: dates.map(day => ({
      queryKey: ["medications", "workspace", owner, day, timeZone],
      queryFn: ({ signal }) => fetchMyMedications(owner, day, timeZone, signal),
      enabled: day !== date,
      retry: false,
      gcTime: 0,
      refetchOnWindowFocus: "always" as const,
    })),
  });

  const counts = daily.map((query, index) => {
    const day = dates[index] === date ? workspace : query.data;
    return day ? adherenceCounts(day) : undefined;
  });
  const loading = daily.some(query => query.isLoading);
  const failed = daily.filter(query => query.isError && query.fetchStatus !== "fetching");
  const totals = counts.reduce((total, day) => ({
    due: total.due + (day?.dueDoses ?? 0),
    taken: total.taken + (day?.takenDoses ?? 0),
  }), { due: 0, taken: 0 });
  const percent = counts.every(Boolean) && !failed.length && totals.due > 0
    ? Math.round((100 * totals.taken) / totals.due) : null;
  const isCompleted = (treatment: MedicationTreatment) => treatment.status === "completed"
    || Boolean(treatment.endDate && treatment.endDate < today);
  const inProgress = workspace.treatments.filter(treatment => !isCompleted(treatment));
  const completed = workspace.treatments.filter(isCompleted);
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone });

  const renderTreatment = (treatment: MedicationTreatment, finished: boolean) => {
    const progress = finished ? null : courseProgress(treatment, today);
    const icon = treatment.productType === "vitamin" ? sunnyOutline
      : treatment.productType === "supplement" ? leafOutline : medicalOutline;

    return <article key={treatment.id} className="medications-history-treatment">
      <div className="medications-dose-product">
        <span className={`medications-product-icon medications-product-${treatment.productType}`}>
          <IonIcon icon={icon} aria-hidden="true" />
        </span>
        <div className="medications-history-treatment-details">
          <h3>{treatment.name}</h3>
          {!finished && <span>{treatment.times.join(" · ")}</span>}
        </div>
        <IonBadge className={`medications-badge medications-badge-${finished ? "completed" : treatment.status}`}>
          {t(finished ? "Finalizado" : treatment.status === "paused" ? "Pausado" : "Activo")}
        </IonBadge>
      </div>
      {progress !== null && <IonProgressBar value={progress} aria-label={t("Vigencia del tratamiento")} />}
      <p><IonIcon icon={calendarOutline} aria-hidden="true" />{treatment.endDate
        ? `${formatDateForDisplay(treatment.startDate)} – ${formatDateForDisplay(treatment.endDate)}`
        : t("Desde {date}", { date: formatDateForDisplay(treatment.startDate) })}</p>
    </article>;
  };

  return <div className="medications-history-view">
    <section className="medications-weekly-card" aria-label={t("Adherencia semanal")}>
      <div className="medications-weekly-heading">
        <div className="medications-progress-ring" style={{ "--med-progress": `${percent ?? 0}%` } as CSSProperties}>
          <span>{percent === null ? "—" : `${percent}%`}</span>
        </div>
        <div>
          <h2>{t("Adherencia semanal")}</h2>
          <p>{t("Tomas del plan en los últimos 7 días")}</p>
          {percent !== null && <p>{t("{taken} de {total} tomas", {
            taken: String(totals.taken), total: String(totals.due),
          })}</p>}
        </div>
      </div>
      {loading ? <IonSkeletonText animated className="medications-weekly-loading" />
        : <>
          <ol className="medications-weekly-bars" aria-label={t("Adherencia por día")}>
            {dates.map((day, index) => {
              const value = counts[index];
              const due = value?.dueDoses ?? 0;
              const taken = value?.takenDoses ?? 0;
              const ratio = due > 0 ? taken / due : 0;
              const dateValue = new Date(`${day}T12:00:00`);
              const description = !value ? t("Datos no disponibles")
                : due === 0 ? t("Sin tomas asignadas para evaluar")
                : t("{taken} de {total} tomas", { taken: String(taken), total: String(due) });
              return <li key={day}>
                <div className="medications-weekly-bar-track" role="img"
                  aria-label={`${dateFormat.format(dateValue)} · ${description}`}>
                  <div className={`medications-weekly-bar${ratio === 1 ? " is-full" : ratio > 0 ? " is-partial" : ""}`}
                    style={{ "--med-bar-fill": `${ratio * 100}%` } as CSSProperties} />
                </div>
                <span aria-hidden="true">{weekdayFormat.format(dateValue)}</span>
              </li>;
            })}
          </ol>
          {failed.length > 0 && <div className="medications-weekly-error" role="status">
            <p>{t("No pudimos cargar todos los días.")}</p>
            <IonButton fill="clear" size="small" onClick={() => {
              void Promise.all(failed.map(query => query.refetch()));
            }}>{t("Reintentar")}</IonButton>
          </div>}
          {failed.length === 0 && totals.due === 0 && <p>{t("Sin tomas asignadas para evaluar")}</p>}
        </>}
    </section>

    <section>
      <h2 className="medications-history-section-title">
        <span><IonIcon icon={medicalOutline} aria-hidden="true" /></span>{t("En curso")}
      </h2>
      {inProgress.length ? inProgress.map(treatment => renderTreatment(treatment, false))
        : <p className="medications-history-empty">{t("Sin tratamientos en curso")}</p>}
    </section>

    <section>
      <h2 className="medications-history-section-title">
        <span><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /></span>{t("Finalizados")}
      </h2>
      {completed.length ? completed.map(treatment => renderTreatment(treatment, true))
        : <p className="medications-history-empty">{t("Aún no hay tratamientos finalizados.")}</p>}
    </section>

    <section aria-label={t("Historial de tomas")}>
      <h2 className="medications-history-section-title">
        <span><IonIcon icon={timeOutline} aria-hidden="true" /></span>{t("Historial de tomas")}
      </h2>
      <div className="medications-history">
        {workspace.history.length ? workspace.history.map(event => {
          const occurredAt = new Date(event.occurredAt);
          return <article className="medications-history-row" key={event.id}>
            <span className={`medications-history-icon medications-badge-${event.status}`}>
              <IonIcon icon={event.status === "taken" ? checkmarkCircleOutline : closeOutline} aria-hidden="true" />
            </span>
            <div>
              <h3 title={event.name}>{event.name}</h3>
              <span>{formatDateForDisplay(toLocalISODate(occurredAt))} · {timeFormat.format(occurredAt)}</span>
              {event.reason && <p>{event.reason}</p>}
            </div>
            <IonBadge className={`medications-badge medications-badge-${event.status}`}>
              {t(event.status === "taken" ? "Tomado" : "Omitido")}
            </IonBadge>
          </article>;
        }) : <p className="medications-history-empty">{t("Tu historial aparecerá aquí")}</p>}
      </div>
    </section>
  </div>;
}
