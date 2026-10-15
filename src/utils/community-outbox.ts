import type { Post } from '../graphql/community'
let posts: Post[] = []
const listeners = new Set<() => void>()
function emit() { for (const listener of listeners) listener() }
export const communityOutbox = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  snapshot: () => posts,
  enqueue(post: Post, send: () => Promise<Post>, release?: () => void) {
    posts = [{...post, clientStatus:'sending'}, ...posts]; emit()
    void send().then(saved => {
      posts = posts.filter(item => item.id !== post.id && item.id !== saved.id)
      posts = [saved,...posts]; release?.(); emit()
    }).catch(() => {
      posts = posts.map(item => item.id === post.id ? {...item, clientStatus:'failed'} : item); emit()
    })
  },
}
