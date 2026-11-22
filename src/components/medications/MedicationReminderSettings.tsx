import { useState } from "react";
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonList, IonModal, IonSkeletonText, IonToggle } from "@ionic/react";
import { notificationsOutline } from "ionicons/icons";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../i18n/I18nContext";
import {
  fetchMyMedicationReminderPreferences,
  updateMyMedicationReminderPreferences,
} from "../../utils/medicationsApi";
import type { MedicationReminderPreferences } from "../../utils/medicationsApi";

export function MedicationReminderSettings({ owner, onClose }: { owner: string; onClose: () => void }) {
  const { t } = useI18n();
  const [changes, setChanges] = useState<Partial<MedicationReminderPreferences>>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["medications", "reminder-preferences", owner],
    queryFn: ({ signal }) => fetchMyMedicationReminderPreferences(owner, signal),
    retry: false,
  });
  const values = data ? { ...data, ...changes } : null;
  const valid = values && values.leadMinutes >= 0 && values.leadMinutes <= 30 &&
    (values.followUpMinutes === null || (values.followUpMinutes >= 15 && values.followUpMinutes <= 90));

  const save = async () => {
    if (!valid || !values || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await updateMyMedicationReminderPreferences(owner, values);
      await refetch();
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen className="medications-reminder-modal" canDismiss={!saving} onDidDismiss={onClose}
      aria-labelledby="medications-reminder-heading">
      <IonContent className="medications-reminder-content">
        <section className="medications-editor">
          <div className="medications-section-heading">
            <div>
              <IonIcon icon={notificationsOutline} aria-hidden="true" />
              <h2 id="medications-reminder-heading">{t("Recordatorios de medicación")}</h2>
            </div>
          </div>
          {isLoading && <IonSkeletonText animated />}
          {isError && <div className="medications-error" role="alert">
            <p>{t("No se pudieron cargar tus recordatorios.")}</p>
            <IonButton fill="outline" onClick={() => void refetch()}>{t("Reintentar")}</IonButton>
          </div>}
          {values && <>
            <IonList className="medications-reminder-channels">
              {([
                ["push", "Notificaciones push"],
                ["inApp", "Avisos en la app"],
                ["whatsApp", "WhatsApp"],
              ] as const).map(([key, label]) => (
                <IonItem key={key} lines="none">
                  <IonToggle checked={values[key]} disabled={saving} justify="space-between"
                    helperText={key === "whatsApp" ? t("Los avisos de WhatsApp pueden incluir el nombre del medicamento.") : undefined}
                    onIonChange={(event) => setChanges(current => ({ ...current, [key]: event.detail.checked }))}>
                    {t(label)}
                  </IonToggle>
                </IonItem>
              ))}
            </IonList>
            <div className="medications-form">
              <IonInput label={t("Anticipación (minutos)")} labelPlacement="stacked" type="number"
                min="0" max="30" step="1" value={values.leadMinutes} disabled={saving}
                onIonInput={(event) => setChanges(current => ({ ...current, leadMinutes: Number(event.detail.value ?? 0) }))} />
              <IonInput label={t("Segundo aviso (minutos)")} labelPlacement="stacked" type="number"
                min="15" max="90" step="1" value={values.followUpMinutes ?? ""} disabled={saving}
                onIonInput={(event) => setChanges(current => ({
                  ...current, followUpMinutes: event.detail.value ? Number(event.detail.value) : null,
                }))} />
            </div>
          </>}
          {saveFailed && <p className="medications-error" role="alert">{t("No pudimos guardar. Reintenta cuando tengas conexión.")}</p>}
          <div className="medications-reminder-actions">
            <IonButton expand="block" fill="outline" disabled={saving} onClick={onClose}>{t("Cancelar")}</IonButton>
            <IonButton expand="block" disabled={!valid || saving} onClick={() => void save()}>{t("Guardar")}</IonButton>
          </div>
        </section>
      </IonContent>
    </IonModal>
  );
}
