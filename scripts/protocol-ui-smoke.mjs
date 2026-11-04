import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
const base = process.env.PROTOCOL_PREVIEW_URL || 'http://127.0.0.1:5180'
const out = 'node_modules/.cache/protocol-qa'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
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
await page.screenshot({path:`${out}/initial.png`})
await page.locator('.wheel-node-action').first().waitFor()
await page.screenshot({path:`${out}/home.png`})
for (const [id, expected] of [['podcast','program-podcast'],['vitals','program-vitals'],['ejercicio','program-ejercicio'],['nut','program-nut'],['nutraceutico','program-nutraceutico'],['emocional','program-emocional'],['chest','program-racha']]) {
 await page.evaluate(() => window.__protocolTestApp.navigate('home'))
 await page.locator(`[data-task="${id}"] ion-button`).click()
 await page.waitForFunction(s => window.__protocolTestApp.screen === s, expected)
 await page.waitForTimeout(500)
 if (id !== 'chest') {
   if (await page.locator('ion-modal.lesson-modal').count()) throw new Error('Activity still uses a modal')
   await page.getByRole('button',{name:'Volver al protocolo',exact:true}).waitFor()
 }
 await page.screenshot({path:`${out}/${id}-mobile.png`})
 console.log('Navigation OK:', id)
}
for (const [width,height] of [[390,844],[768,1024],[1440,900]]) {
 await page.setViewportSize({width,height})
 for (const id of ['podcast','ejercicio','vitals']) {
   await page.evaluate(id => window.__protocolTestApp.navigate(`program-${id}`),id)
   await page.waitForTimeout(400)
   const overflow = await page.locator('.lesson-sheet').evaluate(el => el.scrollWidth > el.clientWidth+1)
   if (overflow) throw new Error(`Overflow ${id} at ${width}`)
   await page.screenshot({path:`${out}/${id}-${width}.png`})
 }
}
await page.evaluate(() => window.__protocolTestApp.navigate('program-ejercicio'))
await page.getByRole('button',{name:'Iniciar circuito',exact:true}).click()
await page.waitForFunction(() => document.querySelector('.ex-clock')?.textContent !== '01:00')
await page.getByRole('button',{name:'Volver al protocolo',exact:true}).click()
await page.waitForFunction(() => window.__protocolTestApp.screen === 'prog')
await page.evaluate(() => window.__protocolTestApp.navigate('program-ejercicio'))
await page.waitForFunction(() => document.querySelector('.ex-clock')?.textContent === '01:00')
await page.waitForTimeout(1200)
if (await page.locator('.ex-clock').innerText() !== '01:00') throw new Error('Exercise timer continued after leaving')
console.log('Exercise pause and re-entry OK')
await page.setViewportSize({width:390,height:844})
await page.evaluate(() => { const a=window.__protocolTestApp; a.finishOnboarding(a.user) })
await page.waitForFunction(() => window.__protocolTestApp.flow === 'tests')
await page.evaluate(() => window.__protocolTestApp.finishTests())
await page.locator('.vita-welcome-modal.show-modal').waitFor()
await page.waitForTimeout(700)
await page.screenshot({path:`${out}/vita-welcome.png`})
await page.getByRole('button',{name:'Conocer a Vita'}).click()
await page.waitForFunction(() => window.__protocolTestApp.screen === 'chat')
await page.waitForTimeout(600)
await page.screenshot({path:`${out}/vita-chat.png`})
await page.evaluate(() => window.__protocolTestApp.openTests())
await page.waitForFunction(() => window.__protocolTestApp.flow === 'tests')
await page.evaluate(() => window.__protocolTestApp.finishTests())
await page.waitForTimeout(300)
if (await page.locator('.vita-welcome-modal.show-modal').count()) throw new Error('Welcome repeated after retaking tests')
console.log('Welcome lifecycle OK; screenshots:', out)
console.log('Browser errors:', errors)
if(errors.length) process.exitCode=1
} finally { await browser.close() }


