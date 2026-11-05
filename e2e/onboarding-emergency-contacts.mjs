/** First-access journey through the real login/onboarding UI; synthetic APIs. */
import {chromium,expect} from 'playwright/test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import path from 'node:path';
const out=process.env.COP_E2E_OUTPUT;assert(out);const b=await chromium.launch(),results=[];
for(const width of [320,390]){
 const c=await b.newContext({viewport:{width,height:950}}),page=await c.newPage();page.setDefaultTimeout(10000);
 const token='x.'+Buffer.from(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.x';let verified=false;
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname,reply=json=>route.fulfill({json});
  if(p==='/api/auth/refresh')return verified?reply({accessToken:token,expiresIn:3600}):route.fulfill({status:401,json:{}});
  if(p==='/api/auth/id-lookup')return reply({patientId:'11111111-1111-4111-8111-111111111111',firstName:'Paciente',lastName:'QA',documentNumber:'QA',contacts:[{id:'qa-contact',type:'Email',label:'qa@example.invalid'}]});
  if(p==='/api/auth/send-otp')return reply({expiresInSeconds:300});
  if(p==='/api/auth/verify-otp'){verified=true;return reply({accessToken:token,tokenType:'Bearer',expiresIn:3600});}
  if(p==='/api/v1/me/patient-profile')return reply({patientId:'11111111-1111-4111-8111-111111111111',firstName:'Paciente',lastName:'QA',documentNumber:'QA',email:'qa@example.invalid',phone:'3001234567',emergencyName:'',emergencyPhone:'',emergencyRelationship:'',emergencyEmail:'',secondaryEmergencyContact:null,insurerId:null,memberId:''});
  return reply([]);
 });
 try{await page.goto(process.env.COP_E2E_APP_URL??'http://127.0.0.1:5173');await page.getByRole('button',{name:'Activa tu cuenta',exact:true}).click();await page.locator('#login-first-id input').fill('QA');await page.getByRole('button',{name:'Confirmar identidad',exact:true}).click();await page.getByRole('radio').click();await page.locator('#login-otp-0').fill('123456');await page.getByRole('button',{name:'Verificar y entrar',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(page.getByText('Obligatorio',{exact:true})).toBeVisible();await expect(page.locator('#onb-fam2-name')).toHaveCount(0);
  await page.locator('#onb-fam-name input').fill('Contacto principal QA');await page.locator('#onb-fam-cel input').fill('3001234567');await page.getByRole('button',{name:'Añadir contacto opcional',exact:true}).click();await page.locator('#onb-fam2-name input').fill('Contacto opcional QA');await page.getByRole('button',{name:'Quitar contacto opcional',exact:true}).click();await expect(page.locator('#onb-fam2-name')).toHaveCount(0);
  await page.locator('.emergency-contacts-form').screenshot({path:path.join(out,`onboarding-contacts-${width}.png`),animations:'disabled'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.getByText('Consentimiento informado',{exact:true})).toBeVisible();results.push({width,result:'passed'});
 }catch(error){results.push({width,result:'failed',error:error.message});await page.screenshot({path:path.join(out,`onboarding-contacts-${width}-failure.png`),fullPage:true});}await c.close();
}
await b.close();await writeFile(path.join(out,'onboarding-contact-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.result==='failed'))process.exitCode=1;
