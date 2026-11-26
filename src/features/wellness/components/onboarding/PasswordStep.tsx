import { useId, useState } from "react";
import { IonButton, IonInput, IonProgressBar } from "@ionic/react";
import { arrowForwardOutline } from "ionicons/icons";
import { AuthSubmitButton } from "../../../../components/AuthSubmitButton";
import { useT } from "../../../../i18n/I18nContext";

export function PasswordStep({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
  onBack,
  busy,
  error,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  busy: boolean;
  error?: string | null;
}) {
  const t = useT();
  const requirementsId = useId();
  const mismatchId = useId();
  const [confirmVisited, setConfirmVisited] = useState(false);
  const requirements = [
    { label: t("8 caracteres o más"), met: password.length >= 8 },
    { label: t("Una mayúscula"), met: /\p{Lu}/u.test(password) },
    { label: t("Un número"), met: /\d/.test(password) },
    { label: t("Un símbolo (!, #, $)"), met: /[\p{P}\p{S}]/u.test(password) },
  ];
  const metCount = requirements.filter(({ met }) => met).length;
  const mismatch = confirmVisited && !!confirm && confirm !== password;
  const disabled = busy || metCount !== requirements.length || password !== confirm;

  return (
    <form
      className="wl-summary"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      <h2 className="wl-title">{t("Crea tu contraseña")}</h2>
      <IonInput
        className="auth-input"
        label={t("Nueva contraseña")}
        labelPlacement="stacked"
        name="new-password"
        type="password"
        autocomplete="new-password"
        enterkeyhint="next"
        required
        disabled={busy}
        aria-describedby={requirementsId}
        value={password}
        onIonInput={(event) => onPasswordChange(event.detail.value ?? "")}
      />
      <div id={requirementsId}>
        <p className="wl-sub">{t("Fuerza de la contraseña")}</p>
        <IonProgressBar
          aria-label={t("Fuerza de la contraseña")}
          aria-valuetext={t("{count} de {total} requisitos cumplidos", {
            count: String(metCount),
            total: String(requirements.length),
          })}
          value={metCount / requirements.length}
        />
        <ul className="wl-sub">
          {requirements.map(({ label, met }) => (
            <li key={label}>
              {met ? t("{requirement} · Cumplido", { requirement: label }) : label}
            </li>
          ))}
        </ul>
      </div>
      <IonInput
        className={mismatch ? "auth-input ion-invalid ion-touched" : "auth-input"}
        label={t("Confirmar contraseña")}
        labelPlacement="stacked"
        name="confirm-password"
        type="password"
        autocomplete="new-password"
        enterkeyhint="done"
        required
        disabled={busy}
        value={confirm}
        aria-describedby={mismatch ? mismatchId : undefined}
        onIonBlur={() => setConfirmVisited(true)}
        onIonInput={(event) => onConfirmChange(event.detail.value ?? "")}
      />
      {mismatch && <p id={mismatchId} className="wl-note wl-note-danger" role="alert">{t("Las contraseñas no coinciden.")}</p>}
      {error && <p className="wl-note wl-note-danger" role="alert">{t(error)}</p>}
      <div className="wl-footer wl-footer-stack">
        <AuthSubmitButton
          type="submit"
          label={t("Crear cuenta")}
          busyLabel={t("Creando cuenta…")}
          busy={busy}
          disabled={disabled}
          icon={arrowForwardOutline}
        />
        <IonButton fill="clear" disabled={busy} onClick={onBack} style={{ minHeight: 44 }}>
          {t("Volver")}
        </IonButton>
      </div>
    </form>
  );
}
