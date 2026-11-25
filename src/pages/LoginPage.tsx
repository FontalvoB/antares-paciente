import { useEffect, useState, type CSSProperties } from "react";
import {
  IonButton,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonProgressBar,
  IonSpinner,
} from "@ionic/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  alertCircleOutline,
  arrowBackOutline,
  arrowForward,
  checkmarkCircle,
  chevronForwardOutline,
  ellipseOutline,
  eye,
  eyeOff,
  lockClosedOutline,
  mailOutline,
  personAddOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useI18n } from "../i18n/I18nContext";
import { localizedError } from "../utils/localizedError";
import { LanguageToggle } from "../components/LanguageToggle";
import { AuthSubmitButton } from "../components/AuthSubmitButton";
import { EmailRecoveryForm } from "../components/EmailRecoveryForm";
import {
  loginUser,
  lookupId,
  sendOtp,
  verifyOtp,
  sendRecoveryCode,
  recoverPassword,
  type ContactMethod,
  type IdLookupResult,
} from "../utils/authApi";
import { BrandWordmark } from "../components/BrandWordmark";
import type { UserProfile } from "../types";

type LoginMode = "login" | "first" | "recovery" | "email-recovery";
type FirstStep = "id" | "contacts" | "otp";

/** Transición compartida por los paneles de modo/paso del acceso. */
const panelMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
};

