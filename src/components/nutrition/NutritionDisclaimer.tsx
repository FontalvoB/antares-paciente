import { useId, useState } from 'react';
import { createAnimation, IonButton, IonContent, IonIcon, IonModal } from '@ionic/react';
import { closeOutline, informationCircleOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { useT } from '../../i18n/I18nContext';
import { sessionUserId } from '../../utils/sessionIdentity';
import { getAccessToken } from '../../utils/authApi';

/** Solo guarda la lectura del aviso, por cuenta y versión; nunca datos clínicos. */
function wasRead(key: string | null) {
  try { return key ? localStorage.getItem(key) === '1' : true; } catch { return true; }
}

/** Animación Ionic: conserva los identificadores que utiliza el gesto nativo de la hoja. */
function legalSheetAnimation(base: HTMLElement, entering: boolean, breakpoint = 1) {
  const root = base.shadowRoot ?? base;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resting = `translateY(${100 - breakpoint * 100}%)`;
  const wrapper = createAnimation('wrapperAnimation').addElement(root.querySelectorAll('.modal-wrapper, .modal-shadow'))
    .beforeStyles({opacity:'1'}).fromTo('transform', entering ? 'translateY(100%)' : resting, entering ? resting : 'translateY(100%)');
  const backdrop = createAnimation('backdropAnimation').addElement(root.querySelector('ion-backdrop')!)
    .fromTo('opacity', entering ? 0 : 'var(--backdrop-opacity)', entering ? 'var(--backdrop-opacity)' : 0);
  return createAnimation().addElement(base).duration(reduced ? 0 : 280).easing('ease-out').addAnimation([wrapper,backdrop]);
}

export function NutritionDisclaimer() {
  const account = sessionUserId(getAccessToken());
  return <AccountDisclaimer key={account ?? 'anonymous'} account={account} />;
}

function AccountDisclaimer({ account }: { account: string | null }) {
  const t = useT();
  const titleId = useId();
  const storageKey = account ? `antares:nutrition-notice:v1:${account}` : null;
  const [open, setOpen] = useState(() => !wasRead(storageKey));
  const dismiss = () => {
    setOpen(false);
    try { if (storageKey) localStorage.setItem(storageKey, '1'); } catch { /* Navegación disponible con almacenamiento restringido. */ }
  };
  return <>
    <aside className="nutrition-notice" aria-label={t('Aviso nutricional')}>
      <IonIcon icon={informationCircleOutline} aria-hidden="true" />
      <p>{t('Plan automático, solo informativo')}<span> · </span><IonButton fill="clear" onClick={() => setOpen(true)}>{t('Leer aviso')}</IonButton></p>
    </aside>
    <IonModal className="nutrition-legal-sheet" isOpen={open} initialBreakpoint={1} breakpoints={[0, 1]} handle aria-labelledby={titleId} onDidDismiss={dismiss}
      enterAnimation={(base,options) => legalSheetAnimation(base,true,options?.currentBreakpoint)}
      leaveAnimation={(base,options) => legalSheetAnimation(base,false,options?.currentBreakpoint)}>
      <IonContent>
        <div className="nutrition-legal-body">
          <div className="nutrition-legal-top"><span className="nutrition-legal-mark"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /></span><IonButton fill="clear" aria-label={t('Cerrar')} onClick={dismiss}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton></div>
          <p className="nutrition-legal-kicker">{t('AVISO IMPORTANTE')}</p>
          <h2 id={titleId}>{t('Recomendaciones nutricionales')}</h2>
          <p>{t('Este plan alimentario lo genera automáticamente el programa a partir de la información que diste en los cuestionarios de evaluación nutricional. Es solo informativo y de bienestar general: no es consejo médico, diagnóstico ni tratamiento, y no reemplaza la evaluación individual de un profesional de la nutrición habilitado.')}</p>
          <p>{t('Te recomendamos que un profesional de la nutrición revise este plan antes de aplicarlo. El programa no garantiza resultados de salud específicos, y sigues siendo responsable de consultar a tu profesional de salud sobre tus necesidades.')}</p>
          <IonButton expand="block" onClick={dismiss}>{t('Entendido')}</IonButton>
          <small>{t('Se muestra una vez. Siempre puedes releerlo desde «Leer aviso».')}</small>
        </div>
      </IonContent>
    </IonModal>
  </>;
}
