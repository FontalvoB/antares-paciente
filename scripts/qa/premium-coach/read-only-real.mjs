/** Producto y stack reales. Solo login y navegación: cero mutaciones clínicas. */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const origin = process.env.PREMIUM_ORIGIN ?? 'http://127.0.0.1:5182'
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname))
const output = resolve('../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/P3/runtime')
mkdirSync(output,{recursive:true})
const fixturePath = resolve('../../.ai/operations/organizar-experiencia-bienestar/4.10-fixture.json')
const account = JSON.parse(readFileSync(fixturePath,'utf8')).accounts.completed
const passwordCode = `import importlib.util,json,sys;from pathlib import Path;p=Path(sys.argv[1]).with_name('3.20-fixture-helper.py');s=importlib.util.spec_from_file_location('h',p);h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(json.dumps(h.read_credential(sys.argv[2])))`
const password = JSON.parse(execFileSync('python',['-c',passwordCode,fixturePath,account.credentialTarget],{encoding:'utf8'})).password
const audit = () => JSON.parse(execFileSync('python',['scripts/qa/premium-nutrition/audit-protected.py'],{encoding:'utf8'}))
const evidence = {stubs:false,origin,patientId:account.patientId,before:audit(),cases:[],requests:[],pageErrors:[],clinicalWrites:[]}
const browser = await chromium.launch({headless:true})
try {
  for (const lang of ['es','en']) {
    const context = await browser.newContext({viewport:{width:390,height:900},locale:lang==='es'?'es-CO':'en-US',timezoneId:'America/Bogota',serviceWorkers:'block'})
    await context.addInitScript(lang=>localStorage.setItem('antares_lang',lang),lang)
    const page = await context.newPage()
    page.on('pageerror',error=>evidence.pageErrors.push(error.message))
    page.on('request',request=>{
      const path=new URL(request.url()).pathname, method=request.method()
      if(path.startsWith('/api/')) {
        evidence.requests.push({lang,method,path})
        if(!['GET','OPTIONS','HEAD'].includes(method) && !path.startsWith('/api/auth/') && !path.includes('/community/')) evidence.clinicalWrites.push({method,path})
      }
    })
    await page.goto(origin)
    await page.locator('#login-id input').fill(account.documentNumber)
    await page.locator('#login-password input').fill(password)
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/login')
    await page.getByRole('button',{name:lang==='es'?'Comencemos':"Let's begin",exact:true}).click()
    assert.equal((await response).status(),200)
    await page.locator('.premium-nav').waitFor({state:'visible',timeout:30000})
    await page.getByRole('button',{name:lang==='es'?'Protocolo diario':'Daily protocol',exact:true}).first().click()
    await page.locator('.pcards').waitFor({state:'visible',timeout:30000})
    for(const mission of ['emocional','podcast']) {
      const card=page.locator('.pcards .pcard').filter({hasText:mission==='emocional'?/emocional|emotional/i:/podcast/i}).first()
      if(await card.count()) {
        await card.click()
        await page.locator('.lesson-'+mission).waitFor({state:'visible'})
        for(const width of [320,390,1440]) {
          await page.setViewportSize({width,height:900});await page.waitForTimeout(700)
          const overflow=await page.locator('.screen-scroll').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false)
          await page.screenshot({path:resolve(output,`${lang}-${width}-${mission}.png`),scale:'css'})
          evidence.cases.push({lang,width,mission,overflow})

        }
        await page.getByRole('button',{name:lang==='es'?'Volver al protocolo':'Back to protocol',exact:true}).click()
        await page.locator('.pcards').waitFor({state:'visible'})
      } else {
        evidence.cases.push({lang,mission,state:await page.locator('.exercise-rest').count()?'rest':'not-scheduled',mutations:0})
      }
    }
    await page.locator('.premium-nav ion-button').filter({hasText:/^Chat$/}).click();await page.locator('.chat-reference').waitFor({state:'visible'});for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(700);await page.screenshot({path:resolve(output,lang+'-'+width+'-chat.png'),scale:'css'});evidence.cases.push({lang,width,mission:'chat'})}
    await context.close()
  }
  evidence.after=audit()
  assert.deepEqual(evidence.after,evidence.before)
  assert.deepEqual(evidence.clinicalWrites,[])
  assert.deepEqual(evidence.pageErrors,[])
} finally { await browser.close();writeFileSync(resolve(output,'results.json'),JSON.stringify(evidence,null,2)+'\n') }