export function LoginPage() {
  const { finishLogin, showToast } = useApp();
  const i18n = useI18n();
  const { t } = i18n;
  const [mode, setMode] = useState<LoginMode>("login");
  const [firstStep, setFirstStep] = useState<FirstStep>("id");

  // Login por correo y contraseña
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Primer inicio de sesión (ID → contactos → OTP)
  const [idInput, setIdInput] = useState("");
  const [lookup, setLookup] = useState<IdLookupResult | null>(null);
  const [contact, setContact] = useState<ContactMethod | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpLeft, setOtpLeft] = useState(0);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");

  // Dispara la animación de despliegue del contenido en cada acción del
  // primer inicio de sesión (buscar identidad, enviar código, verificar).
  const [unfoldSeq, setUnfoldSeq] = useState(0);

  useEffect(() => {
    if (otpLeft <= 0) return;
    const id = window.setTimeout(() => setOtpLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [otpLeft]);

  const startAction = () => {
    setBusy(true);
    setUnfoldSeq((s) => s + 1);
  };

  const submit = async () => {
    if (busy) return;
    const loginEmail = email.trim();
    setLoginError(null);
    if (!loginEmail || !pwd) {
      showToast(t("Ingresa tu correo electrónico y contraseña"), "warn");
      return;
    }
    setBusy(true);
    try {
      await loginUser(loginEmail, pwd, remember);
      setBusy(false);
      finishLogin({ email: loginEmail }, "app");
    } catch (e) {
      setBusy(false);
      const message = localizedError(e, i18n, "Error al iniciar sesión");
      setLoginError(message);
      showToast(message, "err");
    }
  };

  const confirmId = async () => {
    const doc = idInput.trim();
    if (!doc) {
      showToast(t("Ingresa tu número de identificación"), "warn");
      return;
    }
    startAction();
    setBusyMessage("Buscando tu identificación…");
    try {
      const result = await lookupId(doc);
      setLookup(result);
      setContact(null);
      setDevCode(null);
      setOtp(["", "", "", "", "", ""]);
      setFirstStep("contacts");
      setBusy(false);
    } catch (e) {
      setBusy(false);
      showToast(
        localizedError(e, i18n, "No se pudo verificar la identidad"),
        "err",
      );
    }
  };

  const pickContact = async (c: ContactMethod) => {
    startAction();
    setBusyMessage("Enviando tu código…");
    try {
      const result =
        mode === "recovery"
          ? await sendRecoveryCode(idInput.trim(), c.id, i18n.lang)
          : await sendOtp(idInput.trim(), c.id, i18n.lang);
      setContact(c);
      setDevCode(result.devCode ?? null);
      setOtp(["", "", "", "", "", ""]);
      setOtpLeft(result.expiresInSeconds);
      setFirstStep("otp");
      setBusy(false);
      showToast(
        t("Código enviado por {channel}", {
          channel: c.type === "Email" ? t("correo electrónico") : "SMS",
        }),
        "ok",
      );
    } catch (e) {
      setBusy(false);
      showToast(localizedError(e, i18n, "No se pudo enviar el código"), "err");
    }
  };

  const resendOtp = () => {
    if (!contact) return;
    void pickContact(contact);
  };

  const submitOtp = async () => {
    const code = otp.join("");
    setFormError(null);
    if (code.length !== 6) {
      showToast(t("Ingresa el código de 6 dígitos"), "warn");
      return;
    }
    if (mode === "recovery" && !pwdChecks.every((check) => check.ok)) {
      setFormError(t("Tu contraseña aún no cumple todos los requisitos."));
      return;
    }
    if (mode === "recovery" && newPassword !== confirmPassword) {
      setFormError(t("Las contraseñas no coinciden."));
      return;
    }
    startAction();
    setBusyMessage("Verificando tu código…");
    try {
      if (mode === "recovery") {
        if (!contact) throw new Error(t("Selecciona un método de contacto."));
        await recoverPassword(
          idInput.trim(),
          contact.id,
          code,
          newPassword,
          i18n.lang,
        );
        setBusy(false);
        setMode("login");
        setPwd("");
        setNewPassword("");
        setConfirmPassword("");
        setFormError(null);
        showToast(
          t("Contraseña actualizada. Inicia sesión con tu nueva contraseña."),
          "ok",
        );
        return;
      }
      await verifyOtp(idInput.trim(), code, remember);
      setBusy(false);
      const seed: Partial<UserProfile> = lookup
        ? {
            nombre: `${lookup.firstName} ${lookup.lastName}`.trim(),
            cedula: lookup.documentNumber,
          }
        : { cedula: idInput.trim() };
      finishLogin(seed);
    } catch (e) {
      setBusy(false);
      showToast(localizedError(e, i18n, "Código inválido o expirado"), "err");
    }
  };

  const fillOtp = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      const nextOtp = [...otp];
      nextOtp[i] = "";
      setOtp(nextOtp);
      return;
    }
    if (digits.length > 1) {
      const nextOtp = [...otp];
      digits
        .slice(0, 6)
        .split("")
        .forEach((d, idx) => {
          nextOtp[idx] = d;
        });
      setOtp(nextOtp);
      return;
    }
    const nextOtp = [...otp];
    nextOtp[i] = digits.slice(-1);
    setOtp(nextOtp);
    const el = document.getElementById(`login-otp-${i + 1}`);
    if (el instanceof HTMLInputElement) el.focus();
  };

  const goFirst = (recover = false) => {
    setMode(recover ? "recovery" : "first");
    setNewPassword("");
    setConfirmPassword("");
    setFirstStep("id");
    setIdInput("");
    setLookup(null);
    setContact(null);
    setDevCode(null);
    setOtp(["", "", "", "", "", ""]);
  };

  const backFromFirst = () => {
    if (firstStep === "id") {
      setMode(mode === "recovery" ? "email-recovery" : "login");
      return;
    }
    if (firstStep === "otp") {
      setFirstStep("contacts");
      return;
    }
    setFirstStep("id");
  };

  const fullName = lookup
    ? `${lookup.firstName} ${lookup.lastName}`.trim()
    : "";

  // Requisitos de contraseña (espejo de la política del Auth Service) y
  // fuerza visual. El backend sigue siendo la autoridad final.
  const pwdChecks = [
    { key: "len", ok: newPassword.length >= 8, label: t("8 caracteres o más") },
    { key: "upper", ok: /[A-Z]/.test(newPassword), label: t("Una mayúscula") },
    { key: "lower", ok: /[a-z]/.test(newPassword), label: t("Una minúscula") },
    { key: "digit", ok: /\d/.test(newPassword), label: t("Un número") },
    {
      key: "symbol",
      ok: /[^A-Za-z0-9]/.test(newPassword),
      label: t("Un símbolo (!, #, $)"),
    },
  ];
  const pwdScore = pwdChecks.filter((check) => check.ok).length;
  const pwdBars = Math.min(4, Math.max(0, pwdScore - 1));
  const recoveryStepIndex = (["id", "contacts", "otp"] as FirstStep[]).indexOf(
    firstStep,
  );
  const strengthLabel =
    pwdScore === 0
      ? t("Empieza a escribir")
      : pwdScore <= 2
        ? t("Débil")
        : pwdScore === 3
          ? t("Media")
          : pwdScore === 4
            ? t("Fuerte")
            : t("Muy segura");

  const busyBar = (
    <AnimatePresence>
      {busy && (
        <motion.div
          className="auth-busy"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <IonSpinner name="crescent" style={{ width: 16, height: 16 }} />
          <span>{t(busyMessage || "Verificando…")}</span>
          <IonProgressBar type="indeterminate" className="auth-busy-bar" />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="screen auth auth-kb">
      <div className="auth-lang">
        <LanguageToggle />
      </div>

      <div className="auth-scroll">
        <BrandWordmark className="auth-logo" />

        <AnimatePresence mode="wait" initial={false}>
          {mode === "login" ? (
            <motion.div
              key="login"
              className="auth-body auth-body-login"
              {...panelMotion}
            >
              <div className="auth-hero">
                <h1 className="auth-title">
                  {t("Cuida tu salud,")}
                  <strong>{t("vive mejor")}</strong>
                </h1>
                <svg
                  className="auth-underline"
                  viewBox="0 0 168 12"
                  aria-hidden="true"
                >
                  <path d="M3 9.5C47 2.8 114 1.6 165 6.4" />
                </svg>
              </div>

              <form
                className="auth-form"
                aria-label={t("Iniciar sesión")}
                aria-busy={busy}
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="auth-field">
                  <label htmlFor="login-email">
                    {t("Correo electrónico")}
                  </label>
                  <IonInput
                    id="login-email"
                    className="auth-input auth-input-icon"
                    type="email"
                    inputmode="email"
                    autocomplete="username"
                    placeholder={t("nombre@example.com")}
                    autocapitalize="off"
                    spellcheck={false}
                    enterkeyhint="next"
                    value={email}
                    onIonInput={(e) => {
                      setEmail(e.detail.value ?? "");
                      setLoginError(null);
                    }}
                  >
                    <IonIcon
                      slot="start"
                      icon={mailOutline}
                      className="auth-input-ico"
                      aria-hidden="true"
                    />
                  </IonInput>
                </div>

                <div className="auth-field">
                  <label htmlFor="login-password">{t("Contraseña")}</label>
                  <IonInput
                    id="login-password"
                    className="auth-input auth-input-icon"
                    type={showPwd ? "text" : "password"}
                    autocomplete="current-password"
                    enterkeyhint="done"
                    value={pwd}
                    placeholder={t("Tu contraseña actual")}
                    style={{ "--padding-end": "48px" } as CSSProperties}
                    onIonInput={(e) => {
                      setPwd(e.detail.value ?? "");
                      setLoginError(null);
                    }}
                  >
                    <IonIcon
                      slot="start"
                      icon={lockClosedOutline}
                      className="auth-input-ico"
                      aria-hidden="true"
                    />
                  </IonInput>
                  <IonButton
                    type="button"
                    fill="clear"
                    className="auth-eye"
                    aria-label={
                      showPwd
                        ? t("Ocultar contraseña")
                        : t("Mostrar contraseña")
                    }
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    <IonIcon icon={showPwd ? eyeOff : eye} />
                  </IonButton>
                </div>

                {loginError && (
                  <div className="auth-alert" role="alert">
                    <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="auth-options">
                  <label className="auth-remember">
                    <IonCheckbox
                      checked={remember}
                      aria-label={t("Recordarme")}
                      onIonChange={(e) => setRemember(e.detail.checked)}
                    />
                    <span>{t("Recordarme")}</span>
                  </label>
                  <IonButton
                    type="button"
                    fill="clear"
                    className="auth-link-btn"
                    onClick={() => setMode("email-recovery")}
                  >
                    {t("¿Olvidaste tu contraseña?")}
                  </IonButton>
                </div>

                <AuthSubmitButton
                  type="submit"
                  label={t("Ingresar")}
                  busyLabel={t("Ingresando…")}
                  busy={busy}
                  icon={arrowForward}
                />
              </form>

              <div className="auth-divider" role="separator" aria-hidden="true">
                <span>{t("o")}</span>
              </div>

              <div className="auth-activate-block">
                <span className="auth-activate-hint">
                  {t("¿Es tu primera vez aquí?")}
                </span>
                <IonButton
                  expand="block"
                  fill="outline"
                  className="auth-activate"
                  disabled={busy}
                  onClick={() => goFirst()}
                >
                  <IonIcon
                    slot="start"
                    icon={personAddOutline}
                    aria-hidden="true"
                  />
                  <span>{t("Activa tu cuenta")}</span>
                  <IonIcon
                    slot="end"
                    icon={chevronForwardOutline}
                    aria-hidden="true"
                  />
                </IonButton>
              </div>

              <p className="auth-tagline">
                <span>{t("Prevención")}</span>
                <i aria-hidden="true">·</i>
                <span>{t("Bienestar")}</span>
                <i aria-hidden="true">·</i>
                <span>{t("Salud")}</span>
              </p>
            </motion.div>
          ) : mode === "email-recovery" ? (
            <motion.div key="email-recovery" className="auth-body" {...panelMotion}>
              <EmailRecoveryForm
                initialEmail={email}
                onBack={() => setMode("login")}
                onUseLegacyRecovery={() => goFirst(true)}
              />
            </motion.div>
          ) : (
            <motion.div key="first" className="auth-body" {...panelMotion}>
              <header className="auth-head">
                <button
                  type="button"
                  className="auth-back"
                  onClick={backFromFirst}
                  aria-label={t("Volver")}
                >
                  <IonIcon icon={arrowBackOutline} />
                </button>
                <div>
                  <h1 className="auth-head-title">
                    {t(
                      mode === "recovery"
                        ? "Recupera tu contraseña"
                        : "Activa tu cuenta",
                    )}
                  </h1>
                  <p className="auth-head-sub">
                    {firstStep === "id" &&
                      t("Verifica tu identidad para completar tu perfil")}
                    {firstStep === "contacts" &&
                      t("Elige por dónde quieres recibir tu código")}
                    {firstStep === "otp" &&
                      t("Introduce el código que te enviamos")}
                  </p>
                </div>
              </header>

              {mode === "recovery" && (
                <div className="auth-steps" aria-hidden="true">
                  {(["id", "contacts", "otp"] as FirstStep[]).map(
                    (step, index) => (
                      <span
                        key={step}
                        className={`auth-step ${
                          firstStep === step ? "is-active" : ""
                        } ${recoveryStepIndex > index ? "is-done" : ""}`}
                      />
                    ),
                  )}
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${firstStep}-${unfoldSeq}`}
                  className="auth-form"
                  {...panelMotion}
                >
                  {firstStep === "id" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        confirmId();
                      }}
                    >
                      <div className="auth-note">
                        <IonIcon icon={shieldCheckmarkOutline} />
                        <span>
                          {t(
                            "Buscaremos los correos y teléfonos asociados a tu número de identificación para verificar que eres tú.",
                          )}
                        </span>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="login-first-id">
                          {t("Número de identificación")}
                        </label>
                        <IonInput
                          id="login-first-id"
                          className="auth-input"
                          type="text"
                          inputmode="numeric"
                          autocomplete="off"
                          enterkeyhint="done"
                          value={idInput}
                          placeholder={t("Ej. 32534534")}
                          onIonInput={(e) =>
                            setIdInput(
                              (e.detail.value ?? "").replace(/\s/g, ""),
                            )
                          }
                        />
                      </div>

                      {busyBar}

                      <AuthSubmitButton
                        label={t("Confirmar identidad")}
                        busyLabel={t("Buscando…")}
                        busy={busy}
                        icon={shieldCheckmarkOutline}
                        onAct={confirmId}
                      />
                    </form>
                  )}

                  {firstStep === "contacts" && lookup && (
                    <div>
                      {fullName && (
                        <div className="auth-person">
                          <span className="auth-person-avatar">
                            {fullName.charAt(0).toUpperCase()}
                          </span>
                          <span className="auth-person-body">
                            <strong>{fullName}</strong>
                            <small>ID {lookup.documentNumber}</small>
                          </span>
                        </div>
                      )}

                      <p className="auth-hint">
                        {t(
                          lookup.contacts.length === 1
                            ? "Encontramos {n} método de contacto asociado a tu identificación."
                            : "Encontramos {n} métodos de contacto asociados a tu identificación.",
                          { n: String(lookup.contacts.length) },
                        )}
                      </p>

                      <div
                        className="auth-contacts"
                        role="radiogroup"
                        aria-label={t("Métodos de contacto")}
                      >
                        {lookup.contacts.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={false}
                            className="auth-contact"
                            onClick={() => pickContact(c)}
                            disabled={busy}
                          >
                            <span className="auth-contact-ico">
                              <IonIcon
                                icon={
                                  c.type === "Email"
                                    ? mailOutline
                                    : phonePortraitOutline
                                }
                              />
                            </span>
                            <span className="auth-contact-body">
                              <strong>{c.label}</strong>
                              <small>
                                {t("Enviar código por {channel}", {
                                  channel:
                                    c.type === "Email"
                                      ? t("correo electrónico")
                                      : "SMS",
                                })}
                              </small>
                            </span>
                            <IonIcon
                              icon={chevronForwardOutline}
                              className="auth-contact-arrow"
                            />
                          </button>
                        ))}
                      </div>

                      {busyBar}
                    </div>
                  )}

                  {firstStep === "otp" && contact && (
                    <div>
                      <p className="auth-hint">
                        {t("Enviamos un código de 6 dígitos a")}{" "}
                        <strong>{contact.label}</strong>
                      </p>

                      <div className="auth-otp-row">
                        {otp.map((d, i) => (
                          <input
                            key={i}
                            id={`login-otp-${i}`}
                            className={`auth-otp ${d ? "filled" : ""}`}
                            maxLength={i === 0 ? 6 : 1}
                            inputMode="numeric"
                            autoComplete={i === 0 ? "one-time-code" : "off"}
                            aria-label={t("Dígito {n}", { n: String(i + 1) })}
                            value={d}
                            onChange={(e) => fillOtp(i, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !otp[i] && i > 0) {
                                const prev = document.getElementById(
                                  `login-otp-${i - 1}`,
                                );
                                if (prev instanceof HTMLInputElement)
                                  prev.focus();
                              }
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              fillOtp(0, e.clipboardData.getData("text"));
                            }}
                          />
                        ))}
                      </div>

                      {devCode && (
                        <div className="auth-devcode">
                          {t("Código de prueba:")} {devCode}
                        </div>
                      )}

                      <div className="auth-resend">
                        {otpLeft > 0 ? (
                          <span>
                            {t("Reenviar en")} 0:
                            {String(Math.min(otpLeft, 59)).padStart(2, "0")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="auth-alt-link"
                            onClick={resendOtp}
                          >
                            {t("Reenviar código")}
                          </button>
                        )}
                      </div>

                      {mode === "recovery" && (
                        <div className="auth-recovery">
                          <div className="auth-recovery-head">
                            <span
                              className="auth-recovery-badge"
                              aria-hidden="true"
                            >
                              <IonIcon icon={shieldCheckmarkOutline} />
                            </span>
                            <div>
                              <strong>{t("Crea tu nueva contraseña")}</strong>
                              <p>
                                {t(
                                  "La usarás para entrar a la app desde ahora.",
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="auth-pwd">
                            <label htmlFor="recovery-password">
                              {t("Nueva contraseña")}
                            </label>
                            <div className="auth-pwd-box">
                              <input
                                id="recovery-password"
                                className="auth-pwd-input"
                                type={showNewPwd ? "text" : "password"}
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={128}
                                value={newPassword}
                                aria-describedby="recovery-reqs"
                                onChange={(e) => {
                                  setNewPassword(e.target.value);
                                  setFormError(null);
                                }}
                              />
                              <button
                                type="button"
                                className="auth-pwd-eye"
                                aria-label={t(
                                  showNewPwd
                                    ? "Ocultar contraseña"
                                    : "Mostrar contraseña",
                                )}
                                aria-pressed={showNewPwd}
                                onClick={() => setShowNewPwd((v) => !v)}
                              >
                                <IonIcon icon={showNewPwd ? eyeOff : eye} />
                              </button>
                            </div>
                          </div>

                          <div className="auth-pwd">
                            <label htmlFor="recovery-confirm">
                              {t("Confirmar contraseña")}
                            </label>
                            <div className="auth-pwd-box">
                              <input
                                id="recovery-confirm"
                                className="auth-pwd-input"
                                type={showConfirmPwd ? "text" : "password"}
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={128}
                                value={confirmPassword}
                                aria-invalid={
                                  confirmPassword.length > 0 &&
                                  confirmPassword !== newPassword
                                }
                                onChange={(e) => {
                                  setConfirmPassword(e.target.value);
                                  setFormError(null);
                                }}
                              />
                              <button
                                type="button"
                                className="auth-pwd-eye"
                                aria-label={t(
                                  showConfirmPwd
                                    ? "Ocultar contraseña"
                                    : "Mostrar contraseña",
                                )}
                                aria-pressed={showConfirmPwd}
                                onClick={() => setShowConfirmPwd((v) => !v)}
                              >
                                <IonIcon icon={showConfirmPwd ? eyeOff : eye} />
                              </button>
                            </div>
                            {confirmPassword.length > 0 &&
                              confirmPassword !== newPassword && (
                                <p className="auth-pwd-mismatch" role="alert">
                                  {t("Las contraseñas no coinciden.")}
                                </p>
                              )}
                          </div>

                          <div className="auth-strength" data-score={pwdBars}>
                            <div
                              className="auth-strength-bars"
                              aria-hidden="true"
                            >
                              {[0, 1, 2, 3].map((bar) => (
                                <span
                                  key={bar}
                                  className={bar < pwdBars ? "on" : ""}
                                />
                              ))}
                            </div>
                            <span className="auth-strength-label">
                              {strengthLabel}
                            </span>
                          </div>

                          <ul className="auth-reqs" id="recovery-reqs">
                            {pwdChecks.map((check) => (
                              <li
                                key={check.key}
                                className={check.ok ? "ok" : ""}
                              >
                                <IonIcon
                                  icon={
                                    check.ok ? checkmarkCircle : ellipseOutline
                                  }
                                  aria-hidden="true"
                                />
                                <span>{check.label}</span>
                              </li>
                            ))}
                          </ul>

                          {formError && (
                            <div className="auth-alert" role="alert">
                              <IonIcon
                                icon={alertCircleOutline}
                                aria-hidden="true"
                              />
                              <span>{formError}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {busyBar}

                      <AuthSubmitButton
                        label={t(
                          mode === "recovery"
                            ? "Actualizar contraseña"
                            : "Verificar y entrar",
                        )}
                        busyLabel={t("Verificando…")}
                        busy={busy}
                        disabled={otp.join("").length !== 6}
                        icon={lockClosedOutline}
                        onAct={submitOtp}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="auth-alt">
                <span>{t("¿Ya tienes contraseña?")}</span>
                <button
                  type="button"
                  className="auth-alt-link"
                  onClick={() => setMode("login")}
                >
                  {t("Iniciar sesión")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ola decorativa de marca: cierra la pantalla sin competir con el
          formulario ni con el área táctil (puramente visual). */}
      <svg
        className="auth-wave"
        viewBox="0 0 390 84"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="auth-wave-back"
          d="M0 42c72-26 145-30 221-9 74 20 121 17 169-8v59H0Z"
        />
        <path
          className="auth-wave-front"
          d="M0 62c83-25 160-16 236 2 57 13 105 9 154-7v27H0Z"
        />
      </svg>
    </div>
  );
}
