/** QA real 4.10: producto completo, Auth/JWT/API/BD reales, sin rutas interceptadas. */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const origin = process.env.QA410_ORIGIN ?? 'http://127.0.0.1:5182'
const api = 'http://127.0.0.1:5122'
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname))
const fixturePath = resolve(process.env.QA410_FIXTURE ?? '../../.ai/operations/organizar-experiencia-bienestar/4.10-fixture.json')
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const output = resolve(process.env.QA410_OUTPUT ?? '.artifacts/program-completion-real')
await mkdir(output, { recursive: true })
const evidence = { api, origin, appHead: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), apiHead: process.env.QA410_API_HEAD ?? '4c7a811', stubs: false, stages: [], requests: [], pageErrors: [], console: [], apiAssertions: 0 }
let stage = 'preflight'
const browser = await chromium.launch({ headless: true })
const password = account => {
  assert(account.credentialTarget.startsWith('CoppAddresd/QA/4.10/'))
  const code = `import importlib.util,json,sys;from pathlib import Path;p=Path(sys.argv[1]).with_name('3.20-fixture-helper.py');s=importlib.util.spec_from_file_location('h',p);h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(json.dumps(h.read_credential(sys.argv[2])))`
  return JSON.parse(execFileSync('python', ['-c', code, fixturePath, account.credentialTarget], { encoding: 'utf8' })).password
}
const audit = () => JSON.parse(execFileSync('python', [resolve(fixturePath, '..', '4.10-fixture-helper.py'), 'audit'], { encoding: 'utf8' }))
const persist = () => writeFile(resolve(output,'results.json'), JSON.stringify(evidence,null,2)+'\n')

async function login(account, lang = 'es', width = 390) {
  const context = await browser.newContext({ viewport:{width,height:900}, locale:lang==='es'?'es-CO':'en-US', timezoneId:'America/Bogota', serviceWorkers:'block' })
  await context.addInitScript(lang => localStorage.setItem('antares_lang',lang),lang)
  const page = await context.newPage()
  page.on('pageerror',error=>evidence.pageErrors.push({stage,message:error.message}))
  page.on('console',message=>{if(['warning','error'].includes(message.type())) evidence.console.push({stage,type:message.type(),text:message.text().replace(/https?:\/\/[^\s)]+\?[^\s)]+/g,'[URL con query omitida]')})})
  page.on('response',response=>{
    const request=response.request(), path=new URL(response.url()).pathname
    if(path.startsWith('/api/')) evidence.requests.push({stage,method:request.method(),path,status:response.status(),language:request.headers()['x-app-language'],bearerPresent:!!request.headers().authorization})
  })
  await page.goto(origin)
  await page.locator('#login-id input').fill(account.documentNumber)
  await page.locator('#login-password input').fill(password(account))
  const response = page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/login')
  await page.getByRole('button',{name:lang==='es'?'Comencemos':"Let's begin",exact:true}).click()
  assert.equal((await response).status(),200,'Login UI real')
  await page.getByRole('button',{name:lang==='es'?'Protocolo diario':'Daily protocol',exact:true}).first().waitFor({timeout:30000})
  const token = await page.evaluate(()=>sessionStorage.getItem('copp_access_token')??localStorage.getItem('copp_access_token'))
  assert(token)
  const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString())
  assert.equal(claims.aud,'app')
  return {page,context,token}
}
async function completion(context,token) {
  const response=await context.request.get(api+'/api/v1/program/me/completion',{headers:{Authorization:'Bearer '+token}})
  assert.equal(response.status(),200);const body=await response.json()
  evidence.apiAssertions++;return body
}
async function openProgram(page,lang) {
  await page.getByRole('button',{name:lang==='es'?'Protocolo diario':'Daily protocol',exact:true}).first().click()
  await page.getByTestId('program-completion').waitFor({timeout:30000})
}

