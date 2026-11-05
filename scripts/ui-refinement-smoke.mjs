import { chromium } from 'playwright'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const base = process.env.PROTOCOL_PREVIEW_URL || 'http://127.0.0.1:5180'
const out = process.env.PROTOCOL_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'protocol-qa-'))
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL, headless: true })
const errors = []
try {
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message) })
// Exposición solo en la respuesta interceptada de esta prueba. No modifica la aplicación.
await page.route('**/src/context/AppContext.tsx*', async route => {
  const res = await route.fetch()
  const body = (await res.text()).replace('return ctx;', 'window.__protocolTestApp = ctx; return ctx;')
  await route.fulfill({ response: res, body })
})
const token = `${btoa('{}')}.${btoa(JSON.stringify({sub:'qa-user',exp:4102444800}))}.qa`
const tasks = ['podcast','vitals','nut','ejercicio','nutraceutico','emocional']
const titles = ['Escuchar podcast','Medir signos vitales','Nutrición','Ejercicio del día','Tomar nutracéutico','Check-in emocional']
const snapshot = { enrollmentId:'qa', todayLocalDate:'2026-11-04', todayPoints:0, todayBonusAvailable:false, todayPointsMax:600, dailyBonusAmount:50,
 template:{id:'qa',code:'qa',name:'Programa',totalWeeks:24,currentWeekNumber:3,currentWeekStatus:'Active',currentWeekStartDateLocal:'2026-11-02',currentWeekEndDateLocal:'2026-11-08'},
 xp:{balance:350,level:'Inicial',nextLevelAt:1000},streak:{current:5,longest:9,freezesRemaining:1,multiplierActive:1,multiplierEndsAt:null,multiplierRemainingHours:0,nbStreak:2},nextMilestoneDays:7, calendar:[],
 streakChests:[{days:7,xp:100,granted:false},{days:14,xp:200,granted:false}],
 todayTasks:tasks.map((taskCode,i) => ({taskCode,title:titles[i],short:'Tu actividad asignada para hoy',points:100,status:'Pending',completedAt:null,content:taskCode==='podcast'?{
 title:'Pequeños hábitos, grandes cambios', author:'Equipo Copp Adresd',description:'Descubre cómo dar espacio a tu bienestar en la vida cotidiana. Un episodio para reflexionar sobre tus hábitos y avanzar paso a paso.',durationSecs:600,mediaUrl:`${base}/qa-audio.wav`,chapters:[{atSeconds:0,label:'Introducción'},{atSeconds:120,label:'Tu siguiente paso'}],takeaways:['Un día a la vez.']
 }:taskCode==='ejercicio'?{exerciseRoutineName:'Movimiento y bienestar',exercises:[{name:'Marcha en el lugar',description:'Marchar en el sitio elevando las rodillas a altura moderada. Mover los brazos de forma natural.',durationSecs:60,restSeconds:30,targetMuscle:'Piernas',equipment:'Ninguno',sortOrder:1},{name:'Plancha',description:'Mantén la posición indicada por tu equipo.',durationSecs:45,sets:3,restSeconds:30,sortOrder:2}]}:null})) }
await page.route('**/api/**', async route => {
 const url = route.request().url()
 let body = {}
 if (url.includes('/auth/refresh')) body={accessToken:token,tokenType:'Bearer',expiresIn:3600}
 else if (url.includes('/auth/me')) body={id:'qa-user',firstName:'María',lastName:'García',email:'qa@example.test'}
 else if (url.includes('/program/me/snapshot')) body=snapshot
 else if (url.includes('/metrics-history')) body={heightCm:null,metrics:[]}
 else if (url.includes('/calendar')) body={days:[]}
 else if (url.includes('/scores')) return route.fulfill({status:404,json:{message:'Sin resultados de prueba'}})
 else if (url.includes('/appointments')) body={items:[],total:0}
 else if (url.includes('/notifications')) body={items:[],unreadCount:0}
 else if (url.includes('/measurements')) body={items:[]}
 else if (url.includes('/profile')) body={patientId:'qa-user',firstName:'María',lastName:'García',documentNumber:'qa',email:'qa@example.test'}
 else return route.fulfill({status:404,json:{message:'Sin datos de prueba'}})
 await route.fulfill({json:body})
})
await page.goto(base, {waitUntil:'domcontentloaded', timeout:60000})
await page.waitForFunction(() => window.__protocolTestApp?.flow === 'app' && !window.__protocolTestApp?.authLoading)

for (const width of [375, 768, 1440]) {
 await page.setViewportSize({width,height:900});
 await page.evaluate(()=>window.__protocolTestApp.navigate('home'));
 await page.locator('.hm-metric').first().click();
 await page.locator('.metric-modal.show-modal .mh-head').waitFor();
 const alignment=await page.locator('.mh-head').evaluate(el=>{const h=el.getBoundingClientRect(),b=el.querySelector('ion-button').getBoundingClientRect();return Math.abs(h.right-b.right)});
 if(alignment>2) throw new Error('Close button not right aligned: '+alignment);
 await page.screenshot({path:`${out}/metrics-${width}.png`});
 await page.locator('.metric-modal').getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.evaluate(()=>window.__protocolTestApp.navigate('prof'));
 await page.locator('.pf-program-ring').waitFor();
 if(await page.locator('.pf-discover').count())throw new Error('Discover section remains');
 if(await page.locator('.pf-program-ring > span').count())throw new Error('Ring text remains');
 await page.screenshot({path:`${out}/profile-${width}.png`});
 await page.evaluate(()=>window.__protocolTestApp.openPanic());
 await page.locator('.sos-service-action').first().waitFor();
 await page.waitForTimeout(500);
 await page.getByRole('button',{name:'Colombia',exact:true}).click();
 for (const button of await page.locator('.sos-service-action').all()) {
   await button.hover();
   const colors=await button.evaluate(el=>{
     const native=el.shadowRoot.querySelector('[part="native"]');
     return {background:getComputedStyle(native).backgroundColor,color:getComputedStyle(el.querySelector('.sos-service-copy strong')).color,opacity:getComputedStyle(el).opacity};
   });
   console.log('SOS hover',colors);
   if(Number(colors.opacity)<0.99 || colors.background===colors.color)throw new Error('SOS hover contrast lost');
 }
 await page.getByRole('button',{name:'Colombia',exact:true}).hover();
 await page.screenshot({path:`${out}/country-hover-${width}.png`});
 await page.locator('.sos-service-action').first().hover();
 await page.locator('.sos-service-action').first().focus();
 const overflow=await page.locator('.sos-service-content').evaluateAll(els=>els.some(el=>el.scrollWidth>el.clientWidth+1));
 if(overflow)throw new Error('SOS row overflow');
 await page.screenshot({path:`${out}/sos-${width}.png`});
 await page.evaluate(()=>window.__protocolTestApp.closePanic());
}
await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>window.__protocolTestApp.navigate('chat'));
await page.waitForTimeout(500);
await page.screenshot({path:`${out}/vita-chat.png`});
await page.evaluate(()=>{const a=window.__protocolTestApp;a.finishOnboarding(a.user)});
await page.waitForFunction(()=>window.__protocolTestApp.flow==='tests');
await page.evaluate(()=>window.__protocolTestApp.finishTests());
await page.locator('.vita-welcome-modal.show-modal').waitFor();
await page.waitForTimeout(600);
await page.screenshot({path:`${out}/vita-welcome.png`});
console.log('Visual checks OK; browser errors:',errors,'Screenshots:',out);
if(errors.length)process.exitCode=1;
} finally {await browser.close()}
