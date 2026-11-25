import { useEffect, useMemo, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { shieldCheckmarkOutline } from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useI18n } from "../i18n/I18nContext";
import type { UserProfile } from "../types";
import type {
  GateResult,
  ObjectiveDraft,
  OnboardingStage,
  WellnessEmergencyContact,
} from "../features/wellness/domain";
import {
  EMPTY_EMERGENCY_CONTACT,
  EMPTY_OBJECTIVE_DRAFT,
  WELLNESS_TERMS_VERSION,
  evaluateGate,
} from "../features/wellness/domain";
import { wellnessOnboardingService } from "../features/wellness/services/wellness-onboarding-service";
import {
  recordGenerationFailure,
  requestGeneration,
} from "../features/wellness/generation/generation-store";
import {
  localISODate,
  savePlanSnapshot,
} from "../features/wellness/state/wellness-home-store";
import { emergencyContactsError } from "../utils/emergencyContacts";
import {
  EmailStep,
  EmergencyStep,
  PasswordStep,
  TermsStep,
  WellnessStepper,
} from "../features/wellness/components/onboarding";
import { ObjectiveWizard } from "../features/wellness/components/objective";
import { SensitiveDataGate } from "../features/wellness/privacy/WellnessPrivacy";
import { wellnessPrivacyActor } from "../features/wellness/privacy/privacy-consent-store";
import "../features/wellness/wellness.css";

/** Pasos visibles del onboarding de 5 pasos (el objetivo es el quinto). */
const STEP_LABELS = [
  "Correo",
  "Emergencia",
  "Términos",
  "Contraseña",
  "Objetivo",
] as const;

