import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import {ProfileTimeline} from '../ProfileTimeline'
import type {Post} from '../../../graphql/community'
vi.mock('urql',()=>({useQuery:()=>[{data:undefined}]}))
vi.mock('@ionic/react',()=>({IonIcon:()=>null,IonAlert:()=>null}))
vi.mock('../../../i18n/I18nContext',()=>({useI18n:()=>({t:(key:string)=>key})}))
vi.mock('../PostCard',()=>({PostCard:({view,onToggleLike}:{view:{likedByMe:boolean};onToggleLike:()=>Promise<void>})=><button className={view.likedByMe ? 'liked' : ''} aria-label={view.likedByMe ? 'Quitar me gusta' : 'Me gusta'} aria-pressed={view.likedByMe} onClick={()=>void onToggleLike()}/>}))
vi.mock('../community',()=>({Avatar:()=>null,timeAgo:()=> 'ahora'}))
it('likes directly without opening the post and reflects selected state',async()=>{
 const post={id:'post',body:'Hola',profile:{id:'me',displayName:'Test'},likes:[],reposts:[],comments:[],createdAt:'2026-10-14'} as unknown as Post
 const like=vi.fn().mockResolvedValue(undefined),open=vi.fn()
 render(<ProfileTimeline posts={[post]} myId="me" onToggleLike={like} onOpenPost={open} onToast={vi.fn()}/> )
 fireEvent.click(screen.getByRole('button',{name:'Me gusta'}))
 await waitFor(()=>expect(screen.getByRole('button',{name:'Quitar me gusta'}).getAttribute('aria-pressed')).toBe('true'))
 expect(like).toHaveBeenCalledWith(post)
 expect(open).not.toHaveBeenCalled()
 expect(screen.getByRole('button',{name:'Quitar me gusta'}).className).toBe('liked')
})
