import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  IonButton,
  IonCheckbox,
  IonDatetime,
  IonIcon,
  IonInput,
  IonModal,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
} from '@ionic/react'
import {
  calendarOutline,
  callOutline,
  chatbubbleEllipsesOutline,
  checkmark,
  checkmarkCircle,
  createOutline,
  documentTextOutline,
  eye,
  eyeOff,
  lockClosedOutline,
  mailOutline,
  medkitOutline,
  peopleOutline,
  personOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
  walletOutline,
} from 'ionicons/icons'
import { useApp } from '../context/AppContext'
import { formatDateForDisplay } from '../utils/dates'
import type { UserProfile } from '../types'

const STEPS = [
  { title: 'Tus datos', sub: 'Así te identifica el equipo médico', name: 'Identidad' },
  { title: 'Verifica tu identidad', sub: 'Te enviamos un código de 6 dígitos', name: 'Código' },
  { title: 'Contacto de emergencia', sub: 'A quién avisamos si activas SOS', name: 'Familia' },
  { title: 'Consentimiento', sub: 'Lee, acepta y firma tu autorización', name: 'HIPAA' },
  { title: 'Crea tu contraseña', sub: 'Protege tu expediente médico', name: 'Seguridad' },
]

const PARENTESCO = ['Esposo/a', 'Padre/Madre', 'Hijo/a', 'Hermano/a', 'Amigo/a'] as const

