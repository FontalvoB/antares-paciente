import { useRef, useState, type PointerEvent } from 'react'
import { useI18n } from '../../i18n/I18nContext'
type View = {scale:number;x:number;y:number}
const initial: View = {scale:1,x:0,y:0}
export function ZoomableImage({src,alt}: {src:string;alt:string}) {
  const {t}=useI18n()
  const [view,setView]=useState(initial)
  const current=useRef(initial)
  const stage=useRef<HTMLDivElement>(null)
  const points=useRef(new Map<number,{x:number;y:number}>())
  const origin=useRef({view:initial,x:0,y:0,distance:0})
  const moved=useRef(false)
  const lastTap=useRef(0)
  const touchZoomAt=useRef(0)
  function update(next:View) {
    const rect=stage.current?.getBoundingClientRect()
    const scale=Math.max(1,Math.min(4,next.scale))
    const maxX=(rect?.width??0)*(scale-1)/2,maxY=(rect?.height??0)*(scale-1)/2
    const bounded={scale,x:Math.max(-maxX,Math.min(maxX,next.x)),y:Math.max(-maxY,Math.min(maxY,next.y))}
    current.current=bounded;setView(bounded)
  }
  function start() {
    const values=[...points.current.values()]
    const a=values[0],b=values[1]
    if (!a) return
    origin.current={view:current.current,x:b?(a.x+b.x)/2:a.x,y:b?(a.y+b.y)/2:a.y,distance:b?Math.hypot(a.x-b.x,a.y-b.y):0}
  }
  function down(e:PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    points.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    moved.current=false
    if(points.current.size>1) {moved.current=true;lastTap.current=0}
    start()
  }
  function move(e:PointerEvent<HTMLDivElement>) {
    if(!points.current.has(e.pointerId))return
    points.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    const [a,b]=[...points.current.values()],base=origin.current
    const x=b?(a.x+b.x)/2:a.x,y=b?(a.y+b.y)/2:a.y
    if(Math.hypot(x-base.x,y-base.y)>5||b)moved.current=true
    if(b&&base.distance) {
      const scale=Math.max(1,Math.min(4,base.view.scale*Math.hypot(a.x-b.x,a.y-b.y)/base.distance))
      const rect=stage.current!.getBoundingClientRect(),ratio=scale/base.view.scale
      update({scale,x:x-(rect.left+rect.width/2)-(base.x-(rect.left+rect.width/2)-base.view.x)*ratio,y:y-(rect.top+rect.height/2)-(base.y-(rect.top+rect.height/2)-base.view.y)*ratio})
    } else if(current.current.scale>1) update({...base.view,x:base.view.x+x-base.x,y:base.view.y+y-base.y})
  }
  function up(e:PointerEvent<HTMLDivElement>) {
    if(e.type==='pointerup'&&e.pointerType==='touch'&&!moved.current&&points.current.size===1) {
      const now=Date.now()
      if(now-lastTap.current<300) {touchZoomAt.current=now;update(current.current.scale>1?initial:{scale:2,x:0,y:0});lastTap.current=0}
      else lastTap.current=now
    }
    points.current.delete(e.pointerId);start()
  }
  return <>
    <div ref={stage} className="mbl-zoom-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={()=>{if(Date.now()-touchZoomAt.current>350)update(current.current.scale>1?initial:{scale:2,x:0,y:0})}}>
      <img className="mbl-zoom-image" src={src} alt={alt} draggable={false} style={{transform:`translate(${view.x}px, ${view.y}px) scale(${view.scale})`}} />
    </div>
    <div className="mbl-zoom-tools">
      <button type="button" aria-label={t('Alejar')} disabled={view.scale<=1} onClick={()=>update({...view,scale:view.scale-.5})}>−</button>
      <button type="button" aria-label={t('Restablecer zoom')} onClick={()=>update(initial)}>{Math.round(view.scale*100)}%</button>
      <button type="button" aria-label={t('Acercar')} disabled={view.scale>=4} onClick={()=>update({...view,scale:view.scale+.5})}>+</button>
    </div>
  </>
}
