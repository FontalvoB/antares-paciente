/** UI E2E with synthetic HTTP fixtures; no real patient writes. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const out=process.env.COP_E2E_OUTPUT; assert(out?.startsWith('/tmp/')); await mkdir(out,{recursive:true});
const origin=process.env.COP_E2E_APP_URL??'http://127.0.0.1:5188'; assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
const id='11111111-1111-4111-8111-111111111111', med='22222222-2222-4222-8222-222222222222', extra='33333333-3333-4333-8333-333333333333';
const token='x.'+Buffer.from(JSON.stringify({sub:id,exp:2000000000})).toString('base64url')+'.x';
const now=new Date(), date=now.toLocaleDateString('en-CA',{timeZone:'America/Bogota'}), when=new Date(now-3600000).toISOString();
const treatments=[{id:med,name:'Medicamento QA',productType:'medication'},{id:extra,name:'Nutracéutico QA',productType:'supplement'}].map(t=>({...t,origin:'staff_recorded',dosage:1,unit:'unidad',status:'active',revision:1,times:['00:01'],timeZone:'America/Bogota',startDate:date}));
const doses=treatments.map((t,i)=>({id:i?extra:med,treatmentId:t.id,name:t.name,dosage:1,unit:'unidad',scheduledAt:when,timeZone:'America/Bogota',status:'pending',revision:0}));
const workspace={patient:{id,name:'Paciente QA',mrn:'QA'},access:{enabled:true,revision:1},treatments,doses,history:[],summary:{activeTreatments:2,scheduledDoses:2,takenDoses:0,pendingDoses:2}};
const snapshot={enrollmentId:id,todayLocalDate:date,optionalTaskCodes:['nutraceutico'],template:{id,code:'QA',name:'QA',totalWeeks:24,currentWeekNumber:1,currentWeekStatus:'Active',currentWeekStartDateLocal:date,currentWeekEndDateLocal:date},todayTasks:['podcast','vitals','nut','ejercicio','nutraceutico','emocional'].map(taskCode=>({taskCode,title:taskCode,points:80,status:'Pending'})),todayPoints:0,todayPointsMax:530,todayBonusAvailable:true,xp:{balance:0,level:'Semilla',nextLevelAt:2000},streak:{current:0,longest:0,nbWeekDays:Array(7).fill(false)},calendar:[]};
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});
const writes=[];
await page.route('**/api/**',route=>{const r=route.request(),p=new URL(r.url()).pathname,reply=json=>route.fulfill({json});
if(p==='/api/auth/refresh')return reply({accessToken:token,expiresIn:86400});
if(p==='/api/auth/me')return reply({id,firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
if(p==='/api/v1/me/patient-profile')return reply({patientId:id,firstName:'Paciente',lastName:'QA',documentNumber:'QA'});
if(p==='/api/v1/me/capabilities')return reply({modules:{medications:{enabled:true,canView:true,canManage:true}}});
if(p==='/api/v1/program/me/snapshot')return reply(snapshot);
if(p==='/api/v1/me/medications')return reply(workspace);
if(r.method()!=='GET'){writes.push({p,body:r.postDataJSON()});if(p.includes('/doses/')){const d=doses.find(d=>p.includes(d.id));d.status=r.postDataJSON().status;d.revision++;workspace.history=[{id:extra,doseId:d.id,treatmentId:d.treatmentId,name:d.name,status:d.status,occurredAt:when,origin:'patient_reported'}];return reply(d);}}
if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
return route.fulfill({status:404,json:{}});});
try{
await page.goto(origin);
await page.locator('.wheel').getByRole('button',{name:'Medicamentos',exact:true}).click();
await expect(page.getByRole('heading',{name:'Mi medicación',exact:true})).toBeVisible();
await expect(page.locator('.medications-extra')).toContainText('Nutracéutico QA');
await expect(page.locator('.medications-dose-list .medications-dose')).toHaveCount(1);
await expect(page.locator('.medications-extra .medications-dose')).toHaveCount(1);
await page.screenshot({path:out+'/daily-medications.png'});
await page.locator('.medications-extra').getByRole('button',{name:'Registrar toma',exact:true}).click();
await page.locator('ion-modal.medications-capture-modal').getByRole('button',{name:'Registrar manualmente',exact:true}).click();
await page.locator('ion-modal.medications-capture-modal').getByRole('button',{name:'Confirmar toma',exact:true}).click();
await expect(page.locator('.medications-extra')).toContainText('Tomado');
assert.equal(writes.filter(w=>w.p.includes('/doses/')).length,1);
assert.equal(writes.filter(w=>w.p.includes('/tasks/complete')).length,0);
await page.getByRole('navigation').getByRole('button',{name:'Inicio',exact:true}).click();
await page.locator('.hm-day-link').click();
await expect(page.locator('.pcard-medications')).toBeVisible();
await expect(page.locator('.pcards .pcard').filter({hasText:'nutraceutico'})).toHaveCount(0);
await page.locator('.pcard-medications').click();
await expect(page.locator('.medications-extra')).toContainText('Tomado');
for(const width of [320,390,768]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await page.screenshot({path:out+'/daily.png'});
await writeFile(out+'/result.json',JSON.stringify({passed:true,writes:writes.length}));
console.log('Daily medication and optional nutraceutical flow passed');
}finally{await browser.close();}