try {
  evidence.before=audit()
  const health=await (await browser.newContext()).request.get(api+'/health')
  assert.equal(health.status(),200)
  for(const lang of ['es','en']) for(const width of [320,390,1440]) {
    stage=`summary-${lang}-${width}`
    const {page,context,token}=await login(fixture.accounts.completed,lang,width)
    const body=await completion(context,token)
    assert(body.completion?.canStartNewProgram===true,'Fixture nueva, sin reiniciar un programa ya creado')
    for(const [key,value] of Object.entries(fixture.expectedCompletion)) {assert.deepEqual(body.completion[key],value,key);evidence.apiAssertions++}
    assert(!Number.isNaN(Date.parse(body.completion.completedAt)))
    await openProgram(page,lang)
    const summary=await page.getByTestId('program-completion').innerText()
    assert(summary.includes('83')&&summary.includes('12'))
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.screenshot({path:resolve(output,`${stage}.png`),animations:'disabled'})
    const writesBefore=evidence.requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/program/enrollments/me').length
    await page.getByTestId('program-new-open').click()
    await page.getByTestId('program-new-confirm').waitFor()
    await page.screenshot({path:resolve(output,`confirm-${lang}-${width}.png`),animations:'disabled'})
    await page.getByRole('button',{name:lang==='es'?'Todavía no':'Not yet',exact:true}).click()
    await page.locator('ion-modal.program-completion-modal').waitFor({state:'hidden'})
    const same=await completion(context,token)
    assert.deepEqual(same,body,'Cancelar conserva cierre y disponibilidad')
    assert.equal(evidence.requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/program/enrollments/me').length,writesBefore)
    evidence.stages.push({stage,completion:body.completion,cancelNoWrite:true,overflow:false})
    await context.close();await persist()
  }
  stage='completion-null'
  {
    const {page,context,token}=await login(fixture.accounts.empty)
    assert.deepEqual(await completion(context,token),{completion:null})
    const attemptedForeign=await context.request.get(api+'/api/v1/program/me/completion?patientId='+fixture.accounts.completed.patientId,{headers:{Authorization:'Bearer '+token}})
    assert.equal(attemptedForeign.status(),200);assert.deepEqual(await attemptedForeign.json(),{completion:null});evidence.apiAssertions++
    await page.getByRole('button',{name:'Protocolo diario',exact:true}).first().click()
    await page.getByText('Tu plan empieza contigo',{exact:true}).waitFor()
    assert.equal(await page.getByTestId('program-new-open').count(),0)
    await page.screenshot({path:resolve(output,'completion-null.png'),animations:'disabled'})
    evidence.stages.push({stage,nullForOwnAndForeignQuery:true});await context.close();await persist()
  }
  stage='manual-start'
  {
    const {page,context,token}=await login(fixture.accounts.completed)
    const before=await completion(context,token)
    assert.equal(before.completion.canStartNewProgram,true)
    await openProgram(page,'es')
    await page.getByTestId('program-new-open').click()
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/program/enrollments/me'&&r.request().method()==='POST')
    await page.getByTestId('program-new-confirm').click()
    const result=await response
    const request=result.request().postDataJSON()
    evidence.manualStart={status:result.status(),request,response:await result.json()};await persist()
    assert([200,201].includes(result.status()))
    assert.deepEqual(request,{patientId:null,templateId:null,timezone:'America/Bogota',startLocalDate:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())})
    await page.getByTestId('program-new-started').waitFor({timeout:30000})
    await page.screenshot({path:resolve(output,'manual-start-success.png'),animations:'disabled'})
    const after=await completion(context,token)
    assert.deepEqual(after.completion,{...before.completion,canStartNewProgram:false})
    const repeat=await context.request.post(api+'/api/v1/program/enrollments/me',{headers:{Authorization:'Bearer '+token},data:request})
    assert.equal(repeat.status(),409);evidence.apiAssertions+=3
    evidence.manualStart.after=after;evidence.manualStart.repeatStatus=repeat.status()
    await page.getByRole('button',{name:'Ir al inicio',exact:true}).click()
    await page.getByRole('button',{name:'Protocolo diario',exact:true}).first().click()
    await page.getByText('Hoy',{exact:true}).first().waitFor({timeout:30000})
    assert.equal(await page.getByTestId('program-completion').count(),0)
    assert.equal(await page.getByTestId('program-new-open').count(),0)
    await page.screenshot({path:resolve(output,'new-program-active.png'),animations:'disabled'})
    evidence.stages.push({stage,canStartAfter:false,duplicatePost:409,oldSummaryPreserved:true});await context.close();await persist()
  }
  evidence.after=audit()
  assert.equal(evidence.after.enrollments.length,2)
  const oldBefore=evidence.before.enrollments.find(e=>e.id===fixture.completedEnrollmentId)
  const oldAfter=evidence.after.enrollments.find(e=>e.id===fixture.completedEnrollmentId)
  assert.deepEqual(oldAfter,oldBefore)
  assert.deepEqual(evidence.after.protected,evidence.before.protected)
  assert.equal(evidence.after.oldCompletedWeeks,12)
  assert.equal(evidence.requests.filter(r=>r.method==='POST'&&r.path==='/api/v1/program/enrollments/me').length,1)
  assert.deepEqual(evidence.pageErrors,[])
  evidence.status='passed';await persist()
  console.log(JSON.stringify({status:evidence.status,stages:evidence.stages.length,apiAssertions:evidence.apiAssertions,pageErrors:0,manualPosts:1,protectedUnchanged:true,output}))
} catch(error) {
  evidence.status='failed';evidence.failedStage=stage;evidence.failure={name:error.name,message:error.message.split('\n')[0]};await persist()
  console.error(JSON.stringify({status:'failed',stage,error:evidence.failure}));process.exitCode=1
} finally {await browser.close()}
