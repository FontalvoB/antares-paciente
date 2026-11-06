/** Real API/PostgreSQL/model continuation of assessment-profile-ai.mjs. A QA-only command inserts a retake. */
import {chromium,expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const out=process.env.COP_E2E_OUTPUT;assert(out?.startsWith('/tmp/'));await mkdir(out,{recursive:true});
const api=process.env.COP_E2E_PROFILE_API;assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(api??''));
const token=(await readFile(process.env.COP_E2E_TOKEN_FILE,'utf8')).trim();
const subject=JSON.parse(await readFile(process.env.COP_E2E_SUBJECT_FILE,'utf8'));
const old=JSON.parse(await readFile(process.env.COP_E2E_PREVIOUS_ANALYSIS_FILE,'utf8'));
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:900}});page.setDefaultTimeout(12000);
await expect.poll(async () => { try { return (await page.request.get(api + '/health')).status(); } catch { return 0; } }, { timeout: 15000 }).toBe(200);
let language='es';const responses=[];
await page.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),p=url.pathname,reply=json=>route.fulfill({json});
 if(p.startsWith('/api/v1/health-tests/me/')) {
  const r=await route.fetch({url:api+p+url.search,headers:{...req.headers(),authorization:'Bearer '+token},timeout:95000});
  if(p.endsWith('/profile-analysis')&&req.method()==='POST')responses.push({language:url.searchParams.get('language'),status:r.status(),body:r.headers()['content-type']?.includes('json') ? await r.json() : null});
  return route.fulfill({response:r});
 }
 if(p==='/api/auth/refresh')return reply({accessToken:token,expiresIn:86400});
 if(p==='/api/auth/me')return reply({id:subject.userId,firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
 if(p==='/api/v1/me/patient-profile')return reply({patientId:subject.patientId,firstName:'Paciente',lastName:'QA',documentNumber:'QA'});
 if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
 return route.fulfill({status:404,json:{}});
});
async function open(){
 await page.goto(process.env.COP_E2E_APP_URL??'http://127.0.0.1:5184');
 await page.getByRole('button',{name:language==='es'?'Perfil':'Profile',exact:true}).click();
 await page.getByRole('button',{name:language==='es'?/Batería de evaluación/:/Health assessments/}).click();
 await page.getByRole('button',{name:language==='es'?'Resultados de tus evaluaciones':'Your assessment results',exact:true}).click();
}
try{
 // This mutation is restricted to a pre-existing temporary fixture script.
 const command=JSON.parse(process.env.COP_E2E_RETAKE_COMMAND??'[]');assert(command.length>=2&&command[1].startsWith('/tmp/copp-profile-ai-'));
 execFileSync(command[0],command.slice(1),{env:{...process.env,LD_LIBRARY_PATH:''}});
 const missing=await page.request.get(api+'/api/v1/health-tests/me/profile-analysis?language=es',{headers:{authorization:'Bearer '+token}});
 assert.equal(missing.status(),404,'Previous analysis is never returned after new results');
 const unauthenticated=await page.request.post(api+'/api/v1/health-tests/me/profile-analysis');assert.equal(unauthenticated.status(),401);
 const invalidLanguage=await page.request.get(api+'/api/v1/health-tests/me/profile-analysis?language=fr',{headers:{authorization:'Bearer '+token}});assert.equal(invalidLanguage.status(),400);
 await open();
 await page.getByRole('button',{name:'Analizar mis resultados con Vita',exact:true}).click();
 await expect(page.locator('.assessment-ai-summary')).toBeVisible({timeout:95000});
 let next=responses.at(-1);assert.equal(next.status,200);assert.notEqual(next.body.sourceRevision,old.sourceRevision);
 assert(next.body.sources.some(s=>s.testCode==='qa-sueno'&&s.value===8&&s.code==='qa-new-result'));
 assert(!next.body.sources.some(s=>s.testCode==='qa-sueno'&&s.value===4));
 await page.screenshot({path:path.join(out,'retake-es.png'),fullPage:true});
 language='en';await page.evaluate(()=>localStorage.setItem('antares_lang','en'));
 await open();await page.getByRole('button',{name:'Analyze my results with Vita',exact:true}).click();
 await expect(page.locator('.assessment-ai-summary')).toBeVisible({timeout:95000});
 next=responses.at(-1);assert.equal(next.status,200);assert.equal(next.language,'en');
 assert.match(next.body.summary,/\b(your|you|sleep|rest|stress)\b/i);
 assert(next.body.sources.every(s=>/sleep|stress/i.test(s.testName)), 'Evidence labels are localized too');
 assert.equal(next.body.sourceRevision,responses[0].body.sourceRevision,'Language changes prose, not source results');
 await expect(page.getByText('Partial analysis',{exact:true})).toBeVisible();
 await page.screenshot({path:path.join(out,'retake-en.png'),fullPage:true});
 await writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,staleCacheRejected:true,retakePreserved:true,english:true,unauthenticated:401,invalidLanguage:400,responses},null,2));
 console.log('PASS: retake invalidation, new evidence, English, auth and language guard');
}catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(out,'failure.json'),JSON.stringify({error:error.message,responses},null,2));throw error;}finally{await browser.close();}
