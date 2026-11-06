/** UI presentation only: synthetic saved analysis and APIs; no model calls or patient writes. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=process.env.COP_E2E_OUTPUT;assert(out?.startsWith('/tmp/'));await mkdir(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111';
const token='x.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url')+'.x';
const guidance={summary:'Tus respuestas muestran una base sobre la que podemos empezar: el descanso regular te está acompañando, mientras que la tensión ocasional merece un poco de espacio en tu día. No hace falta cambiar todo de una vez. Observar cuándo aparece esa tensión puede ayudarte a reconocer lo que necesitas y a elegir un paso pequeño que sí puedas sostener. Esta lectura se basa en tus evaluaciones completadas y puede ampliarse cuando termines las pendientes.',
 priorities:[
  {title:'Dale espacio a tu descanso',explanation:'En tu evaluación de sueño registraste descanso regular. Mantener una rutina que ya te ayuda puede darte un punto de apoyo mientras exploras otros hábitos.',action:'Elige una hora para acostarte esta semana y observa cómo te sientes al despertar.',evidenceCodes:['sleep']},
  {title:'Reconoce tus momentos de tensión',explanation:'Tus respuestas sobre estrés reflejan tensión ocasional. Identificar en qué situaciones aparece puede ayudarte a conversar con tu equipo desde ejemplos concretos.',action:'Hoy, anota un momento en el que sientas tensión: qué estabas haciendo y qué te ayudó a bajar el ritmo.',evidenceCodes:['stress','sleep']},
  {title:'Encuentra un ritmo que puedas sostener',explanation:'La evaluación de adherencia te permite conversar sobre qué hace más sencillo mantener tus hábitos. Es un punto de partida, no una etiqueta sobre ti.',action:'Escoge un solo hábito para empezar y reserva un momento realista para hacerlo.',evidenceCodes:['habits']}
 ],encouragement:'Cada paso pequeño cuenta. Podemos construir sobre lo que ya te funciona, a tu ritmo.',questions:['¿En qué momentos notas más tensión?','¿Qué te ayuda a mantener tus horarios de descanso?'],isPartial:true,generatedAt:'2026-11-06T15:00:00Z',sourceRevision:'design-fixture',sources:[
 {evidenceCode:'sleep',testCode:'sleep',testName:'Hábitos de sueño',label:'Descanso',resultType:'score',value:8,qualifier:'Descanso regular',completedAt:'2026-11-05T15:00:00Z'},
 {evidenceCode:'stress',testCode:'stress',testName:'Estrés percibido',label:'Estrés',resultType:'score',value:4,qualifier:'Tensión ocasional',completedAt:'2026-11-05T15:00:00Z'},
 {evidenceCode:'habits',testCode:'habits',testName:'Adherencia al programa',label:'Adherencia',resultType:'score',value:6,qualifier:null,completedAt:null}
 ]};
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:900}});page.setDefaultTimeout(8000);let writes=0;
await page.route('**/api/**',async route=>{
 const req=route.request(),p=new URL(req.url()).pathname,reply=json=>route.fulfill({json});
 if(p==='/api/auth/refresh')return reply({accessToken:token,expiresIn:86400});
 if(p==='/api/auth/me')return reply({id,firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
 if(req.method()!=='GET')writes++;
 if(p==='/api/v1/me/patient-profile')return reply({patientId:id,firstName:'Paciente',lastName:'QA',documentNumber:'QA'});
 if(p==='/api/v1/health-tests/me/assignments')return reply([{id,testCode:'sleep',testName:'Hábitos de sueño',status:'completed'}]);
 if(p==='/api/v1/health-tests/me/results')return reply(guidance.sources.map((s,i)=>({id:`result-${i}`,evaluationId:`evaluation-${i}`,code:s.testCode,label:s.testName,resultType:'score',value:s.value,qualifier:s.qualifier,severity:null})));
 if(p==='/api/v1/health-tests/me/profile-analysis')return reply(guidance);
 if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[]});
 return route.fulfill({status:404,json:{}});
});
try{
 await page.goto(process.env.COP_E2E_APP_URL??'http://127.0.0.1:5184');
 await page.getByRole('button',{name:'Perfil',exact:true}).click();
 await page.getByRole('button',{name:/Batería de evaluación/}).click();
 await page.getByRole('button',{name:'Resultados de tus evaluaciones',exact:true}).click();
 await expect(page.locator('.assessment-ai-summary')).toHaveText(guidance.summary);
 await page.screenshot({path:path.join(out,'overview.png')});
 await expect(page.getByRole('img',{name:'Vita, tu coach de bienestar'})).toBeVisible();
 await expect(page.locator('.assessment-ai-step')).toHaveCount(3);
 const summary=page.locator('.assessment-ai-summary');const collapsed=await summary.evaluate(e=>e.clientHeight);
 const expand=page.getByRole('button',{name:'Leer análisis completo',exact:true});
 await expect(expand).toHaveAttribute('aria-expanded','false');await expand.click();
 await expect(page.getByRole('button',{name:'Ver menos',exact:true})).toHaveAttribute('aria-expanded','true');
 assert(await summary.evaluate(e=>e.clientHeight)>collapsed,'The complete unmodified summary is accessible');
 await page.getByRole('button',{name:'Ver menos',exact:true}).click();
 for(let i=0;i<3;i++) {
  const step=page.locator('.assessment-ai-step').nth(i);
  await expect(step.locator('.assessment-ai-action')).toContainText(guidance.priorities[i].action);
  const why=step.locator('.assessment-ai-reason');
  await expect(why).toHaveClass(/accordion-collapsed/);
  await why.locator('[slot="header"]').click();await expect(why).toHaveClass(/accordion-expanded/);
  await expect(why.locator('[slot="content"]')).toContainText(guidance.priorities[i].explanation);
  await why.locator('[slot="header"]').click();await expect(why).toHaveClass(/accordion-collapsed/);
 }
 for(const [width,height] of [[320,780],[390,900],[430,932],[768,1024],[844,390]]) {
  await page.setViewportSize({width,height});
  await page.locator('.assessment-results').evaluate(e=>e.scrollTop=0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const b of await page.locator('.assessment-profile-analysis ion-button:visible').all()) {
   const box=await b.boundingBox();if(box)assert(box.height>=44,'Touch controls must be at least 44px tall');
  }
  await page.screenshot({path:path.join(out,`overview-${width}.png`)});
 }
 await page.setViewportSize({width:390,height:900});
 await page.locator('.assessment-ai-step').first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'action-cards.png')});
 await page.getByText('Para tu próxima conversación',{exact:true}).click();
 await expect(page.locator('.assessment-ai-questions ion-accordion')).toHaveClass(/accordion-expanded/);
 await expect(page.locator('.assessment-ai-questions')).toContainText(guidance.questions[0]);
 await page.getByText('Resultados que Vita tuvo en cuenta',{exact:true}).click();
 await expect(page.locator('.assessment-ai-evidence ion-accordion')).toHaveClass(/accordion-expanded/);
 await page.locator('.assessment-ai-evidence').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'source-details.png')});
 await expect(page.locator('.assessment-ai-evidence ion-list')).toContainText('8');
 await expect(page.locator('.assessment-ai-evidence ion-list')).toContainText('Tensión ocasional');
 assert.equal(writes,0,'Design controls never mutate results or generate a new analysis');
 await writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,summaryUnmodified:true,allActionsVisible:true,disclosures:true,viewports:5,patientWrites:0,modelCalls:0,api:'synthetic fixtures'}));
 console.log('PASS: overview, unmodified full summary, visible actions, explanation/questions/evidence disclosures and five viewports');
}catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await writeFile(path.join(out,'failure.json'),JSON.stringify({error:error.message}));throw error;}finally{await browser.close();}
