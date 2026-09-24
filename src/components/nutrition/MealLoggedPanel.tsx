import { IonButton, IonIcon } from "@ionic/react";
import { checkmarkCircle } from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";

export interface MealLoggedPanelProps {
  /** Origen del log (la fuente cruda distinta de ai_photo cuenta como manual). */
  source: "manual" | "ai_photo" | null;
  /** ISO de creación del log para la hora honesta (null si ausente). */
  createdAt?: string | null;
  onDetail: () => void;
  onEdit: () => void;
}

/** Hora HH:mm del registro con el locale activo; null sin fecha válida. */
function formatLogTime(
  iso: string | null | undefined,
  locale: string,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Estado registrado de una tarjeta de comida: icono de verificación,
 * fuente del registro y hora real del log, más accesos a detalle y edición.
 * (Solo presentación: el check vive en el IonIcon, no en el texto.)
 */
export function MealLoggedPanel({
  source,
  createdAt,
  onDetail,
  onEdit,
}: MealLoggedPanelProps) {
  const { t, lang } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-ES";
  const time = formatLogTime(createdAt, locale);
  const status =
    source === "ai_photo"
      ? t("Registrado con foto · análisis IA")
      : source === "manual"
        ? t("Registrado manualmente")
        : t("Registrado");

  return (
    <div className="meal-logged">
      <div className="meal-logged-status">
        <IonIcon
          icon={checkmarkCircle}
          className="meal-logged-ico"
          aria-hidden="true"
        />
        <span className="meal-logged-label">
          {status}
          {time && <span className="meal-logged-time"> · {time}</span>}
        </span>
      </div>
      <div className="meal-logged-actions">
        <IonButton
          size="small"
          fill="outline"
          className="meal-logged-btn"
          onClick={onDetail}
        >
          {t("Ver detalle")}
        </IonButton>
        <IonButton
          size="small"
          className="meal-logged-btn meal-logged-btn-solid"
          onClick={onEdit}
        >
          {t("Editar comida")}
        </IonButton>
      </div>
    </div>
  );
}
