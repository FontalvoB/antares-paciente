/** App UI regression with explicit synthetic API fixtures; no real patient data/model calls. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=process.env.COP_E2E_OUTPUT;assert(out?.startsWith('/tmp/'));await mkdir(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111';
const token='x.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url')+'.x';
const browser=await chromium.launch(),checks=[];
for(const scenario of ['provider-retry','rate-limit','cache-error','empty','english','slow-read']) {
 const page=await browser.newPage({viewport:{width:390,height:900}});page.setDefaultTimeout(12000);
 let posts=0;
 const english=scenario==='english';
 if(english)await page.addInitScript(()=>localStorage.setItem('antares_lang','en'));
 const guidance={summary:english?'Your sleep assessment suggests an irregular routine. A small daily change can help you notice what supports your rest.':'Tus respuestas sugieren descanso irregular. Un horario constante es un primer paso sencillo para observar qué te ayuda a descansar.',
  priorities:[{title:english?'Make room for rest':'Dale espacio al descanso',explanation:english?'Your stored sleep classification is irregular rest; it does not establish a medical diagnosis.':'Tu clasificación guardada indica descanso irregular; no establece un diagnóstico médico.',action:english?'Write down your bedtime tonight.':'Anota hoy a qué hora te acuestas.',evidenceCodes:['sueno:total:score']}],encouragement:english?'Small, consistent steps count.':'Los pasos pequeños y constantes cuentan.',questions:[],sourceRevision:'synthetic-v2',generatedAt:'2026-11-06T10:00:00Z',isPartial:true,sources:[{evidenceCode:'sueno:total:score',testCode:'sueno',testName:english?'Sleep':'Sueño',code:'total',label:english?'Sleep score':'Sueño',value:4,qualifier:english?'Irregular rest':'Descanso irregular',resultType:'score',completedAt:'2026-11-05T10:00:00Z'}]};
 await page.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,reply=json=>route.fulfill({json});
  if(p==='/api/auth/refresh')return reply({accessToken:token,expiresIn:86400});
  if(p==='/api/auth/me')return reply({id,firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
  if(p==='/api/v1/me/patient-profile')return reply({patientId:id,firstName:'Paciente',lastName:'QA',documentNumber:'QA'});
  if(p==='/api/v1/health-tests/me/assignments')return reply([{id,testCode:'sueno',testName:'Sueño',status:'completed'}]);
  if(p==='/api/v1/health-tests/me/results')return reply(scenario==='empty'?[]:[{id,evaluationId:id,resultType:'score',code:'total',label:'Sueño',value:4,qualifier:'Descanso irregular',severity:null}]);
  if(p==='/api/v1/health-tests/me/profile-analysis') {
   assert.equal(u.searchParams.get('language'),english?'en':'es');
   if(req.method()==='GET') {
    if(scenario==='slow-read')await new Promise(resolve=>setTimeout(resolve,700));
    return route.fulfill({status:scenario==='cache-error'?503:404,json:{}});
   }
   posts++;
   if(scenario==='rate-limit')return route.fulfill({status:429,json:{message:'RAW_INTERNAL_ERROR_SHOULD_NOT_RENDER'}});
   if(scenario==='provider-retry'&&posts===1)return route.fulfill({status:503,json:{message:'RAW_INTERNAL_ERROR_SHOULD_NOT_RENDER'}});
   await new Promise(resolve=>setTimeout(resolve,200));return reply(guidance);
  }
  if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
  return route.fulfill({status:404,json:{}});
 });
 try{
  await page.goto(process.env.COP_E2E_APP_URL??'http://127.0.0.1:5184');
  await page.getByRole('button',{name:english?'Profile':'Perfil',exact:true}).click();
  await page.getByRole('button',{name:english?/Health assessments/:/Batería de evaluación/}).click();
  await page.getByRole('button',{name:english?'Your assessment results':'Resultados de tus evaluaciones',exact:true}).click();
  if(scenario==='empty') {
   await expect(page.getByText('Aún no hay resultados calculados disponibles.',{exact:true})).toBeVisible();
   await expect(page.locator('.assessment-profile-analysis')).toHaveCount(0);assert.equal(posts,0);
  }else {
   const generate=page.getByRole('button',{name:english?'Analyze my results with Vita':'Analizar mis resultados con Vita',exact:true});
   if(scenario==='slow-read')await expect(page.getByRole('button',{name:'Buscando tu análisis guardado…',exact:true})).toBeDisabled();
   await expect(generate).toBeEnabled();await generate.click();
   if(['provider-retry','rate-limit'].includes(scenario)) {
    await expect(page.getByRole('alert')).toContainText(scenario==='rate-limit'?'Espera un minuto':'Tus resultados siguen disponibles');
    await expect(page.getByText('RAW_INTERNAL_ERROR_SHOULD_NOT_RENDER',{exact:true})).toHaveCount(0);
    await expect(page.locator('.assessment-ai-summary')).toHaveCount(0);
    if(scenario==='provider-retry')await generate.click();
   }
   if(scenario!=='rate-limit') {
    await expect(page.locator('.assessment-ai-summary')).toHaveText(guidance.summary);
    await page.getByText(english?'Results Vita considered':'Resultados que Vita tuvo en cuenta',{exact:true}).click();
    await expect(page.locator('.assessment-ai-evidence ion-list')).toBeVisible();
    await expect(page.locator('.assessment-ai-evidence')).toContainText('4');
   }
  }
  await page.screenshot({path:path.join(out,scenario+'.png'),fullPage:true});checks.push({scenario,passed:true});
 }catch(error){checks.push({scenario,passed:false,error:error.message});await page.screenshot({path:path.join(out,scenario+'-failed.png'),fullPage:true}).catch(()=>{});}finally{await page.close();}
}
await browser.close();await writeFile(path.join(out,'results.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));if(checks.some(x=>!x.passed))process.exitCode=1;
