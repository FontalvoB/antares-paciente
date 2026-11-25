import { useId, useState } from "react";
import { IonButton, IonInput } from "@ionic/react";
import { arrowForwardOutline } from "ionicons/icons";
import { AuthSubmitButton } from "../../../../components/AuthSubmitButton";
import { useT } from "../../../../i18n/I18nContext";

export function EmailStep({
  email,
  onEmailChange,
  existingAccount,
  password,
  onPasswordChange,
  onSubmit,
  onBackToLogin,
  busy,
  error,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  existingAccount: boolean;
  password: string;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  onBackToLogin: () => void;
  busy: boolean;
  error?: string | null;
}) {
  const t = useT();
  const errorId = useId();
  const [submitted, setSubmitted] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const invalidEmail = submitted && !validEmail;
  const issue = invalidEmail ? "Ingresa un correo electrónico válido." : error;
  const disabled = busy || !email.trim() || (existingAccount && !password);

  return (
    <form
      className="wl-summary"
      noValidate
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        setSubmitted(true);
        if (validEmail) onSubmit();
      }}
    >
      <h2 className="wl-title">{t("Correo electrónico")}</h2>
      <IonInput
        className={
          invalidEmail ? "auth-input ion-invalid ion-touched" : "auth-input"
        }
        label={t("Correo electrónico")}
        labelPlacement="stacked"
        name="email"
        type="email"
        inputmode="email"
        autocomplete="username"
        autocapitalize="off"
        spellcheck={false}
        enterkeyhint={existingAccount ? "next" : "go"}
        required
        disabled={busy}
        aria-describedby={invalidEmail ? errorId : undefined}
        value={email}
        onIonInput={(event) => onEmailChange(event.detail.value ?? "")}
      />
      {existingAccount && (
        <IonInput
          className="auth-input"
          label={t("Contraseña")}
          labelPlacement="stacked"
          name="password"
          type="password"
          autocomplete="current-password"
          enterkeyhint="go"
          required
          disabled={busy}
          value={password}
          onIonInput={(event) => onPasswordChange(event.detail.value ?? "")}
        />
      )}
      {issue && (
        <p id={errorId} className="wl-note wl-note-danger" role="alert">
          {t(issue)}
        </p>
      )}
      <div className="wl-footer wl-footer-stack">
        <AuthSubmitButton
          type="submit"
          label={existingAccount ? t("Entrar") : t("Continuar")}
          busyLabel={
            existingAccount ? t("Iniciando sesión…") : t("Verificando correo…")
          }
          busy={busy}
          disabled={disabled}
          icon={arrowForwardOutline}
        />
        <IonButton
          fill="clear"
          disabled={busy}
          onClick={onBackToLogin}
          style={{ minHeight: 44 }}
        >
          {t("Volver al inicio de sesión")}
        </IonButton>
      </div>
    </form>
  );
}
