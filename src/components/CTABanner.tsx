import type { ReactNode } from 'react'
import { IonIcon } from '@ionic/react'

export function CTABanner({
  variant,
  icon,
  title,
  sub,
  onClick,
  leading,
  trailing,
}: {
  variant: 'panic' | 'voice' | 'program'
  icon?: string
  title: string
  sub: string
  onClick: () => void
  leading?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <button type="button" className={`cta-banner cta-banner-${variant}`} onClick={onClick}>
      {leading ?? (
        icon ? (
          <span className="cta-banner-ico">
            <IonIcon icon={icon} />
          </span>
        ) : null
      )}
      <div className="cta-banner-body">
        <div className="cta-banner-title">{title}</div>
        <div className="cta-banner-sub">{sub}</div>
      </div>
      {trailing ?? <span className="cta-banner-chevron">›</span>}
    </button>
  )
}
