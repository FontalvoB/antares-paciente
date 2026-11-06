/** QA visual aislado: respuestas interceptadas, sin escrituras al backend. */
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
const base = process.env.PROTOCOL_PREVIEW_URL || 'http://127.0.0.1:5180'
const out = path.resolve(process.env.KAN45_OUTPUT || '.artifacts/kan45/after')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true })
const errors = []
const meals = [
  { mealType:'Desayuno', description:'Un comienzo lleno de energía', foods:'Avena con yogur natural y fruta fresca', calories:420, proteinG:22, carbsG:55, fatG:12, fiberG:7, suggestedTime:'07:30', notes:'Acompaña con un vaso de agua.' },
  { mealType:'Almuerzo', description:'Pollo con arroz y vegetales', foods:'Pollo a la plancha, arroz integral y ensalada', calories:580, proteinG:40, carbsG:65, fatG:18, fiberG:8, suggestedTime:'12:30', notes:'Sirve los vegetales en la mitad del plato.' },
  { mealType:'Merienda', description:'Una pausa para recargar', foods:'Yogur natural con nueces', calories:220, proteinG:14, carbsG:20, fatG:10, fiberG:3, suggestedTime:'16:00' },
  { mealType:'Cena', description:'Termina el día con equilibrio', foods:'Pescado al horno con verduras y papa', calories:480, proteinG:34, carbsG:50, fatG:16, fiberG:7, suggestedTime:'19:00' },
]
const plan = {id:'qa-plan',revision:1,name:'Alimentación equilibrada · Plan personalizado',description:'Comidas variadas para acompañar tus hábitos, con porciones indicadas por tu nutricionista.',dailyCalorieTarget:1700,dailyProteinTarget:110,dailyCarbsTarget:190,dailyFatTarget:56,dailyFiberTarget:25,dailyWaterMl:2000,currentDay:6,durationDays:30,startDate:'2026-11-01',endDate:'2026-11-30',meals}
const snapshot = {enrollmentId:'qa',todayLocalDate:'2026-11-06',todayPoints:0,todayBonusAvailable:false,todayPointsMax:600,dailyBonusAmount:50,template:{id:'qa',code:'qa',name:'Programa',totalWeeks:24,currentWeekNumber:3,currentWeekStatus:'Active',currentWeekStartDateLocal:'2026-11-02',currentWeekEndDateLocal:'2026-11-08'},xp:{balance:350,level:'Inicial',nextLevelAt:1000},streak:{current:5,longest:9,freezesRemaining:1,multiplierActive:1,multiplierEndsAt:null,multiplierRemainingHours:0,nbStreak:2},nextMilestoneDays:7,calendar:[],streakChests:[],todayTasks:[{taskCode:'nut',title:'Cumplir plan nutricional',short:'Tu alimentación de hoy',points:100,status:'Pending',completedAt:null,content:{nutritionPlanName:plan.name,dailyCalorieTarget:1700,nutritionMeals:meals,nutritionIntakeLogs:[]}}]}
const nutrition = {calories:550,protein:38,carbohydrates:61,fat:17,fiber:7,sugar:3,sodium:230}
const result = {analysisId:'qa-analysis',provider:'llm',status:'completed',foods:[{name:'Pollo a la plancha',confidence:.94,portion:{estimatedGrams:140,minGrams:125,maxGrams:155},nutrition:{...nutrition,calories:230,protein:32,carbohydrates:0,fat:10,fiber:0},nutritionStatus:'available',nutritionSource:'llm_estimate'},{name:'Arroz integral y vegetales',confidence:.86,portion:{estimatedGrams:220,minGrams:200,maxGrams:250},nutrition:{...nutrition,calories:320,protein:6,carbohydrates:61,fat:7,fiber:7},nutritionStatus:'available',nutritionSource:'llm_estimate'}],summary:nutrition,intake:{calories:550,proteinG:38,carbsG:61,fatG:17,fiberG:7}}
let planState = 'active', failAnalysis = false, analysisDelay = 1200
let completeCalls = 0, saveCalls = 0, rejectCompletion = true
try {
 const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'})
 page.setDefaultTimeout(15000)
 await page.addInitScript(()=>{
  // Sin cámara física durante QA: verifica la alternativa de galería.
  if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('Sin cámara de prueba','NotFoundError'))
 })
 page.on('pageerror', e=>errors.push(e.message))
 await page.route('**/src/context/AppContext.tsx*',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:(await res.text()).replace('return ctx;','window.__kan45 = ctx; return ctx;')})})
 const token=`${btoa('{}')}.${btoa(JSON.stringify({sub:'qa-user',exp:4102444800}))}.qa`
 await page.route('**/api/**',async route=>{
  const url=route.request().url();let body={}
  if(url.includes('/auth/refresh'))body={accessToken:token,tokenType:'Bearer',expiresIn:3600}
  else if(url.includes('/auth/me'))body={id:'qa-user',firstName:'María',lastName:'García',email:'qa@example.test'}
  else if(url.includes('/program/me/snapshot'))body=snapshot
  else if(url.includes('/nutrition-plan/status'))body={status:planState==='empty'?'no_plan':'active',planId:plan.id,revision:1,currentDay:6,durationDays:30,startDate:plan.startDate,endDate:plan.endDate}
  else if(url.includes('/nutrition-plan')){
   if(planState==='loading')await new Promise(r=>setTimeout(r,2000))
   if(planState==='error')return route.fulfill({status:503,json:{message:'No se pudo cargar el plan alimentario'}})
   if(planState==='empty')return route.fulfill({status:404,json:{message:'Sin plan'}})
   body=plan
  }
  else if(url.includes('/foodai/analyze')){await new Promise(r=>setTimeout(r,analysisDelay));if(failAnalysis)return route.fulfill({status:422,json:{message:'No se identificaron alimentos con suficiente confianza.'}});body=result}
  else if(url.includes('/foodai/analyses/'))body={...result,imageKey:'qa-photo'}
  else if(url.includes('/storage/sign'))body={url:`${base}/src/assets/nutrition/daily-mediterranean.jpg`}
  else if(url.includes('/nutrition/log') && route.request().method()==='POST'){
   saveCalls++
   const payload=route.request().postDataJSON();if(payload.intake?.source!=='ai_photo'||payload.intake?.foodAnalysisId!==result.analysisId)throw new Error('Payload de foto incorrecto')
   snapshot.todayTasks[0].content.nutritionIntakeLogs=[{...payload.intake,mealCode:payload.mealCode,localDate:'2026-11-06',createdAt:'2026-11-06T17:30:00Z'}]
   body={xpAwarded:0}
  }
  else if(url.includes('/tasks/complete')){
   completeCalls++
   if(rejectCompletion)return route.fulfill({status:422,json:{title:'Faltan comidas del plan',detail:'Faltan comidas del plan',code:'NUTRITION_EVIDENCE_REQUIRED',errors:{missingMealCodes:['des','mer','cen']}}})
   body={taskCompletionId:'qa',pointsAwarded:100,xpBalanceAfter:450,isPerfectDay:false,dailyBonusAwarded:0,streakCurrent:5,dayPoints:100,dayPointsMax:600};snapshot.todayTasks[0].status='Completed'
  }
  else if(url.includes('/metrics-history'))body={heightCm:null,metrics:[]}
  else if(url.includes('/calendar'))body={days:[],summary:{}}
  else if(url.includes('/appointments'))body={items:[],total:0}
  else if(url.includes('/notifications'))body={items:[],unreadCount:0}
  else if(url.includes('/measurements'))body={items:[]}
  else if(url.includes('/profile'))body={patientId:'qa-user',firstName:'María',lastName:'García',documentNumber:'qa',email:'qa@example.test'}
  else return route.fulfill({status:404,json:{message:'Sin datos de prueba'}})
  await route.fulfill({json:body})
 })
 const shot=async name=>{await page.waitForTimeout(250);await page.screenshot({path:path.join(out,`${name}.png`)});console.log(name)}
 const reload=async()=>{await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__kan45?.flow==='app'&&!window.__kan45?.authLoading);await page.evaluate(()=>window.__kan45.navigate('nut'));await page.getByText('Tu día, bien nutrido.',{exact:true}).waitFor()}
 await reload()
 await shot('01-nutricion-hoy')
 await page.evaluate(()=>window.__kan45.navigate('home'))
 await page.locator('[data-task="nut"] ion-button').click()
 await page.waitForTimeout(500)
 await shot('02-acceso-protocolo')
 if(process.env.KAN45_BEFORE!=='1'){
  if(await page.locator('.ntr-screen').count()!==1)throw new Error('El protocolo no abre Nutrición directamente')
 }else await page.evaluate(()=>window.__kan45.navigate('nut'))
 await page.locator('ion-segment-button[value="indicaciones"]').click()
 await page.locator('.ntr-plan-overview').waitFor()
 await shot('03-plan')
 await page.getByRole('button',{name:/Merienda.*Ver mi comida/}).click()
 await shot('04-merienda')
 await page.locator('ion-segment-button[value="hoy"]').click()
 await page.locator('.nut-photo-entry').scrollIntoViewIfNeeded()
 await shot('04b-tarjeta-foto-ia')
 await page.getByRole('button',{name:'Foto IA',exact:true}).nth(1).click()
 await page.locator('.food-flow-modal.show-modal').waitFor()
 await page.locator('.nut-cam-controls').waitFor()
 await shot('05-captura')
 await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({name:'comida.jpg',mimeType:'image/jpeg',buffer:await readFile('src/assets/nutrition/daily-mediterranean.jpg')})
 await page.getByText('Revisa tu foto',{exact:true}).waitFor()
 await shot('06-vista-previa')
 await page.getByRole('button',{name:'Usar foto y analizar',exact:true}).click()
 await page.getByText('Analizando tu comida…',{exact:true}).waitFor()
 await shot('07-analizando')
 await page.locator('.food-plan-check').waitFor()
 await shot('08-resultado')
 await page.locator('.food-plan-check').scrollIntoViewIfNeeded()
 await shot('09-comparacion')
 await page.locator('.food-result-card').first().scrollIntoViewIfNeeded()
 await shot('10-alimentos')
 await page.getByRole('button',{name:'Editar valores',exact:true}).click()
 await shot('11-edicion')
 await page.getByRole('button',{name:'Guardar Almuerzo',exact:true}).click()
 await page.locator('.food-flow-modal.show-modal').waitFor({state:'hidden'})
 await page.getByRole('button',{name:'Ver detalle',exact:true}).click()
 await page.getByText('Registrado con foto · análisis IA',{exact:false}).last().waitFor()
 await shot('12-registrada')
 await page.getByRole('button',{name:'Cerrar',exact:true}).last().click()
 await page.locator('.food-flow-modal.show-modal').waitFor({state:'hidden'})
 if(process.env.KAN45_BEFORE!=='1'){
  const confirm=page.getByRole('button',{name:'Cumplí el plan hoy · +100 pts',exact:true})
  await confirm.click()
  await page.waitForFunction(()=>window.__kan45.toast?.message==='Faltan comidas del plan: des, mer, cen')
  await page.waitForFunction(()=>!window.__kan45.authLoading)
  await page.waitForFunction(()=>!document.querySelector('.nut-protocol-checkin ion-button')?.disabled)
  await shot('12b-validacion-protocolo')
  // Segundo escenario: evidencia disponible para las otras comidas del día.
  snapshot.todayTasks[0].content.nutritionIntakeLogs.push(...['des','mer','cen'].map((mealCode,index)=>({mealCode,localDate:'2026-11-06',source:'manual',calories:meals[index===0?0:index+1].calories,createdAt:'2026-11-06T17:30:00Z'})))
  rejectCompletion=false
  await confirm.click()
  await page.getByRole('button',{name:'Plan de hoy completado',exact:true}).waitFor()
  await page.locator('.nut-protocol-checkin ion-spinner').waitFor({state:'hidden'})
  await page.waitForTimeout(6200)
  await page.locator('.ntr-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight})
  await shot('12c-protocolo-completado')
  if(saveCalls!==1||completeCalls!==2)throw new Error('Se duplicó un registro o una confirmación')
  snapshot.todayTasks[0].status='Pending'
  snapshot.todayTasks[0].content.nutritionIntakeLogs=snapshot.todayTasks[0].content.nutritionIntakeLogs.filter(log=>log.mealCode==='alm')
  await reload()
 }
 failAnalysis=true
 await page.getByRole('button',{name:'Foto IA',exact:true}).first().click()
 await page.locator('.food-flow-modal.show-modal').waitFor()
 await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({name:'comida.jpg',mimeType:'image/jpeg',buffer:await readFile('src/assets/nutrition/daily-mediterranean.jpg')})
 await page.getByRole('button',{name:'Usar foto y analizar',exact:true}).click()
 await page.locator('.nut-cam-error').first().waitFor()
 await shot('13-error-analisis')
 failAnalysis=false
 if(process.env.KAN45_BEFORE!=='1'){
  await page.getByRole('button',{name:'Volver a analizar',exact:true}).click()
  await page.locator('.food-plan-check').waitFor()
  if(saveCalls!==1)throw new Error('Reintentar análisis guardó una comida sin confirmación')
  await shot('13b-reintento-analisis')
 }
 await page.getByRole('button',{name:'Volver',exact:true}).last().click()
 await page.locator('.food-flow-modal.show-modal').waitFor({state:'hidden'})
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:900})
  await page.locator('ion-segment-button[value="indicaciones"]').click()
  await shot(`14-plan-${width}`)
  const overflow=await page.locator('.ntr-scroll').evaluate(el=>el.scrollWidth>el.clientWidth+1)
  if(overflow)throw new Error(`Overflow a ${width}`)
 }
 await page.setViewportSize({width:390,height:844})
 for(const state of ['loading','error','empty']){
  planState=state;await reload();await page.locator('ion-segment-button[value="indicaciones"]').click()
  if(state==='loading')await page.locator('.ntr-scroll [aria-busy="true"]').waitFor()
  if(state==='error')await page.getByRole('button',{name:'Reintentar',exact:true}).last().waitFor({timeout:20000})
  if(state==='empty')await page.getByText('Así estamos creando tu plan',{exact:true}).waitFor()
  await shot(`15-plan-${state}`)
  if(state==='error'){
   planState='active';await page.getByRole('button',{name:'Reintentar',exact:true}).last().click();await page.locator('.ntr-plan-overview').waitFor();await shot('15b-plan-recuperado')
  }
 }
 if(errors.length)throw new Error(errors.join('\n'))
 const report={output:out,errors,completeCalls,saveCalls,viewports:[375,390,768,1440],source:'Fixtures locales interceptadas en Playwright; sin escrituras reales.'}
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2))
 const files=(await readdir(out)).filter(name=>name.endsWith('.png')).sort()
 await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAN-45 · Capturas</title><style>body{font:16px/1.5 system-ui;margin:0;background:#f4f6f9;color:#142855;padding:32px}h1{font-size:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px}figure{margin:0;min-width:0}figcaption{font-weight:600;padding:12px 0}img{max-width:100%;max-height:850px;object-fit:contain;object-position:top;background:white;border:1px solid #dfe6ee;border-radius:12px}a{color:inherit}</style><h1>KAN-45 · Recorridos de nutrición</h1><p>Capturas reales del navegador con datos de prueba. 06/11/2026. Las fotografías y valores mostrados son de demostración.</p><main>${files.map(file=>`<figure><figcaption>${file.replace('.png','').replaceAll('-',' ')}</figcaption><a href="${file}" target="_blank"><img src="${file}" loading="lazy" alt="${file}"></a></figure>`).join('')}</main></html>`)
 console.log(JSON.stringify(report))
} finally {await browser.close()}
