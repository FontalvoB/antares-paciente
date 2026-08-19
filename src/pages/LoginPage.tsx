import { useEffect, useState, type CSSProperties } from 'react'
import { IonButton, IonCheckbox, IonIcon, IonInput, IonSpinner } from '@ionic/react'
import {
  arrowBackOutline,
  eye,
  eyeOff,
  infinite,
  keyOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons'
import { useApp } from '../context/AppContext'
import { loginUser } from '../utils/authApi'

type LoginMode = 'login' | 'first'

export function LoginPage() {
  const { finishLogin, showToast } = useApp()
  const [mode, setMode] = useState<LoginMode>('login')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [channel, setChannel] = useState<'SMS' | 'Email'>('SMS')
  const [target, setTarget] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpLeft, setOtpLeft] = useState(0)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])

  useEffect(() => {
    if (otpLeft <= 0) return
    const id = window.setTimeout(() => setOtpLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [otpLeft])

  const submit = async () => {
    if (!email.trim() || !pwd) {
      showToast('Ingresa tu correo y contraseña', 'warn')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Ingresa un correo electrónico válido', 'err')
      return
    }
    setBusy(true)
    try {
      await loginUser(email.trim(), pwd, remember)
      setBusy(false)
      finishLogin()
    } catch (e) {
      setBusy(false)
      showToast(e instanceof Error ? e.message : 'Error al iniciar sesión', 'err')
    }
  }

  const sendOtp = () => {
    setOtpSent(true)
    setOtpLeft(30)
    setOtp(['', '', '', '', '', ''])
    showToast(`Código enviado por ${channel === 'SMS' ? 'SMS' : 'correo electrónico'}`, 'ok')
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
    const el = document.getElementById(`login-otp-${i + 1}`)
    if (el instanceof HTMLInputElement) el.focus()
  }

  const submitFirst = () => {
    if (!otpSent) {
      if (channel === 'Email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.trim())) {
          showToast('Ingresa un correo electrónico válido', 'err')
          return
        }
      } else if (!target.trim()) {
        showToast('Ingresa tu número de celular', 'warn')
        return
      }
      sendOtp()
      return
    }
    if (otp.join('') !== '123456') {
      showToast('Código demo: 123456', 'warn')
      return
    }
    setBusy(true)
    window.setTimeout(() => {
      setBusy(false)
      showToast('Identidad verificada', 'ok')
      finishLogin()
    }, 900)
  }

  const pickChannel = (c: 'SMS' | 'Email') => {
    setChannel(c)
    setOtpSent(false)
    setOtp(['', '', '', '', '', ''])
  }

  return (
    <div className="screen login-screen">
      <div className="login-layout">
        <section className="login-brand" aria-label="Identidad de ANTARES">
          <div className="login-brand-art" aria-hidden="true">
            <div className="login-stars" />
            <div className="login-stars-2" />
            <div className="login-aurora" />
          </div>

          <div className="login-brand-content">
            <div className="login-brand-mark">
              <div className="login-brand-logo">
                <IonIcon icon={infinite} />
              </div>
              <span className="login-brand-word">ANTARES</span>
            </div>
            <div className="login-brand-kicker">ANTARES BIOHACKING</div>
            <h2 className="login-brand-title">Tu salud, conectada</h2>

            <div className="login-stats" aria-label="Beneficios de la plataforma">
              <div>
                <strong>24/7</strong>
                <span>Disponibilidad</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>Seguro</span>
              </div>
              <div>
                <strong>HIPAA</strong>
                <span>Compatible</span>
              </div>
            </div>

            <div className="login-system-status">Todos los sistemas operativos</div>
          </div>

          <div className="login-brand-footer">COPP-ADRESD · Salud preventiva conectada</div>
        </section>

        <section className="login-form-panel" aria-label="Acceso a ANTARES">
          <div className="login-form-wrap">
            <header className="login-form-heading">
              <div className="login-heading-icon">
                <IonIcon icon={mode === 'first' ? shieldCheckmarkOutline : personOutline} />
              </div>
              <div>
                <h1>{mode === 'first' ? 'Primer inicio de sesión' : 'Bienvenido de nuevo'}</h1>
                {mode === 'first' && <p className="login-heading-sub">Verifica tu identidad para completar tu perfil</p>}
              </div>
            </header>

            {mode === 'first' ? (
              <form className="login-form" onSubmit={(e) => { e.preventDefault(); submitFirst() }}>
                <div className="login-channels" role="radiogroup" aria-label="Canal para recibir el código">
                  {[
                    { id: 'SMS', label: 'Número de celular', icon: phonePortraitOutline },
                    { id: 'Email', label: 'Correo electrónico', icon: mailOutline },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={channel === c.id}
                      className={`login-channel ${channel === c.id ? 'on' : ''}`}
                      onClick={() => pickChannel(c.id as 'SMS' | 'Email')}
                    >
                      <IonIcon icon={c.icon} />
                      {c.label}
                    </button>
                  ))}
                </div>

                {!otpSent ? (
                  <div className="login-field">
                    <label htmlFor="login-target">
                      <IonIcon icon={channel === 'SMS' ? phonePortraitOutline : mailOutline} />
                      {channel === 'SMS' ? 'Número de celular' : 'Correo electrónico'}
                    </label>
                    <IonInput
                      id="login-target"
                      className="fld login-input"
                      type={channel === 'SMS' ? 'tel' : 'email'}
                      inputmode={channel === 'SMS' ? 'tel' : 'email'}
                      enterkeyhint="done"
                      value={target}
                      placeholder={channel === 'SMS' ? '+57 300 123 4567' : 'correo@ejemplo.com'}
                      style={{ '--placeholder-color': '#bdcbe0' } as CSSProperties}
                      onIonInput={(e) => setTarget(e.detail.value ?? '')}
                    />
                  </div>
                ) : (
                  <>
                    <div className="login-otp-note">
                      Enviamos un código de 6 dígitos a{' '}
                      <strong>{target || (channel === 'SMS' ? 'tu celular' : 'tu correo')}</strong>
                    </div>
                    <div className="login-otp-row">
                      {otp.map((d, i) => (
                        <input
                          key={i}
                          id={`login-otp-${i}`}
                          className={`otp ${d ? 'filled' : ''}`}
                          maxLength={i === 0 ? 6 : 1}
                          inputMode="numeric"
                          autoComplete={i === 0 ? 'one-time-code' : 'off'}
                          aria-label={`Dígito ${i + 1}`}
                          value={d}
                          onChange={(e) => fillOtp(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otp[i] && i > 0) {
                              const prev = document.getElementById(`login-otp-${i - 1}`)
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
                    <div className="login-otp-resend">
                      {otpLeft > 0 ? (
                        <span>Reenviar en 0:{String(otpLeft).padStart(2, '0')}</span>
                      ) : (
                        <IonButton fill="clear" type="button" className="login-resend" onClick={sendOtp}>
                          Reenviar código
                        </IonButton>
                      )}
                    </div>
                  </>
                )}

                <IonButton expand="block" className="login-submit" type="submit" disabled={busy}>
                  {busy ? (
                    <>
                      <IonSpinner name="crescent" color="light" style={{ width: 18, height: 18, marginRight: 8 }} />
                      Verificando…
                    </>
                  ) : (
                    <>
                      <IonIcon icon={shieldCheckmarkOutline} />
                      {otpSent ? 'Verificar código' : 'Enviar código'}
                    </>
                  )}
                </IonButton>

                <IonButton
                  fill="clear"
                  expand="block"
                  type="button"
                  className="login-first-back"
                  onClick={() => setMode('login')}
                >
                  <IonIcon icon={arrowBackOutline} />
                  Volver al inicio de sesión
                </IonButton>
              </form>
            ) : (
              <>
                <form className="login-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
                  <div className="login-field">
                    <label htmlFor="login-email">
                      <IonIcon icon={mailOutline} />
                      Correo electrónico
                    </label>
                    <IonInput
                      id="login-email"
                      className="fld login-input"
                      type="email"
                      inputmode="email"
                      enterkeyhint="next"
                      value={email}
                      placeholder="correo@ejemplo.com"
                      style={{ '--placeholder-color': '#bdcbe0' } as CSSProperties}
                      onIonInput={(e) => setEmail((e.detail.value ?? '').toLowerCase())}
                    />
                  </div>

                  <div className="login-field login-password-field">
                    <label htmlFor="login-password">
                      <IonIcon icon={keyOutline} />
                      Contraseña
                    </label>
                    <IonInput
                      id="login-password"
                      className="fld login-input"
                      type={showPwd ? 'text' : 'password'}
                      enterkeyhint="done"
                      value={pwd}
                      placeholder="••••••••"
                      style={{ '--padding-end': '48px', '--placeholder-color': '#bdcbe0' } as CSSProperties}
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
                  </div>

                  <div className="login-options">
                    <div className="login-remember">
                      <IonCheckbox
                        checked={remember}
                        color="primary"
                        aria-label="Recordarme"
                        onIonChange={(e) => setRemember(e.detail.checked)}
                      />
                      <IonIcon icon={timeOutline} />
                      <span>Recordarme</span>
                    </div>
                    <div className="login-links">
                      <IonButton
                        type="button"
                        fill="clear"
                        className="login-forgot"
                        onClick={() => showToast('Demo: recuperación de contraseña no disponible', 'info')}
                      >
                        ¿Olvidaste tu contraseña?
                      </IonButton>
                      <IonButton
                        type="button"
                        fill="clear"
                        className="login-first-link"
                        onClick={() => setMode('first')}
                      >
                        ¿Primer inicio de sesión?
                      </IonButton>
                    </div>
                  </div>

                  <IonButton expand="block" className="login-submit" type="submit" disabled={busy}>
                    {busy ? (
                      <>
                        <IonSpinner name="crescent" color="light" style={{ width: 18, height: 18, marginRight: 8 }} />
                        Verificando…
                      </>
                    ) : (
                      <>
                        <IonIcon icon={lockClosedOutline} />
                        Iniciar sesión
                      </>
                    )}
                  </IonButton>

                  <div className="login-security">
                    <IonIcon icon={shieldCheckmarkOutline} />
                    Conexión segura con cifrado de extremo a extremo
                  </div>
                  <p className="login-demo-note">
                    ¿No tienes acceso? Contacta al equipo COPP-ADRESD para crear tu cuenta.
                  </p>
                </form>

                <footer className="login-footer">© 2026 ANTARES · Plataforma de salud preventiva</footer>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
