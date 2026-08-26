import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  IonButton,
  IonIcon,
  IonRadio,
  IonRadioGroup,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
} from '@ionic/react'
import {
  calendarOutline,
  checkmark,
  checkmarkCircle,
  chevronBack,
  chevronForward,
  close,
  flash,
  leaf,
  locationOutline,
  medkit,
  sparkles,
  timeOutline,
  videocamOutline,
  warningOutline,
} from 'ionicons/icons'
import {
  CONSULT_TYPES,
  buildRequestedAppointment,
  bookingWindow,
  consultTypeById,
  firstOpenSlot,
  getAvailableSlots,
  isSelectableBookingDate,
  professionalByType,
  splitSlots,
  type AppointmentMode,
  type ConsultTypeId,
  type ListedAppointment,
} from '../data/appointments'
import {
  formatDateForDisplay,
  formatLongDateEs,
  isTodayISO,
  isoYearMonth,
  monthGrid,
  monthTitleEs,
  shiftMonth,
  toLocalISODate,
} from '../utils/dates'

const STEPS = [
  { title: '¿Qué necesitas?', sub: 'Elige el área y te mostramos quién te atiende' },
  { title: 'Agenda tu cita', sub: 'Toca un día con cupo y elige la hora' },
  { title: 'Confirma los datos', sub: 'Motivo, modalidad y resumen' },
] as const

const TOTAL = STEPS.length
const EASE = [0.22, 1, 0.36, 1] as const
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
const DURATION = '30 min'

const TYPE_ICONS: Record<ConsultTypeId, string> = {
  medica: medkit,
  psicologia: sparkles,
  nutricion: leaf,
  urgencia: flash,
}

const TYPE_BG: Record<ConsultTypeId, string> = {
  medica: 'var(--teal-l)',
  psicologia: 'var(--pur-l)',
  nutricion: 'var(--blue-l)',
  urgencia: 'var(--org-l)',
}

const TYPE_FG: Record<ConsultTypeId, string> = {
  medica: 'var(--teal)',
  psicologia: 'var(--pur)',
  nutricion: 'var(--blue)',
  urgencia: 'var(--org)',
}

