/** Evidencia visual reproducible: componentes reales, fixture aislada, sin escribir en el stack. */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const phase = process.argv[2] ?? 'after'
const output = resolve(process.env.PREMIUM_OUTPUT ?? '../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium', phase)
mkdirSync(output, { recursive: true })
const setupSource = readFileSync('scripts/qa/nutrition-recommendations/setup-playwright.js', 'utf8')
  .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet"></head>')
  .replace('history:null', 'history:window.__qa.metrics??null')
  .replace("openPanic:()=>{}", "openPanic:()=>{window.__qa.panic=(window.__qa.panic??0)+1},openVoice:()=>{window.__qa.voice=(window.__qa.voice??0)+1}")
const setup = (0, eval)('(' + setupSource + ')')
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const lang of (process.env.PREMIUM_LANG ? [process.env.PREMIUM_LANG] : ['es', 'en'])) for (const width of (process.env.PREMIUM_WIDTH ? [Number(process.env.PREMIUM_WIDTH)] : [320, 390, 1440])) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: lang === 'es' ? 'es-CO' : 'en-US', serviceWorkers: 'block' })
    const page = await context.newPage()
    page.qaConfig = { origin: process.env.PREMIUM_ORIGIN ?? 'http://127.0.0.1:5182' }
    try { await setup(page) } catch(error) { console.error(page.qaMessages, page.qaPageErrors, page.qaNetwork); throw error }
    await page.setViewportSize({width,height:900})
    await page.evaluate(({ lang }) => {
      window.qaLang(lang)
      window.qaConfigure({ plan: { ...window.__qa.plan, dailyCalorieTarget: 1800, dailyProteinTarget: 90, dailyCarbsTarget: 220, dailyFatTarget: 60, dailyFiberTarget: 28,
        days: Array.from({length: 7}, (_,i) => ({ dayNumber:i+1, dailyWaterMl:2000, meals:[
          { mealType:'Desayuno', description:'Avena con fruta y huevo', foods:'Avena: 40 g; Leche descremada: 200 ml; Banano: 80 g; Huevo: 60 g', calories:380, proteinG:19, carbsG:52, fatG:11, fiberG:6, suggestedTime:'07:00',sortOrder:1 },
          { mealType:'Almuerzo', description:'Pollo, arroz y ensalada', foods:'Pollo: 120 g; Arroz integral: 100 g; Ensalada: 150 g', calories:560, proteinG:36, carbsG:65, fatG:17, suggestedTime:'12:30',sortOrder:2 },
          { mealType:'Snack', description:'Yogur con frutos secos', foods:'Yogur: 150 g; Nueces: 15 g', calories:210, proteinG:12, carbsG:20, fatG:10, suggestedTime:'16:00',sortOrder:3 },
          { mealType:'Cena', description:'Crema de verduras y atún', foods:'Verduras: 200 g; Atún: 100 g', calories:410, proteinG:28, carbsG:35, fatG:15, suggestedTime:'19:00',sortOrder:4 }
        ] })) }
      })
    }, { lang })
    await page.waitForTimeout(800)
    const shot = async name => {
      await page.locator('.screen-scroll').evaluate(el => el.scrollTop = 0)
      await page.waitForTimeout(650)
      await page.evaluate(()=>document.fonts.ready)
      await page.locator('.screen-scroll').evaluate(el => el.scrollTop = 0)
      const overflow = await page.evaluate(() => [...document.querySelectorAll('.app-shell,.screen-scroll')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className))
      if(overflow.length) {
        console.error(await page.locator('.screen-scroll').evaluate(root=>{const r=root.getBoundingClientRect();return {root:{width:root.clientWidth,scroll:root.scrollWidth,left:r.left,right:r.right},overflow:[...root.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>r.right+1).slice(0,15).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}}))
        await page.screenshot({path:resolve(output,`${lang}-${width}-${name}-overflow.png`),scale:'css'})
      }
      assert.deepEqual(overflow, [], `${lang}-${width}-${name} overflow`)
      await page.screenshot({ path: resolve(output, `${lang}-${width}-${name}.png`), scale:'css' })
    }
    if (phase !== 'before') {
      const modal = page.locator('ion-modal.nutrition-legal-sheet')
      await modal.waitFor({state:'visible'})
      await page.screenshot({path:resolve(output,`${lang}-${width}-legal.png`),scale:'css'})
      await page.getByRole('button',{name:lang==='es'?'Entendido':'Got it',exact:true}).click()
      await modal.waitFor({state:'hidden'})
    }
    await shot('hoy')
    await page.getByTestId('nutrition-tab-plan').click()
    await shot('plan')
    if (phase === 'before') {
      await page.getByRole('button',{name:lang==='es'?'Más secciones de nutrición':'More nutrition sections',exact:true}).click()
      await page.getByRole('button',{name:lang==='es'?'Historial':'History',exact:true}).click()
      await page.locator('ion-action-sheet').first().waitFor({state:'hidden'})
    } else await page.locator('ion-segment-button[value="historial"]').click()
    await shot('historial')
    if (phase !== 'before') {
      const checks = []
      const check = async (name, fn) => { await fn(); checks.push(name) }
      await check('historial-con-mediciones-reales-del-DTO', async () => {
        await page.evaluate(() => {
          const dates=['2026-10-01','2026-10-15','2026-11-01','2026-11-15','2026-12-01'];
          const series=(code,unit,values)=>({code,unit,target:null,favorableDirection:null,points:values.map((value,i)=>({date:dates[i],value}))});
          const snapshot=structuredClone(window.__qa.snapshot);
          snapshot.todayTasks[0].content.nutritionIntakeLogs=[{mealCode:'des',localDate:snapshot.todayLocalDate,calories:380,proteinG:19,carbsG:52,fatG:11,fiberG:6,source:'manual',createdAt:snapshot.todayLocalDate+'T12:00:00Z'}];
          snapshot.todayTasks[0].content.nutritionMeals=window.__qa.plan.days[3].meals;
          window.qaConfigure({snapshot,metrics:{heightCm:172,metrics:[series('weight','kg',[89.8,88.2,86.7,85.4,84.1]),series('bmi','kg_m2',[30.4,29.9,29.3,28.9,28.4]),series('hba1c','pct',[6.3,6.2,6.1,6,5.9]),series('body_fat','pct',[33.1,32.4,31.7,31.1,30.4])]}});
        });
        await page.locator('.ntr-weight-chart').waitFor();
        await shot('historial-datos');
        await page.getByRole('button',{name:lang==='es'?'Ver todas las mediciones':'View all measurements',exact:true}).click();
        assert.equal(await page.locator('.premium-measurement').count(),5);
        await page.getByRole('button',{name:lang==='es'?'Ver menos mediciones':'View fewer measurements',exact:true}).click();
        assert.equal(await page.locator('.premium-measurement').count(),3);
        await page.locator('.ntr-weight-chart').scrollIntoViewIfNeeded();
        await page.screenshot({path:resolve(output,`${lang}-${width}-peso.png`),scale:'css'});
      });
      await page.getByTestId('nutrition-tab-plan').click();
      await check('acordeon-y-dia-actual-sin-escrituras', async () => {
        const breakfast=page.locator('.nutrition-plan-meal').first();
        await breakfast.locator('ion-item[slot=header]').click();
        await page.waitForFunction(()=>!document.querySelector('.nutrition-plan-meal').classList.contains('accordion-expanded'));
        await breakfast.locator('ion-item[slot=header]').click();
        await page.waitForFunction(()=>document.querySelector('.nutrition-plan-meal').classList.contains('accordion-expanded'));
        const days=page.locator('.premium-days ion-button');
        await days.first().click();
        await page.waitForFunction(()=>document.querySelector('.premium-meal-actions ion-button')?.disabled===true);
        await page.getByRole('button',{name:lang==='es'?'Volver al menú de hoy':'Back to today’s menu',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.premium-meal-actions ion-button')?.disabled===false);
        await page.locator('.nutrition-plan-meal').nth(1).locator('ion-item[slot=header]').click();
        await page.locator('.nutrition-plan-meal').nth(1).locator('.premium-meal-actions ion-button').first().click();
        await page.locator('ion-modal.nutrition-register-modal').waitFor({state:'visible'});
        await page.getByRole('button',{name:lang==='es'?'Cancelar':'Cancel',exact:true}).click();
        await page.locator('ion-modal.nutrition-register-modal').waitFor({state:'hidden'});
      });
      await check('aviso-Escape-foco-y-relectura', async () => {
        await page.getByRole('button',{name:lang==='es'?'Leer aviso':'Read notice',exact:true}).click();
        await page.locator('ion-modal.nutrition-legal-sheet').waitFor({state:'visible'});
        await page.keyboard.press('Tab');
        assert(await page.locator('ion-modal.nutrition-legal-sheet').evaluate(el=>el.contains(document.activeElement)), 'Foco atrapado en la hoja');
        await page.keyboard.press('Escape');
        await page.locator('ion-modal.nutrition-legal-sheet').waitFor({state:'hidden'});
        assert.equal(await page.evaluate(()=>localStorage.getItem('antares:nutrition-notice:v1:qa-self')),'1');
        await page.getByRole('button',{name:lang==='es'?'Leer aviso':'Read notice',exact:true}).click();
        const handle=page.locator('ion-modal.nutrition-legal-sheet .modal-handle');
        await handle.waitFor({state:'visible'});
        await handle.click({trial:true});
        await page.waitForTimeout(350);
        const box=await handle.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.down();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2+500,{steps:15});
        await page.mouse.up();
        await page.locator('ion-modal.nutrition-legal-sheet').waitFor({state:'hidden'});
      });
      await check('Vita-y-SOS-conservados', async () => {
        await page.getByRole('button',{name:lang==='es'?'Hablar con Vita':'Talk to Vita',exact:true}).click();
        await page.getByRole('button',{name:lang==='es'?'Botón de pánico':'Panic button',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>[window.__qa.voice,window.__qa.panic]),[1,1]);
      });
      await check('reduced-motion-sin-transicion', async () => {
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.locator('ion-segment-button[value=hoy]').click();
        await page.locator('.ntd-hero').waitFor({state:'visible'});
        await page.waitForTimeout(250);
        assert(['none',''].includes(await page.locator('.premium-tab-content').evaluate(el=>getComputedStyle(el).transform)));
        await shot('hoy-datos-reduced');
      });
      await check('a11y-idioma-y-objetivos-tactiles', async () => {
        assert.equal(await page.evaluate(()=>document.documentElement.lang),lang);
        const short=await page.locator('.ntr-screen ion-button,.ntr-screen ion-segment-button').evaluateAll(elements=>elements.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.5||r.height<43.5)}).map(el=>({class:el.className,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
        assert.deepEqual(short,[]);
      });
      results.push({lang,width,checks});
    }
    assert.deepEqual(page.qaPageErrors, [])
    assert.equal(page.viewportSize().width,width)
    results.push({lang,width,viewport:page.viewportSize(),screens:['hoy','plan','historial'],pageErrors:page.qaPageErrors, fixture:true})
    await context.close()
  }
} finally { await browser.close(); writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2)+'\n') }
