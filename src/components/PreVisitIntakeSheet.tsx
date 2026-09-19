import { useCallback, useEffect, useRef, useState } from "react";
import {
  IonButton,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import { checkmarkCircle, close, refreshOutline } from "ionicons/icons";
import {
  ApiClientError,
  fetchPreVisitIntake,
  savePreVisitIntake,
} from "../utils/appointmentsApi";
import {
  PRE_VISIT_INTAKE_LIMITS,
  emptyPreVisitIntakeForm,
  hasPreVisitIntakeContent,
  intakeFormFromDto,
  intakeInputFromForm,
  validatePreVisitIntake,
  type PreVisitIntakeField,
  type PreVisitIntakeFieldError,
  type PreVisitIntakeForm,
} from "../utils/preVisitIntake";
import { useT } from "../i18n/I18nContext";

/**
 * Pre-consulta del paciente (F4): motivo, síntomas, alergias y medicación
 * actual. Se guarda contra /api/v1/appointments/{id}/pre-visit-intake y deja de
 * ser editable cuando la consulta inicia (la cita deja de estar Confirmed); un
 * 409 del PUT se refleja como solo lectura. Patrón IonModal del repo
 * (RoomChatPanel): estados loading/ready/error, guardado explícito con
 * indicador y errores en línea. Sin PHI en logs (solo viaja al backend).
 */

interface Props {
  appointmentId: string;
  /** true = la cita está Confirmed (sesión sin iniciar): permite editar. */
  editable: boolean;
  onClose: () => void;
}

type LoadState = "loading" | "ready" | "error";

interface IntakeFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  limit: number;
  rows: number;
  readOnly: boolean;
  error?: PreVisitIntakeFieldError;
  onChange: (value: string) => void;
}

