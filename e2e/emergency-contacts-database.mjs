/** Full app -> local API -> isolated PostgreSQL. Auth session is synthetic; no emergency delivery. */
import {chromium,expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=process.env.COP_E2E_OUTPUT;
assert(out?.startsWith('/tmp/'),'Evidence must be temporary');
const api=process.env.COP_E2E_PROFILE_API;
assert.equal(api,'http://127.0.0.1:5122','Only the isolated E2E host is allowed');
const token=await readFile(process.env.COP_E2E_TOKEN_FILE,'utf8');
const b=await chromium.launch(),page=await b.newPage({viewport:{width:390,height:950}});
const writes=[];
await page.route('**/api/**',async route=>{
 const req=route.request(),p=new URL(req.url()).pathname;
 if(p==='/api/v1/me/patient-profile'){
  const response=await route.fetch({url:api+p,headers:{...req.headers(),authorization:'Bearer '+token}});
  if(req.method()==='PUT')writes.push({status:response.status(),body:req.postDataJSON()});
  return route.fulfill({response});
 }
 const reply=json=>route.fulfill({json});
 if(p==='/api/auth/refresh')return reply({accessToken:token,tokenType:'Bearer',expiresIn:3600});
 if(p==='/api/auth/me')return reply({id:'11111111-1111-4111-8111-111111111111',email:'qa@example.invalid',firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
 if(p==='/api/v1/me/context')return reply({patient:{id:'22222222-2222-4222-8222-222222222222',organizationId:null,clinicId:null},clinics:[]});
 if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
 if(p.endsWith('/catalog'))return reply({data:[]});
 if(p.endsWith('/specialties')||p.endsWith('/insurers'))return reply([]);
 return route.fulfill({status:404,json:{}});
});
const open=async()=>{await page.goto(process.env.COP_E2E_APP_URL??'http://127.0.0.1:5173');await page.getByRole('button',{name:'Perfil',exact:true}).click();await expect(page.locator('#pf-emg-name input')).toHaveValue('Contacto principal QA');};
try{
 await open();await page.getByRole('button',{name:'Añadir contacto opcional',exact:true}).click();
 await page.locator('#pf-emg2-name input').fill('Contacto opcional US QA');
 await page.locator('ion-select[aria-label="País del contacto opcional"]').click();
 await page.locator('ion-popover').getByText('EE. UU. (+1)',{exact:true}).click();
 await expect(page.locator('ion-popover')).toHaveCount(0);
 await expect(page.locator('ion-select[aria-label="País del contacto opcional"]')).toHaveJSProperty('value','1');
 await page.locator('#pf-emg2-cel input').fill('2025550102');
 await page.getByRole('button',{name:'Guardar contacto de emergencia',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);assert.equal(writes[0].status,200);assert.equal(writes[0].body.secondaryEmergencyContact.phone,'+12025550102');
 await open();await expect(page.locator('#pf-emg2-name input')).toHaveValue('Contacto opcional US QA');await expect(page.locator('#pf-emg2-cel input')).toHaveValue('2025550102');
 // Bypass only the client guard to verify the server rejects malformed numbers too.
 const rejected=await page.evaluate(async()=>{const r=await fetch('/api/v1/me/patient-profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({emergencyName:'Contacto principal QA',emergencyPhone:'1234567'})});return r.status;});
 assert.equal(rejected,400);
 await open();await expect(page.locator('#pf-emg-cel input')).toHaveValue('3001234567');await expect(page.locator('#pf-emg2-name input')).toHaveValue('Contacto opcional US QA');
 await page.locator('.emergency-contacts-form').screenshot({path:path.join(out,'contacts-database-saved.png'),animations:'disabled'});
 await page.getByRole('button',{name:'Quitar contacto opcional',exact:true}).click();await page.getByRole('button',{name:'Guardar contacto de emergencia',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(3);assert.equal(writes[2].status,200);
 await open();await expect(page.locator('#pf-emg2-name')).toHaveCount(0);await expect(page.getByRole('button',{name:'Añadir contacto opcional',exact:true})).toBeVisible();
 const result={result:'passed',storage:'isolated PostgreSQL',profileApi:'real local API',authentication:'synthetic signed QA session',country:'US +1',savedReloaded:true,invalidServerPhoneRejected:true,removedReloaded:true};await writeFile(path.join(out,'contacts-database-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await page.screenshot({path:path.join(out,"contacts-database-failure.png"),fullPage:true});throw error;}finally{await b.close();}
