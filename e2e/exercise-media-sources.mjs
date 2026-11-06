/** Real app navigation with synthetic assigned routines. No patient writes. */
import {chromium,expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const out=process.env.COP_E2E_OUTPUT;assert(out);await mkdir(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111';
const token='x.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+7*86400})).toString('base64url')+'.x';
const browser=await chromium.launch();
for(const source of ['youtube','wger','manual']) {
 const page=await browser.newPage({viewport:{width:390,height:900}});page.setDefaultTimeout(8000);let writes=0,failMedia=true;
 const exercise={name:source==='wger'?'Remo Gironda':'Plancha asignada',description:source==='wger'?'Lleva la empuñadura hacia tu abdomen manteniendo la espalda neutra.':'Mantén el tronco alineado.',sets:3,repetitions:8,restSeconds:30,tempo:'2-1-2',sortOrder:0,
  ...(source==='youtube'?{referenceVideo:{embedUrl:'https://www.youtube-nocookie.com/embed/cCMob-mi19U',sourceUrl:'https://www.youtube.com/watch?v=cCMob-mi19U',author:'YouTube'}}:{mediaId:id,mediaType:'Video',mediaUrl:'https://media.example.invalid/exercise.mp4',thumbnailUrl:'https://media.example.invalid/poster.jpg'}),
  ...(source==='wger'?{provenance:{provider:'wger',title:'Remo Gironda',author:'Goulart',sourceUrl:'https://wger.de/en/exercise/512/view/',licenseName:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',changes:'Convertido a MP4 H.264; movimiento sin cambios.'}}:{})};
 await page.route('https://www.youtube-nocookie.com/**',r=>r.fulfill({contentType:'text/html',body:'<button>Official player fixture</button>'}));
 await page.route('https://media.example.invalid/**',async r=>{
  if(source!=='wger'||failMedia||!process.env.COP_E2E_REAL_MEDIA_FILE)return r.abort();
  const poster=r.request().url().endsWith('.jpg');
  return r.fulfill({status:200,contentType:poster?'image/jpeg':'video/mp4',body:await readFile(poster?path.join(path.dirname(process.env.COP_E2E_REAL_MEDIA_FILE),'poster.jpg'):process.env.COP_E2E_REAL_MEDIA_FILE)});
 });
 await page.route('**/api/**',r=>{
  const p=new URL(r.request().url()).pathname;const reply=json=>r.fulfill({json});
  if(p==='/api/auth/refresh')return reply({accessToken:token,expiresIn:86400});
  if(r.request().method()!=='GET')writes++;
  if(p==='/api/auth/me')return reply({id,firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
  if(p==='/api/v1/me/patient-profile')return reply({patientId:id,firstName:'Paciente',lastName:'QA',documentNumber:'QA',email:'qa@example.invalid'});
  if(p==='/api/v1/telemedicine/me')return reply({patient:{id,organizationId:id},clinics:[]});
  if(p==='/api/v1/telemedicine/requests/mine'||p.endsWith('/insurers')||p.endsWith('/specialties'))return reply([]);
  if(p==='/api/v1/program/me/snapshot')return reply({enrollmentId:id,todayLocalDate:'2026-11-05',template:{id,code:'QA',name:'Programa QA',totalWeeks:24,currentWeekNumber:3,currentWeekStatus:'Active',currentWeekStartDateLocal:'2026-11-02',currentWeekEndDateLocal:'2026-11-08'},todayTasks:[{taskCode:'ejercicio',title:'Ejercicio del día',points:100,status:'Pending',content:{title:'Rutina con demostración',exercises:[exercise]}}],todayPoints:0,todayPointsMax:100,xp:{balance:1200,level:'Semilla',nextLevelAt:2000},streak:{current:1,longest:1,freezesRemaining:0,nbWeekDays:[false,false,false,false,false,false,false]},calendar:[]});
  if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
  return r.fulfill({status:404,json:{}});
 });
 try {
  await page.goto(process.env.COP_E2E_APP_URL??'http://localhost:5173');
  await page.locator('.hm-day-link').click();
  await page.locator('button.pcard').filter({hasText:'Ejercicio del día'}).click();
  await expect(page.locator('.exercise-session')).toBeVisible();
  if(source==='youtube') {
   await expect(page.locator('iframe')).toHaveCount(1);
   await expect(page.locator('iframe')).toHaveAttribute('src',/youtube-nocookie.com\/embed\/cCMob-mi19U/);
   await expect(page.locator('iframe')).not.toHaveAttribute('src',/autoplay=1/);
   await expect(page.getByRole('link',{name:'Abrir video en origen'})).toHaveAttribute('href',exercise.referenceVideo.sourceUrl);
  } else {
   // Force the browser media error: retry keeps the attribution accessible.
   await expect(page.getByText('No se pudo cargar la demostración.',{exact:true})).toBeVisible();
   if(source==='wger') {
    await expect(page.getByText('Goulart',{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'CC BY-SA 4.0',exact:true})).toHaveAttribute('href',exercise.provenance.licenseUrl);
   }
   failMedia=false;
   await page.getByRole('button',{name:'Reintentar',exact:true}).click();
   if(source==='wger'&&process.env.COP_E2E_REAL_MEDIA_FILE){
    await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
    await page.getByRole('button',{name:'Iniciar circuito',exact:true}).click();
    await page.locator('video').evaluate(v=>v.play());
    await expect(page.getByRole('button',{name:'Pausar',exact:true})).toHaveCount(0);
    await page.locator('video').evaluate(v=>v.pause());
   }
  }
  await page.getByRole('button',{name:/Ver indicaciones de/}).click();
  await expect(page.getByText('2-1-2',{exact:true})).toBeVisible();
  if(source==='wger'&&process.env.COP_E2E_REAL_MEDIA_FILE) await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  for(const width of [320,390,768]) {
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`${out}/app-${source}-${width}.png`,fullPage:true});
  }
  assert.equal(writes,0,'Reading/playing never completes the task or awards XP');
  console.log('PASS',source);
 }catch(e){await page.screenshot({path:`${out}/failure-${source}.png`});console.error(source,e);process.exitCode=1;}finally{await page.close();}
}
await browser.close();
