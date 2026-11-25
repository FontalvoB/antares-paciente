import { IonNote } from "@ionic/react";
import { useI18n } from "../../i18n/I18nContext";

const notices = {
  exercise: "Contenido general de bienestar. Antes de empezar o cambiar tu rutina de ejercicio, consulta a un profesional de la salud. Si sientes dolor intenso o mareo, detén la actividad.",
  diet: "Plan general de alimentación, solo informativo. Antes de cambiar tu alimentación, consulta a un profesional de la salud.",
  vitals: "Tus registros son informativos y no reemplazan la orientación de un profesional de la salud. Consúltalo ante cualquier duda.",
} as const;

export function WellnessGuidance({
  kind,
  className,
}: {
  kind: keyof typeof notices;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <IonNote role="note" color="dark" className={className} style={{ display: "block" }}>
      {t(notices[kind])}
    </IonNote>
  );
}
