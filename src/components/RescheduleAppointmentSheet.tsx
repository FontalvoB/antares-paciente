import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import { calendarOutline } from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import type { ListedAppointment } from "../data/appointments";
import { splitSlotViews, toAvailableSlotViews } from "../data/careOptions";
import {
  fetchAvailabilitySlots,
  type AvailabilitySlotDto,
} from "../utils/appointmentsApi";
import { addDaysToISO, formatLongDateEs, toLocalISODate } from "../utils/dates";

/**
 * Reprogramación directa del paciente (2.A.5, Decisión 2 Opción A): elige una
 * nueva fecha y un slot disponible del MISMO profesional
 * (`GET /availability` modo profesional) y ejecuta
 * `POST /api/v1/appointments/{id}/reschedule`. El backend valida propiedad,
 * estado, límite, anticipación y no-solapamiento (negocio inválido → 409 con
 * mensaje presentable).
 */
export function RescheduleAppointmentSheet({
  appointment,
  onClose,
  onDone,
}: {
  appointment: ListedAppointment | null;
  onClose: () => void;
  onDone: (ok: boolean) => void;
}) {
  const { rescheduleAppointmentById } = useApp();
  const t = useT();
  const today = toLocalISODate();
  const [date, setDate] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [reason, setReason] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlotDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const professionalId = appointment?.professionalId ?? null;
  const canQuery = !!appointment && !!professionalId;

  const loadDay = useCallback(
    async (iso: string, signal: AbortSignal) => {
      if (!professionalId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAvailabilitySlots(
          { professionalId, date: iso },
          { signal },
        );
        if (signal.aborted) return;
        setSlots(res.slots);
      } catch (err) {
        if (signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : t("No se pudo cargar la disponibilidad"),
        );
        setSlots(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [professionalId, t],
  );

  useEffect(() => {
    setDate("");
    setSlotStart("");
    setReason("");
    setSlots(null);
    setError(null);
    setSaveError(null);
  }, [appointment?.id]);

  useEffect(() => {
    if (!appointment || !date || !canQuery) return;
    const ctrl = new AbortController();
    void loadDay(date, ctrl.signal);
    return () => ctrl.abort();
  }, [appointment, date, canQuery, loadDay]);

  const views = useMemo(() => toAvailableSlotViews(slots ?? []), [slots]);
  const { morning, afternoon } = useMemo(() => splitSlotViews(views), [views]);

  const confirm = () => {
    if (!appointment || !slotStart || saving) return;
    setSaving(true);
    setSaveError(null);
    void rescheduleAppointmentById(appointment.id, {
      newStart: slotStart,
      reason: reason.trim() ? reason.trim() : null,
    }).then((result) => {
      setSaving(false);
      if (result.ok) {
        onDone(true);
      } else {
        setSaveError(
          result.error ?? t("No se pudo reprogramar. Intenta de nuevo."),
        );
      }
    });
  };

  return (
    <IonModal
      isOpen={!!appointment}
      onDidDismiss={onClose}
      className="request-modal"
    >
      {appointment && (
        <div className="req-page">
          <header className="req-hero">
            <div className="req-hero-aurora" aria-hidden="true" />
            <div className="kicker">{t("Cita confirmada")}</div>
            <h1 className="req-hero-title">{t("Reprogramar cita")}</h1>
            <p className="sub">
              {appointment.name} · {appointment.time}
            </p>
          </header>

          <IonContent className="req-body" scrollY>
            {!canQuery ? (
              <div className="req-empty" role="alert">
                <strong>{t("No se puede reprogramar esta cita")}</strong>
                <p>
                  {t(
                    "Solo las citas confirmadas con profesional asignado se pueden reprogramar desde aquí.",
                  )}
                </p>
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="resched-date">
                    {t("Elige la nueva fecha")}
                  </label>
                  <IonDatetime
                    id="resched-date"
                    presentation="date"
                    min={today}
                    max={addDaysToISO(today, 30)}
                    value={date || undefined}
                    onIonChange={(e) => {
                      const v = e.detail.value;
                      setDate(typeof v === "string" ? v.slice(0, 10) : "");
                      setSlotStart("");
                    }}
                  />
                </div>

                {date && (
                  <section className="req-hours">
                    <div className="req-times-head">
                      <div>
                        <div className="req-times-title">
                          {formatLongDateEs(date)}
                        </div>
                        <div className="req-times-sub">
                          {loading
                            ? t("Cargando horarios…")
                            : views.length > 0
                              ? t("{count} horarios disponibles", {
                                  count: String(views.length),
                                })
                              : t("Sin cupo este día")}
                        </div>
                      </div>
                    </div>

                    {loading ? (
                      <div
                        className="req-empty"
                        role="status"
                        aria-live="polite"
                      >
                        <IonSpinner name="crescent" aria-hidden="true" />
                        <strong>{t("Cargando horarios…")}</strong>
                      </div>
                    ) : error ? (
                      <div className="req-empty" role="alert">
                        <strong>
                          {t("No se pudo cargar la disponibilidad")}
                        </strong>
                        <p>{error}</p>
                        <IonButton
                          className="bt bt-sm bt-ghost"
                          onClick={() => {
                            const ctrl = new AbortController();
                            void loadDay(date, ctrl.signal);
                          }}
                        >
                          {t("Reintentar")}
                        </IonButton>
                      </div>
                    ) : views.length === 0 ? (
                      <div className="req-empty">
                        <strong>{t("Sin cupo este día")}</strong>
                        <p>{t("Prueba con otra fecha.")}</p>
                      </div>
                    ) : (
                      <>
                        {morning.length > 0 && (
                          <div className="req-slot-group">
                            <div className="req-slot-label">{t("Mañana")}</div>
                            <div className="req-slots">
                              {morning.map((slot) => (
                                <IonButton
                                  key={slot.startIso}
                                  className={`bt req-slot ${slotStart === slot.startIso ? "sel" : ""}`}
                                  aria-pressed={slotStart === slot.startIso}
                                  onClick={() => setSlotStart(slot.startIso)}
                                >
                                  <span className="req-slot-time">
                                    {slot.timeLabel}
                                  </span>
                                </IonButton>
                              ))}
                            </div>
                          </div>
                        )}
                        {afternoon.length > 0 && (
                          <div className="req-slot-group">
                            <div className="req-slot-label">{t("Tarde")}</div>
                            <div className="req-slots">
                              {afternoon.map((slot) => (
                                <IonButton
                                  key={slot.startIso}
                                  className={`bt req-slot ${slotStart === slot.startIso ? "sel" : ""}`}
                                  aria-pressed={slotStart === slot.startIso}
                                  onClick={() => setSlotStart(slot.startIso)}
                                >
                                  <span className="req-slot-time">
                                    {slot.timeLabel}
                                  </span>
                                </IonButton>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                <div className="field">
                  <label htmlFor="resched-reason">
                    {t("Motivo (opcional)")}
                  </label>
                  <IonTextarea
                    id="resched-reason"
                    className="fld"
                    autoGrow
                    rows={2}
                    maxlength={500}
                    value={reason}
                    onIonInput={(e) => setReason(e.detail.value ?? "")}
                  />
                </div>

                {saveError && (
                  <div className="req-empty" role="alert">
                    <strong>{t("No se pudo reprogramar")}</strong>
                    <p>{saveError}</p>
                  </div>
                )}
              </>
            )}
          </IonContent>

          <div className="req-foot">
            <div className="req-foot-row">
              <IonButton
                expand="block"
                className="bt bt-ghost"
                onClick={onClose}
              >
                {t("Volver")}
              </IonButton>
              <IonButton
                expand="block"
                className="bt bt-teal"
                disabled={!slotStart || saving || loading}
                onClick={confirm}
              >
                <IonIcon icon={calendarOutline} aria-hidden="true" />
                &nbsp;{t("Confirmar reprogramación")}
              </IonButton>
            </div>
          </div>
        </div>
      )}
    </IonModal>
  );
}
