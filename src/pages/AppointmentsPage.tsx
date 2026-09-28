import { useEffect, useState, type CSSProperties } from "react";
import { IonAlert, IonButton, IonIcon, IonModal } from "@ionic/react";
import { calendarOutline } from "ionicons/icons";
import { PageHeader } from "../components/PageHeader";
import { PreVisitIntakeSheet } from "../components/PreVisitIntakeSheet";
import { RequestAppointmentWizard } from "../components/RequestAppointmentWizard";
import { RescheduleAppointmentSheet } from "../components/RescheduleAppointmentSheet";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { INITIAL_UPCOMING, pastAppointmentChip } from "../data/appointments";
import type { ListedAppointment } from "../data/appointments";
import { useT } from "../i18n/I18nContext";
import {
  isPreVisitIntakeEditable,
  preVisitIntakeVisible,
} from "../utils/preVisitIntake";

export function AppointmentsPage() {
  const {
    showToast,
    realMode,
    upcomingAppointments,
    pastAppointments,
    appointmentsLoading,
    appointmentsError,
    cancelAppointmentById,
    openRoom,
    bookingWizardAutoOpen,
    clearBookingWizardAutoOpen,
  } = useApp();
  const t = useT();
  const [requestOpen, setRequestOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  /** Cita a reprogramar (2.A.5): abre la hoja con disponibilidad real. */
  const [reschedAppt, setReschedAppt] = useState<ListedAppointment | null>(
    null,
  );
  /** Pre-consulta de la cita destacada (F4): editable mientras Confirmed. */
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Auto-apertura del wizard cuando el CTA del chat lo pide (flag one-shot
  // seteado por openBookingWizard antes de navegar a esta pantalla).
  useEffect(() => {
    if (!bookingWizardAutoOpen) return;
    setRequestOpen(true);
    clearBookingWizardAutoOpen();
  }, [bookingWizardAutoOpen, clearBookingWizardAutoOpen]);

  // Modo real (sesión JWT): datos del backend. Demo: mock actual intacto.
  const upcoming = realMode ? (upcomingAppointments ?? []) : INITIAL_UPCOMING;
  const past = realMode ? (pastAppointments ?? []) : [];
  const featured = upcoming.find((a) => a.featured);
  const rest = upcoming.filter((a) => a.id !== featured?.id);
  // CTA de pre-consulta: visible con cita vigente/en curso; editable solo con
  // la cita Confirmed (la sesión aún no inició). En demo no hay status → no se
  // ofrece (no hay backend contra el que guardar).
  const intakeVisible = preVisitIntakeVisible(featured?.status);
  const intakeEditable = isPreVisitIntakeEditable(featured?.status);

  const handleCancel = async (id: string, reason: string) => {
    if (realMode) {
      const ok = await cancelAppointmentById(id, reason);
      if (ok) {
        showToast(t("Cita cancelada"), "warn");
      } else {
        showToast(t("No se pudo cancelar la cita. Intenta de nuevo."), "err");
      }
    } else {
      showToast(t("Solicitud de cancelación enviada"), "warn");
    }
    setCancelId(null);
  };

  /** Solo citas confirmadas con profesional asignado se reprograman (2.A.5). */
  const canReschedule = (a: ListedAppointment) =>
    realMode && a.status === "Confirmed" && !!a.professionalId;

  return (
    <Screen>
      <PageHeader
        title={t("Citas")}
        sub={t("Agenda con el equipo COPP-ADRESD")}
        trailing={
          <IonButton
            className="bt bt-mini bt-primary"
            onClick={() => setRequestOpen(true)}
          >
            {t("Nueva")}
          </IonButton>
        }
      />
      <Scroll>
        {appointmentsLoading ? (
          <div className="req-empty" style={{ margin: "16px" }}>
            <strong>{t("Cargando tus citas…")}</strong>
          </div>
        ) : appointmentsError ? (
          <div className="req-empty" style={{ margin: "16px" }}>
            <strong>{t("No se pudieron cargar las citas")}</strong>
            <p>{appointmentsError}</p>
          </div>
        ) : featured ? (
          <article className="appt-featured">
            <div
              className="appt-featured-band"
              style={{ background: featured.accent }}
            >
              <span>{t(featured.when)}</span>
              <span
                style={{
                  background: "rgba(255,255,255,.2)",
                  borderRadius: 8,
                  padding: "3px 8px",
                }}
              >
                {t(featured.mode)}
              </span>
            </div>
            <div className="appt-featured-body">
              <div className="appt-featured-when">{featured.time}</div>
              <div className="appt-featured-mode">
                {t(featured.day)} · {t(featured.motivo)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div
                  className="avatar"
                  style={{
                    width: 44,
                    height: 44,
                    background: "var(--teal-l)",
                    fontSize: 20,
                  }}
                >
                  {featured.emoji}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{featured.name}</div>
                  <div style={{ fontSize: 12, color: "var(--mu)" }}>
                    {t(featured.role)}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <IonButton
                  expand="block"
                  className="bt bt-sm bt-teal"
                  style={{ flex: 1 }}
                  onClick={() => {
                    if (realMode) openRoom(featured);
                    else showToast(t("Entrando a la sala de espera…"), "ok");
                  }}
                >
                  {t("Unirse a telemedicina")}
                </IonButton>
                <IonButton
                  className="bt bt-round"
                  style={
                    {
                      "--background": "var(--red-l)",
                      "--color": "var(--red)",
                    } as CSSProperties
                  }
                  aria-label={t("Cancelar cita")}
                  onClick={() => setCancelId(featured.id)}
                >
                  ✕
                </IonButton>
              </div>
              {intakeVisible ? (
                <IonButton
                  expand="block"
                  className="bt bt-sm bt-ghost"
                  style={{ marginTop: 10 }}
                  onClick={() => setIntakeOpen(true)}
                >
                  {intakeEditable
                    ? t("Completar mi pre-consulta")
                    : t("Ver mi pre-consulta")}
                </IonButton>
              ) : null}
              {featured && canReschedule(featured) ? (
                <IonButton
                  expand="block"
                  className="bt bt-sm bt-ghost"
                  style={{ marginTop: 10 }}
                  onClick={() => setReschedAppt(featured)}
                >
                  <IonIcon icon={calendarOutline} aria-hidden="true" />
                  &nbsp;{t("Reprogramar")}
                </IonButton>
              ) : null}
            </div>
          </article>
        ) : null}

        <div className="sec">{t("Siguientes")}</div>
        {rest.length === 0 ? (
          <div className="req-empty" style={{ margin: "0 16px 8px" }}>
            <strong>{t("No hay más citas")}</strong>
            <p>
              {t(
                "Cuando solicites una nueva, aparecerá aquí mientras se confirma.",
              )}
            </p>
          </div>
        ) : (
          <div className="group-list">
            {rest.map((a) => (
              <div
                key={a.id}
                className="group-row"
                style={{ alignItems: "flex-start" }}
              >
                <div className="next-appt-time">
                  <strong>{a.time}</strong>
                  <span>{t(a.day)}</span>
                </div>
                <div className="group-row-body">
                  <strong>{a.name}</strong>
                  <small>
                    {t(a.mode)} · {t(a.motivo)}
                  </small>
                </div>
                {a.pending ? (
                  <span className="chip chip-org">{t("PENDIENTE")}</span>
                ) : null}
                {canReschedule(a) ? (
                  <IonButton
                    className="bt bt-mini bt-ghost"
                    aria-label={t("Reprogramar cita")}
                    onClick={() => setReschedAppt(a)}
                  >
                    <IonIcon icon={calendarOutline} aria-hidden="true" />
                  </IonButton>
                ) : null}
                <IonButton
                  className="bt bt-mini bt-ghost"
                  aria-label={t("Cancelar cita")}
                  onClick={() => setCancelId(a.id)}
                >
                  ✕
                </IonButton>
              </div>
            ))}
          </div>
        )}

        <div className="sec">{t("Anteriores")}</div>
        <div className="group-list" style={{ marginBottom: 20 }}>
          {past.length === 0 ? (
            <div className="req-empty" style={{ margin: "0 16px" }}>
              <p>{t("Aún no hay citas anteriores.")}</p>
            </div>
          ) : (
            past.map((a) => {
              // 2.A.6: el chip refleja el estado final real (nunca todo verde).
              const chip = pastAppointmentChip(a.status);
              return (
                <div key={a.id} className="group-row">
                  <span className="group-row-ico">{a.emoji}</span>
                  <span className="group-row-body">
                    <strong>{a.name}</strong>
                    <small>
                      {a.time} · {t(a.when)}
                    </small>
                    {a.cancellationReason?.trim() ? (
                      <small>
                        {/* Texto libre del servidor: se muestra tal cual, sin
                            diccionario (evita warnings de i18n en consola). */}
                        {a.cancellationReason.trim()}
                      </small>
                    ) : null}
                  </span>
                  <span className={chip.className}>{t(chip.label)}</span>
                </div>
              );
            })
          )}
        </div>
      </Scroll>

      <IonModal
        isOpen={requestOpen}
        onDidDismiss={() => setRequestOpen(false)}
        className="request-modal"
      >
        {requestOpen ? (
          <RequestAppointmentWizard
            onCancel={() => setRequestOpen(false)}
            onSubmitted={() => {
              setRequestOpen(false);
              showToast(
                t("Solicitud enviada. Pendiente de confirmación"),
                "ok",
              );
            }}
          />
        ) : null}
      </IonModal>

      {intakeOpen && featured ? (
        <PreVisitIntakeSheet
          appointmentId={featured.id}
          editable={intakeEditable}
          onClose={() => setIntakeOpen(false)}
        />
      ) : null}

      <IonAlert
        isOpen={!!cancelId}
        header={t("¿Cancelar la cita?")}
        message={t(
          "Se notificará al equipo médico. Cuéntanos el motivo (mínimo 5 caracteres).",
        )}
        inputs={[
          {
            name: "reason",
            type: "textarea",
            placeholder: t("Motivo de la cancelación"),
          },
        ]}
        buttons={[
          { text: t("Volver"), role: "cancel" },
          {
            text: t("Cancelar cita"),
            role: "destructive",
            handler: (data) => {
              const reason = String(
                (data as { reason?: unknown } | undefined)?.reason ?? "",
              ).trim();
              // El backend exige motivo de al menos 5 caracteres: se valida
              // aquí para no viajar en vano (2.A.5).
              if (reason.length < 5) {
                showToast(
                  t("Escribe un motivo de al menos 5 caracteres."),
                  "err",
                );
                return false;
              }
              if (cancelId) void handleCancel(cancelId, reason);
            },
          },
        ]}
        onDidDismiss={() => setCancelId(null)}
      />

      <RescheduleAppointmentSheet
        appointment={reschedAppt}
        onClose={() => setReschedAppt(null)}
        onDone={(ok) => {
          setReschedAppt(null);
          if (ok) showToast(t("Cita reprogramada"), "ok");
        }}
      />
    </Screen>
  );
}
