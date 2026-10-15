import {act,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import type {Post} from '../../../graphql/community'
import {PostCard} from '../PostCard'
vi.mock('@ionic/react',()=>({IonIcon:()=>null,IonModal:()=>null,IonAlert:()=>null}))
vi.mock('../OwnPostDeleteButton',()=>({OwnPostDeleteButton:()=>null}))
vi.mock('../community',()=>({Avatar:()=>null,timeAgo:()=> 'ahora'}))
vi.mock('../../../i18n/I18nContext',()=>({useI18n:()=>({t:(s:string)=>s})}))
afterEach(()=>vi.useRealTimers())
function setup(liked=false, mediaType: 'IMAGE'|'VIDEO' = 'IMAGE', mutation?: () => Promise<void>) {
 const post={id:'p',body:'Foto',profile:{id:'a',displayName:'Ana'},imageUrl:'/photo.png',mediaType,likes:[],reposts:[],comments:[],poll:null} as unknown as Post
 const like=mutation ? vi.fn(mutation) : vi.fn().mockResolvedValue(undefined),open=vi.fn()
 const result=render(<PostCard view={{post,likeCount:0,likedByMe:liked,repostCount:0,repostedByMe:false}} onOpen={vi.fn()} onOpenImage={open} onToggleLike={like} onToast={vi.fn()}/>)
 return {like,open,result}
}
it('opens full photo on a single tap, and likes with a heart on double tap',async()=>{
 vi.useFakeTimers();const {like,open,result}=setup()
 const photo=screen.getByAltText('Imagen de Ana')
 fireEvent.click(photo);act(()=>vi.advanceTimersByTime(301));expect(open).toHaveBeenCalledOnce()
 open.mockClear()
 await act(async()=>{fireEvent.click(photo);fireEvent.click(photo)})
 act(()=>vi.advanceTimersByTime(301))
 expect(open).not.toHaveBeenCalled();expect(like).toHaveBeenCalledOnce()
 expect(result.container.querySelector('.com-dbl-heart')).toBeTruthy()
 act(()=>vi.advanceTimersByTime(1100))
 expect(result.container.querySelector('.com-dbl-heart')).toBeNull()
})
it('does not unlike an already liked photo on double tap',()=>{
 vi.useFakeTimers();const {like}=setup(true)
 const photo=screen.getByAltText('Imagen de Ana');fireEvent.click(photo);fireEvent.click(photo)
 expect(like).not.toHaveBeenCalled()
})

it('leaves video taps to the inline player without opening the lightbox',()=>{
 vi.useFakeTimers();const {open,result}=setup(false,'VIDEO')
 fireEvent.click(result.container.querySelector('video')!)
 act(()=>vi.advanceTimersByTime(500))
 expect(open).not.toHaveBeenCalled()
})

it('updates the heart before saving and rolls back a rejected like',async()=>{
 let reject!: (error:Error)=>void
 const pending=new Promise<void>((_,fail)=>{reject=fail})
 const {result}=setup(false,'IMAGE',()=>pending)
 fireEvent.click(screen.getByRole('button',{name:'Me gusta'}))
 expect(screen.getByRole('button',{name:'Quitar me gusta'}).getAttribute('aria-pressed')).toBe('true')
 expect(result.container.querySelector('.com-react-count')?.textContent).toBe('1')
 await act(async()=>{reject(new Error('Network unavailable'))})
 expect(screen.getByRole('button',{name:'Me gusta'}).getAttribute('aria-pressed')).toBe('false')
 expect(result.container.querySelector('.com-react-count')?.textContent).toBe('0')
})
