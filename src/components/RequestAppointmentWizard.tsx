import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IonButton,
  IonIcon,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from "@ionic/react";
import {
  calendarOutline,
  checkmarkCircle,
  chevronBack,
  chevronForward,
  close,
  flash,
  leaf,
  locationOutline,
  medkit,
  personOutline,
  sparkles,
  videocamOutline,
  warningOutline,
} from "ionicons/icons";
import {
  CONSULT_TYPES,
  buildRequestedAppointment,
  bookingWindow,
  consultTypeById,
  firstOpenSlot,
  getAvailableSlots,
  isSelectableBookingDate,
  splitSlots,
  type AppointmentMode,
  type ConsultTypeId,
  type ListedAppointment,
} from "../data/appointments";
import {
  activeCareOptions,
  careVisualFor,
  groupCareOptionsByCategory,
  professionalsForSpecialty,
  TEMPORARY_CATALOG_SLOT_PROFILE,
  type CareOption,
} from "../data/careOptions";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import {
  formatDateForDisplay,
  formatLongDateEs,
  isTodayISO,
  isoYearMonth,
  monthGrid,
  monthTitleEs,
  shiftMonth,
  toLocalISODate,
} from "../utils/dates";

const STEPS = [
  {
    title: "¿Qué necesitas?",
    sub: "Elige el área y te mostramos quién te atiende",
  },
  { title: "Agenda tu cita", sub: "Toca un día con cupo y elige la hora" },
  { title: "Confirma los datos", sub: "Motivo, modalidad y resumen" },
] as const;

const TOTAL = STEPS.length;
const EASE = [0.22, 1, 0.36, 1] as const;
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DURATION = "30 min";

const TYPE_ICONS: Record<ConsultTypeId, string> = {
  medica: medkit,
  psicologia: sparkles,
  nutricion: leaf,
  urgencia: flash,
};

const TYPE_BG: Record<ConsultTypeId, string> = {
  medica: "var(--teal-l)",
  psicologia: "var(--pur-l)",
  nutricion: "var(--blue-l)",
  urgencia: "var(--org-l)",
};

const TYPE_FG: Record<ConsultTypeId, string> = {
  medica: "var(--teal)",
  psicologia: "var(--pur)",
  nutricion: "var(--blue)",
  urgencia: "var(--org)",
};

const TYPE_KICKER: Record<ConsultTypeId, string> = {
  medica: "Consulta",
  psicologia: "Acompañamiento",
  nutricion: "Nutrición",
  urgencia: "Prioritaria",
};

