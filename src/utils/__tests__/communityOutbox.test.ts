import {expect,it,vi} from 'vitest'
import type {Post} from '../../graphql/community'
it('shows a post before the request finishes, then replaces it without duplicates',async()=>{
 vi.resetModules()
 const {communityOutbox}=await import('../community-outbox')
 const post={id:'pending',body:'Draft'} as Post
 let finish!: (p:Post)=>void
 const saved={...post,id:'saved'}
 const release=vi.fn()
 communityOutbox.enqueue(post,()=>new Promise(resolve=>{finish=resolve}),release)
 expect(communityOutbox.snapshot()[0].clientStatus).toBe('sending')
 finish(saved)
 await new Promise(resolve=>setTimeout(resolve,0))
 expect(communityOutbox.snapshot()).toEqual([saved])
 expect(release).toHaveBeenCalledOnce()
})
it('retains failed text and media instead of claiming success',async()=>{
 vi.resetModules()
 const {communityOutbox}=await import('../community-outbox')
 const post={id:'pending',body:'Achievement',imageUrl:'blob:preview'} as Post
 const release=vi.fn()
 communityOutbox.enqueue(post,async()=>{throw new Error('Upload failed')},release)
 await new Promise(resolve=>setTimeout(resolve,0))
 expect(communityOutbox.snapshot()[0]).toMatchObject({...post,clientStatus:'failed'})
 expect(release).not.toHaveBeenCalled()
})
