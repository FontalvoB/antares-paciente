import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonSpinner,
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
import { DIRECT_ENTRY_DISPLAY } from "../data/careEntryPoints";
import {
  CONSULT_TYPES,
  buildRequestedAppointment,
  bookingWindow,
  consultTypeById,
  type AppointmentMode,
  type ConsultTypeId,
  type ListedAppointment,
} from "../data/appointments";
import {
  activeCareOptions,
  dayHasSchedule,
  entryDisplayFor,
  entryPointCareOptions,
  groupCareOptionsByCategory,
  isCatalogBookingDate,
  splitSlotViews,
  toAvailableSlotViews,
  type CareOption,
} from "../data/careOptions";
import {
  fetchAvailabilitySlots,
  fetchAvailabilitySlotsRange,
  fetchAvailableProfessionals,
  fetchProfessionalsCatalogPage,
  type AvailabilitySlotDto,
  type ProfessionalCatalogItem,
} from "../utils/appointmentsApi";
import { ProfessionalPickerModal } from "./ProfessionalPickerModal";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import {
  addDaysToISO,
  formatDateForDisplay,
  formatLongDateEs,
  isTodayISO,
  isoYearMonth,
  monthGrid,
  monthTitleEs,
  shiftMonth,
  toLocalISODate,
} from "../utils/dates";
import { availabilityViewState } from "../utils/availabilityViewState";

