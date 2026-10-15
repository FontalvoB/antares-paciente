import coppMark from "../../assets/LogoIndividual.png";
import { sparklesOutline } from "ionicons/icons";
import { ProfileTimeline, type TimelineActions } from "./ProfileTimeline";
import { shareCommunityContent } from "../../utils/community-sharing";
import { IonActionSheet, IonButton, IonIcon, IonInput, IonTextarea } from '@ionic/react'
import {
  add,
  cameraOutline,
  checkmark,
  createOutline,
  ellipsisHorizontal,
  documentTextOutline,
  filmOutline,
  gridOutline,
  imagesOutline,
  play,
  repeatOutline,
  shareSocialOutline,
} from 'ionicons/icons'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Post, Profile } from '../../graphql/community'
import type { TimelinePost } from '../../hooks/useCommunity'
import { useI18n } from '../../i18n/I18nContext'
import { Avatar, EmptyState, statusBadge } from './community'

const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
const PROFILE_IMAGE_MAX_MB = 8

/** Formatea conteos grandes: 1700 → "1,7 mil". */
export function formatCount(n: number): string {
  if (n >= 1000) {
    const m = n / 1000
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace('.', ',')} mil`
  }
  return String(n)
}

export type ProfileView = 'all' | 'image' | 'video'

export const VIEW_TABS: { id: ProfileView; label: string; icon: string }[] = [
  { id: 'all', label: 'Todo', icon: gridOutline },
  { id: 'image', label: 'Fotos', icon: imagesOutline },
  { id: 'video', label: 'Videos', icon: filmOutline },
]

/** Perfil personal único y profesional: portada + avatar superpuesto (estilo
 *  Facebook) con stats en línea, meta, acciones (Editar/Compartir), círculos
 *  rápidos, tabs con filtro y grid de publicaciones (Instagram). */
export function CommunityProfile({
  me,
  meLoading,
  pointsTotal,
  followersCount,
  followingCount,
  posts,
  onSaveProfile,
  onCompose,
  onShowList,
  onOpenPost,
  onOpenImage,
  timelineActions,
  onUploadProfileImage,
  onToast,
}: {
  me: Profile | null
  meLoading: boolean
  pointsTotal: number
  followersCount: number
  followingCount: number
  posts: TimelinePost[]
  onSaveProfile: (name: string, bio: string | null, avatarKey?: string | null, coverKey?: string | null) => Promise<void>
  onCompose: () => void
  onShowList: (which: 'followers' | 'following') => void
  onOpenImage: (url: string, mediaType: 'IMAGE' | 'VIDEO' | null) => void
  timelineActions: TimelineActions
  onOpenPost: (p: Post) => void
  /** Sube la foto de perfil/portada y devuelve la info (key + URL de lectura). */
  onUploadProfileImage: (kind: 'AVATAR' | 'COVER', file: File) => Promise<{ key: string; readUrl: string }>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dn, setDn] = useState(me?.displayName ?? '')
  const [bio, setBio] = useState(me?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<ProfileView>('all')
  const [avatarPick, setAvatarPick] = useState<{ file: File; url: string } | null>(null)
  const [coverPick, setCoverPick] = useState<{ file: File; url: string } | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const { t } = useI18n()

  function pickProfileImage(kind: 'AVATAR' | 'COVER', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      onToast(t('Debe ser una imagen (JPG, PNG, WEBP).'), 'warn')
      return
    }
    if (file.size > PROFILE_IMAGE_MAX_MB * 1024 * 1024) {
      onToast(t('La imagen supera los {max} MB.', { max: String(PROFILE_IMAGE_MAX_MB) }), 'warn')
      return
    }
    const url = URL.createObjectURL(file)
    if (kind === 'AVATAR') setAvatarPick({ file, url })
    else setCoverPick({ file, url })
  }

  const goEdit = (next: boolean) => {
    if (saving) return
    setEditing(next)
  }

  const handle = useMemo(
    () => (me?.displayName ?? 'miembro').toLowerCase().replace(/[^a-z0-9]+/g, ''),
    [me?.displayName],
  )

  const filtered = useMemo(
    () =>
      view === 'all'
        ? posts
        : posts.filter((p) => (!!p.imageUrl?.trim() && p.mediaType === (view === 'video' ? 'VIDEO' : 'IMAGE'))),
    [posts, view],
  )

  async function save() {
    if (!dn.trim()) {
      onToast('El nombre no puede estar vacío', 'warn')
      return
    }
    setSaving(true)
    try {
      let avatarKey: string | null = null
      let coverKey: string | null = null
      if (avatarPick) {
        const info = await onUploadProfileImage('AVATAR', avatarPick.file)
        avatarKey = info.key
      }
      if (coverPick) {
        const info = await onUploadProfileImage('COVER', coverPick.file)
        coverKey = info.key
      }
      await onSaveProfile(dn.trim(), bio.trim() || null, avatarKey, coverKey)
      setEditing(false)
      onToast('Perfil actualizado', 'ok')
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setSaving(false)
    }
  }


  async function shareProfile() {
    try {
      const result = await shareCommunityContent(t('Comunidad Copp Adresd'), `${me?.displayName ?? handle} · COPP-ADRESD\n${me?.bio ?? ''}`)
      if (result === 'copied') onToast(t('Contenido copiado para compartir'), 'ok')
    } catch { onToast(t('No se pudo compartir. Inténtalo de nuevo.'), 'err') }
  }

  if (editing) {
    const avatarSrc = avatarPick?.url ?? me?.avatarUrl ?? undefined
    const coverSrc = coverPick?.url ?? me?.coverUrl ?? undefined
    return (
      <div className="compf-edit-screen" key="edit">
        <div className="compf-edit">
          <div className="compf-edit-head">
            <div className="compf-edit-title">{t('Editar perfil')}</div>
            <div className="compf-edit-sub">{t('Tu identidad en la comunidad')}</div>
          </div>

          <div className="compf-edit-preview">
            <div
              className="compf-edit-cover"
              style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}
            >
              <span className="compf-edit-cover-ph">{t('Foto de portada')}</span>
              <button
                type="button"
                className="compf-edit-change cover"
                onClick={() => coverInputRef.current?.click()}
              >
                <IonIcon icon={cameraOutline} style={{ fontSize: 14 }} />
                {coverPick || me?.coverUrl ? t('Cambiar') : t('Añadir')}
              </button>
            </div>
            <div className="compf-edit-circle">
              <Avatar
                name={me?.displayName ?? 'MG'}
                seedId={me?.id ?? 'me'}
                size={88}
                src={avatarSrc}
                style={{ boxShadow: '0 0 0 4px var(--wh), 0 8px 22px rgba(16,42,80,0.18)' }}
              />
              <button
                type="button"
                className="compf-edit-change avatar"
                onClick={() => avatarInputRef.current?.click()}
                aria-label={t('Cambiar foto de perfil')}
              >
                <IonIcon icon={cameraOutline} />
              </button>
            </div>
          </div>

          <input ref={avatarInputRef} type="file" accept={PROFILE_IMAGE_TYPES.join(',')} hidden onChange={(e) => pickProfileImage('AVATAR', e)} />
          <input ref={coverInputRef} type="file" accept={PROFILE_IMAGE_TYPES.join(',')} hidden onChange={(e) => pickProfileImage('COVER', e)} />

          <div className="compf-field-group">
          <label htmlFor="community-display-name">{t('Nombre visible')}</label>
          <IonInput
            id="community-display-name"
            aria-label={t('Nombre visible')}
            className="fld"
            value={dn}
            onIonInput={(e) => setDn(e.detail.value ?? '')}
          />
          </div>
          <div className="compf-field-group">
          <label htmlFor="community-profile-bio">{t('Sobre mí')}</label>
          <IonTextarea
            id="community-profile-bio"
            aria-label={t('Sobre mí')}
            className="fld"
            value={bio}
            onIonInput={(e) => setBio(e.detail.value ?? '')}
            autoGrow
            rows={3}
          />

          </div>
          <div className="compf-edit-foot">
            <IonButton fill="outline" className="compf-edit-cancel" disabled={saving} onClick={() => goEdit(false)}>
              {t('Cancelar')}
            </IonButton>
            <IonButton className="compf-edit-save" disabled={saving || !dn.trim()} onClick={() => void save()}>
              {saving ? (
                t('Guardando…')
              ) : (
                <>
                  <IonIcon icon={checkmark} style={{ marginRight: 4 }} /> {t('Guardar')}
                </>
              )}
            </IonButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="prof-view compf-personal" key="main">
      {me?.status === 'BANNED' && (
        <div className="compf-banned" style={{ margin: '6px 16px 10px' }}>
          {t('Tu perfil está suspendido en la comunidad.')}
        </div>
      )}

      {/* Portada + avatar superpuesto */}
      <button type="button"
        disabled={!me?.coverUrl} aria-label={t('Ver foto de portada')} onClick={() => {if (me?.coverUrl) onOpenImage(me?.coverUrl, 'IMAGE')}}
        className="compf-cover"
        style={me?.coverUrl ? { backgroundImage: `url(${me.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <span className="compf-cover-kicker">
          <IonIcon icon={cameraOutline} style={{ fontSize: 14 }} /> {t('Mi espacio')}
        </span>
      </button>
      <div className="compf-summary">
      <div className="compf-identity">
        <button type="button" className="compf-photo-button" disabled={!me?.avatarUrl} aria-label={t('Ver foto de perfil')} onClick={() => {if(me?.avatarUrl) onOpenImage(me.avatarUrl, 'IMAGE')}}>
        <Avatar name={me?.displayName ?? t('Mi perfil')} seedId={me?.id ?? 'me'} size={80} src={me?.avatarUrl} />
        </button>
        <div className="compf-identity-text">
          <div className="compf-identity-name"><span>{me?.displayName ?? t('Mi perfil')}</span></div>
          <div className="compf-user-status"><span className="compf-handle">@{handle}</span>{me ? statusBadge(me.status, t) : null}</div>
        </div>
        <IonButton fill="clear" className="compf-profile-menu" aria-label={t('Opciones de perfil')} onClick={() => setProfileMenuOpen(true)}><IonIcon slot="icon-only" icon={ellipsisHorizontal} /></IonButton>
      </div>
      <p className="compf-bio">{me?.bio?.trim() || t('Comparte lo que haces con la comunidad.')}</p>
      <div className="compf-secondary-meta">
        <span className="compf-brand-badge"><img src={coppMark} alt="" />COPP-ADRESD</span>
        <span className="compf-points-badge"><IonIcon icon={sparklesOutline} /><b>{formatCount(pointsTotal)}</b><span>pts</span></span>
      </div>
      {meLoading && !me ? <div className="compf-skel" /> : <div className="compf-stat-buttons">
        <div><b>{formatCount(posts.length)}</b><span>{t('publicaciones')}</span></div>
        <button type="button" onClick={() => onShowList('followers')}><b>{formatCount(followersCount)}</b><span>{t('seguidores')}</span></button>
        <button type="button" onClick={() => onShowList('following')}><b>{formatCount(followingCount)}</b><span>{t('siguiendo')}</span></button>
      </div>}
      </div>
      <IonActionSheet isOpen={profileMenuOpen} onDidDismiss={() => setProfileMenuOpen(false)} buttons={[
        {text: t('Editar perfil'), icon: createOutline, handler: () => {setProfileMenuOpen(false); goEdit(true)}},
        {text: t('Compartir'), icon: shareSocialOutline, handler: () => {setProfileMenuOpen(false); void shareProfile()}},
        {text: t('Cancelar'), role: 'cancel'},
      ]} />

      {/* Tabs con filtro */}
      <div className="compf-tabs">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`compf-tab ${view === tab.id ? 'on' : ''}`}
            onClick={() => setView(tab.id)}
          >
            <IonIcon icon={tab.icon} /> {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '10px 14px 0' }}>
          <EmptyState
            icon={view === 'video' ? filmOutline : view === 'image' ? imagesOutline : documentTextOutline}
            tone="pur"
            title={view === 'all' ? t('Crea tu primera publicación') : view === 'image' ? t('Sin fotos') : t('Sin videos')}
            hint={view === 'all' ? t('Comparte tu rutina saludable, un logro o una duda: la comunidad te escucha.') : undefined}
          >
            <IonButton className="bt bt-pur bt-mini" onClick={onCompose}>
              <IonIcon icon={add} style={{ marginRight: 4 }} /> {t('Nueva publicación')}
            </IonButton>
          </EmptyState>
        </div>
      ) : view === 'all' ? (
        <ProfileTimeline posts={filtered} onOpenPost={onOpenPost} {...timelineActions} onOpenImage={onOpenImage} />
      ) : (
        <div className="compf-grid">
          {filtered.map((post) => (
            <button
              key={post.id}
              type="button"
              className="compf-tile"
              onClick={() => onOpenPost(post)}
              aria-label={t('Ver publicación')}
            >
              {post.isRepost && (
                <span className="compf-tile-repost">
                  <IonIcon icon={repeatOutline} /> {t('Reposteado')}
                </span>
              )}
              {post.imageUrl ? (
                post.mediaType === 'VIDEO'
                  ? <video className="compf-tile-media" src={post.imageUrl} muted playsInline preload="metadata" />
                  : <img className="compf-tile-media" src={post.imageUrl} alt="" loading="lazy" />
              ) : (
                <span className="compf-tile-text">💬</span>
              )}
              {post.mediaType === 'VIDEO' && (
                <span className="compf-tile-play">
                  <IonIcon icon={play} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
