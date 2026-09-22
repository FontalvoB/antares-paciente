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
  arrowBackOutline,
  chevronForwardOutline,
  eye,
  eyeOff,
  lockClosedOutline,
  mailOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import { LanguageToggle } from "../components/LanguageToggle";
import { Mascot } from "../components/Mascot";
import { SlideCtaButton } from "../components/SlideCtaButton";
import {
  loginUser,
  lookupId,
  sendOtp,
  verifyOtp,
  type ContactMethod,
  type IdLookupResult,
} from "../utils/authApi";
import logoLetras from "../assets/LogoConLetras.png";
import type { UserProfile } from "../types";

type LoginMode = "login" | "first";
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
  const t = useT();
  const [mode, setMode] = useState<LoginMode>("login");
  const [firstStep, setFirstStep] = useState<FirstStep>("id");

  // Login por ID + contraseña
  const [documentNumber, setDocumentNumber] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);

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
    const doc = documentNumber.trim();
    if (!doc || !pwd) {
      showToast(t("Ingresa tu número de identificación y contraseña"), "warn");
      return;
    }
    setBusy(true);
    try {
      await loginUser(doc, pwd, remember);
      setBusy(false);
      finishLogin({ cedula: doc }, "app");
    } catch (e) {
      setBusy(false);
      showToast(
        e instanceof Error ? e.message : t("Error al iniciar sesión"),
        "err",
      );
    }
  };

  const confirmId = async () => {
    const doc = idInput.trim();
    if (!doc) {
      showToast(t("Ingresa tu número de identificación"), "warn");
      return;
    }
    startAction();
    setBusyMessage(t("Buscando tu identificación…"));
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
        e instanceof Error ? e.message : t("No se pudo verificar la identidad"),
        "err",
      );
    }
  };

  const pickContact = async (c: ContactMethod) => {
    startAction();
    setBusyMessage(t("Enviando tu código…"));
    try {
      const result = await sendOtp(idInput.trim(), c.id);
      setContact(c);
      setDevCode(result.devCode ?? null);
      setOtp(["", "", "", "", "", ""]);
      setOtpLeft(result.expiresInSeconds);
      setFirstStep("otp");
      setBusy(false);
      showToast(
        t("Código enviado por {channel}", {
          channel: c.type === "Email" ? "correo electrónico" : "SMS",
        }),
        "ok",
      );
    } catch (e) {
      setBusy(false);
      showToast(
        e instanceof Error ? e.message : t("No se pudo enviar el código"),
        "err",
      );
    }
  };

  const resendOtp = () => {
    if (!contact) return;
    void pickContact(contact);
  };

  const submitOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      showToast(t("Ingresa el código de 6 dígitos"), "warn");
      return;
    }
    startAction();
    setBusyMessage(t("Verificando tu código…"));
    try {
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
      showToast(
        e instanceof Error ? e.message : t("Código inválido o expirado"),
        "err",
      );
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

  const goFirst = () => {
    setMode("first");
    setFirstStep("id");
    setIdInput("");
    setLookup(null);
    setContact(null);
    setDevCode(null);
    setOtp(["", "", "", "", "", ""]);
  };

  const backFromFirst = () => {
    if (firstStep === "id") {
      setMode("login");
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

  const busyBar = (
    <AnimatePresence>
      {busy && (
        <motion.div
          className="auth-busy"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <IonSpinner name="crescent" style={{ width: 16, height: 16 }} />
          <span>{busyMessage}</span>
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
        <img className="auth-logo" src={logoLetras} alt="COPP-ADRESD" />

        {/* La mascota solo en el panel de acceso; el flujo de activación
            (primera vez) es más denso y no necesita ilustración. */}
        {mode === "login" && <Mascot pose="welcome" className="mascot-auth" />}

        <AnimatePresence mode="wait" initial={false}>
          {mode === "login" ? (
            <motion.div key="login" className="auth-body" {...panelMotion}>
              <h1 className="auth-title">
                {t("Transforma")}
                <br />
                <strong>{t("tus")}</strong> {t("hábitos")}
              </h1>

              <form
                className="auth-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="auth-field">
                  <label htmlFor="login-id">
                    1{t("Número de identificación")}
                  </label>
                  <IonInput
                    id="login-id"
                    className="auth-input"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    enterkeyhint="next"
                    value={documentNumber}
                    placeholder={t("Ej. 32534534")}
                    onIonInput={(e) =>
                      setDocumentNumber(
                        (e.detail.value ?? "").replace(/\s/g, ""),
                      )
                    }
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="login-password">{t("Contraseña")}</label>
                  <IonInput
                    id="login-password"
                    className="auth-input"
                    type={showPwd ? "text" : "password"}
                    enterkeyhint="done"
                    value={pwd}
                    placeholder={t("••••••••")}
                    style={{ "--padding-end": "48px" } as CSSProperties}
                    onIonInput={(e) => setPwd(e.detail.value ?? "")}
                  />
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
                    onClick={() =>
                      showToast(
                        t("Demo: recuperación de contraseña no disponible"),
                        "info",
                      )
                    }
                  >
                    {t("¿Olvidaste tu contraseña?")}
                  </IonButton>
                </div>

                {busyBar}

                <SlideCtaButton
                  label={t("Comencemos")}
                  busyLabel={t("Verificando…")}
                  busy={busy}
                  disabled={busy}
                  icon={chevronForwardOutline}
                  onAct={submit}
                />
              </form>

              <div className="auth-alt">
                <span>{t("¿Es tu primera vez aquí?")}</span>
                <button
                  type="button"
                  className="auth-alt-link"
                  onClick={goFirst}
                >
                  {t("Activa tu cuenta")}
                </button>
              </div>
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
                  <h1 className="auth-head-title">{t("Activa tu cuenta")}</h1>
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

                      <SlideCtaButton
                        label={t("Confirmar identidad")}
                        busyLabel={t("Buscando…")}
                        busy={busy}
                        disabled={busy}
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
                        {t("Encontramos")}{" "}
                        <strong>{lookup.contacts.length}</strong>{" "}
                        {lookup.contacts.length === 1
                          ? t("método de contacto")
                          : t("métodos de contacto")}{" "}
                        {t("asociado")}
                        {lookup.contacts.length === 1 ? "" : "s"}{" "}
                        {t("a tu identificación.")}
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
                                      ? "correo electrónico"
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

                      {busyBar}

                      <SlideCtaButton
                        label={t("Verificar y entrar")}
                        busyLabel={t("Verificando…")}
                        busy={busy}
                        disabled={busy || otp.join("").length !== 6}
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
    </div>
  );
}
