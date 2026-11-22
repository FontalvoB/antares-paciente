import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTextarea,
} from "@ionic/react";
import { addOutline, pulseOutline } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { useApp } from "../../context/AppContext";
import {
  createMedicationRequestId,
  type MedicationTreatment,
} from "../../utils/medicationsApi";
import { getAccessToken } from "../../utils/authApi";
import { sessionUserId } from "../../utils/sessionIdentity";
import { formatDateForDisplay, toLocalISODate } from "../../utils/dates";
import {
  fetchMyEffects,
  reportMyEffect,
  type EffectRequest,
} from "../../utils/medicationMonitoringApi";
const statuses = {
  open: "Abierto",
  follow_up: "En seguimiento",
  resolved: "Resuelto",
} as const;
const severities = {
  mild: "Leve",
  moderate: "Moderado",
  severe: "Intenso",
} as const;
export function PatientMedicationEffects({
  owner,
  canManage,
  treatments,
}: {
  owner: string;
  canManage: boolean;
  treatments: MedicationTreatment[];
}) {
  const { t } = useI18n(),
    { showToast } = useApp(),
    cache = useQueryClient();
  const [adding, setAdding] = useState(false);
  const query = useQuery({
    queryKey: ["medications", "effects", owner],
    queryFn: ({ signal }) => fetchMyEffects(owner, signal),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const valid = () => sessionUserId(getAccessToken()) === owner;
  if (adding)
    return (
      <EffectForm
        owner={owner}
        treatments={treatments}
        onCancel={() => setAdding(false)}
        onSaved={async () => {
          if (!valid()) return;
          await cache.invalidateQueries({
            queryKey: ["medications", "effects", owner],
          });
          setAdding(false);
          showToast(t("Reporte guardado"), "ok");
        }}
      />
    );
  return (
    <section className="medications-effects">
      {canManage && (
        <IonButton className="medications-effect-cta" expand="block" onClick={() => setAdding(true)}>
          <span className="medications-monitoring-icon"><IonIcon icon={pulseOutline} aria-hidden="true" /></span>
          <span>{t("Reportar síntoma")}</span>
          <IonIcon icon={addOutline} slot="end" aria-hidden="true" />
        </IonButton>
      )}
      <div className="medications-section-heading">
        <div><IonIcon icon={pulseOutline} aria-hidden="true" /><h2>{t("Síntomas reportados")}</h2></div>
      </div>
      {query.isLoading ? (
        <IonSkeletonText animated className="medications-monitoring-skeleton" />
      ) : query.isError ? (
        <section role="alert">
          <p>{t("No pudimos cargar los reportes")}</p>
          <IonButton fill="outline" onClick={() => void query.refetch()}>
            {t("Reintentar")}
          </IonButton>
        </section>
      ) : query.data?.length ? (
        query.data.map((report) => (
          <IonCard className={`medications-effect-card medications-effect-${report.severity}`} key={report.id}>
            <IonCardHeader className="medications-monitoring-heading">
              <span className="medications-monitoring-icon"><IonIcon icon={pulseOutline} aria-hidden="true" /></span>
              <div>
                <IonCardTitle>{report.symptom}</IonCardTitle>
                <div className="medications-effect-meta">
                  <span>{formatDateForDisplay(toLocalISODate(new Date(report.occurredAt)))}</span>
                  <IonBadge className="medications-badge">{t(statuses[report.status])}</IonBadge>
                </div>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <p>
                {t(severities[report.severity])}
                {report.treatmentName ? " · " + report.treatmentName : ""}
              </p>
              {report.notes && <p>{report.notes}</p>}
              {report.followUps.map((note) => (
                <div className="medications-effect-note" key={note.id}>
                  <span>
                    {formatDateForDisplay(
                      toLocalISODate(new Date(note.createdAt)),
                    )}{" "}
                    ·{" "}
                    {t(
                      statuses[note.status as keyof typeof statuses] ??
                        "En seguimiento",
                    )}
                  </span>
                  <p>{note.note}</p>
                </div>
              ))}
            </IonCardContent>
          </IonCard>
        ))
      ) : (
        <p className="medications-monitoring-empty">
          {t("Sin síntomas reportados")}
        </p>
      )}
    </section>
  );
}
function EffectForm({
  owner,
  treatments,
  onSaved,
  onCancel,
}: {
  owner: string;
  treatments: MedicationTreatment[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [symptom, setSymptom] = useState(""),
    [treatmentId, setTreatmentId] = useState(""),
    [severity, setSeverity] = useState<EffectRequest["severity"]>("mild"),
    [notes, setNotes] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const operation = useRef<{ signature: string; body: EffectRequest } | null>(
    null,
  );
  const valid = () => sessionUserId(getAccessToken()) === owner;
  async function save() {
    if (saving || !valid()) return;
    if (!symptom.trim()) {
      setError(t("Escribe el síntoma."));
      return;
    }
    const body = {
      treatmentId: treatmentId || null,
      symptom: symptom.trim(),
      severity,
      notes: notes.trim() || null,
    };
    const signature = JSON.stringify(body);
    if (operation.current?.signature !== signature)
      operation.current = {
        signature,
        body: { ...body, clientRequestId: createMedicationRequestId() },
      };
    setSaving(true);
    setError("");
    try {
      await reportMyEffect(owner, operation.current.body);
      if (valid()) await onSaved();
    } catch {
      if (valid())
        setError(t("No pudimos guardar. Actualiza e inténtalo de nuevo."));
    } finally {
      if (valid()) setSaving(false);
    }
  }
  return (
    <section className="medications-editor medications-editor-report">
      <div className="medications-section-heading">
        <h2>{t("Reportar síntoma")}</h2>
        <IonButton fill="clear" onClick={onCancel} disabled={saving}>
          {t("Cancelar")}
        </IonButton>
      </div>
      <form
        className="medications-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <IonInput
          label={t("Síntoma")}
          labelPlacement="stacked"
          value={symptom}
          onIonInput={(e) => setSymptom(e.detail.value ?? "")}
          maxlength={200}
          required
          disabled={saving}
        />
        <IonSelect
          label={t("Medicamento asociado (opcional)")}
          labelPlacement="stacked"
          value={treatmentId}
          interface="popover"
          disabled={saving}
          onIonChange={(e) => setTreatmentId(String(e.detail.value ?? ""))}
        >
          <IonSelectOption value="">
            {t("Sin medicamento asociado")}
          </IonSelectOption>
          {treatments.map((m) => (
            <IonSelectOption key={m.id} value={m.id}>
              {m.name}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonSelect
          label={t("Intensidad")}
          labelPlacement="stacked"
          value={severity}
          interface="popover"
          disabled={saving}
          onIonChange={(e) => setSeverity(e.detail.value)}
        >
          {Object.entries(severities).map(([value, label]) => (
            <IonSelectOption key={value} value={value}>
              {t(label)}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonTextarea
          label={t("Detalles (opcional)")}
          labelPlacement="stacked"
          value={notes}
          maxlength={1000}
          rows={3}
          autoGrow
          disabled={saving}
          onIonInput={(e) => setNotes(e.detail.value ?? "")}
        />
        {error && (
          <p role="alert" className="medications-error">
            {error}
          </p>
        )}
        <IonButton type="submit" expand="block" disabled={saving}>
          {t(saving ? "Guardando…" : "Enviar reporte")}
        </IonButton>
      </form>
    </section>
  );
}
