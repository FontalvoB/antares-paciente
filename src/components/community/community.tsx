import { IonBadge, IonButton, IonIcon, IonSkeletonText } from '@ionic/react'
import { alertCircle, ban } from 'ionicons/icons'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'

/** Gradientes de identidad para avatares sin foto (tokens de marca). */
export const AVATAR_GRADS = [
  'linear-gradient(135deg,#1B6CA8,#0A1F36)',
  'linear-gradient(135deg,#D4537E,#9B2D5A)',
  'linear-gradient(135deg,#E87B2B,#C05A0A)',
  'linear-gradient(135deg,#059669,#047857)',
]

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function timeAgo(iso: string, t: (s: string, p?: Record<string, string>) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('ahora')
  if (mins < 60) return t('hace {n} min', { n: String(mins) })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('hace {n} h', { n: String(hrs) })
  const days = Math.floor(hrs / 24)
  if (days === 1) return t('ayer')
  return t('hace {n} días', { n: String(days) })
}

export function statusBadge(status: string, t: (s: string) => string) {
  if (status === 'BANNED') return <IonBadge color="danger">{t('Baneado')}</IonBadge>
  return <IonBadge color="success">{t('Activo')}</IonBadge>
}

/** Avatar de la comunidad: imagen (foto de perfil) o iniciales sobre
 *  gradiente determinista si aún no hay foto. onclick abre el perfil del
 *  miembro en contextos donde el avatar es navegable. */
export function Avatar({
  name,
  seedId = name,
  size = 40,
  src,
  style,
  onClick,
}: {
  name: string
  seedId?: string
  size?: number
  src?: string | null
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLElement>
}) {
  const grad = AVATAR_GRADS[seedId.charCodeAt(0) % AVATAR_GRADS.length]
  const wrapStyle: CSSProperties = onClick ? { display: 'inline-flex', cursor: 'pointer' } : {}
  const merged = { ...wrapStyle, ...style }
  if (src) {
    return (
      <img
        className="avatar"
        src={src}
        alt={name}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          background: grad,
          ...merged,
        }}
      />
    )
  }
  return (
    <div
      className="avatar"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.34)),
        background: grad,
        ...merged,
      }}
    >
      {initialsOf(name)}
    </div>
  )
}

/** Encabezado de sección: icono en chip + título + contador opcional. */
export function SectionHeader({
  icon,
  tone = 'pur',
  label,
  count,
  style,
}: {
  icon: string
  tone?: 'pur' | 'gold' | 'teal' | 'blue'
  label: string
  count?: number
  style?: CSSProperties
}) {
  return (
    <div className="com-sec" style={style}>
      <span className={`com-sech-ico ${tone}`}>
        <IonIcon icon={icon} />
      </span>
      {label}
      {count != null && <span className="com-sec-count">{count}</span>}
    </div>
  )
}

/** Estado vacío humanizado: mensaje claro + explicación + acción sugerida. */
export function EmptyState({
  icon,
  tone = 'pur',
  title,
  hint,
  children,
}: {
  icon: string
  tone?: 'pur' | 'gold' | 'teal' | 'blue' | 'red'
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="com-empty">
      <div className={`com-empty-ico tone-${tone}`}>
        <IonIcon icon={icon} />
      </div>
      <div className="com-empty-title">{title}</div>
      {hint && <div className="com-empty-hint">{hint}</div>}
      {children}
    </div>
  )
}

/** Tarjeta de error reutilizable con reintento. */
export function ErrorCard({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="com-empty">
      <div className="com-empty-ico tone-red">
        <IonIcon icon={alertCircle} />
      </div>
      <div className="com-empty-title">{t('Ups, algo salió mal')}</div>
      <div className="com-empty-hint">{message}</div>
      <IonButton className="bt bt-pur bt-mini" onClick={onRetry}>
        {t('Reintentar')}
      </IonButton>
    </div>
  )
}

/** Skeleton de publicación: jerarquía similar al contenido real. */
export function PostSkeleton() {
  return (
    <div className="com-skel">
      <div className="com-skel-head">
        <IonSkeletonText style={{ width: 42, height: 42, borderRadius: 21 }} animated />
        <div style={{ flex: 1 }}>
          <IonSkeletonText style={{ width: '40%', height: 12 }} animated />
          <IonSkeletonText style={{ width: '26%', height: 10 }} animated />
        </div>
      </div>
      <IonSkeletonText style={{ width: '100%', height: 12, marginBottom: 6 }} animated />
      <IonSkeletonText style={{ width: '92%', height: 12, marginBottom: 6 }} animated />
      <IonSkeletonText style={{ width: '64%', height: 12 }} animated />
      <div className="com-skel-actions">
        <IonSkeletonText style={{ width: 76, height: 32, borderRadius: 16 }} animated />
        <IonSkeletonText style={{ width: 76, height: 32, borderRadius: 16 }} animated />
      </div>
    </div>
  )
}

/** Skeleton de filas (miembros, conversaciones, búsqueda). */
export function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="com-skel">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '9px 0',
            borderBottom: i < rows - 1 ? '1px solid var(--g1)' : 'none',
          }}
        >
          <IonSkeletonText style={{ width: 40, height: 40, borderRadius: 20 }} animated />
          <div style={{ flex: 1 }}>
            <IonSkeletonText style={{ width: '45%', height: 12 }} animated />
            <IonSkeletonText style={{ width: '72%', height: 11 }} animated />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Fila de usuario/conversación suave (avatar + nombre + sub + acción derecha). */
export function ComRow({
  name,
  seedId = name,
  src,
  sub,
  onClick,
  children,
}: {
  name: string
  seedId?: string
  src?: string | null
  sub?: string
  onClick?: () => void
  children?: ReactNode
}) {
  return (
    <div className="com-row">
      <div className="com-row-main" onClick={onClick}>
        <Avatar name={name} seedId={seedId} size={40} src={src} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="com-row-name">{name}</div>
          {sub && <div className="com-row-sub">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

/** Pantalla de bloqueo completo para perfiles suspendidos. */
export function BannedScreen({ reason }: { reason?: string | null }) {
  const { navigate } = useApp()
  const { t } = useI18n()
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        background: 'var(--red-l)',
        textAlign: 'center',
      }}
    >
      <div className="com-empty-ico tone-red" style={{ width: 84, height: 84, fontSize: 40, animation: 'none' }}>
        <IonIcon icon={ban} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t('Perfil suspendido')}</div>
      <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, maxWidth: 280 }}>
        {t('Tu perfil fue suspendido en la comunidad.')}
      </div>
      {reason && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--mu)',
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--wh)',
            borderRadius: 12,
            maxWidth: 300,
            lineHeight: 1.5,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {reason}
        </p>
      )}
      <IonButton
        style={{
          marginTop: 16,
          '--background': 'var(--teal)',
          '--color': '#fff',
          '--border-radius': '12px',
          fontWeight: 700,
        }}
        onClick={() => navigate('home')}
      >
        {t('Volver a la app')}
      </IonButton>
    </div>
  )
}
