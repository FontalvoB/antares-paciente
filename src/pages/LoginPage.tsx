import { useEffect, useState, type CSSProperties } from 'react'
import { IonButton, IonCheckbox, IonIcon, IonInput, IonProgressBar, IonSpinner } from '@ionic/react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  arrowBackOutline,
  chevronForwardOutline,
  eye,
  eyeOff,
  idCardOutline,
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
import { useT } from '../i18n/I18nContext'
import { LanguageToggle } from '../components/LanguageToggle'
import { loginUser, lookupId, sendOtp, verifyOtp, type ContactMethod, type IdLookupResult } from '../utils/authApi'
import type { UserProfile } from '../types'

type LoginMode = 'login' | 'first'
type FirstStep = 'id' | 'contacts' | 'otp'

export function LoginPage() {
  const { finishLogin, showToast } = useApp()
  const t = useT()
  const [mode, setMode] = useState<LoginMode>('login')
  const [firstStep, setFirstStep] = useState<FirstStep>('id')

  // Login por ID + contraseña
  const [documentNumber, setDocumentNumber] = useState('')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)

  // Primer inicio de sesión (ID → contactos → OTP)
  const [idInput, setIdInput] = useState('')
  const [lookup, setLookup] = useState<IdLookupResult | null>(null)
  const [contact, setContact] = useState<ContactMethod | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [otpLeft, setOtpLeft] = useState(0)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])

  const [busy, setBusy] = useState(false)
  const [busyMessage, setBusyMessage] = useState('')

  // Dispara la animación de despliegue del contenido en cada acción del
  // primer inicio de sesión (buscar identidad, enviar código, verificar).
  const [unfoldSeq, setUnfoldSeq] = useState(0)

  useEffect(() => {
    if (otpLeft <= 0) return
    const id = window.setTimeout(() => setOtpLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [otpLeft])

  const startAction = () => {
    setBusy(true)
    setUnfoldSeq((s) => s + 1)
  }

  const submit = async () => {
    const doc = documentNumber.trim()
    if (!doc || !pwd) {
      showToast(t('Ingresa tu número de identificación y contraseña'), 'warn')
      return
    }
    setBusy(true)
    try {
      await loginUser(doc, pwd, remember)
      setBusy(false)
      finishLogin({ cedula: doc }, 'app')
    } catch (e) {
      setBusy(false)
      showToast(e instanceof Error ? e.message : t('Error al iniciar sesión'), 'err')
    }
  }

  const confirmId = async () => {
    const doc = idInput.trim()
    if (!doc) {
      showToast(t('Ingresa tu número de identificación'), 'warn')
      return
    }
    startAction()
    setBusyMessage(t('Buscando tu identificación…'))
    try {
      const result = await lookupId(doc)
      setLookup(result)
      setContact(null)
      setDevCode(null)
      setOtp(['', '', '', '', '', ''])
      setFirstStep('contacts')
      setBusy(false)
    } catch (e) {
      setBusy(false)
      showToast(e instanceof Error ? e.message : t('No se pudo verificar la identidad'), 'err')
    }
  }

  const pickContact = async (c: ContactMethod) => {
    startAction()
    setBusyMessage(t('Enviando tu código…'))
    try {
      const result = await sendOtp(idInput.trim(), c.id)
      setContact(c)
      setDevCode(result.devCode ?? null)
      setOtp(['', '', '', '', '', ''])
      setOtpLeft(result.expiresInSeconds)
      setFirstStep('otp')
      setBusy(false)
      showToast(t('Código enviado por {channel}', { channel: c.type === 'Email' ? 'correo electrónico' : 'SMS' }), 'ok')
    } catch (e) {
      setBusy(false)
      showToast(e instanceof Error ? e.message : t('No se pudo enviar el código'), 'err')
    }
  }

  const resendOtp = () => {
    if (!contact) return
    void pickContact(contact)
  }

  const submitOtp = async () => {
    const code = otp.join('')
    if (code.length !== 6) {
      showToast(t('Ingresa el código de 6 dígitos'), 'warn')
      return
    }
    startAction()
    setBusyMessage(t('Verificando tu código…'))
    try {
      await verifyOtp(idInput.trim(), code, remember)
      setBusy(false)
      const seed: Partial<UserProfile> = lookup
        ? {
            nombre: `${lookup.firstName} ${lookup.lastName}`.trim(),
            cedula: lookup.documentNumber,
          }
        : { cedula: idInput.trim() }
      finishLogin(seed)
    } catch (e) {
      setBusy(false)
      showToast(e instanceof Error ? e.message : t('Código inválido o expirado'), 'err')
    }
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

  const goFirst = () => {
    setMode('first')
    setFirstStep('id')
    setIdInput('')
    setLookup(null)
    setContact(null)
    setDevCode(null)
    setOtp(['', '', '', '', '', ''])
  }

  const backFromFirst = () => {
    if (firstStep === 'id') {
      setMode('login')
      return
    }
    if (firstStep === 'otp') {
      setFirstStep('contacts')
      return
    }
    setFirstStep('id')
  }

  const fullName = lookup ? `${lookup.firstName} ${lookup.lastName}`.trim() : ''

  return (
    <div className="screen login-screen" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
        <LanguageToggle />
      </div>
      <div className="login-layout">
        <section className="login-brand" aria-label={t('Identidad de ANTARES')}>
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
            <h2 className="login-brand-title">{t('Tu salud, conectada')}</h2>

            <div className="login-stats" aria-label={t('Beneficios de la plataforma')}>
              <div>
                <strong>24/7</strong>
                <span>{t('Disponibilidad')}</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>{t('Seguro')}</span>
              </div>
              <div>
                <strong>HIPAA</strong>
                <span>{t('Compatible')}</span>
              </div>
            </div>

            <div className="login-system-status">{t('Todos los sistemas operativos')}</div>
          </div>

          <div className="login-brand-footer">{t('COPP-ADRESD · Salud preventiva conectada')}</div>
        </section>

        <section className="login-form-panel" aria-label={t('Acceso a ANTARES')}>
          <div className="login-form-wrap">
            <AnimatePresence mode="wait" initial={false}>
              {mode === 'first' ? (
                <motion.div
                  key="first"
                  className="login-mode-panel"
                  initial={{ opacity: 0, scaleY: 0.9, y: 26, transformOrigin: 'top center' }}
                  animate={{ opacity: 1, scaleY: 1, y: 0 }}
                  exit={{ opacity: 0, scaleY: 0.95, y: -18 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <header className="login-form-heading">
                    <div className="login-heading-icon">
                      <IonIcon icon={shieldCheckmarkOutline} />
                    </div>
                    <div>
                      <h1>{t('Primer inicio de sesión')}</h1>
                      <p className="login-heading-sub">
{firstStep === 'id' && t('Verifica tu identidad para completar tu perfil')}
{firstStep === 'contacts' && t('Elige por dónde quieres recibir tu código')}
{firstStep === 'otp' && t('Introduce el código que te enviamos')}
                      </p>
                    </div>
                  </header>
                  <div className="login-form">
                    <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${firstStep}-${unfoldSeq}`}
                    className="login-step"
                    initial={{ opacity: 0, scaleY: 0.9, y: 20, transformOrigin: 'top center' }}
                    animate={{ opacity: 1, scaleY: 1, y: 0 }}
                    exit={{ opacity: 0, scaleY: 0.94, y: -14 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {firstStep === 'id' && (
                      <form onSubmit={(e) => { e.preventDefault(); confirmId() }}>
                    <div className="login-id-note">
                      <IonIcon icon={shieldCheckmarkOutline} />
<span>
                {t('Buscaremos los correos y teléfonos asociados a tu número de identificación para verificar que eres tú.')}
              </span>
                    </div>

                    <div className="login-field">
                      <label htmlFor="login-first-id">
                        <IonIcon icon={idCardOutline} />
                        {t('Número de identificación')}
                      </label>
                      <IonInput
                        id="login-first-id"
                        className="fld login-input"
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        enterkeyhint="done"
                        value={idInput}
placeholder={t('Ej. 32534534')}
                        style={{ '--placeholder-color': '#bdcbe0' } as CSSProperties}
                        onIonInput={(e) => setIdInput((e.detail.value ?? '').replace(/\s/g, ''))}
                      />
                    </div>

                    <IonButton expand="block" className="login-submit" type="submit" disabled={busy}>
                      {busy ? (
                        <>
                          <IonSpinner name="crescent" color="light" style={{ width: 18, height: 18, marginRight: 8 }} />
                          {t('Buscando…')}
                        </>
                      ) : (
                        <>
                          <IonIcon icon={shieldCheckmarkOutline} />
                          {t('Confirmar identidad')}
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
                      {t('Volver al inicio de sesión')}
                    </IonButton>
                  </form>
                )}

                {firstStep === 'contacts' && lookup && (
                  <div>
                    {fullName && (
                      <div className="login-person" aria-label={`Identidad encontrada: ${fullName}`}>
                        <div className="login-person-avatar">{fullName.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="login-person-name">{fullName}</div>
                          <div className="login-person-meta">ID {lookup.documentNumber}</div>
                        </div>
                      </div>
                    )}

                    <p className="login-contacts-hint">
                      {t('Encontramos')} <strong>{lookup.contacts.length}</strong>{' '}
                      {lookup.contacts.length === 1 ? t('método de contacto') : t('métodos de contacto')} {t('asociado')}
                      {lookup.contacts.length === 1 ? '' : 's'} {t('a tu identificación.')}
                    </p>

                    <div className="login-contact-list" role="radiogroup" aria-label={t('Métodos de contacto')}>
                      {lookup.contacts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={false}
                          className={`login-contact ${c.type === 'Email' ? 'mail' : 'phone'}`}
                          onClick={() => pickContact(c)}
                          disabled={busy}
                        >
                          <span className="login-contact-icon">
                            <IonIcon icon={c.type === 'Email' ? mailOutline : phonePortraitOutline} />
                          </span>
                          <span className="login-contact-body">
                            <span className="login-contact-label">{c.label}</span>
                            <span className="login-contact-sub">
                              {t('Enviar código por {channel}', { channel: c.type === 'Email' ? 'correo electrónico' : 'SMS' })}
                            </span>
                          </span>
                          <IonIcon icon={chevronForwardOutline} className="login-contact-arrow" />
                        </button>
                      ))}
                    </div>

                    <IonButton
                      fill="clear"
                      expand="block"
                      type="button"
                      className="login-first-back"
                      onClick={backFromFirst}
                    >
                      <IonIcon icon={arrowBackOutline} />
                      {t('Cambiar número de identificación')}
                    </IonButton>
                  </div>
                )}

                {firstStep === 'otp' && contact && (
                  <div>
                    <div className="login-otp-note">
                      {t('Enviamos un código de 6 dígitos a')} <strong>{contact.label}</strong>
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
                          aria-label={t('Dígito {n}', { n: String(i + 1) })}
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

                    {devCode && <div className="login-dev-code">{t('Código de prueba:')} {devCode}</div>}

                    <div className="login-otp-resend">
                      {otpLeft > 0 ? (
                        <span>{t('Reenviar en')} 0:{String(Math.min(otpLeft, 59)).padStart(2, '0')}</span>
                      ) : (
                        <IonButton fill="clear" type="button" className="login-resend" onClick={resendOtp}>
                          {t('Reenviar código')}
                        </IonButton>
                      )}
                    </div>

                    <IonButton
                      expand="block"
                      className="login-submit"
                      type="button"
                      disabled={busy || otp.join('').length !== 6}
                      onClick={submitOtp}
                    >
                      {busy ? (
                        <>
                          <IonSpinner name="crescent" color="light" style={{ width: 18, height: 18, marginRight: 8 }} />
                          {t('Verificando…')}
                        </>
                      ) : (
                        <>
                          <IonIcon icon={shieldCheckmarkOutline} />
                          {t('Verificar y entrar')}
                        </>
                      )}
                    </IonButton>

                    <IonButton
                      fill="clear"
                      expand="block"
                      type="button"
                      className="login-first-back"
                      onClick={backFromFirst}
                    >
                      <IonIcon icon={arrowBackOutline} />
                      {t('Elegir otro método')}
                    </IonButton>
                  </div>
                )}

                    <AnimatePresence>
                      {busy && (
                        <motion.div
                          className="login-busy-bar"
                          initial={{ opacity: 0, scaleY: 0.6, height: 0 }}
                          animate={{ opacity: 1, scaleY: 1, height: 'auto' }}
                          exit={{ opacity: 0, scaleY: 0.6, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          style={{ transformOrigin: 'top center' }}
                        >
                          <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
                          <span>{busyMessage}</span>
                          <IonProgressBar type="indeterminate" className="login-busy-progress" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </AnimatePresence>
              </div>
              </motion.div>
            ) : (
              <motion.div
                key="login"
                className="login-mode-panel"
                initial={{ opacity: 0, scaleY: 0.9, y: 26, transformOrigin: 'top center' }}
                animate={{ opacity: 1, scaleY: 1, y: 0 }}
                exit={{ opacity: 0, scaleY: 0.95, y: -18 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <header className="login-form-heading">
                  <div className="login-heading-icon">
                    <IonIcon icon={personOutline} />
                  </div>
                  <div>
                    <h1>{t('Bienvenido de nuevo')}</h1>
                  </div>
                </header>
                <form className="login-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
                  <div className="login-field">
                    <label htmlFor="login-id">
                      <IonIcon icon={idCardOutline} />
                      {t('Número de identificación')}
                    </label>
                    <IonInput
                      id="login-id"
                      className="fld login-input"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      enterkeyhint="next"
                      value={documentNumber}
                      placeholder={t('Ej. 32534534')}
                      style={{ '--placeholder-color': '#bdcbe0' } as CSSProperties}
                      onIonInput={(e) => setDocumentNumber((e.detail.value ?? '').replace(/\s/g, ''))}
                    />
                  </div>

                  <div className="login-field login-password-field">
                    <label htmlFor="login-password">
                      <IonIcon icon={keyOutline} />
                      {t('Contraseña')}
                    </label>
                    <IonInput
                      id="login-password"
                      className="fld login-input"
                      type={showPwd ? 'text' : 'password'}
                      enterkeyhint="done"
                      value={pwd}
                      placeholder={t('••••••••')}
                      style={{ '--padding-end': '48px', '--placeholder-color': '#bdcbe0' } as CSSProperties}
                      onIonInput={(e) => setPwd(e.detail.value ?? '')}
                    />
                    <IonButton
                      type="button"
                      fill="clear"
                      className="fld-eye"
                      aria-label={showPwd ? t('Ocultar contraseña') : t('Mostrar contraseña')}
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
                          aria-label={t('Recordarme')}
                          onIonChange={(e) => setRemember(e.detail.checked)}
                        />
                        <IonIcon icon={timeOutline} />
                        <span>{t('Recordarme')}</span>
                      </div>
                      <div className="login-links">
                        <IonButton
                          type="button"
                          fill="clear"
                          className="login-forgot"
                          onClick={() => showToast('Demo: recuperación de contraseña no disponible', 'info')}
                        >
                          {t('¿Olvidaste tu contraseña?')}
                        </IonButton>
                      </div>
                    </div>

                    <IonButton expand="block" className="login-submit" type="submit" disabled={busy}>
                      {busy ? (
                        <>
                          <IonSpinner name="crescent" color="light" style={{ width: 18, height: 18, marginRight: 8 }} />
                          {t('Verificando…')}
                        </>
                      ) : (
                        <>
                          <IonIcon icon={lockClosedOutline} />
                          {t('Iniciar sesión')}
                        </>
                      )}
                    </IonButton>

                    <div className="login-divider" role="separator" aria-label={t('O')}>
                      <span>{t('o')}</span>
                    </div>

                    <IonButton type="button" expand="block" className="login-first-method" onClick={goFirst}>
                      <span className="login-first-method-icon">
                        <IonIcon icon={idCardOutline} />
                      </span>
                      {t('Primer inicio de sesión')}
                    </IonButton>

<div className="login-security">
                      <IonIcon icon={shieldCheckmarkOutline} />
                      {t('Conexión segura con cifrado de extremo a extremo')}
                    </div>
                </form>

                <footer className="login-footer">{t('© 2026 ANTARES · Plataforma de salud preventiva')}</footer>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  )
}
