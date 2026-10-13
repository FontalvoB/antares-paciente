import type { Post } from '../graphql/community'

export function newestFirst(a: { createdAt: string }, b: { createdAt: string }): number {
  return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
}

/** Server results win over the temporary, confirmed-publication buffer. */
export function mergePostsNewest(server: Post[], published: Post[]): Post[] {
  return [...new Map([...published, ...server].map(post => [post.id, post])).values()]
    .sort(newestFirst)
}
