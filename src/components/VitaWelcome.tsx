import { IonButton, IonIcon, IonModal } from '@ionic/react'
import { close, chatbubbleEllipsesOutline } from 'ionicons/icons'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'
import vitaPortrait from '../assets/vita-coach.png'

/** Bienvenida del registro: no se activa al repetir tests desde el perfil. */
export function VitaWelcome() {
  const { flow, user, vitaWelcomePending, dismissVitaWelcome, navigate } = useApp()
  const t = useT()
  return (
    <IonModal isOpen={flow === 'app' && vitaWelcomePending} onDidDismiss={dismissVitaWelcome}
      className="vita-welcome-modal" aria-labelledby="vita-welcome-title">
      <div className="vita-welcome">
        <IonButton fill="clear" className="vita-close" aria-label={t('Cerrar')} onClick={dismissVitaWelcome}>
          <IonIcon slot="icon-only" icon={close} />
        </IonButton>
        <img src={vitaPortrait} alt={t('Vita, tu coach de bienestar')} />
        <div className="vita-welcome-copy">
          <span className="kicker">{t('Tu camino empieza aquí')}</span>
          <h2 id="vita-welcome-title">{t('Bienvenido {nombre} al programa Copp Adresd.', { nombre: user.nombre.split(' ')[0] || t('Paciente') })}</h2>
          <p>{t('Soy Vita, tu coach asignada.')}</p>
          <p className="vita-description">{t('Te acompañaré a descubrir tu programa y a construir tus hábitos, un día a la vez.')}</p>
          <IonButton expand="block" className="bt bt-teal" onClick={() => { dismissVitaWelcome(); navigate('chat') }}>
            <IonIcon slot="start" icon={chatbubbleEllipsesOutline} />{t('Conocer a Vita')}
          </IonButton>
          <IonButton expand="block" fill="clear" onClick={dismissVitaWelcome}>{t('Explorar mi programa')}</IonButton>
        </div>
      </div>
    </IonModal>
  )
}
