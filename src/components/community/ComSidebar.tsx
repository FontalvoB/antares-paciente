import { IonIcon } from '@ionic/react'
import { arrowBackOutline } from 'ionicons/icons'
import { useApp } from '../../context/AppContext'
import type { Profile } from '../../graphql/community'
import { useI18n } from '../../i18n/I18nContext'
import coppLogo from '../../assets/LogoIndividual.png'

export function ComSidebar({hidden = false}: {me: Profile | null; hidden?: boolean}) {
  const {navigate} = useApp()
  const {t} = useI18n()
  if (hidden) return null
  return <button type="button" className="com-app-return com-app-return-compact" onClick={() => navigate('home')} aria-label={t('Volver a la app')} title={t('Volver a la app')}>
    <IonIcon icon={arrowBackOutline} />
    <img src={coppLogo} alt="" />
  </button>
}
