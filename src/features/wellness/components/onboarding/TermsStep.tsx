import { useState } from "react";
import { IonBadge, IonButton, IonCheckbox } from "@ionic/react";
import { useI18n } from "../../../../i18n/I18nContext";
import { formatLocalizedDate, toLocalISODate } from "../../../../utils/dates";
import { WELLNESS_TERMS_VERSION } from "../../domain";

export function TermsStep({
  accepted,
  onAcceptedChange,
  onContinue,
  onBack,
  disabled = false,
}: {
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const { t, lang } = useI18n();
  const [displayDate, setDisplayDate] = useState(() => new Date());
  const date = formatLocalizedDate(toLocalISODate(displayDate), lang);
  const time = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-ES", {
    timeStyle: "short",
  }).format(displayDate);

  return (
    <section className="wl-summary">
      <h2 className="wl-title">{t("Términos de bienestar")}</h2>
      <div className="wl-chips">
        <IonBadge color="primary">
          {t("Versión {version}", { version: WELLNESS_TERMS_VERSION })}
        </IonBadge>
        <time className="wl-sub" dateTime={displayDate.toISOString()}>
          {t("Fecha y hora local: {date}, {time}", { date, time })}
        </time>
      </div>
      <p className="wl-sub">
        {t("El plan ofrece sugerencias generales de bienestar sobre alimentación, movimiento e hidratación. Úsalo como guía para tus hábitos diarios.")}
      </p>
      <p className="wl-note wl-note-info">
        {t("Para recibir orientación individual, consulta con un profesional de salud. Si tienes una emergencia, llama a los servicios de emergencia de tu localidad.")}
      </p>
      <IonCheckbox
        checked={accepted}
        disabled={disabled}
        labelPlacement="end"
        justify="start"
        style={{ minHeight: 44, whiteSpace: "normal" }}
        onIonChange={(event) => {
          setDisplayDate(new Date());
          onAcceptedChange(event.detail.checked);
        }}
      >
        {t("He leído y acepto los términos de bienestar.")}
      </IonCheckbox>
      <div className="wl-footer">
        <IonButton fill="outline" disabled={disabled} onClick={onBack} style={{ minHeight: 44 }}>
          {t("Volver")}
        </IonButton>
        <IonButton disabled={disabled || !accepted} onClick={onContinue} style={{ minHeight: 44 }}>
          {t("Continuar")}
        </IonButton>
      </div>
    </section>
  );
}