export function RequestAppointmentWizard({
  onCancel,
  onSubmitted,
}: {
  onCancel: () => void
  onSubmitted: (appt: ListedAppointment) => void
}) {
  const today = toLocalISODate()
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [typeId, setTypeId] = useState<ConsultTypeId | ''>('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<AppointmentMode | ''>('')
  const [period, setPeriod] = useState<'all' | 'am' | 'pm'>('all')
  const [{ year, month }, setCursor] = useState(() => isoYearMonth(today))
  const dir = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  const range = bookingWindow()
  const professional = typeId ? professionalByType(typeId) : null
  const consultType = typeId ? consultTypeById(typeId) : null
  const slots = typeId && date ? getAvailableSlots(typeId, date) : []
  const { morning, afternoon } = splitSlots(slots)
  const visibleSlots = period === 'am' ? morning : period === 'pm' ? afternoon : slots
  const nextSlot = typeId ? firstOpenSlot(typeId) : null
  const cells = monthGrid(year, month)
  const meta = STEPS[step - 1] ?? STEPS[0]
  const proShort = professional?.name.split(',')[0] ?? ''
  const minCursor = isoYearMonth(range.min)
  const maxCursor = isoYearMonth(range.max)
  const canPrev = year > minCursor.year || (year === minCursor.year && month > minCursor.month)
  const canNext = year < maxCursor.year || (year === maxCursor.year && month < maxCursor.month)

  const canContinue = useMemo(() => {
    if (step === 1) return typeId !== ''
    if (step === 2) return date !== '' && time !== ''
    return reason.trim().length >= 10 && mode !== ''
  }, [step, typeId, date, time, reason, mode])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [step, done])

  const pickType = (id: ConsultTypeId) => {
    setTypeId(id)
    setTime('')
    setPeriod('all')
    const open = firstOpenSlot(id)
    if (open) {
      setDate(open.date)
      setCursor(isoYearMonth(open.date))
    } else {
      setDate('')
    }
  }

  const pickDate = (iso: string) => {
    if (!typeId || !isSelectableBookingDate(iso, typeId)) return
    setDate(iso)
    setTime('')
    setPeriod('all')
  }

  const jumpNext = () => {
    if (!nextSlot) return
    setDate(nextSlot.date)
    setTime(nextSlot.time)
    setCursor(isoYearMonth(nextSlot.date))
    setPeriod('all')
  }

  const go = (n: number) => {
    dir.current = n > step ? 1 : -1
    setStep(n)
  }

  const back = () => {
    if (step === 1) {
      onCancel()
      return
    }
    go(step - 1)
  }

  const next = () => {
    if (!canContinue) return
    if (step < TOTAL) {
      go(step + 1)
      return
    }
    if (!typeId || !mode) return
    setDone(true)
  }

  const finish = () => {
    if (!typeId || !mode) return
    onSubmitted(buildRequestedAppointment({ typeId, date, time, reason, mode }))
  }

  const moveMonth = (delta: number) => {
    if (delta < 0 && !canPrev) return
    if (delta > 0 && !canNext) return
    setCursor((c) => shiftMonth(c.year, c.month, delta))
  }

  return (
    <div className="req-page">
      <header className="req-hero">
        <div className="req-hero-aurora" aria-hidden="true" />
        <div className="req-hero-top">
          <IonButton className="bt bt-round req-hero-btn" aria-label={step === 1 ? 'Cerrar' : 'Volver'} onClick={back}>
            <IonIcon slot="icon-only" icon={step === 1 ? close : chevronBack} />
          </IonButton>
          <div className="req-hero-dots" aria-label={`Paso ${step} de ${TOTAL}`}>
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`req-dot ${i + 1 < step || done ? 'done' : i + 1 === step ? 'now' : ''}`}
                aria-label={s.title}
                disabled={i + 1 > step}
                onClick={() => i + 1 < step && go(i + 1)}
              />
            ))}
          </div>
          <IonButton className="bt bt-round req-hero-btn" aria-label="Cerrar" onClick={onCancel}>
            <IonIcon slot="icon-only" icon={close} />
          </IonButton>
        </div>
        <div className="kicker">Paso {done ? TOTAL : step} de {TOTAL}</div>
        <h1 className="req-hero-title">{done ? 'Solicitud lista' : meta.title}</h1>
        <p className="sub">{done ? 'El equipo confirmará tu cita en breve' : meta.sub}</p>
        {(typeId || date || time) && !done && (
          <div className="chips">
            {consultType && (
              <button type="button" className="chip chip-glass" onClick={() => go(1)}>
                {consultType.emoji} {consultType.label}
              </button>
            )}
            {date && (
              <button type="button" className="chip chip-glass" onClick={() => go(2)}>
                <IonIcon icon={calendarOutline} /> {isTodayISO(date) ? 'Hoy' : formatDateForDisplay(date)}
                {time ? ` · ${time}` : ''}
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
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            >
              <div className="req-done-badge" aria-hidden="true">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>Cita solicitada</div>
              <p>Quedó en revisión. Te avisamos cuando {proShort} la confirme.</p>
              <article className="appt-featured" style={{ margin: '16px 0 0' }}>
                <div className="appt-featured-band" style={{ background: professional.accent }}>
                  <span>PENDIENTE</span>
                  <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '3px 8px' }}>{mode}</span>
                </div>
                <div className="appt-featured-body">
                  <div className="appt-featured-when">{time}</div>
                  <div className="appt-featured-mode">{formatDateForDisplay(date)} · {consultType.label}</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="avatar" style={{ width: 44, height: 44, background: professional.colorSoft, fontSize: 20 }}>
                      {professional.emoji}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{professional.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--mu)' }}>{professional.role}</div>
                    </div>
                  </div>
                </div>
              </article>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 22 * dir.current }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 * dir.current }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {step === 1 && (
                <>
                  <IonRadioGroup
                    className="req-types"
                    value={typeId || undefined}
                    onIonChange={(e) => pickType(e.detail.value as ConsultTypeId)}
                  >
                    {CONSULT_TYPES.map((t) => (
                      <IonRadio
                        key={t.id}
                        value={t.id}
                        className={`req-type-card card card-accent ac-${t.tone} ${typeId === t.id ? 'sel' : ''}`}
                        justify="start"
                        labelPlacement="end"
                      >
                        <span className="req-type-inner">
                          <span className="ico" style={{ background: TYPE_BG[t.id], color: TYPE_FG[t.id], marginBottom: 0 }}>
                            <IonIcon icon={TYPE_ICONS[t.id]} />
                          </span>
                          <span className="req-type-copy">
                            <span className="ct">{t.label}</span>
                            <span className="cs">{t.short}</span>
                          </span>
                          {typeId === t.id ? <IonIcon className="req-type-check" icon={checkmark} /> : null}
                        </span>
                      </IonRadio>
                    ))}
                  </IonRadioGroup>

                  <AnimatePresence>
                    {professional && (
                      <motion.article
                        className="appt-featured"
                        style={{ margin: '12px 0 0' }}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.28, ease: EASE }}
                      >
                        <div className="appt-featured-band" style={{ background: professional.accent }}>
                          <span>PROFESIONAL A CARGO</span>
                          <span className="chip chip-glass" style={{ padding: '2px 8px' }}>
                            <span className="dot" /> Disponible
                          </span>
                        </div>
                        <div className="appt-featured-body" style={{ paddingBottom: 16 }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div className="avatar" style={{ width: 56, height: 56, background: professional.colorSoft, fontSize: 26 }}>
                              {professional.emoji}
                            </div>
                            <div>
                              <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>{professional.name}</div>
                              <div style={{ fontSize: 13, color: 'var(--mu)', marginTop: 2 }}>{professional.role}</div>
                            </div>
                          </div>
                        </div>
                      </motion.article>
                    )}
                  </AnimatePresence>

                  {typeId === 'urgencia' && (
                    <div className="onb-trust onb-trust-warn" style={{ marginTop: 12 }}>
                      <IonIcon icon={warningOutline} />
                      <span>Para una emergencia en curso usa SOS. Aquí pides una cita prioritaria con la médica de guardia.</span>
                    </div>
                  )}
                </>
              )}

              {step === 2 && typeId && (
                <>
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
                      <div className="req-cal-month">{monthTitleEs(year, month)}</div>
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
                    <div className="req-cal-grid" role="grid" aria-label="Calendario de disponibilidad">
                      {cells.map((iso, i) => {
                        if (!iso) return <span key={`e-${i}`} className="req-cal-cell" />
                        const enabled = isSelectableBookingDate(iso, typeId)
                        const hasSlots = enabled && getAvailableSlots(typeId, iso).length > 0
                        const selected = iso === date
                        const todayCell = isTodayISO(iso)
                        return (
                          <IonButton
                            key={iso}
                            fill={selected ? 'solid' : 'clear'}
                            className={`bt req-cal-day${selected ? ' sel' : ''}${todayCell && !selected ? ' today' : ''}${!enabled ? ' off' : ''}${hasSlots ? ' open' : ''}`}
                            disabled={!enabled}
                            aria-label={`${formatLongDateEs(iso)}${hasSlots ? ', con horarios' : ''}`}
                            aria-pressed={selected}
                            onClick={() => pickDate(iso)}
                          >
                            {iso.split('-')[2]?.replace(/^0/, '')}
                          </IonButton>
                        )
                      })}
                    </div>
                    <div className="req-cal-legend">
                      <span><i className="req-cal-dot" /> Con cupo</span>
                      <span>Citas de {DURATION}</span>
                    </div>
                  </section>

                  {nextSlot && !(nextSlot.date === date && nextSlot.time === time) && (
                    <IonButton expand="block" className="bt bt-ghost req-next-open" onClick={jumpNext}>
                      <IonIcon icon={timeOutline} slot="start" />
                      Próximo disponible · {isTodayISO(nextSlot.date) ? 'Hoy' : formatDateForDisplay(nextSlot.date)} {nextSlot.time}
                    </IonButton>
                  )}

                  <div className="req-times-head">
                    <div>
                      <div className="req-times-title">{date ? formatLongDateEs(date) : 'Elige un día'}</div>
                      <div className="req-times-sub">
                        {date
                          ? (slots.length ? `${slots.length} horarios · ${proShort}` : 'Sin cupo este día')
                          : `Agenda de ${proShort}`}
                      </div>
                    </div>
                  </div>

                  {date && slots.length > 0 && (
                    <IonSegment
                      className="req-seg"
                      value={period}
                      onIonChange={(e) => setPeriod((e.detail.value as 'all' | 'am' | 'pm') || 'all')}
                    >
                      <IonSegmentButton value="all">Todos</IonSegmentButton>
                      <IonSegmentButton value="am">Mañana</IonSegmentButton>
                      <IonSegmentButton value="pm">Tarde</IonSegmentButton>
                    </IonSegment>
                  )}

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${date}-${period}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                    >
                      {!date ? (
                        <div className="req-empty">
                          <strong>Elige un día en el calendario</strong>
                          <p>Los puntos indican los días con horarios libres.</p>
                        </div>
                      ) : visibleSlots.length === 0 ? (
                        <div className="req-empty">
                          <strong>{slots.length === 0 ? 'Sin horarios este día' : 'No hay huecos en este periodo'}</strong>
                          <p>
                            {slots.length === 0
                              ? 'Prueba un día con punto verde o usa el próximo disponible.'
                              : 'Cambia a Todos o al otro periodo del día.'}
                          </p>
                        </div>
                      ) : (
                        <div className="req-slots">
                          {visibleSlots.map((slot) => (
                            <IonButton
                              key={slot}
                              className={`bt req-slot ${time === slot ? 'sel' : ''}`}
                              onClick={() => setTime(slot)}
                            >
                              <span className="req-slot-time">{slot}</span>
                              <span className="req-slot-dur">{time === slot ? 'Elegida' : DURATION}</span>
                            </IonButton>
                          ))}
                        </div>
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
                </>
              )}

              {step === 3 && professional && consultType && (
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
                      onIonInput={(e) => setReason(e.detail.value ?? '')}
                    />
                    <span className="req-hint">{reason.trim().length < 10 ? 'Mínimo 10 caracteres' : `${reason.trim().length} / 500`}</span>
                  </div>

                  <div className="req-field-lbl">Modalidad</div>
                  <IonRadioGroup
                    className="req-modes"
                    value={mode || undefined}
                    onIonChange={(e) => setMode(e.detail.value as AppointmentMode)}
                  >
                    <IonRadio value="Videollamada" className={`card req-mode-card ${mode === 'Videollamada' ? 'sel' : ''}`} justify="start" labelPlacement="end">
                      <span className="req-mode-inner">
                        <span className="ico" style={{ background: 'var(--teal-l)', color: 'var(--teal)', marginBottom: 0 }}>
                          <IonIcon icon={videocamOutline} />
                        </span>
                        <span className="req-type-copy">
                          <span className="ct">Videollamada</span>
                          <span className="cs">Desde casa · sala virtual</span>
                        </span>
                      </span>
                    </IonRadio>
                    <IonRadio value="Presencial" className={`card req-mode-card ${mode === 'Presencial' ? 'sel' : ''}`} justify="start" labelPlacement="end">
                      <span className="req-mode-inner">
                        <span className="ico" style={{ background: 'var(--blue-l)', color: 'var(--blue)', marginBottom: 0 }}>
                          <IonIcon icon={locationOutline} />
                        </span>
                        <span className="req-type-copy">
                          <span className="ct">Presencial</span>
                          <span className="cs">En la clínica COPP-ADRESD</span>
                        </span>
                      </span>
                    </IonRadio>
                  </IonRadioGroup>

                  <article className="appt-featured" style={{ margin: '14px 0 0' }}>
                    <div className="appt-featured-band" style={{ background: professional.accent }}>
                      <span>RESUMEN</span>
                      <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '3px 8px' }}>{mode || 'Modalidad'}</span>
                    </div>
                    <div className="appt-featured-body">
                      <div className="appt-featured-when">{time || '—'}</div>
                      <div className="appt-featured-mode">
                        {date ? formatDateForDisplay(date) : '—'} · {consultType.label}
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: reason.trim() ? 10 : 0 }}>
                        <div className="avatar" style={{ width: 44, height: 44, background: professional.colorSoft, fontSize: 20 }}>
                          {professional.emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{professional.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--mu)' }}>{professional.role}</div>
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
              {step === 1 ? 'Cancelar' : 'Volver'}
            </IonButton>
            <IonButton expand="block" className="bt bt-teal" disabled={!canContinue} onClick={next}>
              {step === TOTAL ? 'Solicitar cita' : 'Continuar'}
            </IonButton>
          </div>
        )}
      </div>
    </div>
  )
}
