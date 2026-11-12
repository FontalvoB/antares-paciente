import { useEffect, useState } from 'react';
import { IonButton, IonIcon, IonModal } from '@ionic/react';
import { close, chatbubbleEllipsesOutline } from 'ionicons/icons';
import { useApp } from '../context/AppContext';
import { useT } from '../i18n/I18nContext';
import { getAccessToken } from '../utils/authApi';
import { sessionUserId } from '../utils/sessionIdentity';
import { fetchMyAssignments } from '../utils/healthTestsApi';
import { isInitialBatteryComplete } from '../utils/initialBattery';
import { acknowledgeVitaWelcome, queueVitaWelcome, vitaWelcomeState } from '../utils/vitaWelcome';
import vitaPortrait from '../assets/vita-coach.png';

/** Bienvenida inicial: espera la batería requerida y no se reactiva al consultar resultados antiguos. */
export function VitaWelcome() {
  const { flow, user, vitaWelcomePending, dismissVitaWelcome, navigate, panicOpen, voiceOpen } = useApp();
  const t = useT();
  const accountId = sessionUserId(getAccessToken());
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);

  useEffect(() => {
    setVerifiedFor(null);
    if (flow !== 'app' || !accountId) return;
    if (vitaWelcomePending) queueVitaWelcome(accountId);
    if (vitaWelcomeState(accountId) !== 'pending') return;
    let active = true;
    let sequence = 0;
    const check = async () => {
      const request = ++sequence;
      try {
        const rows = await fetchMyAssignments();
        if (!active || request !== sequence) return;
        setVerifiedFor(isInitialBatteryComplete(rows) ? accountId : null);
      } catch {
        if (active && request === sequence) setVerifiedFor(null);
      }
    };
    const resume = () => { if (!document.hidden && vitaWelcomeState(accountId) === 'pending') void check(); };
    const storageChanged = () => { if (vitaWelcomeState(accountId) === 'seen') setVerifiedFor(null); };
    void check();
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [flow, accountId, vitaWelcomePending]);

  const open = flow === 'app' && !!accountId && verifiedFor === accountId
    && vitaWelcomeState(accountId) === 'pending' && !panicOpen && !voiceOpen;
  const dismiss = () => {
    if (accountId) acknowledgeVitaWelcome(accountId);
    setVerifiedFor(null);
    dismissVitaWelcome();
  };
  return (
    <IonModal isOpen={open} onDidDismiss={() => { if (open) dismiss(); }}
      className="vita-welcome-modal" aria-labelledby="vita-welcome-title">
      <div className="vita-welcome">
        <IonButton fill="clear" className="vita-close" aria-label={t('Cerrar')} onClick={dismiss}>
          <IonIcon slot="icon-only" icon={close} />
        </IonButton>
        <img src={vitaPortrait} alt={t('Vita, tu coach de bienestar')} />
        <div className="vita-welcome-copy">
          <span className="kicker">{t('Tu camino empieza aquí')}</span>
          <h2 id="vita-welcome-title">{t('Bienvenido {nombre} al programa Copp Adresd.', { nombre: user.nombre.trim().split(/\s+/)[0] || t('Paciente') })}</h2>
          <p>{t('Soy Vita, tu coach asignada.')}</p>
          <p className="vita-description">{t('Te acompañaré a descubrir tu programa y a construir tus hábitos, un día a la vez.')}</p>
          <IonButton expand="block" className="bt bt-teal" onClick={() => { dismiss(); navigate('chat'); }}>
            <IonIcon slot="start" icon={chatbubbleEllipsesOutline} />{t('Conocer a Vita')}
          </IonButton>
          <IonButton expand="block" fill="clear" onClick={dismiss}>{t('Explorar mi programa')}</IonButton>
        </div>
      </div>
    </IonModal>
  );
}
