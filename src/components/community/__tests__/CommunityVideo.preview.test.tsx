import {fireEvent,render} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import {CommunityVideo} from '../CommunityVideo'
vi.mock('../../../i18n/I18nContext',()=>({useI18n:()=>({t:(s:string)=>s})}))
it('loads and seeks an initial frame without autoplaying the video',()=>{
 const {container}=render(<CommunityVideo src="/video.mov" muted playsInline preload="metadata" />)
 const video=container.querySelector('video')!
 Object.defineProperty(video,'duration',{value:5})
 fireEvent.loadedMetadata(video)
 expect(video.preload).toBe('auto')
 expect(video.currentTime).toBe(0.1)
 expect(video.autoplay).toBe(false)
})
it('keeps the initial position when a poster is supplied',()=>{
 const {container}=render(<CommunityVideo src="/video.mp4" poster="/poster.jpg" />)
 const video=container.querySelector('video')!
 Object.defineProperty(video,'duration',{value:5})
 fireEvent.loadedMetadata(video)
 expect(video.currentTime).toBe(0)
})
