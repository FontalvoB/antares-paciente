import { IonButton, IonIcon } from '@ionic/react'
import {
  chatbubbleEllipsesOutline,
  checkmark,
  documentTextOutline,
  filmOutline,
  imagesOutline,
  peopleOutline,
  personAddOutline,
  personRemoveOutline,
  play,
} from 'ionicons/icons'
import { useMemo, useState } from 'react'
import type { Post, Profile } from '../../graphql/community'
import { Avatar, EmptyState, statusBadge } from './community'
import { formatCount, VIEW_TABS, type ProfileView } from './CommunityProfile'

/** Vista de perfil de un miembro: espejo del propio perfil (portada con
 *  avatar superpuesto, stats en línea, bio, acciones, círculos y galería
 *  con tabs de filtro). */
export function MemberProfile({
  profile,
  isFriend,
  isFollowingBack,
  busy,
  followersCount,
  followingCount,
  onShowList,
  onFollow,
  onUnfollow,
  onMessage,
  onOpenPost,
}: {
  profile: Profile
  isFriend: boolean
  isFollowingBack: boolean
  busy: boolean
  followersCount: number
  followingCount: number
  onShowList: (which: 'followers' | 'following') => void
  onFollow: () => void
  onUnfollow: () => void
  onMessage: () => void
  onOpenPost: (p: Post) => void
}) {
  const [view, setView] = useState<ProfileView>('all')

  const filtered = useMemo(
    () =>
      view === 'all'
        ? profile.posts
        : profile.posts.filter((p) => (view === 'video' ? p.mediaType === 'VIDEO' : p.mediaType !== 'VIDEO')),
    [profile.posts, view],
  )

  return (
    <div className="prof-view">
      {/* Portada + avatar superpuesto */}
      <div
        className="compf-cover memf-cover"
        style={
          profile.coverUrl
            ? { backgroundImage: `url(${profile.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        <span className="compf-cover-kicker">
          <IonIcon icon={peopleOutline} style={{ fontSize: 14 }} /> Su espacio
        </span>
      </div>
      <div className="compf-avatar-slot">
        <div className="compf-avatar-wrap">
          <Avatar
            name={profile.displayName}
            seedId={profile.id}
            size={96}
            src={profile.avatarUrl}
            style={{ boxShadow: '0 0 0 4px var(--wh), 0 12px 26px rgba(124,58,237,0.18)' }}
          />
        </div>
      </div>

      {/* Identidad */}
      <div className="compf-name-row center">
        <span className="compf-name-big">{profile.displayName}</span>
        {statusBadge(profile.status)}
      </div>

      <div className="compf-stats-line">
        <b>{formatCount(profile.posts.length)}</b> publicaciones
        <span className="compf-sep">·</span>
        <b>{formatCount(followersCount)}</b> seguidores
        <span className="compf-sep">·</span>
        <b>{formatCount(followingCount)}</b> siguiendo
      </div>

      <p className="compf-bio">
        {profile.bio?.trim() ? profile.bio : 'Comparte lo que hace con la comunidad.'}
      </p>

      {/* Acciones */}
      <div className="compf-actions">
        {isFriend ? (
          <IonButton fill="solid" className="compf-action-btn" disabled={busy} onClick={onUnfollow}>
            <IonIcon icon={personRemoveOutline} style={{ marginRight: 5 }} /> Dejar de seguir
          </IonButton>
        ) : isFollowingBack ? (
          <IonButton fill="solid" className="compf-action-btn" disabled={busy} onClick={onUnfollow}>
            <IonIcon icon={checkmark} style={{ marginRight: 5 }} /> Siguiendo
          </IonButton>
        ) : (
          <IonButton fill="solid" className="compf-action-btn" disabled={busy} onClick={onFollow}>
            <IonIcon icon={personAddOutline} style={{ marginRight: 5 }} /> Seguir
          </IonButton>
        )}
        {isFriend && (
          <IonButton fill="solid" className="compf-action-btn" onClick={onMessage}>
            <IonIcon icon={chatbubbleEllipsesOutline} style={{ marginRight: 5 }} /> Enviar mensaje
          </IonButton>
        )}
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
            title={view === 'all' ? 'Sin publicaciones todavía' : view === 'image' ? 'Sin fotos' : 'Sin videos'}
            hint={view === 'all' ? 'Este miembro no ha compartido publicaciones todavía.' : undefined}
          />
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
