/** KAN-52: app/browser end-to-end; synthetic API boundary, no real patient or model calls.
 * Evidence stays under COP_E2E_OUTPUT=/tmp/... . Run against two isolated Vite servers:
 * COP_E2E_APP_URL (flag unset/false) and COP_E2E_ENABLED_URL (flag true).
 */
import {chromium,expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const out=process.env.COP_E2E_OUTPUT;assert(out?.startsWith('/tmp/'));
const hiddenOrigin=process.env.COP_E2E_APP_URL??'http://127.0.0.1:5186';
const enabledOrigin=process.env.COP_E2E_ENABLED_URL??'http://127.0.0.1:5187';
for(const origin of [hiddenOrigin,enabledOrigin])assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const phase=process.env.COP_E2E_PHASE??'green';await mkdir(path.join(out,phase),{recursive:true});
const browser=await chromium.launch();const results=[];
const links='Consulta [tu menú](https://erp.coppadresd.com/nutrition), [tu plan](https://erp.coppadresd.com/?screen=nut), [tu registro](https://erp.coppadresd.com/#/program-nut) y [tu foto](https://erp.coppadresd.com/%66oodai). [Abrir Nutrición](https://example.test/a). Lee la [guía de salud](https://www.who.int/health-topics/physical-activity).';
const bare='https://erp.coppadresd.com/food-ai';
const cases=phase==='red'?[{enabled:false,lang:'es',width:390}]:[false,true].flatMap(enabled=>['es','en'].flatMap(lang=>[390,1280].map(width=>({enabled,lang,width}))));
for(const scenario of cases){
 const {enabled,lang,width}=scenario;const origin=enabled?enabledOrigin:hiddenOrigin;const id=randomUUID();const token='x.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.x';
 const context=await browser.newContext({viewport:{width,height:950}});const page=await context.newPage();let offline=false;let nutritionReads=0;const submitted=[];
 await page.addInitScript(({lang})=>localStorage.setItem('antares_lang',lang),{lang});
 await context.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;const reply=json=>route.fulfill({json});
  if(p==='/api/auth/refresh')return reply({accessToken:token,expiresIn:3600});
  if(p==='/api/auth/me')return reply({id,firstName:'QA',lastName:'Paciente',roles:['Patient'],permissions:[]});
  if(p==='/api/v1/me/patient-profile')return reply({patientId:id,firstName:'QA',lastName:'Paciente',documentNumber:'QA'});
  if(p==='/api/v1/me/context')return reply({patient:{id,organizationId:id},clinics:[]});
  if(p.includes('/threads/')&&p.endsWith('/messages'))return reply({threadId:'proactive-'+id,messageCount:3,hasMore:false,messages:[{role:'bot',text:links+'\n'+bare},{role:'bot',text:bare},{role:'user',text:'Mi nutrición es importante; conserva este mensaje.'}]});
  if(p==='/api/v1/chat/stream'||p==='/api/v1/chat'){
   submitted.push(req.postDataJSON());if(offline)return route.fulfill({status:503,json:{message:'QA offline'}});
   const answer='QA respuesta útil. '+links+'\n'+bare;const suggestions=[{type:'appointment',ctaText:req.postDataJSON().message==='QA Nutrition action'?'Ver plan nutricional':lang==='es'?'Agendar cita':'Book appointment'}];
   if(p.endsWith('/stream'))return route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({type:'token',content:answer})+'\n\ndata: '+JSON.stringify({type:'done',answer,thread_id:'proactive-'+id,execution_id:randomUUID(),suggestions})+'\n\n'});
   return reply({reply:answer,suggestions,threadId:'proactive-'+id,executionId:randomUUID()});
  }
  if(p.startsWith('/api/v1/me/nutrition-plan')){nutritionReads++;return route.fulfill({status:404,json:{message:'No QA plan'}});}
  if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
  return route.fulfill({status:404,json:{}});
 });
 try{
  await page.goto(origin);await page.getByRole('button',{name:'Chat',exact:true}).click();
  const quick=page.locator('.chat-quick-actions');await expect(quick).toBeVisible();await expect(page.getByText('Mi nutrición es importante; conserva este mensaje.',{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(out,phase,`${enabled?'enabled':'hidden'}-${lang}-${width}.png`),animations:'disabled'});
  await expect(quick.getByRole('button',{name:lang==='es'?'¿Qué comer?':'What to eat?',exact:true})).toHaveCount(enabled?1:0);
  const messages=page.locator('.chat-list');const internalLinks=messages.locator('a[href*="coppadresd.com"]');
  await expect(internalLinks).toHaveCount(enabled?4:0);await expect(messages.getByRole('link',{name:'guía de salud',exact:true})).toHaveCount(1);
  await expect(messages.getByRole('link',{name:'Abrir Nutrición',exact:true})).toHaveCount(enabled?1:0);
  await expect(messages.locator('.bub')).toHaveCount(enabled?3:2);
  await expect(messages.locator('.typing')).toHaveCount(0);
  if(!enabled)await expect(messages).not.toContainText(bare);
  const input=page.locator('ion-input.chat-inp input');await input.fill('QA necesito ayuda para descansar');await page.getByRole('button',{name:lang==='es'?'Enviar':'Send',exact:true}).click();
  await expect(messages).toContainText('QA respuesta útil.');assert(submitted.some(x=>x.message==='QA necesito ayuda para descansar'));
  await expect(messages.locator('a[href*="coppadresd.com"]')).toHaveCount(enabled?8:0);
  await expect(page.getByRole('button',{name:lang==='es'?'Agendar cita':'Book appointment',exact:true})).toBeVisible();
  await input.fill('QA Nutrition action');await page.getByRole('button',{name:lang==='es'?'Enviar':'Send',exact:true}).click();
  await expect(messages.locator('.bub-bot')).toHaveCount(enabled?4:3);
  await expect(messages.getByRole('button',{name:'Ver plan nutricional',exact:true})).toHaveCount(enabled?1:0);
  await page.getByRole('button',{name:lang==='es'?'Adjuntar al chat':'Attach to chat',exact:true}).click();
  await expect(page.getByRole('button',{name:lang==='es'?'Tomar foto':'Take photo',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  // Exercise the actual offline fallback, including its legacy Nutrition branch.
  offline=true;await input.fill('Quiero saber qué comer');await page.getByRole('button',{name:lang==='es'?'Enviar':'Send',exact:true}).click();
  const last=messages.locator('.bub-bot').last();
  if(enabled)await expect(last).toContainText(/mediterr|Mediterr/);else{await expect(last).toContainText(lang==='es'?'Puedo ayudarte con citas':'I can help you with appointments');await expect(last).not.toContainText(/1,800|1.800|mediterr|nutricional|nutritional/);}
  await page.getByRole('button',{name:lang==='es'?'Inicio':'Home',exact:true}).click();
  await page.locator('.hm-nutrition-card').click();await expect(page.getByRole('heading',{name:lang==='es'?'Nutrición':'Nutrition',exact:true})).toBeVisible();
  await expect.poll(()=>nutritionReads,{timeout:10000}).toBeGreaterThan(0);
  results.push({...scenario,passed:true});
 }catch(error){results.push({...scenario,passed:false,error:error.message});await page.screenshot({path:path.join(out,phase,`failure-${enabled}-${lang}-${width}.png`),fullPage:true});}
 finally{await context.close();}
}
await browser.close();await writeFile(path.join(out,phase,'results.json'),JSON.stringify({apiBoundary:'synthetic; browser and app code real',results},null,2));console.log(JSON.stringify(results));if(results.some(r=>!r.passed))process.exitCode=1;
