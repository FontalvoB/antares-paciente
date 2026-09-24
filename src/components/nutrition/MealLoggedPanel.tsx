import { IonButton } from "@ionic/react";
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
 * Estado registrado de una tarjeta de comida: check verde, fuente del
 * registro y hora real del log, más accesos a detalle y edición.
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
      ? t("✓ Registrado con foto · análisis IA")
      : source === "manual"
        ? t("✓ Registrado manualmente")
        : t("✓ Registrado");

  return (
    <div
      style={{
        margin: 12,
        background: "var(--teal-l)",
        borderRadius: 12,
        padding: 12,
        color: "#0F6E56",
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      <div
        style={{
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "var(--teal)",
            color: "#fff",
            fontSize: 13,
          }}
          aria-hidden="true"
        >
          ✓
        </span>
        <span style={{ flex: 1 }}>
          {status}
          {time && (
            <span style={{ fontWeight: 400, opacity: 0.8 }}> · {time}</span>
          )}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <IonButton
          size="small"
          fill="outline"
          style={{ flex: 1, minHeight: 44 }}
          onClick={onDetail}
        >
          {t("Ver detalle")}
        </IonButton>
        <IonButton
          size="small"
          fill="outline"
          style={{ flex: 1, minHeight: 44 }}
          onClick={onEdit}
        >
          {t("Editar comida")}
        </IonButton>
      </div>
    </div>
  );
}
