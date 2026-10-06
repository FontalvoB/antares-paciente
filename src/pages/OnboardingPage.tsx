import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
} from "@ionic/react";
import {
  calendarOutline,
  callOutline,
  checkmark,
  checkmarkCircle,
  documentTextOutline,
  eye,
  eyeOff,
  lockClosedOutline,
  medkitOutline,
  peopleOutline,
  personOutline,
  shieldCheckmarkOutline,
  walletOutline,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
import { Mascot } from "../components/Mascot";
import { formatDateForDisplay } from "../utils/dates";
import {
  fetchInsurers,
  fetchMyPatientProfile,
  toUserProfile,
  updateMyPatientProfile,
} from "../utils/patientProfileApi";
import { setFirstPassword } from "../utils/authApi";
import { PARENTESCO } from "../data/emergencyContact";
import type { UserProfile } from "../types";

export function OnboardingPage() {
  const { finishOnboarding, showToast, backToLogin } = useApp();
  const t = useT();
  const [step, setStep] = useState(1);

  const STEPS = [
    {
      title: t("Tus datos"),
      sub: t("Así te identifica el equipo médico"),
      name: t("Identidad"),
    },
    {
      title: t("Contacto de emergencia"),
      sub: t("A quién avisamos si activas SOS"),
      name: t("Familia"),
    },
    {
      title: t("Consentimiento"),
      sub: t("Lee y acepta tu autorización"),
      name: t("HIPAA"),
    },
    {
      title: t("Crea tu contraseña"),
      sub: t("Protege tu expediente médico"),
      name: t("Seguridad"),
    },
  ];
  const [done, setDone] = useState(false);
  const [checks, setChecks] = useState([false, false, false]);
  const [dateOpen, setDateOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  /** Guardando el perfil en el backend (paso final). */
  const [saving, setSaving] = useState(false);
  /** Catálogo de aseguradoras administrado por el ERP (GET /api/v1/insurers). */
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<UserProfile>({
    nombre: "",
    cedula: "",
    dob: "",
    seguro: "",
    poliza: "",
    grupo: "",
    email: "",
    celular: "",
    fam1Nombre: "",
    fam1Parentesco: "",
    fam1Cel: "",
    fam1Email: "",
  });
  const TOTAL_STEPS = STEPS.length;

  const set = (k: keyof UserProfile, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Prefill del perfil real (si existe) y catálogo de aseguradoras del ERP.
  // El 404 es el estado esperado en el primer acceso (aún no hay perfil editable).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dto = await fetchMyPatientProfile();
        if (!cancelled) setForm((f) => ({ ...f, ...toUserProfile(dto) }));
      } catch {
        /* primer acceso: el backend aún no expone perfil (ERP creó al paciente) */
      }
    })();
    void (async () => {
      try {
        const list = await fetchInsurers();
        if (!cancelled) setInsurers(list);
      } catch {
        /* sin catálogo: el select queda vacío y el seguro no se persiste */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step, done]);

  /**
   * Persiste el onboarding: contraseña inicial (si la definió) + perfil del
   * paciente vía PUT /me/patient-profile. Si el backend rechaza, el usuario
   * NO pierde lo escrito (el form permanece) y puede reintentar (spec FASE 2).
   */
  const persistOnboarding = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (pwd) await setFirstPassword(pwd);
      const insurerId =
        insurers.find((i) => i.name === form.seguro)?.id ?? null;
      await updateMyPatientProfile({
        dateOfBirth: form.dob || null,
        email: form.email,
        phone: form.celular,
        emergencyName: form.fam1Nombre,
        emergencyRelationship: form.fam1Parentesco,
        emergencyPhone: form.fam1Cel,
        emergencyEmail: form.fam1Email,
        insurerId,
        memberId: form.poliza,
      });
      finishOnboarding(form);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("No se pudo guardar tu perfil"),
        "err",
      );
    } finally {
      setSaving(false);
    }
  };

  const pwdOk =
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /\d/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd);
  const strength = useMemo(() => {
    let s = 0;
    if (pwd.length >= 8) s += 25;
    if (/[A-Z]/.test(pwd)) s += 25;
    if (/\d/.test(pwd)) s += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) s += 25;
    return s;
  }, [pwd]);
  const strengthLbl =
    strength < 50 ? "Débil" : strength < 100 ? "Aceptable" : "Fuerte";
  const strengthColor =
    strength < 50
      ? "var(--red)"
      : strength < 100
        ? "var(--org)"
        : "var(--teal)";

  const next = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!form.fam1Nombre || !form.fam1Cel) {
        showToast(t("El familiar principal es obligatorio"), "err");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!checks.every(Boolean)) {
        showToast(t("Acepta los términos para continuar"), "warn");
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      if (!pwdOk || pwd !== pwd2) {
        showToast(t("La contraseña no cumple los requisitos"), "err");
        return;
      }
      setDone(true);
    }
  };

  const back = () => {
    if (step === 1) {
      backToLogin();
      return;
    }
    setStep((s) => s - 1);
  };

  const meta = STEPS[step - 1];
  const cta = done
    ? t("Entrar")
    : step === 4
      ? t("Crear cuenta")
      : t("Continuar");

  return (
    <div className="screen onb-page" style={{ background: "var(--g0)" }}>
      <header className="onb-head">
        <div className="onb-head-top">
          <div className="onb-head-brand">Copp Adresd</div>
          {!done && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mu)" }}>
              {step} / {TOTAL_STEPS}
            </span>
          )}
        </div>
        {!done && (
          <div
            className="onb-stepper"
            aria-label={`Paso ${step} de ${TOTAL_STEPS}`}
          >
            {STEPS.map((s, i) => {
              const n = i + 1;
              return (
                <span key={s.name} style={{ display: "contents" }}>
                  {i > 0 && (
                    <span
                      className={`onb-stepper-line ${n <= step ? "done" : ""}`}
                    />
                  )}
                  <span
                    className={`onb-stepper-dot ${n < step ? "done" : n === step ? "now" : ""}`}
                  >
                    {n < step ? <IonIcon icon={checkmark} /> : n}
                  </span>
                </span>
              );
            })}
          </div>
        )}
        <h1 className="onb-head-title">
          {done ? t("Cuenta lista") : meta.title}
        </h1>
        <p className="onb-head-sub">
          {done
            ? t("Bienvenida al programa, {name}.", {
                name: form.nombre.split(" ")[0],
              })
            : meta.sub}
        </p>
      </header>

      <div className="screen-scroll no-nav onb-body" ref={scrollRef}>
        <div className="onb-stack" key={done ? "done" : `${step}`}>
          {done ? (
            <div className="onb-done">
              <Mascot pose="success" className="mascot-onb" />
              <div className="onb-done-badge" aria-hidden="true">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <div
                className="display"
                style={{ fontSize: 22, fontWeight: 700 }}
              >
                {t("Registro completado")}
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--mu)",
                  lineHeight: 1.55,
                  margin: "8px 16px 0",
                }}
              >
                {t("Tu perfil COPP-ADRESD quedó activo. Semana 12 de 24.")}
              </p>
              <div className="onb-done-list">
                {[
                  t("Identidad confirmada"),
                  t("Emergencia: {name}", { name: form.fam1Nombre }),
                  t("Consentimiento HIPAA aceptado"),
                  t("Contraseña segura"),
                ].map((item) => (
                  <div key={item}>
                    <IonIcon icon={checkmarkCircle} />
                    {item}
                  </div>
                ))}
              </div>
              <IonButton
                expand="block"
                className="bt bt-primary"
                disabled={saving}
                onClick={() => void persistOnboarding()}
              >
                {saving ? t("Guardando…") : t("Entrar a Copp Adresd")}
              </IonButton>
            </div>
          ) : (
            <>
              {step === 1 && (
                <>
                  <section className="onb-card tone-teal">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-teal">
                        <IonIcon icon={personOutline} />
                      </span>
                      <div>
                        <strong>Datos personales</strong>
                        <span>Como aparecen en tu documento</span>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-nombre">{t("Nombre completo")}</label>
                      <IonInput
                        id="onb-nombre"
                        className="fld"
                        value={form.nombre}
                        autocomplete="name"
                        enterkeyhint="next"
                        onIonInput={(e) => set("nombre", e.detail.value ?? "")}
                      />
                    </div>
                    <div className="onb-grid-2">
                      <div className="field">
                        <label htmlFor="onb-cedula">{t("Cédula / ID")}</label>
                        <IonInput
                          id="onb-cedula"
                          className="fld"
                          value={form.cedula}
                          inputmode="numeric"
                          enterkeyhint="next"
                          onIonInput={(e) =>
                            set("cedula", e.detail.value ?? "")
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="onb-dob">
                          {t("Fecha de nacimiento")}
                        </label>
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
                      <span className="onb-card-ico tone-ice">
                        <IonIcon icon={walletOutline} />
                      </span>
                      <div>
                        <strong>{t("Seguro médico")}</strong>
                        <span>{t("Para copagos y autorizaciones")}</span>
                      </div>
                    </div>
                    <div className="field">
                      <label>{t("Aseguradora")}</label>
                      <IonSelect
                        className="fld"
                        interface="popover"
                        value={form.seguro}
                        onIonChange={(e) =>
                          set("seguro", e.detail.value as string)
                        }
                      >
                        {[
                          "BlueCross BlueShield",
                          "Aetna",
                          "UnitedHealth",
                          "Cigna",
                          "Medicare Part B",
                          "Medicaid",
                        ]
                          .concat(insurers.map((i) => i.name))
                          .filter((s, i, arr) => arr.indexOf(s) === i)
                          .map((s) => (
                            <IonSelectOption key={s} value={s}>
                              {s}
                            </IonSelectOption>
                          ))}
                      </IonSelect>
                    </div>
                    <div className="onb-grid-2">
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="onb-poliza">{t("N.º de póliza")}</label>
                        <IonInput
                          id="onb-poliza"
                          className="fld"
                          value={form.poliza}
                          enterkeyhint="next"
                          onIonInput={(e) =>
                            set("poliza", e.detail.value ?? "")
                          }
                        />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="onb-grupo">{t("Grupo")}</label>
                        <IonInput
                          id="onb-grupo"
                          className="fld"
                          value={form.grupo}
                          enterkeyhint="next"
                          onIonInput={(e) => set("grupo", e.detail.value ?? "")}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="onb-card tone-teal">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-teal">
                        <IonIcon icon={callOutline} />
                      </span>
                      <div>
                        <strong>{t("Cómo te contactamos")}</strong>
                        <span>{t("Correo y celular de la cuenta")}</span>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-email">
                        {t("Correo electrónico")}
                      </label>
                      <IonInput
                        id="onb-email"
                        className="fld"
                        type="email"
                        inputmode="email"
                        autocomplete="email"
                        enterkeyhint="next"
                        value={form.email}
                        onIonInput={(e) => set("email", e.detail.value ?? "")}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="onb-cel">{t("Celular / WhatsApp")}</label>
                      <IonInput
                        id="onb-cel"
                        className="fld"
                        type="tel"
                        inputmode="tel"
                        autocomplete="tel"
                        enterkeyhint="done"
                        value={form.celular}
                        onIonInput={(e) => set("celular", e.detail.value ?? "")}
                      />
                    </div>
                  </section>

                  <div className="onb-trust onb-trust-safe">
                    <IonIcon icon={shieldCheckmarkOutline} />
                    <span>
                      {t(
                        "Tus datos viajan cifrados (TLS 1.3) y se tratan como PHI bajo HIPAA.",
                      )}
                    </span>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="onb-trust onb-trust-warn">
                    <IonIcon icon={medkitOutline} />
                    <span>
                      {t(
                        "Si activas SOS, avisamos a esta persona, al médico y a emergencias. No se usa para marketing.",
                      )}
                    </span>
                  </div>

                  <section className="onb-card tone-panic">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-panic">
                        <IonIcon icon={peopleOutline} />
                      </span>
                      <div>
                        <strong>{t("Cuidador principal")}</strong>
                        <span>{t("Obligatorio para activar el programa")}</span>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-fam-nom">{t("Nombre")}</label>
                      <IonInput
                        id="onb-fam-nom"
                        className="fld"
                        value={form.fam1Nombre}
                        autocomplete="name"
                        enterkeyhint="next"
                        onIonInput={(e) =>
                          set("fam1Nombre", e.detail.value ?? "")
                        }
                      />
                    </div>
                    <div className="field">
                      <label>{t("Parentesco")}</label>
                      <div
                        className="chips"
                        style={{ marginTop: 0, marginBottom: 4 }}
                      >
                        {PARENTESCO.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`chip ${form.fam1Parentesco === p ? "chip-teal" : "chip-glass"}`}
                            style={
                              form.fam1Parentesco === p
                                ? undefined
                                : {
                                    background: "var(--g0)",
                                    border: "1px solid var(--bd)",
                                    color: "var(--mu)",
                                  }
                            }
                            onClick={() => set("fam1Parentesco", p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="onb-fam-cel">{t("Celular")}</label>
                      <IonInput
                        id="onb-fam-cel"
                        className="fld"
                        type="tel"
                        inputmode="tel"
                        enterkeyhint="next"
                        value={form.fam1Cel}
                        onIonInput={(e) => set("fam1Cel", e.detail.value ?? "")}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="onb-fam-mail">
                        {t("Correo (opcional)")}
                      </label>
                      <IonInput
                        id="onb-fam-mail"
                        className="fld"
                        type="email"
                        inputmode="email"
                        enterkeyhint="done"
                        value={form.fam1Email}
                        onIonInput={(e) =>
                          set("fam1Email", e.detail.value ?? "")
                        }
                      />
                    </div>
                  </section>

                  <section
                    className="onb-card"
                    style={{
                      background: "linear-gradient(145deg,#102a50,#173c73)",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        color: "var(--ice)",
                        marginBottom: 8,
                      }}
                    >
                      {t("Vista previa SOS")}
                    </div>
                    <div
                      style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.92 }}
                    >
                      {t(
                        "“{name} ({relation}) recibirá una alerta en {cell} si activas pánico.”",
                        {
                          name: form.fam1Nombre || "Tu familiar",
                          relation: form.fam1Parentesco,
                          cell: form.fam1Cel || "su celular",
                        },
                      )}
                    </div>
                  </section>
                </>
              )}

              {step === 3 && (
                <>
                  <section className="onb-card tone-teal">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-teal">
                        <IonIcon icon={documentTextOutline} />
                      </span>
                      <div>
                        <strong>{t("Consentimiento informado")}</strong>
                        <span>{t("COPP-ADRESD · 24 semanas")}</span>
                      </div>
                    </div>
                    <div className="onb-doc">
                      <strong style={{ color: "var(--tx)" }}>
                        {t("Programa de medicina preventiva")}
                      </strong>
                      <p style={{ margin: "8px 0 0" }}>
                        {t(
                          "Tus datos son PHI según HIPAA. FYA TECH SAS actúa como Business Associate. Los datos biométricos se cifran con AES-256. Las fotos de comida se eliminan en 24 h. Autorizas el contacto de emergencia si activas SOS.",
                        )}
                      </p>
                    </div>
                    {[
                      t("He leído y acepto el consentimiento informado."),
                      t(
                        "Autorizo el manejo de mis datos de salud según HIPAA.",
                      ),
                      t("Autorizo notificar a mis contactos de emergencia."),
                    ].map((t, i) => (
                      <button
                        key={t}
                        type="button"
                        className={`check-row ${checks[i] ? "on" : ""}`}
                        onClick={() =>
                          setChecks((c) => c.map((x, j) => (j === i ? !x : x)))
                        }
                      >
                        <IonCheckbox
                          checked={checks[i]}
                          onClick={(e) => e.stopPropagation()}
                          onIonChange={(e) =>
                            setChecks((c) =>
                              c.map((x, j) => (j === i ? e.detail.checked : x)),
                            )
                          }
                        />
                        <span
                          style={{
                            fontSize: 13,
                            lineHeight: 1.45,
                            textAlign: "left",
                          }}
                        >
                          {t}
                        </span>
                      </button>
                    ))}
                  </section>
                </>
              )}

              {step === 4 && (
                <>
                  <section className="onb-card tone-org">
                    <div className="onb-card-head">
                      <span className="onb-card-ico tone-org">
                        <IonIcon icon={lockClosedOutline} />
                      </span>
                      <div>
                        <strong>{t("Contraseña de la cuenta")}</strong>
                        <span>
                          {t("Úsala para entrar desde cualquier dispositivo")}
                        </span>
                      </div>
                    </div>
                    <div className="field onb-pwd">
                      <label htmlFor="onb-pwd">{t("Nueva contraseña")}</label>
                      <IonInput
                        id="onb-pwd"
                        className="fld"
                        type={showPwd ? "text" : "password"}
                        value={pwd}
                        autocomplete="new-password"
                        enterkeyhint="next"
                        style={{ "--padding-end": "48px" } as CSSProperties}
                        onIonInput={(e) => setPwd(e.detail.value ?? "")}
                      />
                      <IonButton
                        type="button"
                        fill="clear"
                        className="fld-eye"
                        aria-label={
                          showPwd
                            ? t("Ocultar contraseña")
                            : t("Mostrar contraseña")
                        }
                        onClick={() => setShowPwd((v) => !v)}
                      >
                        <IonIcon icon={showPwd ? eyeOff : eye} />
                      </IonButton>
                      <div className="onb-strength">
                        <span>{t("Seguridad")}</span>
                        <span style={{ color: strengthColor }}>
                          {pwd ? t(strengthLbl) : "—"}
                        </span>
                      </div>
                      <IonProgressBar
                        className="pb"
                        style={
                          {
                            marginTop: 6,
                            "--progress-background": strengthColor,
                          } as CSSProperties
                        }
                        value={strength / 100}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="onb-pwd2">
                        {t("Confirmar contraseña")}
                      </label>
                      <IonInput
                        id="onb-pwd2"
                        className="fld"
                        type={showPwd ? "text" : "password"}
                        value={pwd2}
                        autocomplete="new-password"
                        enterkeyhint="done"
                        onIonInput={(e) => setPwd2(e.detail.value ?? "")}
                      />
                      {pwd2.length > 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            marginTop: 6,
                            color:
                              pwd === pwd2 ? "var(--teal-d)" : "var(--red)",
                            fontWeight: 600,
                          }}
                        >
                          {pwd === pwd2
                            ? t("Las contraseñas coinciden")
                            : t("Las contraseñas no coinciden")}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="onb-card tone-teal">
                    <div className="onb-req">
                      {[
                        [pwd.length >= 8, t("Mínimo 8 caracteres")],
                        [/[A-Z]/.test(pwd), t("Una letra mayúscula")],
                        [/\d/.test(pwd), t("Un número")],
                        [/[^A-Za-z0-9]/.test(pwd), t("Un carácter especial")],
                      ].map(([ok, label]) => (
                        <div
                          key={String(label)}
                          className={`onb-req-item ${ok ? "on" : ""}`}
                        >
                          <span className="onb-req-dot">{ok ? "✓" : ""}</span>
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
              {step === 1 ? t("Cancelar") : t("Volver")}
            </IonButton>
            <IonButton expand="block" className="bt bt-primary" onClick={next}>
              {cta}
            </IonButton>
          </div>
        </div>
      )}

      <IonModal
        isOpen={dateOpen}
        onDidDismiss={() => setDateOpen(false)}
        className="date-modal"
      >
        <div
          style={{
            padding: "12px 16px 0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
          }}
        >
          <IonIcon icon={calendarOutline} />
          {t("Fecha de nacimiento")}
        </div>
        <IonDatetime
          presentation="date"
          locale="es-ES"
          value={form.dob}
          onIonChange={(e) => set("dob", String(e.detail.value).split("T")[0])}
        />
        <div style={{ padding: "0 16px 16px" }}>
          <IonButton
            expand="block"
            className="bt bt-primary"
            onClick={() => setDateOpen(false)}
          >
            {t("Listo")}
          </IonButton>
        </div>
      </IonModal>
    </div>
  );
}