const STAGE_INDEX: Record<OnboardingStage, number> = {
  email: 0,
  emergency: 1,
  terms: 2,
  password: 3,
  objective: 4,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseProfile(draft: ObjectiveDraft, email: string): UserProfile {
  const fallbackName = email.split("@")[0] || "Persona";
  return {
    nombre: draft.name.trim() || fallbackName,
    cedula: "",
    dob: "",
    seguro: "",
    poliza: "",
    grupo: "",
    email,
    celular: "",
    fam1Nombre: "",
    fam1Parentesco: "",
    fam1Cel: "",
    fam1Email: "",
    fam2Nombre: "",
    fam2Parentesco: "",
    fam2Cel: "",
    fam2Email: "",
  };
}

export function OnboardingPage() {
  const { user, finishWellnessOnboarding, backToLogin, showToast } = useApp();
  const { t } = useI18n();

  const [stage, setStage] = useState<OnboardingStage>("email");
  const [initialDraft] = useState<ObjectiveDraft>(
    () => wellnessOnboardingService.loadDraft() ?? EMPTY_OBJECTIVE_DRAFT,
  );
  const [email, setEmail] = useState(initialDraft.email);
  const [existingAccount, setExistingAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [primaryContact, setPrimaryContact] =
    useState<WellnessEmergencyContact>(EMPTY_EMERGENCY_CONTACT);
  const [secondaryContact, setSecondaryContact] =
    useState<WellnessEmergencyContact>(EMPTY_EMERGENCY_CONTACT);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [draft, setDraft] = useState<ObjectiveDraft>(initialDraft);
  const [gate, setGate] = useState<GateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const generationSubmitted = useRef(false);

  useEffect(() => {
    // Cada paso arranca arriba: al cambiar de pantalla el scroll anterior se
    // quedaba a mitad y el título del paso nuevo aparecía cortado.
    scrollRef.current?.scrollTo({ top: 0 });
  }, [stage]);

  const stepIndex = STAGE_INDEX[stage];

  const title = useMemo(() => {
    if (stage === "objective") return t("Cuéntanos tu objetivo");
    return t(STEP_LABELS[stepIndex]);
  }, [stage, stepIndex, t]);

  const subtitle = useMemo(() => {
    switch (stage) {
      case "email":
        return t("Entra con tu correo. Sin cédula y sin trámites.");
      case "emergency":
        return t("Una persona de confianza para avisarte si usas el SOS.");
      case "terms":
        return t("Lee y acepta para usar Agentic Wellness IA.");
      case "password":
        return t("Protege tu cuenta con una contraseña segura.");
      case "objective":
        return t("8 pasos cortos para armar tu plan de 365 días.");
    }
  }, [stage, t]);

  const submitEmail = async () => {
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      setError(t("Ingresa un correo electrónico válido."));
      return;
    }
    setBusy(true);
    try {
      if (existingAccount) {
        await wellnessOnboardingService.signIn(normalized, password);
        setDraft((prev) => ({ ...prev, email: normalized }));
        setStage("emergency");
        return;
      }
      const lookup = await wellnessOnboardingService.checkEmail(normalized);
      if (lookup.exists) {
        setExistingAccount(true);
        setError(
          t("Ya existe una cuenta con este correo. Ingresa tu contraseña."),
        );
        return;
      }
      setDraft((prev) => ({ ...prev, email: normalized }));
      setStage("emergency");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("No pudimos comprobar tu correo."),
      );
    } finally {
      setBusy(false);
    }
  };

  const continueFromEmergency = () => {
    const validation = emergencyContactsError(primaryContact, secondaryContact);
    if (validation) {
      setError(t(validation));
      return;
    }
    setError(null);
    setStage("terms");
  };

  const continueFromTerms = () => {
    if (!termsAccepted) {
      setError(
        t("Acepta los términos y el aviso de bienestar para continuar."),
      );
      return;
    }
    setError(null);
    // El aviso del paso 3 y el del wizard (paso 7) son el mismo documento:
    // se registra una sola aceptación versionada para no pedirla dos veces.
    const acceptedAt = new Date().toISOString();
    setDraft((prev) => {
      const next = {
        ...prev,
        terms: { version: WELLNESS_TERMS_VERSION, acceptedAt },
      };
      wellnessOnboardingService.saveDraft(next);
      return next;
    });
    setStage(existingAccount ? "objective" : "password");
  };

  const submitPassword = async () => {
    setError(null);
    setBusy(true);
    try {
      await wellnessOnboardingService.createAccount(
        email.trim().toLowerCase(),
        password,
      );
      setStage("objective");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("No pudimos crear tu cuenta."),
      );
    } finally {
      setBusy(false);
    }
  };

  const changeDraft = (patch: Partial<ObjectiveDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch, email: prev.email || email };
      wellnessOnboardingService.saveDraft(next);
      return next;
    });
    if (gate) setGate(null);
  };

  const generatePlan = async () => {
    if (generationSubmitted.current) return;
    generationSubmitted.current = true;
    let completed = false;
    setGenerating(true);
    setError(null);
    try {
      // Términos del paso 3 + términos del wizard (paso 7) son el mismo aviso.
      const withTerms: ObjectiveDraft = {
        ...draft,
        email: draft.email || email,
        terms:
          draft.terms ??
          (termsAccepted
            ? {
                version: WELLNESS_TERMS_VERSION,
                acceptedAt: new Date().toISOString(),
              }
            : null),
      };
      const localGate = evaluateGate(withTerms);
      if (!localGate.ok) {
        setGate(localGate);
        setDraft(withTerms);
        showToast(t("Revisa lo que falta para generar tu plan."), "warn");
        return;
      }
      const result = await wellnessOnboardingService.generatePlan(withTerms);
      setGate(result.status);
      setDraft(withTerms);
      if (result.status.ok && result.plan) {
        const now = new Date();
        wellnessOnboardingService.saveDraft(withTerms);
        const snapshot = savePlanSnapshot({
          name: withTerms.name.trim(),
          goal: result.plan.goal,
          startDate: localISODate(now),
          kcal: result.plan.kcal,
          proteinG: result.plan.proteinG,
          carbsG: result.plan.carbsG,
          fatG: result.plan.fatG,
          waterMl: result.plan.waterMl,
          totalDays: result.plan.totalDays,
          createdAt: now.toISOString(),
          // KAN-144: datos del objetivo para precargar el cambio desde Perfil.
          sex: withTerms.sex,
          age: withTerms.age,
          heightCm: withTerms.heightCm,
          weightKg: withTerms.weightKg,
          waistCm: withTerms.waistCm,
          targetWeightKg: withTerms.targetWeightKg,
          activity: withTerms.activity,
          pace: withTerms.pace,
          vegetarian: withTerms.vegetarian,
          dairyFree: withTerms.dairyFree,
        }, now);
        try {
          requestGeneration(snapshot);
        } catch {
          recordGenerationFailure(snapshot);
        }
        finishWellnessOnboarding({
          ...baseProfile(withTerms, email),
          fam1Nombre: primaryContact.name,
          fam1Parentesco: primaryContact.relationship,
          fam1Cel: primaryContact.phone,
          fam1Email: primaryContact.email,
          fam2Nombre: secondaryContact.name,
          fam2Parentesco: secondaryContact.relationship,
          fam2Cel: secondaryContact.phone,
          fam2Email: secondaryContact.email,
        });
        completed = true;
      }
    } catch {
      showToast(t("No pudimos generar tu plan. Intenta de nuevo."), "err");
    } finally {
      if (!completed) {
        generationSubmitted.current = false;
        setGenerating(false);
      }
    }
  };

  const goBack = () => {
    setError(null);
    switch (stage) {
      case "email":
        backToLogin();
        return;
      case "emergency":
        setStage("email");
        return;
      case "terms":
        setStage("emergency");
        return;
      case "password":
        setStage("terms");
        return;
      case "objective":
        setStage(existingAccount ? "terms" : "password");
        return;
      default:
        return;
    }
  };

  return (
    <div className="screen onb-page" style={{ background: "var(--g0)" }}>
      <header className="onb-head">
        <div className="onb-head-top">
          <div className="onb-head-brand">Copp Adresd</div>
        </div>
        <WellnessStepper current={stepIndex + 1} total={STEP_LABELS.length} />
        <h1 className="onb-head-title">{title}</h1>
        <p className="onb-head-sub">{subtitle}</p>
      </header>

      <div className="screen-scroll no-nav onb-body" ref={scrollRef}>
        <div className="onb-stack" key={stage}>
          {stage === "email" && (
            <EmailStep
              email={email}
              onEmailChange={setEmail}
              existingAccount={existingAccount}
              password={password}
              onPasswordChange={setPassword}
              onSubmit={() => void submitEmail()}
              onBackToLogin={backToLogin}
              busy={busy}
              error={error}
            />
          )}

          {stage === "emergency" && (
            <EmergencyStep
              primary={primaryContact}
              secondary={secondaryContact}
              onPrimaryChange={setPrimaryContact}
              onSecondaryChange={setSecondaryContact}
              onContinue={continueFromEmergency}
              onBack={goBack}
              disabled={busy}
            />
          )}

          {stage === "terms" && (
            <TermsStep
              accepted={termsAccepted}
              onAcceptedChange={(value) => {
                setTermsAccepted(value);
                setError(null);
              }}
              onContinue={continueFromTerms}
              onBack={goBack}
              disabled={busy}
            />
          )}

          {stage === "password" && (
            <PasswordStep
              password={password}
              confirm={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirmPassword}
              onSubmit={() => void submitPassword()}
              onBack={goBack}
              busy={busy}
              error={error}
            />
          )}

          {stage === "objective" && (
            <SensitiveDataGate actor={wellnessPrivacyActor({ id: user.id, email })} onBack={goBack}>
              <ObjectiveWizard
                draft={draft}
                onChange={changeDraft}
                gate={gate}
                generating={generating}
                onGenerate={() => void generatePlan()}
                onExit={goBack}
              />
            </SensitiveDataGate>
          )}

          {error && stage !== "email" && stage !== "password" && (
            <p
              role="alert"
              className="wl-note wl-note-danger"
              style={{ marginTop: 12 }}
            >
              {error}
            </p>
          )}

          <div className="wl-note wl-note-info" style={{ marginTop: 16 }}>
            <IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />
            <span>
              {t(
                "Información general de bienestar. Consulta a un profesional de la salud para recibir orientación personal. En una emergencia llama al 911.",
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