export function OnboardingPage() {
  const { finishOnboarding, showToast, backToLogin } = useApp()
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [otpCh, setOtpCh] = useState('SMS')
  const [otpSent, setOtpSent] = useState(false)
  const [otpLeft, setOtpLeft] = useState(0)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [checks, setChecks] = useState([false, false, false])
  const [signed, setSigned] = useState(false)
  const [sigCh, setSigCh] = useState('SMS')
  const [dateOpen, setDateOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<UserProfile>({
    nombre: 'María González',
    cedula: '10247381',
    dob: '1988-04-12',
    seguro: 'BlueCross BlueShield',
    poliza: 'BCB-20247381',
    grupo: 'GRP-5092',
    email: 'maria.gonzalez@email.com',
    celular: '+1 (786) 555-0100',
    fam1Nombre: 'Pedro González',
    fam1Parentesco: 'Esposo/a',
    fam1Cel: '+1 (786) 555-0192',
    fam1Email: 'pedro.gonzalez@email.com',
  })

  const set = (k: keyof UserProfile, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [step, done, otpSent])

  useEffect(() => {
    if (otpLeft <= 0) return
    const id = window.setTimeout(() => setOtpLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [otpLeft])

  const pwdOk = pwd.length >= 8 && /[A-Z]/.test(pwd) && /\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)
  const strength = useMemo(() => {
    let s = 0
    if (pwd.length >= 8) s += 25
    if (/[A-Z]/.test(pwd)) s += 25
    if (/\d/.test(pwd)) s += 25
    if (/[^A-Za-z0-9]/.test(pwd)) s += 25
    return s
  }, [pwd])
  const strengthLbl = strength < 50 ? 'Débil' : strength < 100 ? 'Aceptable' : 'Fuerte'
  const strengthColor = strength < 50 ? 'var(--red)' : strength < 100 ? 'var(--org)' : 'var(--teal)'

  const sendOtp = () => {
    setOtpSent(true)
    setOtpLeft(30)
    setOtp(['', '', '', '', '', ''])
    showToast(`Código enviado por ${otpCh}`, 'ok')
  }

  const next = () => {
    if (step === 1) {
      setStep(2)
      return
    }
    if (step === 2) {
      if (!otpSent) {
        sendOtp()
        return
      }
      if (otp.join('') !== '123456') {
        showToast('Código demo: 123456', 'warn')
        return
      }
      setStep(3)
      return
    }
    if (step === 3) {
      if (!form.fam1Nombre || !form.fam1Cel) {
        showToast('El familiar principal es obligatorio', 'err')
        return
      }
      setStep(4)
      return
    }
    if (step === 4) {
      if (!checks.every(Boolean) || !signed) {
        showToast('Acepta los términos y firma para continuar', 'warn')
        return
      }
      setStep(5)
      return
    }
    if (step === 5) {
      if (!pwdOk || pwd !== pwd2) {
        showToast('La contraseña no cumple los requisitos', 'err')
        return
      }
      setDone(true)
    }
  }

  const back = () => {
    if (step === 1) {
      backToLogin()
      return
    }
    setStep((s) => s - 1)
  }

  const fillOtp = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) {
      const nextOtp = [...otp]
      nextOtp[i] = ''
      setOtp(nextOtp)
      return
    }
    if (digits.length > 1) {
      const nextOtp = [...otp]
      digits.slice(0, 6).split('').forEach((d, idx) => {
        nextOtp[idx] = d
      })
      setOtp(nextOtp)
      return
    }
    const nextOtp = [...otp]
    nextOtp[i] = digits.slice(-1)
    setOtp(nextOtp)
    const el = document.getElementById(`otp-${i + 1}`)
    if (el instanceof HTMLInputElement) el.focus()
  }

  const meta = STEPS[step - 1]
  const otpTarget = otpCh === 'Email' ? form.email : form.celular
  const cta = done
    ? 'Entrar'
    : step === 2 && !otpSent
      ? 'Enviar código'
      : step === 2
        ? 'Verificar código'
        : step === 5
          ? 'Crear cuenta'
          : 'Continuar'

  return (
    <div className="screen onb-page" style={{ background: 'var(--g0)' }}>
      <header className="onb-head">
        <div className="onb-head-top">
          <div className="onb-head-brand">ANTARES</div>
          {!done && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mu)' }}>{step} / 5</span>}
        </div>
        {!done && (
          <div className="onb-stepper" aria-label={`Paso ${step} de 5`}>
            {STEPS.map((s, i) => {
              const n = i + 1
              return (
                <span key={s.name} style={{ display: 'contents' }}>
                  {i > 0 && <span className={`onb-stepper-line ${n <= step ? 'done' : ''}`} />}
                  <span className={`onb-stepper-dot ${n < step ? 'done' : n === step ? 'now' : ''}`}>
                    {n < step ? <IonIcon icon={checkmark} /> : n}
                  </span>
                </span>
              )
            })}
          </div>
        )}
        <h1 className="onb-head-title">{done ? 'Cuenta lista' : meta.title}</h1>
        <p className="onb-head-sub">{done ? `Bienvenida al programa, ${form.nombre.split(' ')[0]}.` : meta.sub}</p>
      </header>

      <div className="screen-scroll no-nav onb-body" ref={scrollRef}>
        <div className="onb-stack" key={done ? 'done' : `${step}-${otpSent}`}>
          {done ? (
            <div className="onb-done">
              <div className="onb-done-badge" aria-hidden="true">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>
                Registro completado
              </div>
              <p style={{ fontSize: 14, color: 'var(--mu)', lineHeight: 1.55, margin: '8px 16px 0' }}>
                Tu perfil COPP-ADRESD quedó activo. Semana 12 de 24.
              </p>
              <div className="onb-done-list">
                {[
                  'Identidad confirmada',
                  'Código verificado',
                  `Emergencia: ${form.fam1Nombre}`,
                  'Consentimiento HIPAA firmado',
                  'Contraseña segura',
                ].map((t) => (
                  <div key={t}>
                    <IonIcon icon={checkmarkCircle} />
                    {t}
                  </div>
                ))}
              </div>
              <IonButton expand="block" className="bt bt-primary" onClick={() => finishOnboarding(form)}>
                Entrar a ANTARES
              </IonButton>
            </div>
          ) : (
            <>
              {step === 1 && (
                <>
                  <section className="onb-card tone-teal">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-teal"><IonIcon icon={personOutline} /></span>
                      <div>
                        <strong>Datos personales</strong>
                        <span>Como aparecen en tu documento</span>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-nombre">Nombre completo</label>
                      <IonInput id="onb-nombre" className="fld" value={form.nombre} autocomplete="name" enterkeyhint="next" onIonInput={(e) => set('nombre', e.detail.value ?? '')} />
                    </div>
                    <div className="onb-grid-2">
                      <div className="field">
                        <label htmlFor="onb-cedula">Cédula / ID</label>
                        <IonInput id="onb-cedula" className="fld" value={form.cedula} inputmode="numeric" enterkeyhint="next" onIonInput={(e) => set('cedula', e.detail.value ?? '')} />
                      </div>
                      <div className="field">
                        <label htmlFor="onb-dob">Fecha de nacimiento</label>
                        <IonInput
                          id="onb-dob"
                          className="fld"
                          value={formatDateForDisplay(form.dob)}
                          readonly
                          onClick={() => setDateOpen(true)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="onb-card tone-ice">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-ice"><IonIcon icon={walletOutline} /></span>
                      <div>
                        <strong>Seguro médico</strong>
                        <span>Para copagos y autorizaciones</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>Aseguradora</label>
                      <IonSelect className="fld" interface="popover" value={form.seguro} onIonChange={(e) => set('seguro', e.detail.value as string)}>
                        {['BlueCross BlueShield', 'Aetna', 'UnitedHealth', 'Cigna', 'Medicare Part B', 'Medicaid'].map((s) => (
                          <IonSelectOption key={s} value={s}>{s}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </div>
                    <div className="onb-grid-2">
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="onb-poliza">N.º de póliza</label>
                        <IonInput id="onb-poliza" className="fld" value={form.poliza} enterkeyhint="next" onIonInput={(e) => set('poliza', e.detail.value ?? '')} />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="onb-grupo">Grupo</label>
                        <IonInput id="onb-grupo" className="fld" value={form.grupo} enterkeyhint="next" onIonInput={(e) => set('grupo', e.detail.value ?? '')} />
                      </div>
                    </div>
                  </section>

                  <section className="onb-card tone-teal">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-teal"><IonIcon icon={callOutline} /></span>
                      <div>
                        <strong>Cómo te contactamos</strong>
                        <span>Correo y celular de la cuenta</span>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-email">Correo electrónico</label>
                      <IonInput id="onb-email" className="fld" type="email" inputmode="email" autocomplete="email" enterkeyhint="next" value={form.email} onIonInput={(e) => set('email', e.detail.value ?? '')} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="onb-cel">Celular / WhatsApp</label>
                      <IonInput id="onb-cel" className="fld" type="tel" inputmode="tel" autocomplete="tel" enterkeyhint="done" value={form.celular} onIonInput={(e) => set('celular', e.detail.value ?? '')} />
                    </div>
                  </section>

                  <div className="onb-trust onb-trust-safe">
                    <IonIcon icon={shieldCheckmarkOutline} />
                    <span>Tus datos viajan cifrados (TLS 1.3) y se tratan como PHI bajo HIPAA.</span>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <section className="onb-card tone-pur">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-pur"><IonIcon icon={shieldCheckmarkOutline} /></span>
                      <div>
                        <strong>Canal de verificación</strong>
                        <span>Elige dónde recibir el código</span>
                      </div>
                    </div>
                    <div className="onb-channels">
                      {[
                        { id: 'SMS', label: 'SMS', icon: phonePortraitOutline },
                        { id: 'Email', label: 'Email', icon: mailOutline },
                        { id: 'WhatsApp', label: 'WhatsApp', icon: chatbubbleEllipsesOutline },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`onb-channel ${otpCh === c.id ? 'on' : ''}`}
                          onClick={() => { setOtpCh(c.id); setOtpSent(false) }}
                        >
                          <IonIcon icon={c.icon} />
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--mu)', textAlign: 'center' }}>
                      Enviaremos el código a <strong style={{ color: 'var(--tx)' }}>{otpTarget}</strong>
                    </p>
                  </section>

                  {otpSent && (
                    <section className="onb-card tone-org">
                      <div className="onb-card-head">
                      <span className="onb-card-ico tone-org"><IonIcon icon={lockClosedOutline} /></span>
                      <div>
                        <strong>Introduce el código</strong>
                          <span>6 dígitos · demo 123456</span>
                        </div>
                      </div>
                      <div className="onb-otp-row">
                        {otp.map((d, i) => (
                          <input
                            key={i}
                            id={`otp-${i}`}
                            className={`otp ${d ? 'filled' : ''}`}
                            maxLength={i === 0 ? 6 : 1}
                            inputMode="numeric"
                            autoComplete={i === 0 ? 'one-time-code' : 'off'}
                            aria-label={`Dígito ${i + 1}`}
                            value={d}
                            onChange={(e) => fillOtp(i, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !otp[i] && i > 0) {
                                const prev = document.getElementById(`otp-${i - 1}`)
                                if (prev instanceof HTMLInputElement) prev.focus()
                              }
                            }}
                            onPaste={(e) => {
                              e.preventDefault()
                              fillOtp(0, e.clipboardData.getData('text'))
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ textAlign: 'center', marginTop: 14 }}>
                        {otpLeft > 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--mu)' }}>Reenviar en 0:{String(otpLeft).padStart(2, '0')}</span>
                        ) : (
                          <IonButton fill="clear" className="onb-back-login" onClick={sendOtp}>
                            Reenviar código
                          </IonButton>
                        )}
                      </div>
                    </section>
                  )}

                  <div className="onb-trust onb-trust-info">
                    <IonIcon icon={mailOutline} />
                    <span>El código caduca en 10 minutos. Si no llega, prueba otro canal.</span>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="onb-trust onb-trust-warn">
                    <IonIcon icon={medkitOutline} />
                    <span>Si activas SOS, avisamos a esta persona, al médico y a emergencias. No se usa para marketing.</span>
                  </div>

                  <section className="onb-card tone-panic">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-panic"><IonIcon icon={peopleOutline} /></span>
                      <div>
                        <strong>Familiar principal</strong>
                        <span>Obligatorio para activar el programa</span>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-fam-nom">Nombre</label>
                      <IonInput id="onb-fam-nom" className="fld" value={form.fam1Nombre} autocomplete="name" enterkeyhint="next" onIonInput={(e) => set('fam1Nombre', e.detail.value ?? '')} />
                    </div>
                    <div className="field">
                      <label>Parentesco</label>
                      <div className="chips" style={{ marginTop: 0, marginBottom: 4 }}>
                        {PARENTESCO.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`chip ${form.fam1Parentesco === p ? 'chip-teal' : 'chip-glass'}`}
                            style={form.fam1Parentesco === p ? undefined : { background: 'var(--g0)', border: '1px solid var(--bd)', color: 'var(--mu)' }}
                            onClick={() => set('fam1Parentesco', p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-fam-cel">Celular</label>
                      <IonInput id="onb-fam-cel" className="fld" type="tel" inputmode="tel" enterkeyhint="next" value={form.fam1Cel} onIonInput={(e) => set('fam1Cel', e.detail.value ?? '')} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="onb-fam-mail">Correo (opcional)</label>
                      <IonInput id="onb-fam-mail" className="fld" type="email" inputmode="email" enterkeyhint="done" value={form.fam1Email} onIonInput={(e) => set('fam1Email', e.detail.value ?? '')} />
                    </div>
                  </section>

                  <section className="onb-card" style={{ background: 'linear-gradient(145deg,#102a50,#173c73)', color: '#fff', border: 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--ice)', marginBottom: 8 }}>
                      Vista previa SOS
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.92 }}>
                      “{form.fam1Nombre || 'Tu familiar'} ({form.fam1Parentesco}) recibirá una alerta en {form.fam1Cel || 'su celular'} si activas pánico.”
                    </div>
                  </section>
                </>
              )}

              {step === 4 && (
                <>
                  <section className="onb-card tone-teal">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-teal"><IonIcon icon={documentTextOutline} /></span>
                      <div>
                        <strong>Consentimiento informado</strong>
                        <span>COPP-ADRESD · 24 semanas</span>
                      </div>
                    </div>
                    <div className="onb-doc">
                      <strong style={{ color: 'var(--tx)' }}>Programa de medicina preventiva</strong>
                      <p style={{ margin: '8px 0 0' }}>
                        Tus datos son PHI según HIPAA. FYA TECH SAS actúa como Business Associate. Los datos biométricos se cifran con AES-256. Las fotos de comida se eliminan en 24 h. Autorizas el contacto de emergencia si activas SOS.
                      </p>
                    </div>
                    {[
                      'He leído y acepto el consentimiento informado.',
                      'Autorizo el manejo de mis datos de salud según HIPAA.',
                      'Autorizo notificar a mis contactos de emergencia.',
                    ].map((t, i) => (
                      <button key={t} type="button" className={`check-row ${checks[i] ? 'on' : ''}`} onClick={() => setChecks((c) => c.map((x, j) => (j === i ? !x : x)))}>
                        <IonCheckbox
                          checked={checks[i]}
                          onClick={(e) => e.stopPropagation()}
                          onIonChange={(e) => setChecks((c) => c.map((x, j) => (j === i ? e.detail.checked : x)))}
                        />
                        <span style={{ fontSize: 13, lineHeight: 1.45, textAlign: 'left' }}>{t}</span>
                      </button>
                    ))}
                  </section>

                  <section className="onb-card tone-pur">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-pur"><IonIcon icon={createOutline} /></span>
                      <div>
                        <strong>Firma digital</strong>
                        <span>Enviaremos el comprobante por {sigCh}</span>
                      </div>
                    </div>
                    <div className="onb-channels compact" style={{ marginBottom: 12 }}>
                      {['SMS', 'Email', 'WhatsApp'].map((c) => (
                        <button key={c} type="button" className={`onb-channel ${sigCh === c ? 'on' : ''}`} onClick={() => setSigCh(c)}>
                          {c}
                        </button>
                      ))}
                    </div>
                    <button type="button" className={`onb-sign ${signed ? 'on' : ''}`} onClick={() => setSigned(true)}>
                      <IonIcon icon={signed ? checkmarkCircle : createOutline} />
                      {signed ? 'Firma capturada · DocuSign' : 'Toca para firmar'}
                    </button>
                  </section>
                </>
              )}

              {step === 5 && (
                <>
                  <section className="onb-card tone-org">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-org"><IonIcon icon={lockClosedOutline} /></span>
                      <div>
                        <strong>Contraseña de la cuenta</strong>
                        <span>Úsala para entrar desde cualquier dispositivo</span>
                      </div>
                    </div>
                    <div className="field onb-pwd">
                      <label htmlFor="onb-pwd">Nueva contraseña</label>
                      <IonInput
                        id="onb-pwd"
                        className="fld"
                        type={showPwd ? 'text' : 'password'}
                        value={pwd}
                        autocomplete="new-password"
                        enterkeyhint="next"
                        style={{ '--padding-end': '48px' } as CSSProperties}
                        onIonInput={(e) => setPwd(e.detail.value ?? '')}
                      />
                      <IonButton
                        type="button"
                        fill="clear"
                        className="fld-eye"
                        aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        onClick={() => setShowPwd((v) => !v)}
                      >
                        <IonIcon icon={showPwd ? eyeOff : eye} />
                      </IonButton>
                      <div className="onb-strength">
                        <span>Seguridad</span>
                        <span style={{ color: strengthColor }}>{pwd ? strengthLbl : '—'}</span>
                      </div>
                      <IonProgressBar
                        className="pb"
                        style={{ marginTop: 6, '--progress-background': strengthColor } as CSSProperties}
                        value={strength / 100}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="onb-pwd2">Confirmar contraseña</label>
                      <IonInput
                        id="onb-pwd2"
                        className="fld"
                        type={showPwd ? 'text' : 'password'}
                        value={pwd2}
                        autocomplete="new-password"
                        enterkeyhint="done"
                        onIonInput={(e) => setPwd2(e.detail.value ?? '')}
                      />
                      {pwd2.length > 0 && (
                        <div style={{ fontSize: 12, marginTop: 6, color: pwd === pwd2 ? 'var(--teal-d)' : 'var(--red)', fontWeight: 600 }}>
                          {pwd === pwd2 ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="onb-card tone-teal">
                    <div className="onb-req">
                      {[
                        [pwd.length >= 8, 'Mínimo 8 caracteres'],
                        [/[A-Z]/.test(pwd), 'Una letra mayúscula'],
                        [/\d/.test(pwd), 'Un número'],
                        [/[^A-Za-z0-9]/.test(pwd), 'Un carácter especial'],
                      ].map(([ok, label]) => (
                        <div key={String(label)} className={`onb-req-item ${ok ? 'on' : ''}`}>
                          <span className="onb-req-dot">{ok ? '✓' : ''}</span>
                          {label}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {!done && (
        <div className="onb-foot">
          <div className="onb-foot-row">
            <IonButton expand="block" className="bt bt-ghost" onClick={back}>
              {step === 1 ? 'Cancelar' : 'Volver'}
            </IonButton>
            <IonButton expand="block" className="bt bt-primary" onClick={next}>
              {cta}
            </IonButton>
          </div>
        </div>
      )}

      <IonModal isOpen={dateOpen} onDidDismiss={() => setDateOpen(false)} className="date-modal">
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <IonIcon icon={calendarOutline} />
          Fecha de nacimiento
        </div>
        <IonDatetime
          presentation="date"
          locale="es-ES"
          value={form.dob}
          onIonChange={(e) => set('dob', String(e.detail.value).split('T')[0])}
        />
        <div style={{ padding: '0 16px 16px' }}>
          <IonButton expand="block" className="bt bt-primary" onClick={() => setDateOpen(false)}>
            Listo
          </IonButton>
        </div>
      </IonModal>
    </div>
  )
}
