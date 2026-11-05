// Prueba de la vista Ionic real; wearable y guardado se simulan sin tocar pacientes ni hardware.
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const out = process.env.EMOTIONAL_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'emotional-qa-'))
await mkdir(out, { recursive: true })
const entry = path.resolve('emotional-qa-entry.tmp.tsx')
await writeFile(entry, `import React from 'react';import{createRoot}from'react-dom/client';import{IonApp,setupIonicReact}from'@ionic/react';import'@ionic/react/css/core.css';import'@ionic/react/css/normalize.css';import'@ionic/react/css/typography.css';import'/src/theme/variables.css';import'/src/theme/global.css';import{I18nProvider}from'/src/i18n/I18nContext';import{EmotionalLesson}from'/src/pages/program/EmotionalLesson';setupIonicReact({mode:'ios'});createRoot(document.getElementById('root')).render(<IonApp><I18nProvider><div className="app-stage"><div className="app-shell"><div className="screen lesson-page lesson-emocional"><div className="screen-scroll no-nav lesson-page-scroll"><div className="lesson-sheet"><EmotionalLesson done={false} pts={50} onComplete={p=>window.__emotionalSaved=p}/></div></div></div></div></div></I18nProvider></IonApp>);`)
const fixture = `import{useSyncExternalStore}from'react';let value={device:{deviceId:'ring-test',name:'R88 C1BF'},syncing:false,lastSyncAt:Date.now(),samples:{sleep:{metric:'sleep',value:427,unit:'min',ts:new Date().setHours(7,0,0,0),deviceId:'ring-test',source:'history',sleepDurationVersion:1}}};window.__setEmotionalWearable=patch=>{value={...value,...patch};window.dispatchEvent(new Event('emotional-fixture'))};const subscribe=f=>{window.addEventListener('emotional-fixture',f);return()=>window.removeEventListener('emotional-fixture',f)};export function useWearable(){return useSyncExternalStore(subscribe,()=>value)}`
let browser, server
const errors=[]
try {
 server=await createServer({server:{host:'127.0.0.1',port:0},plugins:[{name:'emotional-fixture',enforce:'pre',resolveId(source,importer){if(importer?.includes('/pages/program/EmotionalLesson.tsx')&&source.endsWith('/context/WearableContext'))return '\0emotional-fixture'},load(id){if(id==='\0emotional-fixture')return fixture},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url!=='/__emotional-qa')return next();try{const html=await s.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/emotional-qa-entry.tmp.tsx"></script></body></html>');res.setHeader('Content-Type','text/html');res.end(html)}catch(error){next(error)}})}}]})
 await server.listen()
 browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:390,height:900}})
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__emotional-qa`,{waitUntil:'networkidle'})
 await page.getByText('7 h 07 min',{exact:true}).waitFor()
 const sizes=[]
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:900})
  await page.locator('.screen-scroll').evaluate(el=>el.scrollTop=0)
  const geometry=await page.locator('.emotion-checkin').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,buttons:[...el.querySelectorAll('ion-button')].map(b=>({label:b.textContent.trim(),height:b.getBoundingClientRect().height}))}))
  assert.ok(geometry.scrollWidth<=geometry.width+1,`Horizontal overflow at ${width}`)
  assert.ok(geometry.buttons.every(b=>b.height>=43),`Small touch target at ${width}`)
  sizes.push({width,...geometry})
  await page.screenshot({path:path.join(out,`emotional-${width}-top.png`)})
  await page.getByRole('button',{name:/Guardar evaluación/}).scrollIntoViewIfNeeded()
  await page.screenshot({path:path.join(out,`emotional-${width}-bottom.png`)})
 }
 await page.setViewportSize({width:390,height:900})
 await page.getByRole('button',{name:'Bien',exact:true}).click()
 await page.getByRole('button',{name:'Corregir este dato',exact:true}).click()
 await page.getByLabel('Horas de sueño',{exact:true}).fill('7,5')
 await page.getByRole('button',{name:'Aplicar',exact:true}).click()
 await page.evaluate(()=>window.__setEmotionalWearable({samples:{sleep:{metric:'sleep',value:399,unit:'min',ts:Date.now(),deviceId:'ring-test',source:'history',sleepDurationVersion:1}}}))
 await page.getByRole('button',{name:/Guardar evaluación/}).click()
 const saved=await page.evaluate(()=>window.__emotionalSaved)
 assert.equal(saved.emotional.sleepMinutes,450)
 assert.equal(saved.emotional.sleepSource,'manual')
 assert.equal(saved.emotional.sleepRecordedAt,undefined)
 assert.equal(saved.emotional.sleepDeviceId,undefined)
 assert.equal(saved.emotional.stressScore,undefined)
 await page.getByRole('button',{name:'No tengo este dato',exact:true}).click()
 await page.getByRole('button',{name:'Reparador',exact:true}).click()
 await page.getByRole('button',{name:/Guardar evaluación/}).click()
 const unknown=await page.evaluate(()=>window.__emotionalSaved.emotional)
 assert.equal(unknown.sleepSource,'unknown');assert.equal(unknown.sleepMinutes,undefined);assert.equal(unknown.sleepQuality,'restorative')
 assert.deepEqual(errors,[])
 await writeFile(path.join(out,'results.json'),JSON.stringify({sizes,saved,unknown,errors},null,2))
 console.log('Emotional Ionic layout and functional checks passed:',out)
}finally{await browser?.close();await server?.close();await rm(entry,{force:true})}
