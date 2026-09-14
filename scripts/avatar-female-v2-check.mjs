// Actual AvatarViewer and GLBs; no API, authentication or persistence writes.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/avatar-female-v2-validation';
const server=await createServer({configFile:false,plugins:[{
 name:'female-asset-validation',
 resolveId(id){if(id==='/female-entry')return '\0female-entry';},
 load(id){if(id==='\0female-entry')return `
 import React,{useState} from 'react';import{createRoot}from'react-dom/client';
 import{AvatarViewer}from'/src/components/avatar/AvatarViewer.tsx';
 import{I18nProvider}from'/src/i18n/I18nContext.tsx';
 function Demo(){const [s,set]=useState({hair:'female-hair-long-01',morph:'BodyVolume',value:0});
 window.setScenario=set;return React.createElement('div',{style:{height:'850px',width:'550px'}},React.createElement(AvatarViewer,{
 gender:'female',playing:true,enteredAt:0,weights:{[s.morph]:s.value},
 equipment:{hair:s.hair,clothing:{shirt:'shirt-basic-01',pants:null,shoes:null},accessories:{glasses:'glasses-01',watch:'watch-01',bracelet:'bracelet-01'}},
 onReady:m=>window.morphs=m,onMetrics:m=>window.metrics=m}));}
 createRoot(document.getElementById('root')).render(React.createElement(I18nProvider,null,React.createElement(Demo)));`;},
 configureServer(s){s.middlewares.use('/female-test',async(q,r)=>{r.setHeader('Content-Type','text/html');r.end(await s.transformIndexHtml('/female-test','<html><body style="margin:0;background:#eef1f5"><div id="root"></div><script type="module" src="/female-entry"></script></body></html>'));});}
},react()],server:{host:'127.0.0.1',port:5188,strictPort:true}});
await server.listen();let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:550,height:850}});const errors=[];const loaded=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('.glb'))loaded.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:5188/female-test');
 await page.waitForFunction(()=>window.metrics?.fps>0&&Object.values(window.metrics.equipment??{}).filter(e=>e.status==='ready').length===5,null,{timeout:60000});
 const rows=[];
 for(const hair of ['female-hair-long-01','female-hair-long-02','female-hair-long-03']){
  for(const [morph,value] of [['BodyVolume',0],['BodyVolume',.25],['BodyVolume',.5],['BodyVolume',.75],['BodyVolume',1],['BodyLean',.5],['BodyLean',1]]){
   await page.evaluate(s=>window.setScenario(s),{hair,morph,value});await page.waitForTimeout(2300);
   await page.waitForFunction(id=>window.metrics?.equipment?.hair?.id===id&&window.metrics.equipment.hair.status==='ready',hair,{timeout:30000});
   const metrics=await page.evaluate(()=>window.metrics);assert(Math.abs(metrics.morphWeights[morph]-value)<.025);
   assert(metrics.idleTime>0);rows.push({hair,morph,value,...metrics});
   if([0,1].includes(value))await page.screenshot({path:`${out}/browser-${hair}-${morph}-${value}.png`});
  }
 }
 await page.waitForTimeout(13000);const last=await page.evaluate(()=>window.metrics);assert(last.loops>=1);assert.equal(errors.length,0);
 assert(loaded.some(r=>r.url.includes('female-body-base-v2.glb')));assert(loaded.every(r=>r.status===200));
 await fs.writeFile(`${out}/browser-validation.json`,JSON.stringify({rows,last,errors,loaded,scope:'Real AvatarViewer, local asset validation without backend/login/persistence'},null,2));
 console.log(JSON.stringify({scenarios:rows.length,minFps:Math.min(...rows.map(r=>r.fps)),maxCalls:Math.max(...rows.map(r=>r.calls)),maxBytes:Math.max(...rows.map(r=>r.bytes)),loops:last.loops}));
}finally{await browser?.close();await server.close();}
