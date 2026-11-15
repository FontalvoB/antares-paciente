import type { ReactNode } from 'react'
import { IonButton, IonIcon } from '@ionic/react'
import { arrowBackOutline } from 'ionicons/icons'
import { useT } from '../i18n/I18nContext'

export function PageHeader({
  title,
  sub,
  kicker,
  trailing,
  onBack,
}: {
  title: string
  sub?: string
  kicker?: string
  trailing?: ReactNode
  onBack?: () => void
}) {
  const t = useT()
  return (
    <header className="page-head">
      {kicker ? <div className="page-head-kicker">{kicker}</div> : null}
      <div className="page-head-row">
        {onBack && <IonButton className="premium-back" fill="clear" aria-label={t('Volver')} onClick={onBack}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton>}
        <h1 className="page-head-title">{title}</h1>
        {trailing}
      </div>
      {sub ? <p className="page-head-sub">{sub}</p> : null}
    </header>
  )
}
