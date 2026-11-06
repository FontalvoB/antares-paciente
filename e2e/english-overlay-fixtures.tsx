/** Montaje aislado de componentes reales; API, dispositivos y publicación son fixtures locales. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IonApp, IonButton, setupIonicReact } from '@ionic/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider, cacheExchange, createClient, fetchExchange } from 'urql';
import { AppProvider } from '../src/context/AppContext';
import { I18nProvider } from '../src/i18n/I18nContext';
import { RoomDeviceSettings } from '../src/components/RoomDeviceSettings';
import { RoomChatPanel } from '../src/components/RoomChatPanel';
import { AchievementCenter } from '../src/components/achievements/AchievementCenter';
import { MediaLightbox } from '../src/components/community/MediaLightbox';
import { installEnglishAudit, id } from './english-audit-fixtures.mjs';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '../src/theme/variables.css';
import '../src/theme/global.css';

setupIonicReact({mode:'ios'});
installEnglishAudit();
const qa = window as any;
qa.__overlayChatMode='empty';
qa.__overlayRenderError=false;
const devices = ['videoinput','audioinput','audiooutput'].map((kind,index)=>({kind,deviceId:'qa-device-'+index,groupId:'qa',label:'',toJSON(){return this}}));
Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{enumerateDevices:async()=>{if(qa.__overlayDeviceError)throw Error('Controlled device failure');return devices},addEventListener(){},removeEventListener(){}}});
localStorage.setItem('copp:achievements:v1:'+id,JSON.stringify({enrollment:id,items:[{id:'qa-streak',kind:'streak',value:5,earnedAt:new Date().toISOString(),readAt:null},{id:'qa-day',kind:'day',value:1,earnedAt:new Date().toISOString(),readAt:null}]}));
const original=window.fetch;
window.fetch=async(input,init={})=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.origin);
 if(url.pathname.includes('/chat/messages')){
  qa.__englishAudit.requests.push({path:url.pathname,method:init.method||'GET',scenario:qa.__overlayChatMode});
  const mode=qa.__overlayChatMode;
  if(mode==='loading')await new Promise(resolve=>setTimeout(resolve,1200));
  if(mode==='error'||mode==='ended'||(mode==='send-error'&&init.method==='POST'))return new Response(JSON.stringify({message:'Controlled failure'}),{status:mode==='ended'?409:500,headers:{'Content-Type':'application/json'}});
  const message={id:'qa-chat',appointmentId:id,senderUserId:id,senderRole:'Patient',body:init.method==='POST'?JSON.parse(String(init.body)).body:'Texto libre del profesional',createdAt:new Date().toISOString()};
  return new Response(JSON.stringify(init.method==='POST'?message:mode==='message'?[{...message,senderRole:'Professional'}]:[]),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return original(input,init);
};
const client=createClient({url:'/api/v1/community/graphql',exchanges:[cacheExchange,fetchExchange]});
const query=new QueryClient({defaultOptions:{queries:{retry:false}}});
const image='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#173c73"/><text x="150" y="100" fill="white" text-anchor="middle">QA image</text></svg>');
export function OverlayFixtures(){
 const [overlay,setOverlay]=useState<string|null>(null),[revision,setRevision]=useState(0);
 qa.__overlayControl={setOverlay,reload:()=>setRevision(current=>current+1)};
 return <IonApp><div style={{padding:24}}><h1>Controlled overlay fixtures</h1>{['devices','chat','chat-disabled','achievements','image','video'].map(name=><IonButton key={name} onClick={()=>name==='achievements'?window.dispatchEvent(new Event('achievements:open')):setOverlay(name)}>QA {name}</IonButton>)}</div>
  {overlay==='devices'&&<RoomDeviceSettings key={revision} isOpen onClose={()=>setOverlay(null)} canCamera canMicrophone busy={false} error="" outputId="" inputIds={{camera:'qa-device-0',microphone:'qa-device-1'}} onInput={async()=>true} onOutput={async()=>{}}/>}
  {(overlay==='chat'||overlay==='chat-disabled')&&<RoomChatPanel key={revision} appointmentId={id} enabled={overlay==='chat'} onClose={()=>setOverlay(null)}/>}
  <AchievementCenter/>
  {(overlay==='image'||overlay==='video')&&<MediaLightbox url={overlay==='image'?image:'/qa-unavailable-video.mp4'} mediaType={overlay==='image'?'IMAGE':'VIDEO'} onClose={()=>setOverlay(null)}/>}</IonApp>;
}
createRoot(document.getElementById('root')!).render(<I18nProvider><QueryClientProvider client={query}><Provider value={client}><AppProvider><OverlayFixtures/></AppProvider></Provider></QueryClientProvider></I18nProvider>);
