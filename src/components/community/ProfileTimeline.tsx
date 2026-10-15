import { useState } from 'react'
import { useQuery } from 'urql'
import { IonIcon } from '@ionic/react'
import { repeatOutline } from 'ionicons/icons'
import { POST_QUERY, type Post, type PostResult } from '../../graphql/community'
import { useI18n } from '../../i18n/I18nContext'
import { PostCard } from './PostCard'

export interface TimelineActions {
  onOpenImage?: (url: string, mediaType: 'IMAGE' | 'VIDEO' | null) => void
  myId?: string | null
  onToggleLike?: (post: Post) => Promise<void>
  onToggleRepost?: (post: Post) => Promise<{id: string; reposts: Post['reposts']} | null>
  onVotePoll?: (optionId: string) => Promise<Post | undefined>
  onDeletePost?: (id: string) => Promise<void>
  onReportPost?: (id: string, reason: string) => Promise<unknown>
  onToast: (message: string, kind?: 'ok'|'err'|'info'|'warn') => void
}
function TimelineItem({post, onOpenPost, ...actions}: TimelineActions & {post: Post & {isRepost?: boolean}; onOpenPost: (post: Post) => void}) {
  const {t} = useI18n()
  const [local, setLocal] = useState<Post | null>(null)
  const [details] = useQuery<PostResult>({query: POST_QUERY, variables: {id:post.id}, pause: !!post.poll})
  const current = local ?? details.data?.post ?? post
  const liked = current.likes.some(l => l.profileId === actions.myId)
  return <div className="profile-feed-item">
    {post.isRepost && <div className="profile-timeline-repost"><IonIcon icon={repeatOutline} />{t('Reposteado')}</div>}
    <PostCard view={{post:current, likeCount:current.likes.length, likedByMe:liked, repostCount:current.reposts.length, repostedByMe:current.reposts.some(r => r.profileId === actions.myId)}}
      myId={actions.myId} onOpen={onOpenPost} onOpenImage={actions.onOpenImage} onToast={actions.onToast} onDeletePost={actions.onDeletePost}
      onReportPost={actions.onReportPost ? async (id,reason) => {await actions.onReportPost?.(id,reason); return {id}} : undefined}
      onToggleLike={async () => {
        if (!actions.onToggleLike || !actions.myId) return
        await actions.onToggleLike(current)
        setLocal({...current,likes:liked ? current.likes.filter(l => l.profileId !== actions.myId) : [...current.likes,{id:`local-${actions.myId}`,profileId:actions.myId}]})
      }}
      onToggleRepost={actions.onToggleRepost ? async () => {
        const result = await actions.onToggleRepost?.(current)
        if (result) setLocal({...current,reposts:result.reposts})
        return result ?? null
      } : undefined}
      onVotePoll={actions.onVotePoll ? async id => {
        const updated = await actions.onVotePoll?.(id)
        if (updated) setLocal({...current,poll:updated.poll})
        return updated
      } : undefined}
    />
  </div>
}
export function ProfileTimeline({posts, onOpenPost, ...actions}: TimelineActions & {posts: (Post & {isRepost?: boolean})[]; onOpenPost: (post: Post) => void}) {
  return <div className="profile-feed-list">{posts.map(post => <TimelineItem key={post.id} post={post} onOpenPost={onOpenPost} {...actions}/>)}</div>
}
