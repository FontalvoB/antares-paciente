import { describe, expect, it } from 'vitest'
import type { Comment } from '../../graphql/community'
import { mergeCommunityComments } from '../community-comments'

const comment = (id: string, parentCommentId: string | null = null, replies: Comment[] = []): Comment => ({
  id, postId: 'post', parentCommentId, body: id, createdAt: '2026-10-08T12:00:00Z',
  profile: { id: 'profile', displayName: 'QA', avatarUrl: null, isSystem: false }, likes: [], replies,
})

describe('Community comments from mutations, snapshots and subscriptions', () => {
  it('deduplicates a response received both through the mutation and WebSocket', () => {
    const root = comment('root')
    const reply = comment('reply', 'root')
    const merged = mergeCommunityComments(mergeCommunityComments([root], [reply]), [reply])
    expect(merged).toHaveLength(1)
    expect(merged[0].replies.map((row) => row.id)).toEqual(['reply'])
  })
  it('attaches out-of-order replies when the parent arrives', () => {
    const orphan = mergeCommunityComments([], [comment('reply', 'root')])
    const merged = mergeCommunityComments(orphan, [comment('root')])
    expect(merged).toHaveLength(1)
    expect(merged[0].replies[0].id).toBe('reply')
  })
  it('preserves live replies when an older server snapshot arrives', () => {
    const merged = mergeCommunityComments([comment('root', null, [comment('reply', 'root')])], [comment('root')])
    expect(merged[0].replies.map((row) => row.id)).toEqual(['reply'])
  })
  it('rebuilds nested threads from a mixture of flat and nested comments', () => {
    const merged = mergeCommunityComments([comment('root')], [comment('child', 'root', [comment('grandchild', 'child')])])
    expect(merged[0].replies[0].replies[0].id).toBe('grandchild')
  })
})
