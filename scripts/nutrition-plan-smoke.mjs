// Vista Ionic real con menú ilustrativo; sin API, pacientes ni prescripciones reales.
import { chromium, expect } from 'playwright/test'
import { createServer } from 'vite'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const out = process.env.NUTRITION_PLAN_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'nutrition-plan-qa-'))
await mkdir(out, { recursive: true })
const entry = path.resolve('nutrition-plan-qa-entry.tmp.tsx')
const meals = [
 { mealType:'Desayuno',description:'Avena con fruta y yogur',foods:'Avena: 40 g; Yogur natural: 150 g; Fresas: 100 g',calories:380,proteinG:18,carbsG:54,fatG:10,fiberG:6,waterMl:250,notes:'Prepara la avena sin azúcar añadida.',suggestedTime:'07:00',sortOrder:1 },
 { mealType:'Almuerzo',description:'Pollo con arroz integral y ensalada',foods:'Pollo: 120 g; Arroz integral cocido: 150 g; Ensalada: 150 g',calories:560,proteinG:38,carbsG:62,fatG:18,fiberG:8,waterMl:300,notes:'Usa la porción indicada de aceite al preparar la ensalada.',suggestedTime:'12:00',sortOrder:2 },
 { mealType:'Snack',description:'Yogur natural con fruta',foods:'Yogur natural: 150 g; Manzana: 120 g',calories:190,proteinG:8,carbsG:28,fatG:5,fiberG:3,waterMl:250,notes:'Elige yogur sin azúcar añadida. Mantén las porciones de tu plan.',suggestedTime:'15:30',sortOrder:3 },
 { mealType:'Cena',description:'Pescado con papa y verduras',foods:'Pescado: 120 g; Papa cocida: 150 g; Verduras: 180 g',calories:470,proteinG:32,carbsG:48,fatG:15,fiberG:7,waterMl:250,suggestedTime:'19:00',sortOrder:4 },
]
const plan={id:'plan-qa',revision:1,name:'Alimentación y bienestar',durationDays:30,currentDay:10,startDate:'2026-11-01',endDate:'2026-11-30',dailyCalorieTarget:1600,dailyProteinTarget:96,dailyCarbsTarget:192,dailyFatTarget:48,dailyFiberTarget:24,dailyWaterMl:2000,allergens:'Evitar maní. Revisa los ingredientes de los productos envasados.',mealTiming:'07:00, 12:00, 15:30, 19:00',days:Array.from({length:30},(_,index)=>index+1).map(dayNumber=>({dayNumber,dailyWaterMl:dayNumber===1?1800:2000,meals:meals.map(meal=>dayNumber===1&&meal.mealType==='Snack'?{...meal,description:'Fruta con queso fresco',foods:'Pera: 120 g; Queso fresco: 40 g'}:meal)}))}
await writeFile(entry, `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{IonApp,setupIonicReact}from'@ionic/react';import'@ionic/react/css/core.css';import'@ionic/react/css/normalize.css';import'@ionic/react/css/typography.css';import'/src/theme/variables.css';import'/src/theme/global.css';import{I18nProvider}from'/src/i18n/I18nContext';import{NutritionPlanTab}from'/src/components/nutrition/NutritionPlanTab';setupIonicReact({mode:'ios'});function App(){const[plan,setPlan]=useState(${JSON.stringify(plan)});window.__setNutritionPlan=setPlan;return <IonApp><I18nProvider><main className="qa-plan"><NutritionPlanTab plan={plan} isLoading={false} error={null} fallbackRows={[]} locale="es-CO" onRetry={()=>{}}/></main></I18nProvider></IonApp>};createRoot(document.getElementById('root')).render(<App/>);`)
let browser,server
const errors=[],requests=[],results=[]
try{
 server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'nutrition-plan-qa',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url!=='/__nutrition-plan-qa')return next();try{const html=await s.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:auto!important;overflow:visible!important}ion-app{position:static!important;display:block!important;contain:none!important}.qa-plan{max-width:430px;margin:auto;padding-top:20px;background:var(--wh)}</style></head><body><div id="root"></div><script type="module" src="/nutrition-plan-qa-entry.tmp.tsx"></script></body></html>');res.setHeader('Content-Type','text/html');res.end(html)}catch(error){next(error)}})}}]})
 await server.listen();browser=await chromium.launch()
 const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'})
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/api/**',route=>{requests.push(route.request().url());return route.abort()})
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__nutrition-plan-qa`,{waitUntil:'networkidle'})
 await expect(page.getByText('Yogur natural con fruta',{exact:true})).toBeVisible()
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0))
  const geometry=await page.locator('.nutrition-plan-redesign').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,buttons:[...el.querySelectorAll('ion-button,ion-select')].map(b=>({text:b.textContent.trim(),height:b.getBoundingClientRect().height}))}))
  assert(geometry.scrollWidth<=geometry.width+1,`Overflow at ${width}`)
  assert(geometry.buttons.every(b=>b.height>=44),`Touch target at ${width}`)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Document overflow at ${width}`)
  await page.mouse.move(0,0)
  await expect(page.locator('.nutrition-meal-shortcuts .ion-activated')).toHaveCount(0)
  await page.locator('main').screenshot({path:path.join(out,`nutrition-plan-${width}-full.png`),animations:'disabled'})
  await page.getByRole('button',{name:/Meriendas y snacks/}).click()
  await expect(page.locator('article[id^="nutrition-meal-mer-"]')).toBeFocused()
  await expect(page.locator('.nutrition-meal-shortcuts .ion-activated')).toHaveCount(0)
  const snackTop=await page.locator('article[id^="nutrition-meal-mer-"]').evaluate(el=>el.getBoundingClientRect().top)
  assert(snackTop>=0&&snackTop<300,`Snack jump at ${width}`)
  await page.screenshot({path:path.join(out,`nutrition-plan-${width}-snack.png`),animations:'disabled'})
  results.push({viewportWidth:width,...geometry})
 }
 await page.setViewportSize({width:390,height:900})
 await page.locator('ion-select.nutrition-plan-day').click()
 await page.getByRole('radio',{name:'Día 1',exact:true}).click()
 await expect(page.getByText('Fruta con queso fresco',{exact:true})).toBeVisible()
 await expect(page.getByText('1.800 ml',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Volver al menú de hoy',exact:true}).click()
 await expect(page.getByText('Yogur natural con fruta',{exact:true})).toBeVisible()
 await expect(page.getByText('Día 10 de 30',{exact:true})).toBeVisible()
 // Ausencia de snack: no sustituir el menú por sugerencias inventadas.
 await page.evaluate(()=>window.__setNutritionPlan(p=>({...p,days:p.days.map(d=>({...d,meals:d.meals.filter(m=>m.mealType!=='Snack')}))})))
 await expect(page.getByText('Tu nutricionista aún no ha indicado una merienda o snack para este día.',{exact:true})).toBeVisible()
 await expect(page.getByText('Yogur natural con fruta',{exact:true})).toHaveCount(0)
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[])
 await writeFile(path.join(out,'results.json'),JSON.stringify({results,daySwitch:true,returnToday:true,missingSnack:true,errors,requests},null,2))
 console.log('Nutrition plan Ionic checks passed:',out)
}finally{await browser?.close();await server?.close();await rm(entry,{force:true})}
