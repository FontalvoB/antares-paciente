import coppMark from "../../assets/LogoIndividual.png";
import { CommunityVideo } from "./CommunityVideo";
import { ProfileTimeline, type TimelineActions } from "./ProfileTimeline";
import { IonButton, IonIcon } from '@ionic/react'
import {
  chatbubbleEllipsesOutline,
  checkmark,
  documentTextOutline,
  filmOutline,
  imagesOutline,
  personAddOutline,
  personRemoveOutline,
  play,
} from 'ionicons/icons'
import { useMemo, useState } from 'react'
import type { Post, Profile } from '../../graphql/community'
import { useI18n } from '../../i18n/I18nContext'
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
  onOpenImage,
  timelineActions,
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
  onOpenImage: (url: string, mediaType: 'IMAGE' | 'VIDEO' | null) => void
  timelineActions: TimelineActions
  onOpenPost: (p: Post) => void
}) {
  const [view, setView] = useState<ProfileView>('all')
  const { t } = useI18n()

  const filtered = useMemo(
    () =>
      view === 'all'
        ? profile.posts
        : profile.posts.filter((p) => (!!p.imageUrl?.trim() && p.mediaType === (view === 'video' ? 'VIDEO' : 'IMAGE'))),
    [profile.posts, view],
  )

  return (
    <div className="prof-view compf-personal compf-member">
      {/* Portada + avatar superpuesto */}
      <button type="button"
        disabled={!profile.coverUrl} aria-label={t('Ver foto de portada')} onClick={() => {if (profile.coverUrl) onOpenImage(profile.coverUrl, 'IMAGE')}}
        className="compf-cover memf-cover"
        style={
          profile.coverUrl
            ? { backgroundImage: `url(${profile.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
      </button>
      <div className="compf-summary">
        <div className="compf-identity">
          <button type="button" className="compf-photo-button" disabled={!profile.avatarUrl} aria-label={t('Ver foto de perfil')} onClick={() => {if(profile.avatarUrl) onOpenImage(profile.avatarUrl, 'IMAGE')}}>
            <Avatar name={profile.displayName} seedId={profile.id} size={80} src={profile.avatarUrl} />
          </button>
          <div className="compf-identity-text">
            <div className="compf-identity-name"><span>{profile.displayName}</span></div>
            <div className="compf-user-status"><span className="compf-handle">@{profile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '')}</span>{statusBadge(profile.status, t)}</div>
          </div>
        </div>
        <p className="compf-bio">{profile.bio?.trim() || t('Comparte lo que hace con la comunidad.')}</p>
        <div className="compf-secondary-meta"><span className="compf-brand-badge"><img src={coppMark} alt="" />COPP-ADRESD</span></div>
        <div className="compf-stat-buttons">
          <div><b>{formatCount(profile.posts.length)}</b><span>{t('publicaciones')}</span></div>
          <button type="button" onClick={() => onShowList('followers')}><b>{formatCount(followersCount)}</b><span>{t('seguidores')}</span></button>
          <button type="button" onClick={() => onShowList('following')}><b>{formatCount(followingCount)}</b><span>{t('siguiendo')}</span></button>
        </div>
        <div className="compf-member-actions">
          <IonButton fill={isFriend || isFollowingBack ? 'outline' : 'solid'} disabled={busy} onClick={isFriend || isFollowingBack ? onUnfollow : onFollow}>
            <IonIcon slot="start" icon={isFriend ? personRemoveOutline : isFollowingBack ? checkmark : personAddOutline} />
            {t(isFriend ? 'Dejar de seguir' : isFollowingBack ? 'Siguiendo' : 'Seguir')}
          </IonButton>
          {isFriend && <IonButton fill="outline" onClick={onMessage}><IonIcon slot="start" icon={chatbubbleEllipsesOutline} />{t('Enviar mensaje')}</IonButton>}
        </div>
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
            title={view === 'all' ? t('Sin publicaciones todavía') : view === 'image' ? t('Sin fotos') : t('Sin videos')}
            hint={view === 'all' ? t('Este miembro no ha compartido publicaciones todavía.') : undefined}
          />
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
              {post.imageUrl ? (
                post.mediaType === 'VIDEO'
                  ? <CommunityVideo className="compf-tile-media" src={post.imageUrl} muted playsInline preload="metadata" />
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
