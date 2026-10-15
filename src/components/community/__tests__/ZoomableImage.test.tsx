import {fireEvent,render,screen} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import {ZoomableImage} from '../ZoomableImage'
vi.mock('../../../i18n/I18nContext',()=>({useI18n:()=>({t:(s:string)=>s})}))
it('zooms up to 4x and restores the full image',()=>{
 render(<ZoomableImage src="/photo.jpg" alt="Foto" />)
 for(let i=0;i<10;i++)fireEvent.click(screen.getByRole('button',{name:'Acercar'}))
 expect(screen.getByRole('button',{name:'Restablecer zoom'}).textContent).toBe('400%')
 fireEvent.click(screen.getByRole('button',{name:'Restablecer zoom'}))
 expect(screen.getByRole('button',{name:'Restablecer zoom'}).textContent).toBe('100%')
})
it('double click toggles zoom without closing the photo',()=>{
 const {container}=render(<ZoomableImage src="/photo.jpg" alt="Foto" />)
 fireEvent.doubleClick(container.querySelector('.mbl-zoom-stage')!)
 expect(screen.getByRole('button',{name:'Restablecer zoom'}).textContent).toBe('200%')
 fireEvent.doubleClick(container.querySelector('.mbl-zoom-stage')!)
 expect(screen.getByRole('button',{name:'Restablecer zoom'}).textContent).toBe('100%')
})
