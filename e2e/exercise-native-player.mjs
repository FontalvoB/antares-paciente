/** Full app navigation; native bridge is an explicit fixture, not a device test. */
import {chromium,expect} from 'playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.COP_E2E_OUTPUT;assert(out);await mkdir(out,{recursive:true});
const project=await readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj',import.meta.url),'utf8');
const bundleIds=[...new Set([...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(m=>m[1]))];assert.equal(bundleIds.length,1);
const id='11111111-1111-4111-8111-111111111111';
const token='x.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url')+'.x';
const exercise={name:'Plancha asignada',description:'Mantén el tronco alineado.',sets:3,repetitions:8,restSeconds:30,sortOrder:0,referenceVideo:{embedUrl:'https://www.youtube-nocookie.com/embed/cCMob-mi19U',sourceUrl:'https://www.youtube.com/watch?v=cCMob-mi19U',author:'YouTube'}};
const browser=await chromium.launch();const results=[];
try{for(const platform of ['ios','android']){
 const page=await browser.newPage({viewport:{width:390,height:900}});page.setDefaultTimeout(12000);
 await page.addInitScript(({platform,bundleId})=>{
  window.CapacitorCustomPlatform={name:platform};window.__nativeCalls=[];
  window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'getInfo',rtype:'promise'}]},{name:'Browser',methods:[{name:'open',rtype:'promise'}]}],nativePromise:async(plugin,method,options)=>{window.__nativeCalls.push({plugin,method,options});return plugin==='App'&&method==='getInfo'?{id:bundleId,name:'Copp Adresd',version:'1.0',build:'QA'}:{};}};
 },{platform,bundleId:bundleIds[0]});
 await page.route('**/api/**',r=>{
  const p=new URL(r.request().url()).pathname,reply=json=>r.fulfill({json});
  if(p==='/api/auth/refresh')return reply({accessToken:token,expiresIn:86400});
  if(p==='/api/auth/me')return reply({id,firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
  if(p==='/api/v1/me/patient-profile')return reply({patientId:id,firstName:'Paciente',lastName:'QA',documentNumber:'QA'});
  if(p==='/api/v1/telemedicine/me')return reply({patient:{id,organizationId:id},clinics:[]});
  if(p==='/api/v1/telemedicine/requests/mine'||p.endsWith('/insurers')||p.endsWith('/specialties'))return reply([]);
  if(p==='/api/v1/program/me/snapshot')return reply({enrollmentId:id,todayLocalDate:'2026-11-06',template:{id,code:'QA',name:'Programa QA',totalWeeks:24,currentWeekNumber:3,currentWeekStatus:'Active'},todayTasks:[{taskCode:'ejercicio',title:'Ejercicio del día',points:100,status:'Pending',content:{title:'Rutina con demostración',exercises:[exercise]}}],todayPoints:0,todayPointsMax:100,xp:{balance:1200,level:'Semilla',nextLevelAt:2000},streak:{current:1,longest:1,freezesRemaining:0,nbWeekDays:[false,false,false,false,false,false,false]},calendar:[]});
  if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
  return r.fulfill({status:404,json:{}});
 });
 try{
  await page.goto(process.env.COP_E2E_APP_URL??'http://localhost:5173');
  await page.locator('.hm-day-link').click();await page.locator('button.pcard').filter({hasText:'Ejercicio del día'}).click();
  await expect(page.locator('.exercise-session')).toBeVisible();await expect(page.locator('iframe')).toHaveCount(0);
  const play=page.getByRole('button',{name:'Reproducir en YouTube',exact:true});await expect(play).toBeVisible();
  assert.equal(await page.evaluate(()=>window.__nativeCalls.filter(c=>c.plugin==='Browser').length),0,'No automatic browser opening');
  await play.click();
  await expect.poll(()=>page.evaluate(()=>window.__nativeCalls.filter(c=>c.plugin==='Browser').length)).toBe(1);
  const call=await page.evaluate(()=>window.__nativeCalls.find(c=>c.plugin==='Browser'));assert.equal(call.plugin,'Browser');assert.equal(call.method,'open');
  const url=new URL(call.options.url);
  if(platform==='ios'){assert.equal(url.hostname,'www.youtube.com');assert.equal(url.pathname,'/embed/cCMob-mi19U');assert.equal(url.searchParams.get('origin'),'https://'+bundleIds[0]);assert.equal(url.searchParams.get('autoplay'),'0');}
  else assert.equal(url.href,exercise.referenceVideo.sourceUrl);
  results.push({platform,passed:true,url:url.href,nativeBridge:'fixture; physical playback unverified'});
  await page.screenshot({path:out+'/'+platform+'-youtube.png'});
 }catch(e){await page.screenshot({path:out+'/failure-'+platform+'.png'});throw e;}finally{await page.close();}
}
await writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log('PASS native UI, no autoplay, Browser.open URLs, iOS origin matches Xcode bundle ID. Bridge fixture only.');
}finally{await browser.close();}
