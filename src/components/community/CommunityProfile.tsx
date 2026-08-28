import { IonButton, IonIcon, IonInput, IonTextarea } from '@ionic/react'
import {
  add,
  cameraOutline,
  checkmark,
  createOutline,
  documentTextOutline,
  filmOutline,
  gridOutline,
  imagesOutline,
  peopleOutline,
  personAddOutline,
  play,
  ribbonOutline,
  shareSocialOutline,
} from 'ionicons/icons'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Post, Profile } from '../../graphql/community'
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
  onUploadProfileImage,
  onToast,
}: {
  me: Profile | null
  meLoading: boolean
  pointsTotal: number
  followersCount: number
  followingCount: number
  posts: Post[]
  onSaveProfile: (name: string, bio: string | null, avatarKey?: string | null, coverKey?: string | null) => Promise<void>
  onCompose: () => void
  onShowList: (which: 'followers' | 'following') => void
  onOpenPost: (p: Post) => void
  /** Sube la foto de perfil/portada y devuelve la info (key + URL de lectura). */
  onUploadProfileImage: (kind: 'AVATAR' | 'COVER', file: File) => Promise<{ key: string; readUrl: string }>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  const [editing, setEditing] = useState(false)
  const [dn, setDn] = useState(me?.displayName ?? '')
  const [bio, setBio] = useState(me?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<ProfileView>('all')
  const [editingOut, setEditingOut] = useState(false)
  const editingBusyRef = useRef(false)
  const [avatarPick, setAvatarPick] = useState<{ file: File; url: string } | null>(null)
  const [coverPick, setCoverPick] = useState<{ file: File; url: string } | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  function pickProfileImage(kind: 'AVATAR' | 'COVER', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      onToast('Debe ser una imagen (JPG, PNG, WEBP).', 'warn')
      return
    }
    if (file.size > PROFILE_IMAGE_MAX_MB * 1024 * 1024) {
      onToast(`La imagen supera los ${PROFILE_IMAGE_MAX_MB} MB.`, 'warn')
      return
    }
    const url = URL.createObjectURL(file)
    if (kind === 'AVATAR') setAvatarPick({ file, url })
    else setCoverPick({ file, url })
  }

  // Transición con salida/entrada al cambiar entre perfil y edición.
  const goEdit = (next: boolean) => {
    if (editingBusyRef.current) return
    editingBusyRef.current = true
    setEditingOut(true)
    window.setTimeout(() => {
      setEditing(next)
      setEditingOut(false)
      editingBusyRef.current = false
    }, 180)
  }

  const handle = useMemo(
    () => (me?.displayName ?? 'miembro').toLowerCase().replace(/[^a-z0-9]+/g, ''),
    [me?.displayName],
  )

  const filtered = useMemo(
    () =>
      view === 'all'
        ? posts
        : posts.filter((p) => (view === 'video' ? p.mediaType === 'VIDEO' : p.mediaType !== 'VIDEO')),
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
      goEdit(false)
      onToast('Perfil actualizado', 'ok')
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setSaving(false)
    }
  }

  const composeWrapper = () => onCompose()

  async function shareProfile() {
    try {
      await navigator.clipboard.writeText(`https://antares.bio/${handle}`)
      onToast('Enlace de tu perfil copiado', 'ok')
    } catch {
      onToast('Perfil: @' + handle, 'info')
    }
  }

  if (editing) {
    const avatarSrc = avatarPick?.url ?? me?.avatarUrl ?? undefined
    const coverSrc = coverPick?.url ?? me?.coverUrl ?? undefined
    return (
      <div className="prof-view" key="edit" style={{ paddingTop: 12 }}>
        <div className="compf-edit">
          <div className="compf-edit-head">
            <div className="compf-edit-title">Editar perfil</div>
            <div className="compf-edit-sub">Tu identidad en la comunidad</div>
          </div>

          <div className="compf-edit-preview">
            <div
              className="compf-edit-cover"
              style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}
            >
              <span className="compf-edit-cover-ph">Foto de portada</span>
              <button
                type="button"
                className="compf-edit-change cover"
                onClick={() => coverInputRef.current?.click()}
              >
                <IonIcon icon={cameraOutline} style={{ fontSize: 14 }} />
                {coverPick || me?.coverUrl ? 'Cambiar' : 'Añadir'}
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
                aria-label="Cambiar foto de perfil"
              >
                <IonIcon icon={cameraOutline} />
              </button>
            </div>
          </div>

          <input ref={avatarInputRef} type="file" accept={PROFILE_IMAGE_TYPES.join(',')} hidden onChange={(e) => pickProfileImage('AVATAR', e)} />
          <input ref={coverInputRef} type="file" accept={PROFILE_IMAGE_TYPES.join(',')} hidden onChange={(e) => pickProfileImage('COVER', e)} />

          <IonInput
            className="fld"
            label="Nombre visible"
            labelPlacement="stacked"
            value={dn}
            onIonInput={(e) => setDn(e.detail.value ?? '')}
          />
          <IonTextarea
            className="fld"
            label="Sobre mí"
            labelPlacement="stacked"
            value={bio}
            onIonInput={(e) => setBio(e.detail.value ?? '')}
            autoGrow
          />

          <div className="compf-edit-foot">
            <IonButton fill="outline" className="bt bt-mini" onClick={() => goEdit(false)}>
              Cancelar
            </IonButton>
            <IonButton className="bt bt-pur bt-mini" disabled={saving} onClick={() => void save()}>
              {saving ? (
                'Guardando…'
              ) : (
                <>
                  <IonIcon icon={checkmark} style={{ marginRight: 4 }} /> Guardar
                </>
              )}
            </IonButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`prof-view ${editingOut ? 'out' : ''}`} key="main">
      {me?.status === 'BANNED' && (
        <div className="compf-banned" style={{ margin: '6px 16px 10px' }}>
          Tu perfil está suspendido en la comunidad.
        </div>
      )}

      {/* Portada + avatar superpuesto */}
      <div
        className="compf-cover"
        style={me?.coverUrl ? { backgroundImage: `url(${me.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <span className="compf-cover-kicker">
          <IonIcon icon={cameraOutline} style={{ fontSize: 14 }} /> Mi espacio
        </span>
      </div>
      <div className="compf-avatar-slot">
        <div className="compf-avatar-wrap">
          <Avatar
            name={me?.displayName ?? 'MG'}
            seedId={me?.id ?? 'me'}
            size={96}
            src={me?.avatarUrl}
            style={{ boxShadow: '0 0 0 4px var(--wh), 0 12px 26px rgba(124,58,237,0.18)' }}
          />
        </div>
      </div>

      {/* Identidad */}
      <div className="compf-name-row center">
        <span className="compf-name-big">{me?.displayName ?? 'Mi perfil'}</span>
        {me ? statusBadge(me.status) : null}
      </div>

      {meLoading && !me ? (
        <div className="compf-skel" />
      ) : (
        <div className="compf-stats-line">
          <b>{formatCount(posts.length)}</b> publicaciones
          <span className="compf-sep">·</span>
          <b>{formatCount(followersCount)}</b> seguidores
          <span className="compf-sep">·</span>
          <b>{formatCount(followingCount)}</b> siguiendo
        </div>
      )}

      <div className="compf-meta">
        <span className="compf-meta-item">
          <IonIcon icon={ribbonOutline} /> COPP-ADRESD + INFINITO
        </span>
        <span className="compf-meta-item">
          <IonIcon icon={gridOutline} style={{ fontSize: 13 }} /> {pointsTotal} pts
        </span>
        <span className="compf-meta-item">
          <IonIcon icon={checkmark} style={{ fontSize: 14 }} /> @{handle}
        </span>
      </div>

      <p className="compf-bio">
        {me?.bio?.trim() ? me.bio : 'Comparte lo que haces con la comunidad.'}
      </p>

      {/* Acciones (estilo Panel + Crear) */}
      <div className="compf-actions">
        <IonButton fill="solid" className="compf-action-btn" onClick={() => void shareProfile()}>
          <IonIcon icon={shareSocialOutline} style={{ marginRight: 5 }} /> Compartir
        </IonButton>
        <IonButton fill="solid" className="compf-action-btn" onClick={composeWrapper}>
          <IonIcon icon={add} style={{ marginRight: 5 }} /> Crear
        </IonButton>
        <IonButton fill="clear" className="compf-action-edit" onClick={() => goEdit(true)} aria-label="Editar perfil">
          <IonIcon icon={createOutline} />
        </IonButton>
      </div>

      {/* Círculos rápidos */}
      <div className="compf-circles">
        <button type="button" className="compf-circle" onClick={() => onShowList('following')}>
          <span className="compf-circle-ico">
            <IonIcon icon={personAddOutline} />
          </span>
          Siguiendo
        </button>
        <button type="button" className="compf-circle" onClick={() => onShowList('followers')}>
          <span className="compf-circle-ico">
            <IonIcon icon={peopleOutline} />
          </span>
          Seguidores
        </button>
        <button type="button" className="compf-circle" onClick={onCompose}>
          <span className="compf-circle-ico">
            <IonIcon icon={gridOutline} />
          </span>
          Publicar
        </button>
      </div>

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
            title={view === 'all' ? 'Crea tu primera publicación' : `Sin ${{ image: 'fotos', video: 'videos' }[view]}`}
            hint="Comparte tu rutina saludable, un logro o una duda: la comunidad te escucha."
          >
            <IonButton className="bt bt-pur bt-mini" onClick={onCompose}>
              <IonIcon icon={add} style={{ marginRight: 4 }} /> Nueva publicación
            </IonButton>
          </EmptyState>
        </div>
      ) : (
        <div className="compf-grid">
          {filtered.map((post) => (
            <button
              key={post.id}
              type="button"
              className="compf-tile"
              onClick={() => onOpenPost(post)}
              aria-label="Ver publicación"
            >
              {post.imageUrl ? (
                <img className="compf-tile-media" src={post.imageUrl} alt="" loading="lazy" />
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
