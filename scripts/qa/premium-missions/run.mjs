import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {setup} from './setup.mjs';
const phase=process.argv[2]??'after';
const origin=process.env.PREMIUM_ORIGIN??'http://127.0.0.1:5182';
const output=resolve('../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/P2',phase);
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const lang of (process.env.PREMIUM_LANG?[process.env.PREMIUM_LANG]:['es','en']))for(const width of (process.env.PREMIUM_WIDTH?[Number(process.env.PREMIUM_WIDTH)]:[320,390,1440])){
  const context=await browser.newContext({viewport:{width,height:900},locale:lang==='es'?'es-CO':'en-US',serviceWorkers:'block',permissions:['local-network-access']});const page=await context.newPage();await setup(page,origin);await page.evaluate(lang=>window.qaLang(lang),lang);
  const shot=async name=>{await page.waitForTimeout(700);await page.evaluate(()=>document.fonts.ready);const overflow=await page.locator('.screen-scroll').evaluateAll(els=>els.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className));assert.deepEqual(overflow,[],name);await page.screenshot({path:resolve(output,`${lang}-${width}-${name}.png`),scale:'css'})};
  await shot('ejercicio-lista');
  await page.getByRole('button',{name:lang==='es'?'Iniciar circuito':'Start circuit',exact:true}).click();await shot('ejercicio-activo');
  const checks=[];
  if(phase==='after'){
   await page.waitForTimeout(1100);await page.locator('.p2-pause').click();const paused=await page.getByRole('timer').innerText();await page.waitForTimeout(1200);assert.equal(await page.getByRole('timer').innerText(),paused);checks.push('pausa-sin-saltos');
   await page.locator('.p2-pause').click();await page.locator('.p2-ex-controls ion-button').last().click();await page.locator('.p2-active-heading strong').filter({hasText:lang==='es'?'ESTACIÓN 2 DE 6':'STATION 2 OF 6'}).waitFor();await page.locator('.p2-ex-controls ion-button').first().click();checks.push('siguiente-anterior');
   await page.locator('.p2-demo-button').click();await page.locator('.p2-demo-modal').waitFor({state:'visible'});await page.locator('.p2-demo-modal ion-button').first().click();await page.locator('.p2-demo-modal').waitFor({state:'hidden'});assert.equal(page.qaRequests.length,0);checks.push('demostracion-pausa-sin-puntos');
   await page.locator('.p2-active-heading ion-button').click();await page.getByTestId('exercise-list').waitFor();await page.evaluate(()=>window.__p2.delay=1200);await page.locator('.p2-list-actions ion-button').last().click();await page.waitForTimeout(100);assert.equal(await page.getByTestId('exercise-completed').count(),0);await page.getByTestId('exercise-completed').waitFor();assert.equal(page.qaRequests.length,1);await page.getByText('+150',{exact:true}).waitFor();await page.waitForTimeout(2600);checks.push('exito-solo-tras-HTTP-200-y-puntos-reales');
  }else await page.evaluate(()=>window.qaReset('program-ejercicio',true));
  await shot('ejercicio-completado');
  await page.evaluate(()=>window.qaReset('program-nutraceutico'));await shot('nutraceutico-detalle');
  if(phase==='after'){
   await page.locator('.p2-nb-actions ion-button').last().click();await page.locator('.p2-nb-sheet').waitFor({state:'visible'});await page.getByRole('button',{name:lang==='es'?'Cancelar':'Cancel',exact:true}).click();await page.locator('.p2-nb-sheet').waitFor({state:'hidden'});assert.equal(page.qaRequests.length,1);checks.push('cancelar-sin-POST');
   await page.locator('.p2-nb-actions ion-button').last().click();await page.locator('.p2-nb-sheet').waitFor({state:'visible'});await page.getByTestId('nutraceutic-photo-input').setInputFiles(resolve('src/assets/missions/nutribiotico.jpg'));await page.locator('.p2-nb-sheet ion-toggle').click();await page.locator('.p2-nb-sheet textarea').fill(lang==='es'?'Un día más cuidándome.':'Another day taking care of myself.');await shot('nutraceutico-registro');
   await page.keyboard.press('Tab');assert(await page.locator('.p2-nb-sheet').evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');await page.locator('.p2-nb-sheet').waitFor({state:'hidden'});await page.locator('.p2-nb-actions ion-button').last().click();await page.locator('.p2-nb-sheet').waitFor({state:'visible'});assert(await page.locator('.p2-nb-sheet textarea').inputValue());checks.push('hoja-foco-Escape-conserva-borrador');
   const short=await page.locator('.p2-nb-sheet ion-button,.p2-nb-sheet ion-toggle').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.5||r.height<43.5)}).map(el=>({tag:el.tagName,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));assert.deepEqual(short,[]);checks.push('objetivos-tactiles-44px');
   await page.evaluate(()=>window.__p2.status=422);await page.locator('.p2-nb-register > ion-button').first().dblclick();await page.locator('.p2-nb-register [role=alert]').waitFor();assert.equal(await page.getByTestId('nutraceutic-completed').count(),0);assert(await page.locator('.p2-nb-sheet textarea').inputValue());checks.push('rechazo-422-conserva-foto-mensaje-y-sin-exito');
   await page.evaluate(()=>window.__p2.status=200);await page.locator('.p2-nb-register > ion-button').first().click();await page.getByTestId('nutraceutic-completed').waitFor();await page.locator('.p2-nb-sheet').waitFor({state:'hidden'});await page.getByTestId('nutraceutic-completed').getByText('+80 pts',{exact:true}).waitFor();await page.waitForTimeout(2600);assert.equal(page.qaRequests.length,3);checks.push('registro-unico-y-preview-sin-publicacion');
   const payload=page.qaRequests.at(-1);assert.equal(payload.enrollmentId,'11111111-1111-4111-8111-111111111111');assert.equal(payload.localDate,'2026-11-15');assert.equal(payload.taskCode,'nutraceutico');assert(payload.clientRequestId);assert(!('file' in payload));checks.push('contrato-identidad-fecha-idempotencia-sin-foto-clinica');
   await page.emulateMedia({reducedMotion:'reduce'});checks.push('reduced-motion');
  }else await page.evaluate(()=>window.qaReset('program-nutraceutico',true));
  await shot('nutraceutico-exito');
  if(phase==='after'){
   await page.getByTestId('nutraceutic-completed').locator('.p2-success-actions ion-button').first().click();const draft=await page.evaluate(async()=>{const m=await import('/src/utils/communityShareDraft.ts');const d=m.takeCommunityShareDraftContent('qa-p2');return{text:d?.text,fileName:d?.file?.name,size:d?.file?.size}});assert(draft.text);assert.equal(draft.fileName,'nutribiotico.jpg');assert(draft.size>0);checks.push('borrador-con-foto-misma-cuenta-sin-upload');
   const writes=page.qaHttp.filter(request=>request.method==='POST');assert.equal(writes.length,3);assert(writes.every(request=>request.path==='/api/v1/program/tasks/complete'));assert.equal(new Set(page.qaRequests.map(request=>request.clientRequestId)).size,3);checks.push('sin-publicacion-y-sin-duplicados');
   await page.evaluate(()=>{window.qaReset('program-ejercicio');window.qaPatch({rest:true})});await page.locator('.exercise-rest').waitFor();assert.equal(await page.getByTestId('exercise-list').count(),0);await shot('ejercicio-descanso');
   await page.evaluate(()=>{window.qaReset('program-ejercicio');window.qaPatch({todayTasks:window.__p2.snapshot.todayTasks.map(task=>task.taskCode==='ejercicio'?{...task,content:{contentUnavailable:true}}:task)})});await page.getByText(lang==='es'?'Rutina no disponible':'Routine unavailable',{exact:true}).waitFor();await shot('ejercicio-vacio');checks.push('descanso-y-vacio-sin-completar');
   await page.evaluate(()=>{window.qaReset('program-nutraceutico');window.qaPatch({todayTasks:window.__p2.snapshot.todayTasks.map(task=>task.taskCode==='nutraceutico'?{...task,status:'Completed',clientPending:true}:task)})});await page.locator('.p2-nutraceutic .p2-status').waitFor({state:'visible'});assert.equal(await page.getByTestId('nutraceutic-completed').count(),0);await shot('nutraceutico-pendiente');checks.push('pendiente-sin-celebracion-ni-compartir');
  }
  assert.deepEqual(page.qaErrors,[]);results.push({lang,width,viewport:page.viewportSize(),pageErrors:page.qaErrors,console:page.qaConsole,http:page.qaHttp,checks,requests:page.qaRequests});await context.close();
 }
}finally{await browser.close();writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2)+'\n')}
