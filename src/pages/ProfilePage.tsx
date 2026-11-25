import { useEffect, useRef, useState } from "react";
import {
  IonAlert,
  IonAvatar,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
} from "@ionic/react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  barbellOutline,
  bodyOutline,
  clipboardOutline,
  flagOutline,
  languageOutline,
  leafOutline,
  logOutOutline,
  trashOutline,
  chevronForward,
  optionsOutline,
  shieldCheckmarkOutline,
  notificationsOutline,
  menuOutline,
  globeOutline,
  locationOutline,
  openOutline,
  sparklesOutline,
} from "ionicons/icons";
import { NotificationsModal } from "../components/notifications/NotificationsModal";
import logoIcon from "../assets/LogoIndividual.png";
import vitaPortrait from "../assets/vita-coach.png";
import { AvatarPage } from "./AvatarPage";
import { Screen, Scroll } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { localizedError } from "../utils/localizedError";
import { useI18n } from "../i18n/I18nContext";
import { useLegalConsents } from "../context/LegalConsentContext";
import { useAiDisclosure } from "../context/AiDisclosureContext";
import { aiDisclosureAccepted as aiDisclosureAcceptedForAccount } from "../utils/aiDisclosure";
import { EmergencyContactsForm } from "../components/EmergencyContactsForm";
import {
  contactFromProfile,
  emergencyContactsError,
  trimEmergencyContact,
} from "../utils/emergencyContacts";
import { getWebBaseUrl } from "../utils/apiBaseUrl";
import { Browser } from "@capacitor/browser";
import { createAccountDeletionHandoff, restoreSession } from "../utils/authApi";
import { updateMyPatientProfile } from "../utils/patientProfileApi";
import { PRIVACY_POLICY_URL } from "../utils/legalLinks";

/**
 * Tarjeta de contacto editable del paciente (FASE 2): email + celular con
 * guardado vía PUT /me/patient-profile (anti-IDOR por JWT). Al fallar se
 * revierten los inputs al snapshot pre-guardado (rollback, spec FASE 2).
 */
function ContactSection() {
  const { user, showToast } = useApp();
  const i18n = useI18n();
  const { t } = i18n;
  const [email, setEmail] = useState(user.email);
  const [cel, setCel] = useState(user.celular);
  const [saving, setSaving] = useState(false);
  const preSaveRef = useRef({ email: user.email, cel: user.celular });

  useEffect(() => {
    setEmail(user.email);
    setCel(user.celular);
  }, [user.email, user.celular]);

  const save = async () => {
    if (saving) return;
    preSaveRef.current = { email, cel };
    setSaving(true);
    try {
      await updateMyPatientProfile({
        dateOfBirth: user.dob || null,
        email,
        phone: cel,
        emergencyName: user.fam1Nombre,
        emergencyRelationship: user.fam1Parentesco,
        emergencyPhone: user.fam1Cel,
        emergencyEmail: user.fam1Email,
        insurerId: user.seguro || null,
        memberId: user.poliza,
      });
      showToast(t("Datos actualizados"), "ok");
    } catch (err) {
      setEmail(preSaveRef.current.email);
      setCel(preSaveRef.current.cel);
      showToast(
        localizedError(err, i18n, "No se pudo actualizar tu contacto"),
        "err",
      );
    } finally {
      setSaving(false);
    }
  };

  const dirty = email !== user.email || cel !== user.celular;

  return (
    <div className="pf-contact">
      <div className="h3" style={{ margin: "0 0 10px" }}>
        {t("Datos de contacto")}
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="pf-email">{t("Correo")}</label>
        <IonInput
          id="pf-email"
          className="fld"
          type="email"
          value={email}
          inputmode="email"
          enterkeyhint="next"
          onIonInput={(e) => setEmail(String(e.detail.value ?? ""))}
        />
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="pf-cel">{t("Celular")}</label>
        <IonInput
          id="pf-cel"
          className="fld"
          type="tel"
          value={cel}
          inputmode="tel"
          enterkeyhint="done"
          onIonInput={(e) => setCel(String(e.detail.value ?? ""))}
        />
      </div>
      <IonButton
        expand="block"
        className="bt bt-primary"
        disabled={saving || !dirty}
        onClick={() => void save()}
      >
        {saving ? t("Guardando…") : t("Guardar contacto")}
      </IonButton>
    </div>
  );
}

