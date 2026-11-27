import { useState } from "react";
import { IonButton, IonIcon } from "@ionic/react";
import { arrowForward, chevronForward, fitnessOutline, medicalOutline, moonOutline, nutritionOutline } from "ionicons/icons";
import nutritionPhoto from "../../../assets/home/shortcut-nutrition.webp";
import exercisePhoto from "../../../assets/home/shortcut-exercise.webp";
import sleepPhoto from "../../../assets/home/shortcut-sleep.webp";
import medicationsPhoto from "../../../assets/home/shortcut-medications.webp";
import { useApp } from "../../../context/AppContext";
import { useI18n } from "../../../i18n/I18nContext";
import { WellnessPreview } from "./WellnessFrame";

const shortcuts = [
  { title: "Nutrición", description: "Planifica, come y logra tus metas", image: nutritionPhoto, icon: nutritionOutline, screen: "wellness-diet" },
  { title: "Rutina de ejercicios", description: "Entrena a tu ritmo", image: exercisePhoto, icon: fitnessOutline, screen: "wellness-exercise" },
  { title: "Sueño", description: "Registra tu descanso", image: sleepPhoto, icon: moonOutline, screen: "wellness-checkin" },
  { title: "Medicamentos", description: "Próximamente", image: medicationsPhoto, icon: medicalOutline, screen: null },
] as const;

export function WellnessQuickAccess() {
  const { t } = useI18n();
  const { navigate } = useApp();
  const [medicationsOpen, setMedicationsOpen] = useState(false);
  return (
    <section className="wh-quick" aria-labelledby="wh-quick-title">
      <div className="wh-quick-header">
        <h2 id="wh-quick-title">{t("Accesos rápidos")}</h2>
        <IonButton fill="clear" className="wh-quick-all" onClick={() => navigate("wellness-plan")}>
          {t("Ver todos")}
          <IonIcon slot="end" icon={arrowForward} aria-hidden="true" />
        </IonButton>
      </div>
      <div className="wh-quick-grid">
        {shortcuts.map(({ title, description, image, icon, screen }) => (
          <IonButton
            key={title}
            className="wh-shortcut"
            fill="clear"
            aria-label={t(title)}
            aria-description={t(description)}
            aria-haspopup={screen ? undefined : "dialog"}
            onClick={() => screen ? navigate(screen) : setMedicationsOpen(true)}
          >
            <span className="wh-shortcut-content">
              <img className="wh-shortcut-photo" src={image} alt="" width="640" height="360" />
              <span className="wh-shortcut-copy">
                <span className="wh-shortcut-badge"><IonIcon icon={icon} aria-hidden="true" /></span>
                <strong>{t(title)}</strong>
                <span className="wh-shortcut-description">
                  <span>{t(description)}</span>
                  <span className="wh-shortcut-arrow"><IonIcon icon={chevronForward} aria-hidden="true" /></span>
                </span>
              </span>
            </span>
          </IonButton>
        ))}
      </div>
      <WellnessPreview title="Medicamentos" open={medicationsOpen} onClose={() => setMedicationsOpen(false)} icon={medicalOutline} />
    </section>
  );
}
