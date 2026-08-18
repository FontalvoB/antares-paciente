import { useMemo, useState, type CSSProperties } from 'react'
import {
  IonButton,
  IonCheckbox,
  IonDatetime,
  IonInput,
  IonModal,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
} from '@ionic/react'
import { useApp } from '../context/AppContext'
import { formatDateForDisplay } from '../utils/dates'
import type { UserProfile } from '../types'

const STEPS = [
  { title: 'Bienvenido al programa', sub: 'Completa el registro en 5 pasos · 3 minutos', name: 'Identidad' },
  { title: 'Verifica tu identidad', sub: 'Código de 6 dígitos por SMS, email o WhatsApp', name: 'OTP' },
  { title: 'Contacto de emergencia', sub: 'Tu familia será notificada si activas SOS', name: 'Familia' },
  { title: 'Consentimiento HIPAA', sub: 'Lee, acepta y firma digitalmente', name: 'Consentimiento' },
  { title: 'Crea tu contraseña', sub: 'Protege tu expediente médico', name: 'Seguridad' },
]

export function OnboardingPage() {
  const { finishOnboarding, showToast, backToLogin } = useApp()
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [otpCh, setOtpCh] = useState('SMS')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [checks, setChecks] = useState([false, false, false])
  const [signed, setSigned] = useState(false)
  const [sigCh, setSigCh] = useState('SMS')
  const [dateOpen, setDateOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
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

  const pwdOk = pwd.length >= 8 && /[A-Z]/.test(pwd) && /\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)
  const strength = useMemo(() => {
    let s = 0
    if (pwd.length >= 8) s += 25
    if (/[A-Z]/.test(pwd)) s += 25
    if (/\d/.test(pwd)) s += 25
    if (/[^A-Za-z0-9]/.test(pwd)) s += 25
    return s
  }, [pwd])

  const next = () => {
    if (step === 1) {
      setStep(2)
      return
    }
    if (step === 2) {
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

  const meta = STEPS[step - 1]

  return (
    <div className="screen onb-page" style={{ background: '#fff' }}>
      <div className="hero hero-cosmos" style={{ paddingBottom: 16 }}>
        <div className="kicker">ANTARES BIOHACKING · COPP-ADRESD</div>
        <div className="h2">{done ? '¡Registro completado!' : meta.title}</div>
        <div className="sub">{done ? 'Tu cuenta está lista. Bienvenida al programa.' : meta.sub}</div>
        {!done && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 10, fontWeight: 700 }}>
              <span style={{ color: 'rgba(255,255,255,.45)' }}>PASO {step} DE 5</span>
              <span style={{ color: 'var(--ice)' }}>{meta.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  style={{
                    height: 4,
                    flex: 1,
                    borderRadius: 2,
                    background: n < step ? 'var(--teal)' : n === step ? 'var(--ice)' : 'rgba(255,255,255,.15)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="screen-scroll no-nav" style={{ padding: '16px 16px 110px' }}>
        {done ? (
          <div style={{ textAlign: 'center', paddingTop: 12 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                margin: '0 auto 14px',
                background: 'linear-gradient(135deg,var(--teal),#0F6E56)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                boxShadow: '0 8px 24px rgba(29,158,117,.35)',
              }}
            >
              🎉
            </div>
            <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>
              ¡Registro completado!
            </div>
            <p style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
              Bienvenida al programa <strong>COPP-ADRESD</strong>, {form.nombre.split(' ')[0]}. Semana 12/24 activa.
            </p>
            <div style={{ background: 'linear-gradient(145deg,#102a50,#173c73)', borderRadius: 16, padding: 16, textAlign: 'left', margin: '16px 0' }}>
              {['Identidad confirmada', 'Verificación OTP', `Familiar: ${form.fam1Nombre}`, 'Consentimiento HIPAA firmado', 'Contraseña segura'].map((t) => (
                <div key={t} style={{ color: 'rgba(255,255,255,.75)', fontSize: 12, marginBottom: 8 }}>
                  ✅ {t}
                </div>
              ))}
            </div>
            <IonButton expand="block" className="bt bt-teal" onClick={() => finishOnboarding(form)}>
              Entrar a mi programa ANTARES
            </IonButton>
          </div>
        ) : (
          <>
            {step === 1 && (
              <>
                <div className="field">
                  <label>Nombre completo</label>
                  <IonInput className="fld" value={form.nombre} onIonInput={(e) => set('nombre', e.detail.value ?? '')} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="field">
                    <label>Cédula / ID</label>
                    <IonInput className="fld" value={form.cedula} inputmode="numeric" onIonInput={(e) => set('cedula', e.detail.value ?? '')} />
                  </div>
                  <div className="field">
                    <label>Fecha de nacimiento</label>
                    <IonInput className="fld" value={formatDateForDisplay(form.dob)} readonly onClick={() => setDateOpen(true)} />
                  </div>
                </div>
                <div className="field">
                  <label>Seguro médico</label>
                  <IonSelect className="fld" interface="popover" value={form.seguro} onIonChange={(e) => set('seguro', e.detail.value as string)}>
                    {['BlueCross BlueShield', 'Aetna', 'UnitedHealth', 'Cigna', 'Medicare Part B', 'Medicaid'].map((s) => (
                      <IonSelectOption key={s} value={s}>{s}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="field">
                    <label>No. de póliza</label>
                    <IonInput className="fld" value={form.poliza} onIonInput={(e) => set('poliza', e.detail.value ?? '')} />
                  </div>
                  <div className="field">
                    <label>Grupo</label>
                    <IonInput className="fld" value={form.grupo} onIonInput={(e) => set('grupo', e.detail.value ?? '')} />
                  </div>
                </div>
                <div className="field">
                  <label>Correo</label>
                  <IonInput className="fld" type="email" value={form.email} onIonInput={(e) => set('email', e.detail.value ?? '')} />
                </div>
                <div className="field">
                  <label>Celular / WhatsApp</label>
                  <IonInput className="fld" type="tel" value={form.celular} onIonInput={(e) => set('celular', e.detail.value ?? '')} />
                </div>
                <div style={{ background: 'var(--teal-l)', borderRadius: 12, padding: 12, fontSize: 12, color: '#0F6E56', lineHeight: 1.5 }}>
                  🔒 Datos cifrados con TLS 1.3 y protegidos bajo HIPAA.
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Enviar código por
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {['SMS', 'Email', 'WhatsApp'].map((c) => (
                    <button key={c} className={`sig-ch ${otpCh === c ? 'on' : ''}`} onClick={() => setOtpCh(c)}>
                      {c === 'SMS' ? '📱' : c === 'Email' ? '📧' : '💬'}
                      <div>{c}</div>
                    </button>
                  ))}
                </div>
                {!otpSent ? (
                  <IonButton expand="block" className="bt bt-primary" onClick={() => {
                    setOtpSent(true)
                    showToast(`Código enviado por ${otpCh}`, 'ok')
                  }}>
                    Enviar código de verificación
                  </IonButton>
                ) : (
                  <>
                    <div style={{ background: 'var(--blue-l)', borderRadius: 12, padding: 12, fontSize: 12, color: '#185FA5', marginBottom: 14 }}>
                      Código enviado por <strong>{otpCh}</strong>. Demo: <strong>123456</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                      {otp.map((d, i) => (
                        <input
                          key={i}
                          className={`otp ${d ? 'filled' : ''}`}
                          maxLength={1}
                          inputMode="numeric"
                          value={d}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(-1)
                            const nextOtp = [...otp]
                            nextOtp[i] = v
                            setOtp(nextOtp)
                            const el = e.target.nextElementSibling
                            if (v && el instanceof HTMLInputElement) el.focus()
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>1 · Familiar principal</div>
                  <div className="field">
                    <label>Nombre</label>
                    <IonInput className="fld" value={form.fam1Nombre} onIonInput={(e) => set('fam1Nombre', e.detail.value ?? '')} />
                  </div>
                  <div className="field">
                    <label>Parentesco</label>
                    <IonSelect className="fld" interface="popover" value={form.fam1Parentesco} onIonChange={(e) => set('fam1Parentesco', e.detail.value as string)}>
                      {['Esposo/a', 'Padre/Madre', 'Hijo/a', 'Hermano/a', 'Amigo/a'].map((p) => (
                        <IonSelectOption key={p} value={p}>{p}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Celular</label>
                    <IonInput className="fld" type="tel" value={form.fam1Cel} onIonInput={(e) => set('fam1Cel', e.detail.value ?? '')} />
                  </div>
                </div>
                <div style={{ background: 'var(--org-l)', borderRadius: 12, padding: 12, fontSize: 12, color: '#854F0B', lineHeight: 1.5 }}>
                  Solo se contactará en SOS o alerta crítica del equipo médico.
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div
                  style={{
                    background: '#FAFAFA',
                    border: '1px solid var(--bd)',
                    borderRadius: 12,
                    padding: 14,
                    maxHeight: 180,
                    overflow: 'auto',
                    fontSize: 12,
                    color: 'var(--mu)',
                    lineHeight: 1.7,
                    marginBottom: 12,
                  }}
                >
                  <strong style={{ color: 'var(--tx)' }}>CONSENTIMIENTO INFORMADO — COPP-ADRESD</strong>
                  <p>Programa de medicina preventiva de 24 semanas. Tus datos son PHI según HIPAA. FYA TECH SAS actúa como Business Associate. Datos biométricos cifrados AES-256. Fotos de comida se eliminan en 24h. Autorizas contacto de emergencia en SOS.</p>
                </div>
                {['He leído y acepto el consentimiento informado.', 'Autorizo el manejo de mis datos de salud según HIPAA.', 'Autorizo notificar a mis contactos de emergencia.'].map((t, i) => (
                  <button key={t} className={`check-row ${checks[i] ? 'on' : ''}`} onClick={() => setChecks((c) => c.map((x, j) => (j === i ? !x : x)))}>
                    <IonCheckbox
                      checked={checks[i]}
                      onClick={(e) => e.stopPropagation()}
                      onIonChange={(e) => setChecks((c) => c.map((x, j) => (j === i ? e.detail.checked : x)))}
                    />
                    <span style={{ fontSize: 12, lineHeight: 1.45 }}>{t}</span>
                  </button>
                ))}
                <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
                  {['SMS', 'Email', 'WhatsApp'].map((c) => (
                    <button key={c} className={`sig-ch ${sigCh === c ? 'on' : ''}`} onClick={() => setSigCh(c)}>
                      {c}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSigned(true)}
                  style={{
                    width: '100%',
                    height: 90,
                    borderRadius: 12,
                    border: `2px ${signed ? 'solid var(--teal)' : 'dashed var(--bd)'}`,
                    background: signed ? 'var(--teal-l)' : '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: signed ? 'var(--teal-d)' : 'var(--mu)',
                    fontWeight: 700,
                  }}
                >
                  {signed ? '✍️ Firma capturada · DocuSign' : 'Toca para firmar · DocuSign'}
                </button>
              </>
            )}

            {step === 5 && (
              <>
                <div className="field">
                  <label>Nueva contraseña</label>
                  <IonInput className="fld" type="password" value={pwd} placeholder="Mínimo 8 caracteres" onIonInput={(e) => setPwd(e.detail.value ?? '')} />
                  <IonProgressBar
                    className="pb"
                    style={{ marginTop: 8, '--progress-background': strength < 50 ? 'var(--red)' : strength < 100 ? 'var(--org)' : 'var(--teal)' } as CSSProperties}
                    value={strength / 100}
                  />
                </div>
                <div className="field">
                  <label>Confirmar</label>
                  <IonInput className="fld" type="password" value={pwd2} onIonInput={(e) => setPwd2(e.detail.value ?? '')} />
                </div>
                <div style={{ background: 'var(--g1)', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 1.9 }}>
                  <div style={{ color: pwd.length >= 8 ? 'var(--teal)' : 'var(--mu)' }}>{pwd.length >= 8 ? '✅' : '⬜'} Mínimo 8 caracteres</div>
                  <div style={{ color: /[A-Z]/.test(pwd) ? 'var(--teal)' : 'var(--mu)' }}>{/[A-Z]/.test(pwd) ? '✅' : '⬜'} Una mayúscula</div>
                  <div style={{ color: /\d/.test(pwd) ? 'var(--teal)' : 'var(--mu)' }}>{/\d/.test(pwd) ? '✅' : '⬜'} Un número</div>
                  <div style={{ color: /[^A-Za-z0-9]/.test(pwd) ? 'var(--teal)' : 'var(--mu)' }}>{/[^A-Za-z0-9]/.test(pwd) ? '✅' : '⬜'} Un carácter especial</div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {!done && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
            background: 'linear-gradient(transparent, #fff 28%)',
          }}
        >
          <IonButton expand="block" className="bt bt-primary" onClick={next}>
            {step === 5 ? 'Crear cuenta' : step === 2 ? 'Verificar identidad' : 'Continuar'}
          </IonButton>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {step > 1 ? (
              <button style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 12 }} onClick={() => setStep((s) => s - 1)}>
                ← Volver
              </button>
            ) : (
              <span />
            )}
            <span style={{ fontSize: 11, color: 'var(--mu)' }}>Paso {step} de 5</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <IonButton fill="clear" className="onb-back-login" onClick={backToLogin}>
              ← Volver al inicio de sesión
            </IonButton>
          </div>
        </div>
      )}

      <IonModal isOpen={dateOpen} onDidDismiss={() => setDateOpen(false)} className="date-modal">
        <IonDatetime
          presentation="date"
          value={form.dob}
          onIonChange={(e) => set('dob', String(e.detail.value).split('T')[0])}
        />
        <IonButton expand="block" className="bt bt-teal" onClick={() => setDateOpen(false)}>
          Listo
        </IonButton>
      </IonModal>
    </div>
  )
}