const STEPS = [
  {
    title: "Agendar tu cita",
    sub: "Selecciona el área de atención que necesitas",
  },
  {
    title: "Agendar tu cita",
    sub: "Elige la fecha y la hora que mejor se ajuste a ti",
  },
  { title: "Agendar tu cita", sub: "Revisa los datos y confirma tu solicitud" },
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
    patientCareContext,
    refreshAppointments,
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
  // Inicio exacto del slot elegido (ISO del backend → preferred_start).
  const [slotStart, setSlotStart] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<AppointmentMode | "">("");
  // Disponibilidad remota por día (2.A.4): caché + estados de carga.
  const [daySlots, setDaySlots] = useState<
    Record<string, AvailabilitySlotDto[]>
  >({});
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  // Reintento manual de disponibilidad (botón "Reintentar").
  const [retryTick, setRetryTick] = useState(0);
  const [{ year, month }, setCursor] = useState(() => isoYearMonth(today));
  // Picker de profesional: el select muestra un top (con cupo primero) y el
  // modal busca en todo el catálogo server-side (escala a cientos).
  const [proPickerOpen, setProPickerOpen] = useState(false);
  const [quickPros, setQuickPros] = useState<ProfessionalCatalogItem[] | null>(
    null,
  );
  const [quickProsTotal, setQuickProsTotal] = useState(0);
  const [availablePros, setAvailablePros] = useState<Set<string>>(new Set());
  const [selectedPro, setSelectedPro] =
    useState<ProfessionalCatalogItem | null>(null);
  const dir = useRef(1);
  const scrollRef = useRef<HTMLIonContentElement>(null);

  // Opciones de atención desde el catálogo (null = aún no cargado),
  // restringidas a la entrada directa de Decisión 5 (REQ-APP-02).
  const careOptions = useMemo(
    () => entryPointCareOptions(activeCareOptions(specialties)),
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
  // Top de la especialidad para el select (6). El resto vive en el picker.
  useEffect(() => {
    if (!useCatalogPath || !specialtyId) {
      setQuickPros(null);
      setQuickProsTotal(0);
      return;
    }
    const ctrl = new AbortController();
    setQuickPros(null);
    void fetchProfessionalsCatalogPage({
      specialtyId,
      status: "Active",
      page: 1,
      pageSize: 6,
      signal: ctrl.signal,
    })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setQuickPros(res.data);
        setQuickProsTotal(res.total);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setQuickPros([]);
          setQuickProsTotal(0);
        }
      });
    return () => ctrl.abort();
  }, [useCatalogPath, specialtyId]);

  // Con cupo primero (orden estable), luego alfabético.
  const quickProsSorted = useMemo(() => {
    return [...(quickPros ?? [])].sort((a, b) => {
      const aCupo = availablePros.has(a.id) ? 1 : 0;
      const bCupo = availablePros.has(b.id) ? 1 : 0;
      if (aCupo !== bCupo) return bCupo - aCupo;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [quickPros, availablePros]);

  const selectedProfessional = useMemo(() => {
    if (!professionalId) return null;
    if (selectedPro?.id === professionalId) return selectedPro;
    return quickPros?.find((p) => p.id === professionalId) ?? null;
  }, [professionalId, selectedPro, quickPros]);

  const range = bookingWindow();
  const professional = typeId ? teamProfessional(typeId) : null;
  const consultType = typeId ? consultTypeById(typeId) : null;
  const orgId = patientCareContext?.orgId ?? "";

  // Parámetros de disponibilidad (contrato `/availability`): modo
  // profesional con elegido, o modo especialidad (+organización requerida
  // por el backend) agregando sin asignar.
  const buildAvailabilityQuery = useCallback(
    (iso: string) => {
      if (!useCatalogPath || !specialtyId) return null;
      if (professionalId) return { professionalId, date: iso };
      if (!orgId) return null;
      return { specialtyId, organizationId: orgId, date: iso };
    },
    [useCatalogPath, specialtyId, professionalId, orgId],
  );

  // Parámetros del modo rango (mismos modos, sin `date`): la búsqueda del
  // primer día con cupo viaja en UNA llamada from/to (máx. 14 días) y el
  // backend batchea las consultas.
  const buildAvailabilityRangeQuery = useCallback(
    (desde: string) => {
      if (!useCatalogPath || !specialtyId) return null;
      if (professionalId)
        return { professionalId, from: desde, to: addDaysToISO(desde, 13) };
      if (!orgId) return null;
      return {
        specialtyId,
        organizationId: orgId,
        from: desde,
        to: addDaysToISO(desde, 13),
      };
    },
    [useCatalogPath, specialtyId, professionalId, orgId],
  );

  // Búsqueda del primer día con cupo al entrar al Paso 2 o cambiar la
  // selección (máx. 14 días, cancelable). UNA llamada en modo rango: la
  // respuesta trae days[] completo y se cachea de una vez.
  useEffect(() => {
    if (step !== 2 || !useCatalogPath || !specialtyId) return;
    // El modo especialidad exige organización (contrato 400): sin ella no
    // hay qué consultar; error explícito en vez de spinner infinito.
    if (!professionalId && !orgId) {
      setDayError(
        t("Se necesita tu organización para buscar por especialidad."),
      );
      setProbing(false);
      return;
    }
    const ctrl = new AbortController();
    setProbing(true);
    setDayError(null);
    setDaySlots({});
    setDate("");
    setSlotStart("");
    setTime("");
    void (async () => {
      try {
        const desde = toLocalISODate();
        const rangeQuery = buildAvailabilityRangeQuery(desde);
        if (!rangeQuery) {
          setProbing(false);
          return;
        }
        const res = await fetchAvailabilitySlotsRange(rangeQuery, {
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        // Caché solo de días agendables (mismo criterio que la sonda por día),
        // para no pintar puntos del calendario fuera del horizonte.
        const agendables = res.days.filter((d) => isCatalogBookingDate(d.date));
        setDaySlots(
          Object.fromEntries(agendables.map((d) => [d.date, d.slots])),
        );
        const primerDia = agendables.find((d) =>
          d.slots.some((s) => s.isAvailable),
        );
        if (primerDia) {
          setDate(primerDia.date);
          setCursor(isoYearMonth(primerDia.date));
        }
        setProbing(false);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setDayError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la disponibilidad",
        );
        setProbing(false);
      }
    })();
    return () => ctrl.abort();
  }, [
    step,
    useCatalogPath,
    specialtyId,
    buildAvailabilityRangeQuery,
    retryTick,
    t,
    professionalId,
    orgId,
  ]);

  // Carga bajo demanda del día tocado manualmente (si no está en caché).
  useEffect(() => {
    if (step !== 2 || !useCatalogPath || !date || daySlots[date]) return;
    const q = buildAvailabilityQuery(date);
    if (!q) return;
    const ctrl = new AbortController();
    setDayLoading(true);
    setDayError(null);
    void fetchAvailabilitySlots(q, { signal: ctrl.signal })
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setDaySlots((prev) => ({ ...prev, [date]: res.slots }));
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setDayError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la disponibilidad",
        );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setDayLoading(false);
      });
    return () => ctrl.abort();
  }, [step, useCatalogPath, date, daySlots, buildAvailabilityQuery, retryTick]);

  // Vistas de slots (B4: solo `isAvailable`) + días verificados con cupo.
  const slotViews = useMemo(
    () => toAvailableSlotViews(daySlots[date] ?? []),
    [daySlots, date],
  );
  const { morning, afternoon } = useMemo(
    () => splitSlotViews(slotViews),
    [slotViews],
  );
  const scheduledDay = date ? (daySlots[date] ?? null) : null;
  const dotDays = useMemo(
    () =>
      new Set(
        Object.entries(daySlots)
          .filter(([, s]) => s.some((x) => x.isAvailable))
          .map(([iso]) => iso),
      ),
    [daySlots],
  );
  // Estado de la sección de horarios (decisión pura testeable). Ventana
  // completa (14 días) sin cupo o rango fallido ya no giran indefinidamente
  // en "Buscando horarios disponibles…" (QA TestFlight 2026-10-02).
  const viewState = useMemo(
    () => availabilityViewState(probing, dayLoading, dayError, date, daySlots),
    [probing, dayLoading, dayError, date, daySlots],
  );
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
    if (step === 2)
      return useCatalogPath ? date !== "" && slotStart !== "" : false;
    return reason.trim().length >= 10 && mode !== "";
  }, [
    step,
    useCatalogPath,
    specialtyId,
    typeId,
    date,
    slotStart,
    reason,
    mode,
  ]);

  useEffect(() => {
    // IonContent (scroll nativo de Ionic) en vez del div overflow custom:
    // en WKWebView el scroller casero no respondía al gesto.
    scrollRef.current?.scrollToTop();
  }, [step, done]);

  // Cupo por profesional (best-effort: sin badge si falla/no hay organización).
  useEffect(() => {
    if (!useCatalogPath || !specialtyId || !orgId) {
      setAvailablePros(new Set());
      return;
    }
    const ctrl = new AbortController();
    void fetchAvailableProfessionals(
      { specialtyId, organizationId: orgId },
      { signal: ctrl.signal },
    )
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setAvailablePros(
          new Set(res.professionals.map((p) => p.professionalId)),
        );
      })
      .catch(() => {
        /* badge best-effort */
      });
    return () => ctrl.abort();
  }, [useCatalogPath, specialtyId, orgId]);

  const pickType = (id: ConsultTypeId) => {
    setTypeId(id);
  };

  const pickCare = (id: string) => {
    setSpecialtyId(id);
    // Sin preselección silenciosa: el profesional queda en "cualquiera"
    // hasta que el paciente elija explícitamente (veredicto D1). La fecha y
    // el slot los resuelve la búsqueda de disponibilidad del Paso 2.
    setProfessionalId("");
    setSelectedPro(null);
    setSlotStart("");
    setTime("");
  };

  const pickDate = (iso: string) => {
    if (!isCatalogBookingDate(iso)) return;
    setDate(iso);
    setSlotStart("");
    setTime("");
  };

  const pickSlot = (startIso: string, label: string) => {
    setSlotStart(startIso);
    setTime(label);
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
        if (!specialtyId || !selectedCare || !slotStart) return;
        // Urgencia = solicitud prioritaria (triage del staff), no SOS.
        const isUrgent = selectedCare.code === "URGENT_CARE";
        const payload = {
          specialtyId,
          professionalId: professionalId || null,
          date,
          time,
          // 2.A.4: el slot elegido viaja como preferred_start exacto.
          preferredStart: slotStart,
          reason,
          mode,
          priority: isUrgent ? ("Urgent" as const) : ("Normal" as const),
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
                ? t("Hoy")
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

  // Tarjeta de entrada directa (Decisión 5): título en español por code
  // (fallback al nombre del catálogo), icono Ionicons, check al seleccionar.
  // `categoryKicker` solo cuando no hay encabezado de área (plano): evita
  // encabezados duplicados.
  const renderEntryCard = (
    opt: CareOption,
    index: number,
    categoryKicker: boolean,
  ) => {
    const display = entryDisplayFor(opt.code, index);
    const selected = specialtyId === opt.specialtyId;
    const title = display.titleKey ? t(display.titleKey) : opt.name;
    const desc = display.descKey ? t(display.descKey) : (opt.description ?? "");
    const kicker = display.kickerKey
      ? t(display.kickerKey)
      : categoryKicker
        ? t(opt.category)
        : null;
    return (
      <IonRadio
        key={opt.specialtyId}
        value={opt.specialtyId}
        className={`req-type-card ac-${display.tone} ${selected ? "sel" : ""}`}
        justify="start"
        labelPlacement="end"
        aria-label={title}
      >
        <span className="req-type-inner">
          <span className="req-type-top">
            <span
              className="req-type-ico"
              style={{ background: display.bg, color: display.fg }}
            >
              <IonIcon icon={display.icon} />
            </span>
            {kicker ? <span className="req-type-kicker">{kicker}</span> : null}
            {selected ? (
              <IonIcon className="req-type-check" icon={checkmarkCircle} />
            ) : null}
          </span>
          <span className="req-type-copy">
            <span className="ct">{title}</span>
            {desc ? <span className="cs">{desc}</span> : null}
            {opt.code === "FAMILY_MEDICINE" && (
              <span className="req-reference-detail">
                {t(
                  "Consulta con tu equipo de salud para el seguimiento y cuidado integral.",
                )}
              </span>
            )}
            {display.sosNote && (
              <span className="req-reference-detail">
                {t(
                  "Si presentas una situación de emergencia, acude de inmediato o comunícate con el 911.",
                )}
              </span>
            )}
          </span>
          {display.sosNote ? (
            <span className="req-type-note">
              <IonIcon icon={warningOutline} />
              {t("Si es una emergencia en curso, usa SOS.")}
            </span>
          ) : null}
        </span>
      </IonRadio>
    );
  };
  // Con un área única (caso Decisión 5) se renderiza plano, sin encabezados;
  // si la entrada creciera a varias áreas, se agrupa con un encabezado.
  const showAreaHeaders = careGroups.length > 1;

  // Resumen del paso 3 (ruta por catálogo: datos del backend, sin mocks).
  // Entradas directas muestran su título de app ("Medicina General"/"Urgencia"),
  // no el nombre clínico del ERP ("Family Medicine"/"Urgent Care").
  const summaryLabel = useCatalogPath
    ? (DIRECT_ENTRY_DISPLAY[selectedCare?.code ?? ""]?.titleKey ??
      selectedCare?.name ??
      "")
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

  // QA-008: en sesión real nunca se cae en silencio a la ruta legacy. Sin
  // catálogo → loading; catálogo vacío/fallido → error recuperable.
  if (realMode && specialties === null) {
    return (
      <div className="req-page booking-reference">
        <div className="req-empty" role="status" aria-live="polite">
          <IonSpinner name="crescent" aria-hidden="true" />
          <strong>{t("Cargando tipos de atención…")}</strong>
        </div>
      </div>
    );
  }
  if (realMode && (!careOptions || careOptions.length === 0)) {
    return (
      <div className="req-page booking-reference">
        <div className="req-empty" role="alert">
          <strong>{t("No se pudieron cargar los tipos de atención")}</strong>
          <p>{t("Revisa tu conexión e inténtalo de nuevo.")}</p>
          <IonButton
            className="bt bt-sm bt-teal"
            onClick={() => void refreshAppointments()}
          >
            {t("Reintentar")}
          </IonButton>
          <IonButton className="bt bt-sm bt-ghost" onClick={onCancel}>
            {t("Cerrar")}
          </IonButton>
        </div>
      </div>
    );
  }

  return (
    <div className="req-page booking-reference">
      <header className="req-hero">
        <div className="req-hero-aurora" aria-hidden="true" />
        <div className="req-hero-top">
          <IonButton
            className="bt bt-round req-hero-btn"
            aria-label={step === 1 ? t("Cerrar") : t("Volver")}
            onClick={back}
          >
            <IonIcon slot="icon-only" icon={step === 1 ? close : chevronBack} />
          </IonButton>
          <div
            className="req-hero-dots"
            aria-label={t("Paso {step} de {total}", {
              step: String(step),
              total: String(TOTAL),
            })}
          >
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`req-dot ${i + 1 < step || done ? "done" : i + 1 === step ? "now" : ""}`}
                aria-label={t(
                  ["Área de atención", "Fecha y hora", "Confirmación"][i],
                )}
                disabled={i + 1 > step}
                onClick={() => i + 1 < step && go(i + 1)}
              >
                <span>{i + 1}</span>
                <small>
                  {t(["Área de atención", "Fecha y hora", "Confirmación"][i])}
                </small>
              </button>
            ))}
          </div>
          <IonButton
            className="bt bt-round req-hero-btn"
            aria-label={t("Cerrar")}
            onClick={onCancel}
          >
            <IonIcon slot="icon-only" icon={close} />
          </IonButton>
        </div>
        <div className="kicker">
          {t("Paso {step} de {total}", {
            step: String(done ? TOTAL : step),
            total: String(TOTAL),
          })}
        </div>
        <h1 className="req-hero-title">
          {done ? t("Solicitud lista") : t(meta.title)}
        </h1>
        <p className="sub">
          {done ? t("El equipo confirmará tu cita en breve") : t(meta.sub)}
        </p>
        {(specialtyId || typeId || date || time) && !done && (
          <div className="chips">
            {useCatalogPath && selectedCare && (
              <button
                type="button"
                className="chip chip-glass"
                onClick={() => go(1)}
              >
                {t(
                  DIRECT_ENTRY_DISPLAY[selectedCare.code]?.titleKey ??
                    selectedCare.name,
                )}
              </button>
            )}
            {!useCatalogPath && consultType && (
              <button
                type="button"
                className="chip chip-glass"
                onClick={() => go(1)}
              >
                {consultType.emoji} {t(consultType.label)}
              </button>
            )}
            {date && (
              <button
                type="button"
                className="chip chip-glass"
                onClick={() => go(2)}
              >
                <IonIcon icon={calendarOutline} />{" "}
                {isTodayISO(date) ? t("Hoy") : formatDateForDisplay(date)}
                {time ? ` · ${time}` : ""}
              </button>
            )}
          </div>
        )}
      </header>

      <IonContent className="req-body" ref={scrollRef} scrollY>
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
                {t("Cita solicitada")}
              </div>
              <p>
                {t(
                  "Quedó en revisión. Te avisamos cuando {name} la confirme.",
                  {
                    name: proShort,
                  },
                )}
              </p>
              <article className="appt-featured" style={{ margin: "16px 0 0" }}>
                <div
                  className="appt-featured-band"
                  style={{ background: professional.accent }}
                >
                  <span>{t("PENDIENTE")}</span>
                  <span
                    style={{
                      background: "rgba(255,255,255,.2)",
                      borderRadius: 8,
                      padding: "3px 8px",
                    }}
                  >
                    {t(mode)}
                  </span>
                </div>
                <div className="appt-featured-body">
                  <div className="appt-featured-when">{time}</div>
                  <div className="appt-featured-mode">
                    {formatDateForDisplay(date)} · {t(consultType.label)}
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
                      <div style={{ fontWeight: 700 }}>
                        {t(professional.name)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--mu)" }}>
                        {t(professional.role)}
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
                  {!showAreaHeaders ? (
                    <IonRadioGroup
                      className="req-types"
                      value={specialtyId || undefined}
                      onIonChange={(e) => pickCare(e.detail.value as string)}
                    >
                      {(careOptions ?? []).map((opt, i) =>
                        renderEntryCard(opt, i, true),
                      )}
                    </IonRadioGroup>
                  ) : (
                    careGroups.map((group, gi) => (
                      <section key={group.category} className="req-area">
                        <div className="req-field-lbl">{t(group.category)}</div>
                        <IonRadioGroup
                          className="req-types"
                          value={specialtyId || undefined}
                          onIonChange={(e) =>
                            pickCare(e.detail.value as string)
                          }
                        >
                          {group.options.map((opt) =>
                            renderEntryCard(opt, gi, false),
                          )}
                        </IonRadioGroup>
                      </section>
                    ))
                  )}

                  {specialtyId && (
                    <div className="field">
                      <label>{t("Profesional (opcional)")}</label>
                      <IonSelect
                        className="fld req-pro-pick-input"
                        interface="popover"
                        interfaceOptions={{
                          cssClass: "req-pro-popover",
                          side: "bottom",
                          alignment: "center",
                        }}
                        value={professionalId}
                        aria-label={t("Profesional (opcional)")}
                        onIonChange={(e) => {
                          const value = e.detail.value as string;
                          if (value === "__all__") {
                            setProPickerOpen(true);
                            return;
                          }
                          setProfessionalId(value);
                          setSelectedPro(
                            value
                              ? (quickPros?.find((p) => p.id === value) ?? null)
                              : null,
                          );
                        }}
                      >
                        <IonIcon
                          slot="start"
                          className="req-pro-ico"
                          icon={personOutline}
                          aria-hidden="true"
                        />
                        <IonSelectOption value="">
                          {t("Cualquier profesional")}
                        </IonSelectOption>
                        {quickProsSorted.map((p) => (
                          <IonSelectOption key={p.id} value={p.id}>
                            {p.fullName}
                          </IonSelectOption>
                        ))}
                        {quickProsTotal > quickProsSorted.length ? (
                          <IonSelectOption value="__all__">
                            {t("Ver todos ({count})", {
                              count: String(quickProsTotal),
                            })}
                          </IonSelectOption>
                        ) : null}
                      </IonSelect>
                      {quickPros !== null && quickProsTotal === 0 ? (
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

              {step === 2 && useCatalogPath && !!specialtyId && (
                <div className="req-agenda">
                  {probing && (
                    <div
                      className="req-empty"
                      role="status"
                      aria-live="polite"
                      style={{ margin: "0 0 12px" }}
                    >
                      <IonSpinner name="crescent" aria-hidden="true" />
                      <strong>{t("Buscando horarios disponibles…")}</strong>
                    </div>
                  )}

                  <section className="req-cal card">
                    <div className="req-cal-nav">
                      <IonButton
                        className="bt bt-round req-cal-nav-btn"
                        disabled={!canPrev}
                        aria-label={t("Mes anterior")}
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
                        aria-label={t("Mes siguiente")}
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
                      aria-label={t("Calendario de disponibilidad")}
                    >
                      {cells.map((iso, i) => {
                        if (!iso)
                          return (
                            <span key={`e-${i}`} className="req-cal-cell" />
                          );
                        const enabled = isCatalogBookingDate(iso);
                        const hasSlots = enabled && dotDays.has(iso);
                        const selected = iso === date;
                        const todayCell = isTodayISO(iso);
                        return (
                          <IonButton
                            key={iso}
                            fill={selected ? "solid" : "clear"}
                            className={`bt req-cal-day${selected ? " sel" : ""}${todayCell && !selected ? " today" : ""}${!enabled ? " off" : ""}${hasSlots ? " open" : ""}`}
                            disabled={!enabled}
                            aria-label={`${formatLongDateEs(iso)}${hasSlots ? ` · ${t("Con cupo")}` : ""}`}
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
                            ? slotViews.length > 0
                              ? t("{count} horarios · {name}", {
                                  count: String(slotViews.length),
                                  name: proShort,
                                })
                              : scheduledDay === null
                                ? t("Cargando horarios…")
                                : dayHasSchedule(scheduledDay)
                                  ? t("Sin cupo este día")
                                  : t("Sin jornada este día")
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
                        {viewState === "loading" ? (
                          <div
                            className="req-empty"
                            role="status"
                            aria-live="polite"
                          >
                            <IonSpinner name="crescent" aria-hidden="true" />
                            <strong>
                              {t(
                                dayLoading
                                  ? "Cargando horarios…"
                                  : "Buscando horarios disponibles…",
                              )}
                            </strong>
                          </div>
                        ) : viewState === "empty" ? (
                          // Resultado vacío explícito con salida guiada: la
                          // ventana de 14 días se escaneó completa sin cupo.
                          // Reemplaza el spinner infinito (QA TestFlight).
                          <div
                            className="req-empty"
                            role="status"
                            aria-live="polite"
                          >
                            <IonIcon
                              className="req-empty-ico"
                              icon={calendarOutline}
                              aria-hidden="true"
                              style={{ color: "var(--teal)" }}
                            />
                            <strong>
                              {t(
                                "{name} no tiene cupos en los próximos 14 días",
                                {
                                  name: proShort,
                                },
                              )}
                            </strong>
                            <p>
                              {t(
                                professionalId
                                  ? "Puedes probar con cualquier profesional del equipo o volver más tarde."
                                  : "Ningún profesional de esta área tiene cupo por ahora; vuelve más tarde.",
                              )}
                            </p>
                            {professionalId ? (
                              <>
                                <IonButton
                                  className="bt bt-sm bt-teal"
                                  onClick={() => {
                                    // Vuelve al modo "cualquiera" (especialidad):
                                    // el efecto reescanea la ventana en un paso.
                                    setProfessionalId("");
                                    setSelectedPro(null);
                                    setSlotStart("");
                                    setTime("");
                                  }}
                                >
                                  {t("Probar con cualquier profesional")}
                                </IonButton>
                                <IonButton
                                  className="bt bt-sm bt-ghost"
                                  onClick={() => setProPickerOpen(true)}
                                >
                                  {t("Ver todos los profesionales")}
                                </IonButton>
                              </>
                            ) : (
                              <IonButton
                                className="bt bt-sm bt-ghost"
                                onClick={() => setRetryTick((n) => n + 1)}
                              >
                                {t("Reintentar")}
                              </IonButton>
                            )}
                          </div>
                        ) : viewState === "error" ? (
                          // El error precede al placeholder neutro: un rango
                          // fallido con date vacío muestra su causa, no gira
                          // (era la otra mitad del spinner infinito original).
                          <div className="req-empty" role="alert">
                            <strong>
                              {t("No se pudo cargar la disponibilidad")}
                            </strong>
                            <p>{dayError}</p>
                            <IonButton
                              className="bt bt-sm bt-ghost"
                              onClick={() => setRetryTick((n) => n + 1)}
                            >
                              {t("Reintentar")}
                            </IonButton>
                          </div>
                        ) : viewState === "chooseDay" ? (
                          // Residual: sin fecha y sin rango en caché (contrato
                          // days[] completo nunca debería llegar vacío).
                          <div
                            className="req-empty"
                            role="status"
                            aria-live="polite"
                          >
                            <strong>
                              {t("Elige un día para ver los horarios")}
                            </strong>
                          </div>
                        ) : slotViews.length === 0 ? (
                          <div className="req-empty">
                            <strong>
                              {t(
                                scheduledDay && dayHasSchedule(scheduledDay)
                                  ? "Sin cupo este día"
                                  : "Sin horarios este día",
                              )}
                            </strong>
                            <p>
                              {t(
                                "Prueba un día marcado con cupo o elige otra atención.",
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
                                      key={slot.startIso}
                                      className={`bt req-slot ${slotStart === slot.startIso ? "sel" : ""}`}
                                      aria-pressed={slotStart === slot.startIso}
                                      onClick={() =>
                                        pickSlot(slot.startIso, slot.timeLabel)
                                      }
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
                                <div className="req-slot-label">
                                  {t("Tarde")}
                                </div>
                                <div className="req-slots">
                                  {afternoon.map((slot) => (
                                    <IonButton
                                      key={slot.startIso}
                                      className={`bt req-slot ${slotStart === slot.startIso ? "sel" : ""}`}
                                      aria-pressed={slotStart === slot.startIso}
                                      onClick={() =>
                                        pickSlot(slot.startIso, slot.timeLabel)
                                      }
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
                      </motion.div>
                    </AnimatePresence>

                    {date && slotStart && (
                      <div className="req-pick">
                        <IonIcon icon={calendarOutline} />
                        <span>{formatLongDateEs(date)}</span>
                        <strong>{time}</strong>
                        <em>{t(DURATION)}</em>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {step === 2 && !useCatalogPath && (
                <div
                  className="req-empty"
                  style={{ margin: "8px 0 0" }}
                  role="status"
                >
                  <strong>{t("Inicia sesión para ver horarios")}</strong>
                  <p>
                    {t(
                      "Los horarios reales se cargan con tu sesión de paciente.",
                    )}
                  </p>
                </div>
              )}

              {step === 3 &&
                (useCatalogPath
                  ? !!selectedCare
                  : !!(professional && consultType)) && (
                  <>
                    <div className="field">
                      <label htmlFor="req-motivo">
                        {t("Motivo de la consulta")}
                      </label>
                      <IonTextarea
                        id="req-motivo"
                        className="fld"
                        autoGrow
                        rows={4}
                        maxlength={500}
                        enterkeyhint="done"
                        placeholder={t(
                          "Cuéntale al equipo qué te preocupa hoy",
                        )}
                        value={reason}
                        onIonInput={(e) => setReason(e.detail.value ?? "")}
                      />
                      <span className="req-hint">
                        {reason.trim().length < 10
                          ? t("Mínimo 10 caracteres")
                          : `${reason.trim().length} / 500`}
                      </span>
                    </div>

                    {useCatalogPath && (
                      <div className="field">
                        <label>{t("Profesional (opcional)")}</label>
                        <div className="req-pick">
                          <IonIcon
                            className="req-pro-ico"
                            icon={personOutline}
                          />
                          <span>
                            {selectedProfessional?.fullName ??
                              t("Cualquier profesional disponible")}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="req-field-lbl">{t("Modalidad")}</div>
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
                            <span className="ct">{t("Videollamada")}</span>
                            <span className="cs">
                              {t("Desde casa · sala virtual")}
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
                            <span className="ct">{t("Presencial")}</span>
                            <span className="cs">
                              {t("En la clínica COPP-ADRESD")}
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
                        <span>{t("RESUMEN")}</span>
                        <span
                          style={{
                            background: "rgba(255,255,255,.2)",
                            borderRadius: 8,
                            padding: "3px 8px",
                          }}
                        >
                          {mode ? t(mode) : t("Modalidad")}
                        </span>
                      </div>
                      <div className="appt-featured-body">
                        <div className="appt-featured-when">{time || "—"}</div>
                        <div className="appt-featured-mode">
                          {date ? formatDateForDisplay(date) : "—"} ·{" "}
                          {t(summaryLabel)}
                          {selectedCare?.code === "URGENT_CARE"
                            ? ` · ${t("Atención prioritaria")}`
                            : ""}
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
      </IonContent>

      <div className="req-foot">
        {done ? (
          <IonButton expand="block" className="bt bt-primary" onClick={finish}>
            {t("Ver mis citas")}
          </IonButton>
        ) : (
          <div className="req-foot-row">
            <IonButton expand="block" className="bt bt-ghost" onClick={back}>
              {step === 1 ? t("Cancelar") : t("Volver")}
            </IonButton>
            <IonButton
              expand="block"
              className="bt bt-teal"
              disabled={!canContinue}
              onClick={next}
            >
              {step === TOTAL ? t("Solicitar cita") : t("Continuar")}
            </IonButton>
          </div>
        )}
      </div>

      {useCatalogPath && specialtyId ? (
        <ProfessionalPickerModal
          isOpen={proPickerOpen}
          specialtyId={specialtyId}
          organizationId={orgId}
          selectedId={professionalId}
          onClose={() => setProPickerOpen(false)}
          onSelect={(pro) => {
            setProfessionalId(pro.id);
            setSelectedPro(pro);
            setProPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
