import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import type { CSSProperties } from "react";

interface Props {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  /** Icono Ionicons de la cápsula derecha. */
  icon: string;
  type?: "button" | "submit";
  onAct?: () => void;
  ariaLabel?: string;
  style?: CSSProperties;
}

/**
 * CTA principal del acceso: una sola receta visual para el login y los pasos
 * de activación. Sustituye el gesto de deslizar, que añadía fricción y
 * ambigüedad a una acción que no es destructiva; aquí la acción es explícita
 * y accesible con teclado y lector de pantalla.
 */
export function AuthSubmitButton({
  label,
  busyLabel,
  busy,
  disabled = false,
  icon,
  type = "button",
  onAct,
  ariaLabel,
  style,
}: Props) {
  const isDisabled = disabled || busy;
  const className = `auth-submit${busy ? " is-busy" : ""}${
    !busy && disabled ? " is-disabled" : ""
  }`;

  return (
    <IonButton
      type={type}
      expand="block"
      className={className}
      disabled={isDisabled}
      aria-label={ariaLabel}
      onClick={onAct}
      style={style}
    >
      <span className="auth-submit-label" aria-live="polite">
        {busy ? busyLabel : label}
      </span>
      <span className="auth-submit-arrow" aria-hidden="true">
        {busy ? <IonSpinner name="crescent" /> : <IonIcon icon={icon} />}
      </span>
    </IonButton>
  );
}