/** Campo de texto de la pre-consulta: label, textarea y pista/error con contador. */
function IntakeField({
  id,
  label,
  placeholder,
  value,
  limit,
  rows,
  readOnly,
  error,
  onChange,
}: IntakeFieldProps) {
  const t = useT();
  const hint =
    error === "tooLong"
      ? t("Máximo {max} caracteres.", { max: String(limit) })
      : error === "required"
        ? t("Obligatorio")
        : `${value.trim().length} / ${limit}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <IonTextarea
        id={id}
        className="fld"
        autoGrow
        rows={rows}
        maxlength={limit}
        readonly={readOnly}
        placeholder={placeholder}
        value={value}
        onIonInput={(event) => onChange(event.detail.value ?? "")}
      />
      <span className={`previsit-hint${error ? " error" : ""}`}>{hint}</span>
    </div>
  );
}

export function PreVisitIntakeSheet({
  appointmentId,
  editable,
  onClose,
}: Props) {
  const t = useT();
  const [form, setForm] = useState<PreVisitIntakeForm>(
    emptyPreVisitIntakeForm,
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** 409 del PUT: la consulta inició entre la carga y el guardado. */
  const [locked, setLocked] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Carga inicial (y reintento) de la pre-consulta de la cita, 1:1.
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    void (async () => {
      try {
        const dto = await fetchPreVisitIntake(appointmentId);
        if (cancelled || !mountedRef.current) return;
        setForm(intakeFormFromDto(dto));
        setLoadState("ready");
      } catch {
        if (!cancelled && mountedRef.current) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, reloadToken]);

  const readOnly = !editable || locked;
  const errors = validatePreVisitIntake(form);
  const invalid = Object.keys(errors).length > 0;

  const setField = useCallback((field: PreVisitIntakeField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (readOnly || saving || invalid) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const dto = await savePreVisitIntake(
        appointmentId,
        intakeInputFromForm(form),
      );
      if (!mountedRef.current) return;
      setForm(intakeFormFromDto(dto));
      setSaved(true);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof ApiClientError && err.status === 409) {
        setLocked(true);
        return;
      }
      setSaveError(t("No se pudo guardar tu pre-consulta."));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [appointmentId, form, invalid, readOnly, saving, t]);

  const retryLoad = useCallback(() => setReloadToken((token) => token + 1), []);

  return (
    <IonModal isOpen onDidDismiss={onClose} className="previsit-modal">
      <div className="previsit">
        <header className="previsit-head">
          <strong>{t("Pre-consulta")}</strong>
          <IonButton
            fill="clear"
            className="previsit-close"
            aria-label={t("Cerrar")}
            onClick={onClose}
          >
            <IonIcon slot="icon-only" icon={close} />
          </IonButton>
        </header>

        <div className="previsit-body">
          {loadState === "loading" ? (
            <div className="previsit-status">
              <IonSpinner name="crescent" />
              <span>{t("Cargando tu pre-consulta…")}</span>
            </div>
          ) : loadState === "error" ? (
            <div className="previsit-status">
              <span>{t("No se pudo cargar tu pre-consulta.")}</span>
              <IonButton className="bt bt-primary" onClick={retryLoad}>
                <IonIcon icon={refreshOutline} slot="start" />
                {t("Reintentar")}
              </IonButton>
            </div>
          ) : (
            <>
              <p className="previsit-note">
                {readOnly
                  ? t(
                      "La consulta ya comenzó; tu pre-consulta quedó en solo lectura.",
                    )
                  : t("Podés editarla hasta que empiece la consulta.")}
              </p>
              {readOnly && !hasPreVisitIntakeContent(form) ? (
                <p className="previsit-empty">
                  {t("Sin pre-consulta registrada.")}
                </p>
              ) : (
                <>
                  <IntakeField
                    id="intake-reason"
                    label={t("Motivo de la consulta")}
                    placeholder={t("Cuéntale al equipo qué te preocupa hoy")}
                    value={form.reason}
                    limit={PRE_VISIT_INTAKE_LIMITS.reason}
                    rows={3}
                    readOnly={readOnly}
                    error={errors.reason}
                    onChange={(value) => setField("reason", value)}
                  />
                  <IntakeField
                    id="intake-symptoms"
                    label={t("Síntomas")}
                    placeholder={t("Ej.: dolor de cabeza desde hace 3 días")}
                    value={form.symptoms}
                    limit={PRE_VISIT_INTAKE_LIMITS.symptoms}
                    rows={3}
                    readOnly={readOnly}
                    error={errors.symptoms}
                    onChange={(value) => setField("symptoms", value)}
                  />
                  <IntakeField
                    id="intake-allergies"
                    label={t("Alergias")}
                    placeholder={t("Ej.: penicilina")}
                    value={form.allergies}
                    limit={PRE_VISIT_INTAKE_LIMITS.allergies}
                    rows={2}
                    readOnly={readOnly}
                    error={errors.allergies}
                    onChange={(value) => setField("allergies", value)}
                  />
                  <IntakeField
                    id="intake-medications"
                    label={t("Medicación actual (opcional)")}
                    placeholder={t("Ej.: losartán 50 mg")}
                    value={form.medications}
                    limit={PRE_VISIT_INTAKE_LIMITS.medications}
                    rows={2}
                    readOnly={readOnly}
                    error={errors.medications}
                    onChange={(value) => setField("medications", value)}
                  />
                </>
              )}
            </>
          )}
        </div>

        {loadState === "ready" ? (
          <footer className="previsit-foot">
            {readOnly ? (
              <IonButton
                expand="block"
                className="bt bt-ghost"
                onClick={onClose}
              >
                {t("Cerrar")}
              </IonButton>
            ) : (
              <>
                <IonButton
                  expand="block"
                  className="bt bt-teal"
                  disabled={saving || invalid}
                  onClick={() => void handleSave()}
                >
                  {saving ? t("Guardando…") : t("Guardar pre-consulta")}
                </IonButton>
                {saved ? (
                  <span className="previsit-saved">
                    <IonIcon icon={checkmarkCircle} />
                    {t("Guardado")}
                  </span>
                ) : null}
                {saveError ? (
                  <span className="previsit-error">{saveError}</span>
                ) : null}
              </>
            )}
          </footer>
        ) : null}
      </div>
    </IonModal>
  );
}
