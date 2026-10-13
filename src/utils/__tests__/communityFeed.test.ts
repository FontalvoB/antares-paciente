import { expect, it } from 'vitest'
import { mergePostsNewest, newestFirst } from '../community-feed'
import type { Post } from '../../graphql/community'
const post = (id: string, createdAt: string, pinned = false) => ({ id, createdAt, pinned, body: id }) as Post
it('shows a confirmed new post before older pinned posts and deduplicates when refresh arrives', () => {
  const old = post('old', '2026-10-01T10:00:00Z', true)
  const fresh = post('new', '2026-10-13T10:00:00Z')
  expect(mergePostsNewest([old], [fresh]).map(p => p.id)).toEqual(['new', 'old'])
  const updated = { ...fresh, body: 'server state' }
  expect(mergePostsNewest([old, updated], [fresh])).toEqual([updated, old])
})
it('interleaves club and personal posts by actual time', () => {
  const items = [post('club', '2026-10-01T10:00:00Z'), post('personal', '2026-10-13T10:00:00Z')]
  expect(items.sort(newestFirst).map(p => p.id)).toEqual(['personal', 'club'])
})