/**
 * Contacto de emergencia editable post-onboarding (mismo JSON
 * {name, relationship, phone, email} del onboarding). Es el destinatario real
 * de la alerta SOS (llamada, SMS y correo): sin esta tarjeta, un paciente que
 * ya pasó el onboarding no podía agregar/corregir el correo y el canal de
 * correo quedaba SinDestino para siempre.
 * Reglas del backend espejadas antes de enviar: nombre exige teléfono; un
 * correo solo (sin nombre ni teléfono) no persiste el contacto.
 */
function EmergencyContactSection() {
  const { user, showToast, refreshPatientProfile } = useApp();
  const i18n = useI18n();
  const { t } = i18n;
  const [primary, setPrimary] = useState(() => contactFromProfile(user, 1));
  const [secondary, setSecondary] = useState(() => contactFromProfile(user, 2));
  const [saving, setSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  useEffect(() => {
    setPrimary({
      name: user.fam1Nombre ?? "",
      relationship: user.fam1Parentesco ?? "",
      phone: user.fam1Cel ?? "",
      email: user.fam1Email ?? "",
    });
    setSecondary({
      name: user.fam2Nombre ?? "",
      relationship: user.fam2Parentesco ?? "",
      phone: user.fam2Cel ?? "",
      email: user.fam2Email ?? "",
    });
  }, [
    user.fam1Nombre,
    user.fam1Parentesco,
    user.fam1Cel,
    user.fam1Email,
    user.fam2Nombre,
    user.fam2Parentesco,
    user.fam2Cel,
    user.fam2Email,
  ]);
  const dirty =
    JSON.stringify(primary) !== JSON.stringify(contactFromProfile(user, 1)) ||
    JSON.stringify(secondary) !== JSON.stringify(contactFromProfile(user, 2));
  const save = async () => {
    if (saving) return;
    const error = emergencyContactsError(primary, secondary);
    if (error) {
      setContactError(error);
      return;
    }
    setContactError(null);
    setSaving(true);
    const first = trimEmergencyContact(primary);
    try {
      await updateMyPatientProfile({
        dateOfBirth: user.dob || null,
        email: user.email,
        phone: user.celular,
        emergencyName: first.name,
        emergencyRelationship: first.relationship,
        emergencyPhone: first.phone,
        emergencyEmail: first.email,
        secondaryEmergencyContact: trimEmergencyContact(secondary),
        insurerId: user.seguro || null,
        memberId: user.poliza,
      });
      await refreshPatientProfile();
      showToast(t("Contacto de emergencia actualizado"), "ok");
    } catch (err) {
      showToast(
        localizedError(
          err,
          i18n,
          "No se pudo actualizar el contacto de emergencia",
        ),
        "err",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="pf-contact" style={{ marginTop: 18 }}>
      <h3>{t("Contacto de emergencia")}</h3>
      <EmergencyContactsForm
        prefix="pf-emg"
        primary={primary}
        secondary={secondary}
        onPrimaryChange={(value) => {
          setContactError(null);
          setPrimary(value);
        }}
        onSecondaryChange={(value) => {
          setContactError(null);
          setSecondary(value);
        }}
        disabled={saving}
      />
      {contactError && (
        <p role="alert" className="emergency-contact-error">
          {t(contactError)}
        </p>
      )}
      <IonButton
        expand="block"
        className="bt bt-primary"
        disabled={saving || !dirty}
        onClick={() => void save()}
      >
        {saving ? t("Guardando…") : t("Guardar contacto de emergencia")}
      </IonButton>
    </div>
  );
}

/**
 * Sección "Liga" del perfil: opt-in + apodo (LEAGUE v1). La verdad de las
 * preferencias sale del GET league (`me`); el guardado hace PUT y parchea el
 * cache de la liga (el cohorte no cambia). Errores 400 con mensajes reales
 * del backend (p.ej. token reservado) se muestran inline vía `errors`.
 */
export function ProfilePage() {
  const { user, navigate, showToast, logout, openTests } = useApp();
  const { lang, toggleLang, t } = useI18n();
  const { openPrivacyChoices } = useLegalConsents();
  const { openAiDisclosure } = useAiDisclosure();
  const aiDisclosureAccepted = aiDisclosureAcceptedForAccount();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const reduce = useReducedMotion();
  const accountRef = useRef<HTMLElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const openPrivacyPolicy = async () => {
    try {
      await Browser.open({
        url: PRIVACY_POLICY_URL,
        presentationStyle: "popover",
      });
    } catch {
      showToast(
        t("No se pudo abrir el sitio web. Inténtalo más tarde."),
        "err",
      );
    }
  };

  // La eliminación de la cuenta se completa en el microfrontend web. La app NO pone
  // ningún token en la URL: pide al backend un código opaco de un solo uso (vida de
  // segundos) y la web lo canjea por una cookie de sesión HttpOnly. El código va en
  // el fragmento (#), que no se envía al servidor, y la web lo retira al leerlo.
  // Se abre en el navegador integrado (SFSafariViewController / Chrome Custom Tabs):
  // el usuario no sale de la app y las cookies quedan aisladas de ella.
  const openDeleteAccountWeb = async () => {
    const webBase = getWebBaseUrl();
    if (!webBase) {
      showToast(
        t("No se pudo abrir el sitio web. Inténtalo más tarde."),
        "err",
      );
      return;
    }
    try {
      const code = await createAccountDeletionHandoff();
      const hash = new URLSearchParams({ code, lang }).toString();
      // Cache-buster en la query: el navegador integrado comparte caché HTTP con
      // Safari/Chrome y reutiliza la página previamente visitada, incluso
      // descartando el fragment (#) — un ?cb distinto fuerza una carga fresca.
      await Browser.open({
        url: `${webBase}/eliminar-cuenta?cb=${Date.now()}#${hash}`,
        presentationStyle: "popover",
      });
    } catch {
      showToast(
        t("No se pudo abrir el sitio web. Inténtalo más tarde."),
        "err",
      );
    }
  };

  // Al cerrar el navegador integrado se revalida la sesión: si la cuenta se
  // eliminó, el refresh responde 401 y la app vuelve al login (onSessionInvalid).
  useEffect(() => {
    const listener = Browser.addListener("browserFinished", () => {
      void restoreSession();
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, []);

  const initials = user.nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase(locale);

  return (
    <MotionConfig reducedMotion="user">
      <Screen className="pf-screen pf-reference">
        <Scroll className="pf-scroll">
          <div className="pf-layout">
            <div className="pf-overview">
              <header className="pf-heading">
                <div className="pf-topbar">
                  <div className="hm-wordmark" aria-label="COPP-ADRESD">
                    <img src={logoIcon} alt="" />
                    <span>
                      <strong>
                        COPP-ADRESD<sup>®</sup>
                      </strong>
                      <small>
                        COMPREHENSIVE OBESITY
                        <br />
                        PREVENTION PROGRAM
                      </small>
                    </span>
                  </div>
                  <div className="pf-header-actions">
                    <IonButton
                      fill="clear"
                      aria-label={t("Notificaciones")}
                      onClick={() => setNotificationsOpen(true)}
                    >
                      <IonIcon icon={notificationsOutline} />
                    </IonButton>
                    <IonButton
                      fill="clear"
                      onClick={toggleLang}
                      aria-label={t("Idioma")}
                    >
                      <IonIcon icon={globeOutline} />
                      <span>{lang === "es" ? "ES" : "EN"}</span>
                    </IonButton>
                    <IonButton
                      fill="clear"
                      aria-label={t("Ir a ajustes de cuenta")}
                      onClick={() => {
                        accountRef.current?.scrollIntoView({
                          behavior: reduce ? "instant" : "smooth",
                          block: "start",
                        });
                        accountRef.current?.focus({ preventScroll: true });
                      }}
                    >
                      <IonIcon icon={menuOutline} />
                    </IonButton>
                  </div>
                </div>
                <h1>{t("Perfil")}</h1>
                <p>{t("Tu progreso, nuestra prioridad")}</p>
              </header>

              {/* Tarjeta de identidad: composición editorial de dominio, sin equivalente Ionic. */}
              <motion.section
                className="pf-identity"
                aria-label={t("Tu perfil")}
                initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.55 }}
              >
                <div className="pf-identity-body">
                  <IonAvatar className="pf-monogram" aria-hidden="true">
                    {initials || <IonIcon icon={bodyOutline} />}
                  </IonAvatar>
                  <div className="pf-person">
                    <h2>{user.nombre}</h2>
                    <p className="pf-patient-label">
                      <IonIcon
                        icon={shieldCheckmarkOutline}
                        aria-hidden="true"
                      />
                      {t("Mi perfil de salud")}
                    </p>
                    {user.cedula && (
                      <p className="pf-doc">
                        <span>{t("Documento")}</span>
                        {user.cedula}
                      </p>
                    )}
                    {user.ciudad && (
                      <p className="pf-city">
                        <IonIcon icon={locationOutline} aria-hidden="true" />
                        {user.ciudad}
                      </p>
                    )}
                  </div>
                </div>
              </motion.section>

              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reduce ? 0 : 0.12,
                  duration: reduce ? 0 : 0.45,
                }}
              >
                <IonButton
                  className="pf-avatar-feature"
                  aria-label={t("Mi Avatar")}
                  fill="clear"
                  expand="block"
                  onClick={() => setAvatarOpen(true)}
                >
                  <span className="pf-avatar-copy">
                    <strong>{t("Personaliza tu avatar")}</strong>
                    <span className="pf-feature-description">
                      {t("Haz que tu experiencia sea única.")}
                    </span>
                  </span>
                  {/* KAN-97: el banner usa el retrato de doctora ya existente
                      en el repo (src/assets/vita-coach.png, scrubs teal y
                      estetoscopio, fondo transparente). Sin assets nuevos. */}
                  <img
                    src={vitaPortrait}
                    alt=""
                    aria-hidden="true"
                    className="pf-avatar-doctor"
                    decoding="async"
                  />
                  <span className="pf-avatar-next">
                    <IonIcon icon={chevronForward} aria-hidden="true" />
                  </span>
                </IonButton>
              </motion.div>
            </div>

            <div className="pf-content">
              <section className="pf-care" aria-labelledby="pf-care-title">
                <div className="pf-section-title">
                  <div>
                    <h2 id="pf-care-title">{t("Mi plan")}</h2>
                    <p>{t("Tu salud en equilibrio, todos los días.")}</p>
                  </div>
                </div>
                <IonList className="pf-menu" lines="none">
                  {[
                    {
                      icon: clipboardOutline,
                      title: "Evaluaciones de bienestar",
                      sub: "Evaluaciones pendientes",
                      tone: "lilac",
                      action: openTests,
                    },
                    {
                      icon: leafOutline,
                      title: "Plan nutricional",
                      sub: "Alimentación que te acompaña",
                      tone: "mint",
                      action: () => navigate("wellness-diet"),
                    },
                    {
                      icon: barbellOutline,
                      title: "Plan de ejercicios",
                      sub: "Consulta tu rutina de hoy",
                      tone: "mint",
                      action: () => navigate("wellness-exercise"),
                    },
                    {
                      icon: flagOutline,
                      title: "Cambiar objetivo",
                      sub: "Cambia tu meta y actualiza tu plan",
                      tone: "sky",
                      action: () => navigate("wellness-goal"),
                    },
                  ].map((item) => (
                    <IonItem
                      button
                      detail={false}
                      key={item.title}
                      onClick={item.action}
                      className={"pf-menu-row pf-plan-" + item.tone}
                    >
                      <span
                        slot="start"
                        className={"pf-menu-icon " + item.tone}
                      >
                        <IonIcon icon={item.icon} aria-hidden="true" />
                      </span>
                      <IonLabel>
                        <h3>{t(item.title)}</h3>
                        <p>{t(item.sub)}</p>
                      </IonLabel>
                      <IonIcon
                        slot="end"
                        className="pf-chevron"
                        icon={chevronForward}
                        aria-hidden="true"
                      />
                    </IonItem>
                  ))}
                </IonList>
              </section>

              <section
                className="pf-account"
                ref={accountRef}
                tabIndex={-1}
                aria-labelledby="pf-account-title"
              >
                <div className="pf-section-title">
                  <div>
                    <span className="pf-eyebrow">{t("A TU MANERA")}</span>
                    <h2 id="pf-account-title">{t("Cuenta y preferencias")}</h2>
                  </div>
                  <IonIcon
                    className="pf-section-settings"
                    icon={optionsOutline}
                    aria-hidden="true"
                  />
                </div>
                <ContactSection />
                <EmergencyContactSection />
                <IonList className="pf-menu pf-account-menu" lines="none">
                  <IonItem
                    button
                    detail={false}
                    className="pf-menu-row"
                    onClick={toggleLang}
                  >
                    <span slot="start" className="pf-menu-icon neutral">
                      <IonIcon icon={languageOutline} aria-hidden="true" />
                    </span>
                    <IonLabel>
                      <h3>{t("Idioma")}</h3>
                      <p>{t("Elige cómo quieres leernos")}</p>
                    </IonLabel>
                    <span slot="end" className="pf-language">
                      {lang === "es" ? "ES" : "EN"}
                      <IonIcon icon={chevronForward} aria-hidden="true" />
                    </span>
                  </IonItem>
                  <IonItem
                    button
                    detail={false}
                    className="pf-menu-row"
                    onClick={() => navigate("wellness-privacy")}
                  >
                    <span slot="start" className="pf-menu-icon neutral">
                      <IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />
                    </span>
                    <IonLabel><h3>{t("Privacidad y datos")}</h3></IonLabel>
                    <IonIcon slot="end" className="pf-chevron" icon={chevronForward} aria-hidden="true" />
                  </IonItem>
                </IonList>
                <IonButton
                  fill="clear"
                  expand="block"
                  className="bt bt-ghost"
                  style={{ marginTop: 12 }}
                  onClick={openAiDisclosure}
                >
                  <IonIcon
                    icon={sparklesOutline}
                    slot="start"
                    aria-hidden="true"
                  />
                  {t("Privacidad de IA")}
                  {aiDisclosureAccepted && (
                    <span slot="end" className="pf-language">
                      {t("Autorizado")}
                    </span>
                  )}
                </IonButton>
                <IonButton
                  fill="clear"
                  expand="block"
                  className="bt bt-ghost"
                  style={{ marginTop: 12 }}
                  onClick={openPrivacyChoices}
                >
                  <IonIcon
                    icon={optionsOutline}
                    slot="start"
                    aria-hidden="true"
                  />
                  {t("Autorizaciones y privacidad")}
                </IonButton>
                <IonButton
                  fill="clear"
                  expand="block"
                  className="bt bt-ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => void openPrivacyPolicy()}
                >
                  <IonIcon
                    icon={shieldCheckmarkOutline}
                    slot="start"
                    aria-hidden="true"
                  />
                  {t("Política de privacidad")}
                  <IonIcon icon={openOutline} slot="end" aria-hidden="true" />
                </IonButton>
                <IonButton
                  fill="clear"
                  expand="block"
                  className="pf-logout"
                  onClick={() => {
                    logout();
                    showToast(t("Sesión cerrada"), "ok");
                  }}
                >
                  <IonIcon icon={logOutOutline} slot="start" />
                  {t("Cerrar sesión")}
                </IonButton>
                <IonButton
                  fill="clear"
                  expand="block"
                  className="pf-delete-account"
                  onClick={() => setDeleteOpen(true)}
                >
                  <IonIcon icon={trashOutline} slot="start" />
                  {t("Eliminar cuenta")}
                </IonButton>
                <div className="pf-signature">
                  <span aria-hidden="true" />
                  <span>COPP ADRESD</span>
                  <span aria-hidden="true" />
                </div>
                <p className="pf-closing">
                  {t("Tu bienestar empieza contigo.")}
                </p>
              </section>
            </div>
          </div>
        </Scroll>
        <IonModal
          isOpen={avatarOpen}
          aria-label={t("Mi Avatar")}
          onDidDismiss={() => setAvatarOpen(false)}
        >
          <AvatarPage onClose={() => setAvatarOpen(false)} />
        </IonModal>
        <IonAlert
          isOpen={deleteOpen}
          onDidDismiss={() => setDeleteOpen(false)}
          header={t("Eliminar cuenta")}
          message={t(
            "Para eliminar tu cuenta te llevaremos a nuestro sitio web, donde revisarás lo que implica y confirmarás la eliminación.",
          )}
          buttons={[
            { text: t("Cancelar"), role: "cancel" },
            {
              text: t("Continuar en la web"),
              role: "destructive",
              handler: openDeleteAccountWeb,
            },
          ]}
        />
        {notificationsOpen && (
          <NotificationsModal
            isOpen={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        )}
      </Screen>
    </MotionConfig>
  );
}
