import { IonButton, IonIcon } from '@ionic/react';
import { languageOutline } from 'ionicons/icons';
import { useI18n } from '../i18n/I18nContext';

export function LanguageToggle() {
  const { lang, toggleLang } = useI18n();

  return (
    <IonButton
      fill="clear"
      size="small"
      onClick={toggleLang}
      aria-label={`Cambiar idioma a ${lang === 'es' ? 'English' : 'Español'}`}
      className="lang-toggle"
    >
      <IonIcon icon={languageOutline} style={{ fontSize: 20, verticalAlign: '-2px' }} />
      <span style={{ fontWeight: 700, fontSize: 12, marginLeft: 4 }}>
        {lang === 'es' ? 'ES' : 'EN'}
      </span>
    </IonButton>
  );
}