export function RequestAppointmentWizard({
  onCancel,
  onSubmitted,
}: {
  onCancel: () => void;
  onSubmitted: (appt: ListedAppointment) => void;
}) {
  const {
    teamProfessional,
    realMode,
    specialties,
    professionalsCatalog,
    submitAppointmentRequest,
    showToast,
  } = useApp();
  const t = useT();
  const today = toLocalISODate();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [typeId, setTypeId] = useState<ConsultTypeId | "">("");
  // Ruta por catálogo (veredicto D1, tarea 2.A.3): especialidad elegida +
  // profesional opcional ("" = cualquiera, viaja como professional_id=null).
  const [specialtyId, setSpecialtyId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<AppointmentMode | "">("");
  const [{ year, month }, setCursor] = useState(() => isoYearMonth(today));
  const dir = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Opciones de atención desde el catálogo (null = aún no cargado).
  const careOptions = useMemo(
    () => activeCareOptions(specialties),
    [specialties],
  );
  // Ruta por catálogo solo en modo real con catálogo no vacío; si no, la
  // ruta legacy demo (CONSULT_TYPES) para no romper el modo sin sesión.
  const useCatalogPath = realMode && !!careOptions && careOptions.length > 0;
  const careGroups = useMemo(
    () => groupCareOptionsByCategory(careOptions ?? []),
    [careOptions],
  );
  const selectedCare: CareOption | null =
    careOptions?.find((o) => o.specialtyId === specialtyId) ?? null;
  const eligibleProfessionals = useMemo(
    () =>
      useCatalogPath && specialtyId
        ? (professionalsForSpecialty(professionalsCatalog, specialtyId) ?? [])
        : [],
    [useCatalogPath, specialtyId, professionalsCatalog],
  );
  const selectedProfessional =
    eligibleProfessionals.find((p) => p.id === professionalId) ?? null;

  const range = bookingWindow();
  const professional = typeId ? teamProfessional(typeId) : null;
  const consultType = typeId ? consultTypeById(typeId) : null;
  // Motor de slots mock (2.A.2 lo retira; B1 lo reemplaza por /availability).
  // En la ruta por catálogo usa el perfil temporal neutro (ver
  // TEMPORARY_CATALOG_SLOT_PROFILE): sin precisión inventada por especialidad.
  const slotTypeId: ConsultTypeId | "" = useCatalogPath
    ? specialtyId
      ? TEMPORARY_CATALOG_SLOT_PROFILE
      : ""
    : typeId;
  const slots = slotTypeId && date ? getAvailableSlots(slotTypeId, date) : [];
  const { morning, afternoon } = splitSlots(slots);
  const nextSlot = slotTypeId ? firstOpenSlot(slotTypeId) : null;
  const cells = monthGrid(year, month);
  const meta = STEPS[step - 1] ?? STEPS[0];
  const proShort = useCatalogPath
    ? (selectedProfessional?.fullName.split(",")[0] ?? selectedCare?.name ?? "")
    : (professional?.name.split(",")[0] ?? "");
  const minCursor = isoYearMonth(range.min);
  const maxCursor = isoYearMonth(range.max);
  const canPrev =
    year > minCursor.year ||
    (year === minCursor.year && month > minCursor.month);
  const canNext =
    year < maxCursor.year ||
    (year === maxCursor.year && month < maxCursor.month);

  const canContinue = useMemo(() => {
    if (step === 1) return useCatalogPath ? specialtyId !== "" : typeId !== "";
    if (step === 2) return date !== "" && time !== "";
    return reason.trim().length >= 10 && mode !== "";
  }, [step, useCatalogPath, specialtyId, typeId, date, time, reason, mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step, done]);

  const pickType = (id: ConsultTypeId) => {
    setTypeId(id);
    setTime("");
    const open = firstOpenSlot(id);
    if (open) {
      setDate(open.date);
      setCursor(isoYearMonth(open.date));
    } else {
      setDate("");
    }
  };

  const pickCare = (id: string) => {
    setSpecialtyId(id);
    // Sin preselección silenciosa: el profesional queda en "cualquiera"
    // hasta que el paciente elija explícitamente (veredicto D1).
    setProfessionalId("");
    setTime("");
    const open = firstOpenSlot(TEMPORARY_CATALOG_SLOT_PROFILE);
    if (open) {
      setDate(open.date);
      setCursor(isoYearMonth(open.date));
    } else {
      setDate("");
    }
  };

  const pickDate = (iso: string) => {
    if (!slotTypeId || !isSelectableBookingDate(iso, slotTypeId)) return;
    setDate(iso);
    setTime("");
  };

  const jumpNext = () => {
    if (!nextSlot) return;
    setDate(nextSlot.date);
    setTime(nextSlot.time);
    setCursor(isoYearMonth(nextSlot.date));
  };

  const go = (n: number) => {
    dir.current = n > step ? 1 : -1;
    setStep(n);
  };

  const back = () => {
    if (step === 1) {
      onCancel();
      return;
    }
    go(step - 1);
  };

  const next = () => {
    if (!canContinue) return;
    if (step < TOTAL) {
      go(step + 1);
      return;
    }
    if (useCatalogPath ? !specialtyId : !typeId) return;
    if (!mode) return;
    if (realMode) {
      // Modo sesión real: "Solicitar cita" envía la solicitud al backend de
      // inmediato (el wizard cierra con toast de éxito/error). La pantalla
      // "Solicitud lista" queda para el modo demo.
      finish();
      return;
    }
    setDone(true);
  };

  const finish = () => {
    if (!mode) return;
    if (realMode) {
      // Modo sesión real: la solicitud viaja al backend y la lista se refresca.
      if (useCatalogPath) {
        if (!specialtyId || !selectedCare) return;
        const payload = {
          specialtyId,
          professionalId: professionalId || null,
          date,
          time,
          reason,
          mode,
        };
        const summaryName =
          selectedProfessional?.fullName ?? "Equipo COPP-ADRESD";
        const summaryRole =
          selectedProfessional?.professionalTypeName ?? selectedCare.name;
        void submitAppointmentRequest(payload).then((ok) => {
          if (ok) {
            onSubmitted({
              id: `req-${Date.now()}`,
              when: "PENDIENTE",
              mode,
              accent: "linear-gradient(90deg,#0C3D2C,var(--teal))",
              emoji: "🩺",
              name: summaryName,
              role: summaryRole,
              time,
              day: isTodayISO(date)
                ? "Hoy"
                : formatDateForDisplay(date).slice(0, 5),
              motivo: `${selectedCare.name} · ${reason.trim()}`,
              color: "var(--teal)",
              pending: true,
            });
          } else {
            showToast(
              "No se pudo enviar la solicitud. Intenta de nuevo.",
              "err",
            );
          }
        });
        return;
      }
      if (!typeId) return;
      // Modo sesión real: la solicitud viaja al backend y la lista se refresca.
      void submitAppointmentRequest({ typeId, date, time, reason, mode }).then(
        (ok) => {
          if (ok) {
            onSubmitted(
              buildRequestedAppointment({ typeId, date, time, reason, mode }),
            );
          } else {
            showToast(
              "No se pudo enviar la solicitud. Intenta de nuevo.",
              "err",
            );
          }
        },
      );
      return;
    }
    if (!typeId) return;
    onSubmitted(
      buildRequestedAppointment({ typeId, date, time, reason, mode }),
    );
  };

  const moveMonth = (delta: number) => {
    if (delta < 0 && !canPrev) return;
    if (delta > 0 && !canNext) return;
    setCursor((c) => shiftMonth(c.year, c.month, delta));
  };

  // Resumen del paso 3 (ruta por catálogo: datos del backend, sin mocks).
  const summaryLabel = useCatalogPath
    ? (selectedCare?.name ?? "")
    : (consultType?.label ?? "");
  const summaryProName = useCatalogPath
    ? (selectedProfessional?.fullName ?? "Equipo COPP-ADRESD")
    : (professional?.name ?? "");
  const summaryProRole = useCatalogPath
    ? (selectedProfessional?.professionalTypeName ?? selectedCare?.name ?? "")
    : (professional?.role ?? "");
  const summaryAccent = useCatalogPath
    ? "linear-gradient(90deg,#0C3D2C,var(--teal))"
    : (professional?.accent ?? "");
  const summaryColorSoft = useCatalogPath
    ? "var(--teal-l)"
    : (professional?.colorSoft ?? "");

  return (
    <div className="req-page">
      <header className="req-hero">
        <div className="req-hero-aurora" aria-hidden="true" />
        <div className="req-hero-top">
          <IonButton
            className="bt bt-round req-hero-btn"
            aria-label={step === 1 ? "Cerrar" : "Volver"}
            onClick={back}
          >
            <IonIcon slot="icon-only" icon={step === 1 ? close : chevronBack} />
          </IonButton>
          <div
            className="req-hero-dots"
            aria-label={`Paso ${step} de ${TOTAL}`}
          >
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`req-dot ${i + 1 < step || done ? "done" : i + 1 === step ? "now" : ""}`}
                aria-label={s.title}
                disabled={i + 1 > step}
                onClick={() => i + 1 < step && go(i + 1)}
              />
            ))}
          </div>
          <IonButton
            className="bt bt-round req-hero-btn"
            aria-label="Cerrar"
            onClick={onCancel}
          >
            <IonIcon slot="icon-only" icon={close} />
          </IonButton>
        </div>
        <div className="kicker">
          Paso {done ? TOTAL : step} de {TOTAL}
        </div>
        <h1 className="req-hero-title">
          {done ? "Solicitud lista" : meta.title}
        </h1>
        <p className="sub">
          {done ? "El equipo confirmará tu cita en breve" : meta.sub}
        </p>
        {(specialtyId || typeId || date || time) && !done && (
          <div className="chips">
            {useCatalogPath && selectedCare && (
              <button
                type="button"
                className="chip chip-glass"
                onClick={() => go(1)}
              >
                {t(selectedCare.name)}
              </button>
            )}
            {!useCatalogPath && consultType && (
              <button
                type="button"
                className="chip chip-glass"
                onClick={() => go(1)}
              >
                {consultType.emoji} {consultType.label}
              </button>
            )}
            {date && (
              <button
                type="button"
                className="chip chip-glass"
                onClick={() => go(2)}
              >
                <IonIcon icon={calendarOutline} />{" "}
                {isTodayISO(date) ? "Hoy" : formatDateForDisplay(date)}
                {time ? ` · ${time}` : ""}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="req-body" ref={scrollRef}>
        <AnimatePresence mode="wait" initial={false}>
          {done && professional && consultType ? (
            <motion.div
              key="done"
              className="req-done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
            >
              <div className="req-done-badge" aria-hidden="true">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <div
                className="display"
                style={{ fontSize: 22, fontWeight: 700 }}
              >
                Cita solicitada
              </div>
              <p>
                Quedó en revisión. Te avisamos cuando {proShort} la confirme.
              </p>
              <article className="appt-featured" style={{ margin: "16px 0 0" }}>
                <div
                  className="appt-featured-band"
                  style={{ background: professional.accent }}
                >
                  <span>PENDIENTE</span>
                  <span
                    style={{
                      background: "rgba(255,255,255,.2)",
                      borderRadius: 8,
                      padding: "3px 8px",
                    }}
                  >
                    {mode}
                  </span>
                </div>
                <div className="appt-featured-body">
                  <div className="appt-featured-when">{time}</div>
                  <div className="appt-featured-mode">
                    {formatDateForDisplay(date)} · {consultType.label}
                  </div>
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <div
                      className="avatar"
                      style={{
                        width: 44,
                        height: 44,
                        background: professional.colorSoft,
                        fontSize: 20,
                      }}
                    >
                      {professional.emoji}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{professional.name}</div>
                      <div style={{ fontSize: 12, color: "var(--mu)" }}>
                        {professional.role}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              className={step === 1 ? "req-step req-step-types" : "req-step"}
              initial={{ opacity: 0, x: 22 * dir.current }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 * dir.current }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {step === 1 && useCatalogPath && (
                <div className="req-catalog">
                  {careGroups.map((group, gi) => {
                    const visual = careVisualFor(gi);
                    return (
                      <section key={group.category} className="req-area">
                        <div className="req-field-lbl">{t(group.category)}</div>
                        <IonRadioGroup
                          className="req-types"
                          value={specialtyId || undefined}
                          onIonChange={(e) =>
                            pickCare(e.detail.value as string)
                          }
                        >
                          {group.options.map((opt) => {
                            const selected = specialtyId === opt.specialtyId;
                            return (
                              <IonRadio
                                key={opt.specialtyId}
                                value={opt.specialtyId}
                                className={`req-type-card ac-${visual.tone} ${selected ? "sel" : ""}`}
                                justify="start"
                                labelPlacement="end"
                                aria-label={t(opt.name)}
                              >
                                <span className="req-type-inner">
                                  <span className="req-type-top">
                                    <span
                                      className="req-type-ico"
                                      style={{
                                        background: visual.bg,
                                        color: visual.fg,
                                      }}
                                    >
                                      <IonIcon icon={visual.icon} />
                                    </span>
                                    <span className="req-type-kicker">
                                      {t(group.category)}
                                    </span>
                                    {selected ? (
                                      <IonIcon
                                        className="req-type-check"
                                        icon={checkmarkCircle}
                                      />
                                    ) : null}
                                  </span>
                                  <span className="req-type-copy">
                                    <span className="ct">{t(opt.name)}</span>
                                    {opt.description ? (
                                      <span className="cs">
                                        {opt.description}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              </IonRadio>
                            );
                          })}
                        </IonRadioGroup>
                      </section>
                    );
                  })}

                  {specialtyId && (
                    <div className="field">
                      <label>{t("Profesional (opcional)")}</label>
                      <IonSelect
                        className="fld"
                        interface="popover"
                        value={professionalId}
                        aria-label={t("Profesional (opcional)")}
                        onIonChange={(e) =>
                          setProfessionalId(e.detail.value as string)
                        }
                      >
                        <IonSelectOption value="">
                          {t("Cualquier profesional disponible")}
                        </IonSelectOption>
                        {eligibleProfessionals.map((p) => (
                          <IonSelectOption key={p.id} value={p.id}>
                            {p.fullName}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                      {professionalsCatalog !== null &&
                      eligibleProfessionals.length === 0 ? (
                        <span className="req-hint">
                          {t(
                            "Sin profesionales listados. El equipo te asignará.",
                          )}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {step === 1 && !useCatalogPath && (
                <IonRadioGroup
                  className="req-types"
                  value={typeId || undefined}
                  onIonChange={(e) => pickType(e.detail.value as ConsultTypeId)}
                >
                  {CONSULT_TYPES.map((kind) => {
                    const pro = teamProfessional(kind.id);
                    const selected = typeId === kind.id;
                    return (
                      <IonRadio
                        key={kind.id}
                        value={kind.id}
                        className={`req-type-card ac-${kind.tone} ${selected ? "sel" : ""}`}
                        justify="start"
                        labelPlacement="end"
                        aria-label={t(kind.label)}
                      >
                        <span className="req-type-inner">
                          <span className="req-type-top">
                            <span
                              className="req-type-ico"
                              style={{
                                background: TYPE_BG[kind.id],
                                color: TYPE_FG[kind.id],
                              }}
                            >
                              <IonIcon icon={TYPE_ICONS[kind.id]} />
                            </span>
                            <span className="req-type-kicker">
                              {t(TYPE_KICKER[kind.id])}
                            </span>
                            {selected ? (
                              <IonIcon
                                className="req-type-check"
                                icon={checkmarkCircle}
                              />
                            ) : null}
                          </span>
                          <span className="req-type-copy">
                            <span className="ct">{t(kind.label)}</span>
                            <span className="cs">{t(kind.short)}</span>
                          </span>
                          <span className="req-type-pro">
                            <span
                              className="req-type-avatar"
                              aria-hidden="true"
                            >
                              {pro.emoji}
                            </span>
                            <span>
                              <strong>{pro.name}</strong>
                              <small>{t(pro.role)}</small>
                            </span>
                          </span>
                          {kind.id === "urgencia" ? (
                            <span className="req-type-note">
                              <IonIcon icon={warningOutline} />
                              {t("Si es una emergencia en curso, usa SOS.")}
                            </span>
                          ) : null}
                        </span>
                      </IonRadio>
                    );
                  })}
                </IonRadioGroup>
              )}

              {step === 2 && (useCatalogPath ? !!specialtyId : !!typeId) && (
                <div className="req-agenda">
                  {nextSlot &&
                    !(nextSlot.date === date && nextSlot.time === time) && (
                      <IonButton
                        expand="block"
                        className="req-soon"
                        onClick={jumpNext}
                      >
                        <span className="req-soon-copy">
                          <span className="req-soon-kicker">
                            {t("Más pronto")}
                          </span>
                          <span className="req-soon-when">
                            {isTodayISO(nextSlot.date)
                              ? t("Hoy")
                              : formatDateForDisplay(nextSlot.date)}
                            <strong>{nextSlot.time}</strong>
                          </span>
                        </span>
                        <IonIcon icon={chevronForward} aria-hidden="true" />
                      </IonButton>
                    )}

                  <section className="req-cal card">
                    <div className="req-cal-nav">
                      <IonButton
                        className="bt bt-round req-cal-nav-btn"
                        disabled={!canPrev}
                        aria-label="Mes anterior"
                        onClick={() => moveMonth(-1)}
                      >
                        <IonIcon slot="icon-only" icon={chevronBack} />
                      </IonButton>
                      <div className="req-cal-month">
                        {monthTitleEs(year, month)}
                      </div>
                      <IonButton
                        className="bt bt-round req-cal-nav-btn"
                        disabled={!canNext}
                        aria-label="Mes siguiente"
                        onClick={() => moveMonth(1)}
                      >
                        <IonIcon slot="icon-only" icon={chevronForward} />
                      </IonButton>
                    </div>
                    <div className="req-cal-week">
                      {WEEKDAYS.map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </div>
                    <div
                      className="req-cal-grid"
                      role="grid"
                      aria-label="Calendario de disponibilidad"
                    >
                      {cells.map((iso, i) => {
                        if (!iso)
                          return (
                            <span key={`e-${i}`} className="req-cal-cell" />
                          );
                        const enabled =
                          !!slotTypeId &&
                          isSelectableBookingDate(iso, slotTypeId);
                        const hasSlots =
                          enabled &&
                          !!slotTypeId &&
                          getAvailableSlots(slotTypeId, iso).length > 0;
                        const selected = iso === date;
                        const todayCell = isTodayISO(iso);
                        return (
                          <IonButton
                            key={iso}
                            fill={selected ? "solid" : "clear"}
                            className={`bt req-cal-day${selected ? " sel" : ""}${todayCell && !selected ? " today" : ""}${!enabled ? " off" : ""}${hasSlots ? " open" : ""}`}
                            disabled={!enabled}
                            aria-label={`${formatLongDateEs(iso)}${hasSlots ? ", con horarios" : ""}`}
                            aria-pressed={selected}
                            onClick={() => pickDate(iso)}
                          >
                            {iso.split("-")[2]?.replace(/^0/, "")}
                          </IonButton>
                        );
                      })}
                    </div>
                    <div className="req-cal-legend">
                      <span>
                        <i className="req-cal-dot" /> {t("Con cupo")}
                      </span>
                      <span>{t("Citas de {mins}", { mins: "30" })}</span>
                    </div>
                  </section>

                  <section className="req-hours">
                    <div className="req-times-head">
                      <div>
                        <div className="req-times-title">
                          {date ? formatLongDateEs(date) : t("Elige un día")}
                        </div>
                        <div className="req-times-sub">
                          {date
                            ? slots.length
                              ? t("{count} horarios · {name}", {
                                  count: String(slots.length),
                                  name: proShort,
                                })
                              : t("Sin cupo este día")
                            : t("Agenda de {name}", { name: proShort })}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={date || "none"}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                      >
                        {!date ? (
                          <div className="req-empty">
                            <strong>
                              {t("Elige un día en el calendario")}
                            </strong>
                            <p>
                              {t("Los días marcados tienen horarios libres.")}
                            </p>
                          </div>
                        ) : slots.length === 0 ? (
                          <div className="req-empty">
                            <strong>{t("Sin horarios este día")}</strong>
                            <p>
                              {t(
                                "Prueba un día marcado o usa el horario más pronto.",
                              )}
                            </p>
                          </div>
                        ) : (
                          <>
                            {morning.length > 0 && (
                              <div className="req-slot-group">
                                <div className="req-slot-label">
                                  {t("Mañana")}
                                </div>
                                <div className="req-slots">
                                  {morning.map((slot) => (
                                    <IonButton
                                      key={slot}
                                      className={`bt req-slot ${time === slot ? "sel" : ""}`}
                                      aria-pressed={time === slot}
                                      onClick={() => setTime(slot)}
                                    >
                                      <span className="req-slot-time">
                                        {slot}
                                      </span>
                                    </IonButton>
                                  ))}
                                </div>
                              </div>
                            )}
                            {afternoon.length > 0 && (
                              <div className="req-slot-group">
                                <div className="req-slot-label">
                                  {t("Tarde")}
                                </div>
                                <div className="req-slots">
                                  {afternoon.map((slot) => (
                                    <IonButton
                                      key={slot}
                                      className={`bt req-slot ${time === slot ? "sel" : ""}`}
                                      aria-pressed={time === slot}
                                      onClick={() => setTime(slot)}
                                    >
                                      <span className="req-slot-time">
                                        {slot}
                                      </span>
                                    </IonButton>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {date && time && (
                      <div className="req-pick">
                        <IonIcon icon={calendarOutline} />
                        <span>{formatLongDateEs(date)}</span>
                        <strong>{time}</strong>
                        <em>{DURATION}</em>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {step === 3 &&
                (useCatalogPath
                  ? !!selectedCare
                  : !!(professional && consultType)) && (
                  <>
                    <div className="field">
                      <label htmlFor="req-motivo">Motivo de la consulta</label>
                      <IonTextarea
                        id="req-motivo"
                        className="fld"
                        autoGrow
                        rows={4}
                        maxlength={500}
                        enterkeyhint="done"
                        placeholder="Cuéntale al equipo qué te preocupa hoy"
                        value={reason}
                        onIonInput={(e) => setReason(e.detail.value ?? "")}
                      />
                      <span className="req-hint">
                        {reason.trim().length < 10
                          ? "Mínimo 10 caracteres"
                          : `${reason.trim().length} / 500`}
                      </span>
                    </div>

                    {useCatalogPath && (
                      <div className="field">
                        <label>{t("Profesional (opcional)")}</label>
                        <IonSelect
                          className="fld"
                          interface="popover"
                          value={professionalId}
                          aria-label={t("Profesional (opcional)")}
                          onIonChange={(e) =>
                            setProfessionalId(e.detail.value as string)
                          }
                        >
                          <IonSelectOption value="">
                            {t("Cualquier profesional disponible")}
                          </IonSelectOption>
                          {eligibleProfessionals.map((p) => (
                            <IonSelectOption key={p.id} value={p.id}>
                              {p.fullName}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </div>
                    )}

                    <div className="req-field-lbl">Modalidad</div>
                    <IonRadioGroup
                      className="req-modes"
                      value={mode || undefined}
                      onIonChange={(e) =>
                        setMode(e.detail.value as AppointmentMode)
                      }
                    >
                      <IonRadio
                        value="Videollamada"
                        className={`card req-mode-card ${mode === "Videollamada" ? "sel" : ""}`}
                        justify="start"
                        labelPlacement="end"
                      >
                        <span className="req-mode-inner">
                          <span
                            className="ico"
                            style={{
                              background: "var(--teal-l)",
                              color: "var(--teal)",
                              marginBottom: 0,
                            }}
                          >
                            <IonIcon icon={videocamOutline} />
                          </span>
                          <span className="req-type-copy">
                            <span className="ct">Videollamada</span>
                            <span className="cs">
                              Desde casa · sala virtual
                            </span>
                          </span>
                        </span>
                      </IonRadio>
                      <IonRadio
                        value="Presencial"
                        className={`card req-mode-card ${mode === "Presencial" ? "sel" : ""}`}
                        justify="start"
                        labelPlacement="end"
                      >
                        <span className="req-mode-inner">
                          <span
                            className="ico"
                            style={{
                              background: "var(--blue-l)",
                              color: "var(--blue)",
                              marginBottom: 0,
                            }}
                          >
                            <IonIcon icon={locationOutline} />
                          </span>
                          <span className="req-type-copy">
                            <span className="ct">Presencial</span>
                            <span className="cs">
                              En la clínica COPP-ADRESD
                            </span>
                          </span>
                        </span>
                      </IonRadio>
                    </IonRadioGroup>

                    <article
                      className="appt-featured"
                      style={{ margin: "14px 0 0" }}
                    >
                      <div
                        className="appt-featured-band"
                        style={{ background: summaryAccent }}
                      >
                        <span>RESUMEN</span>
                        <span
                          style={{
                            background: "rgba(255,255,255,.2)",
                            borderRadius: 8,
                            padding: "3px 8px",
                          }}
                        >
                          {mode || "Modalidad"}
                        </span>
                      </div>
                      <div className="appt-featured-body">
                        <div className="appt-featured-when">{time || "—"}</div>
                        <div className="appt-featured-mode">
                          {date ? formatDateForDisplay(date) : "—"} ·{" "}
                          {t(summaryLabel)}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            marginBottom: reason.trim() ? 10 : 0,
                          }}
                        >
                          <div
                            className="avatar"
                            style={{
                              width: 44,
                              height: 44,
                              background: summaryColorSoft,
                              fontSize: 20,
                            }}
                          >
                            {useCatalogPath ? (
                              <IonIcon icon={personOutline} />
                            ) : (
                              professional?.emoji
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>
                              {t(summaryProName)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--mu)" }}>
                              {t(summaryProRole)}
                            </div>
                          </div>
                        </div>
                        {reason.trim() ? (
                          <p className="req-ticket-motivo">{reason.trim()}</p>
                        ) : null}
                      </div>
                    </article>
                  </>
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="req-foot">
        {done ? (
          <IonButton expand="block" className="bt bt-primary" onClick={finish}>
            Ver mis citas
          </IonButton>
        ) : (
          <div className="req-foot-row">
            <IonButton expand="block" className="bt bt-ghost" onClick={back}>
              {step === 1 ? "Cancelar" : "Volver"}
            </IonButton>
            <IonButton
              expand="block"
              className="bt bt-teal"
              disabled={!canContinue}
              onClick={next}
            >
              {step === TOTAL ? "Solicitar cita" : "Continuar"}
            </IonButton>
          </div>
        )}
      </div>
    </div>
  );
}
