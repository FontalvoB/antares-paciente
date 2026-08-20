import { useState, type CSSProperties } from 'react'
import { IonButton, IonCheckbox, IonIcon, IonInput, IonSpinner } from '@ionic/react'
import {
  eye,
  eyeOff,
  infinite,
  keyOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons'
import { useApp } from '../context/AppContext'
import { loginUser } from '../utils/authApi'

export function LoginPage() {
  const { finishLogin, showToast } = useApp()
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)

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
                <IonIcon icon={personOutline} />
              </div>
              <div>
                <h1>Bienvenido de nuevo</h1>
              </div>
            </header>

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
                <IonButton
                  type="button"
                  fill="clear"
                  className="login-forgot"
                  onClick={() => showToast('Demo: recuperación de contraseña no disponible', 'info')}
                >
                  ¿Olvidaste tu contraseña?
                </IonButton>
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

            <div className="login-create">
              ¿Aún no tienes una cuenta?
              <IonButton fill="clear" className="login-create-btn" onClick={() => finishLogin()}>
                Crear cuenta
              </IonButton>
            </div>
            <footer className="login-footer">© 2026 ANTARES · Plataforma de salud preventiva</footer>
          </div>
        </section>
      </div>
    </div>
  )
}
