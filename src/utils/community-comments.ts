import type { Comment } from '../graphql/community'

/** Une snapshots y eventos (incluidas respuestas fuera de orden) sin duplicar IDs. */
export function mergeCommunityComments(current: Comment[], incoming: Comment[]): Comment[] {
  const rows = new Map<string, Comment>()
  const visit = (comments: Comment[]) => {
    for (const comment of comments) {
      rows.set(comment.id, { ...comment, replies: [] })
      visit(comment.replies ?? [])
    }
  }
  visit(current)
  visit(incoming)
  const roots: Comment[] = []
  for (const comment of rows.values()) {
    const parent = comment.parentCommentId ? rows.get(comment.parentCommentId) : undefined
    if (parent && parent.id !== comment.id) parent.replies.push(comment)
    else roots.push(comment)
  }
  return roots
}
