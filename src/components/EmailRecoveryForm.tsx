import { useState } from "react";
import { IonButton, IonIcon, IonInput } from "@ionic/react";
import { arrowForward, mailOutline } from "ionicons/icons";
import { useI18n } from "../i18n/I18nContext";
import { HttpStatusError, requestPasswordReset } from "../utils/authApi";
import { AuthSubmitButton } from "./AuthSubmitButton";

interface Props {
  initialEmail: string;
  onBack: () => void;
  onUseLegacyRecovery: () => void;
}

export function EmailRecoveryForm({ initialEmail, onBack, onUseLegacyRecovery }: Props) {
  const { lang, t } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"accepted" | "error" | null>(null);

  async function submit() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      await requestPasswordReset(email, lang);
      setResult("accepted");
    } catch (error) {
      if (error instanceof HttpStatusError && [404, 405, 503].includes(error.status)) {
        onUseLegacyRecovery();
        return;
      }
      setResult("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="auth-head">
        <h1 className="auth-head-title">{t("Recupera tu contraseña")}</h1>
      </header>
      <form
        className="auth-form"
        aria-label={t("Recuperar contraseña")}
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="auth-field">
          <label id="recovery-email-label" htmlFor="recovery-email">{t("Correo electrónico")}</label>
          <IonInput
            id="recovery-email"
            aria-labelledby="recovery-email-label"
            className="auth-input auth-input-icon"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder={t("nombre@example.com")}
            enterkeyhint="go"
            autocapitalize="off"
            spellcheck={false}
            required
            maxlength={256}
            readonly={busy}
            value={email}
            onIonInput={(event) => {
              setEmail(event.detail.value ?? "");
              setResult(null);
            }}
          >
            <IonIcon slot="start" icon={mailOutline} className="auth-input-ico" aria-hidden="true" />
          </IonInput>
        </div>
        {result === "accepted" && (
          <p role="status" className="auth-head-sub">
            {t("Si hay una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.")}
          </p>
        )}
        {result === "error" && (
          <p role="alert" className="auth-alert">
            {t("No pudimos solicitar el enlace. Intenta de nuevo.")}
          </p>
        )}
        <AuthSubmitButton
          type="submit"
          label={t("Enviar enlace")}
          busyLabel={t("Enviando enlace…")}
          busy={busy}
          disabled={!email.trim()}
          icon={arrowForward}
        />
        <IonButton type="button" fill="clear" className="auth-link-btn" disabled={busy} onClick={onBack}>
          {t("Volver al inicio de sesión")}
        </IonButton>
        <IonButton type="button" fill="clear" className="auth-link-btn" disabled={busy} onClick={onUseLegacyRecovery}>
          {t("Recuperar con identificación")}
        </IonButton>
      </form>
    </>
  );
}
