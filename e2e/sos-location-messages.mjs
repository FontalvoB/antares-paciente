/** Real SOS API + PostgreSQL + rendered outbound email; only external transports/geocoder are synthetic.
 * COP_E2E_OUTPUT must be a temporary directory containing subjects.json (synthetic signed JWTs).
 * Run with the CoppAddresd.E2EHost and an isolated copp_review_* database, never production.
 */
import {chromium,request} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const output=process.env.COP_E2E_OUTPUT;
assert(output?.startsWith('/tmp/'),'Evidence and test secrets must be temporary.');
const origin=process.env.COP_E2E_API_URL??'http://localhost:5122';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local isolated API only.');
const subjects=JSON.parse(await readFile(path.join(output,'subjects.json'),'utf8'));
const ledgerPath=path.join(output,'emergency-ledger.jsonl');
const ledger=async()=>{try{return (await readFile(ledgerPath,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch(e){if(e.code==='ENOENT')return [];throw e;}};
const api=await request.newContext({baseURL:origin});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:390,height:1100}});
const results=[];
const artifactDir=path.join(output,process.env.COP_E2E_PHASE??'green');await mkdir(artifactDir,{recursive:true});
try{
 for(const [index,subject] of subjects.entries()){
  if(process.env.COP_E2E_CASE&&subject.case!==process.env.COP_E2E_CASE)continue;
  const captured=new Date(Date.now()-10000).toISOString();
  const data=subject.case==='none'?{}:{latitude:subject.case==='japan'?35.68:subject.case==='us'?38.8977:10.98+index/100,longitude:subject.case==='japan'?139.76:subject.case==='us'?-77.0365:-74.8,accuracyMeters:subject.case==='coarse'?3500:subject.case==='unknown'?undefined:18,locationCapturedAt:subject.case==='future'?new Date(Date.now()+86400000).toISOString():captured};
  const headers={Authorization:'Bearer '+subject.token,'Idempotency-Key':randomUUID()};
  const start=Date.now();const activated=await api.post('/api/v1/sos/alerts',{headers,data});
  assert.equal(activated.status(),201,`Activation ${subject.case}: ${await activated.text()}`);
  const activationMs=Date.now()-start;
  if(subject.case==='timeout')assert(activationMs<1000,'Activation must return before the address lookup timeout.');
  const alert=await activated.json();
  let rows=[];
  for(let tries=0;tries<100;tries++){
   rows=(await ledger()).filter(row=>row.callback?.includes(alert.id)||row.body?.includes(`/maps/`));
   const state=await (await api.get(`/api/v1/sos/alerts/${alert.id}`,{headers})).json();
   if(state.emailChannelStatus==='Enviado'&&state.smsChannelStatus==='Enviado')break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  // Outbound email has no callback. Select only rows created after this activation.
  rows=(await ledger()).filter(row=>Date.parse(row.at)>=start);
  const sms=rows.filter(x=>x.channel==='sms'),emails=rows.filter(x=>x.channel==='email'),voices=rows.filter(x=>x.channel==='voice');
  assert.equal(sms.length,2,subject.case+' SMS principal + optional');assert.equal(emails.length,2,subject.case+' email principal + optional');
  assert.equal(voices.length,2,subject.case+' voice principal + optional');
  assert.equal(voices[0].body,voices[1].body,'Both contacts must hear the saved location snapshot.');
  const spoken=voices[0].body;
  assert(spoken,'The isolated provider must capture the actual voice script.');
  assert(!spoken.includes('DOMICILIO GUARDADO'),'Never read the profile address as current GPS.');
  assert.equal(sms[0].body,sms[1].body);assert.equal(emails[0].body,emails[1].body);
  const message=sms[0].body,html=emails[0].body;
  const gsm='@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  const extended='\f^{}\\[~]|€';
  const isGsm=[...message].every(c=>gsm.includes(c)||extended.includes(c));
  const septets=[...message].reduce((n,c)=>n+(extended.includes(c)?2:1),0);
  if(subject.case==='unicode'){
   assert(message.includes('李 王'),'Names without a faithful GSM representation must be preserved.');
   assert(message.length<=134,'Unicode fallback should fit two segments for this fixture.');
  }else{
   assert(isGsm,'Latin test messages must use GSM-7.');
   assert(septets<=160,`SOS SMS must fit one segment, got ${septets} septets.`);
  }
  const wire=(await readFile(path.join(output,'sms-wire-ledger.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).filter(r=>Date.parse(r.at)>=start);
  assert.equal(wire.length,2);assert(wire.every(r=>r.method==='POST'&&r.endpoint.endsWith('/Messages.json')&&r.from==='+12025550199'));
  await page.setContent(html);
  const text=await page.locator('body').innerText();
  assert(!message.includes('DOMICILIO GUARDADO'));assert(!text.includes('DOMICILIO GUARDADO'));
  assert(!/\b10\.\d+,-74\./.test(message),'SMS must use the first-party link, not raw coordinates.');
  if(subject.case==='precise'){
   assert(spoken.includes('Calle 72 45-12, Barranquilla'),'The call must speak the approximate street and city.');
   assert(spoken.includes('Dirección aproximada'));
   assert(message.includes('Calle 72 45-12, Barranquilla'), 'SMS is missing the approximate street/city address.');
   await page.getByText('Dirección aproximada',{exact:true}).waitFor();
   assert(text.includes('Calle 72 45-12, Barranquilla'));
   assert(text.includes('18 m'));assert(text.includes('GPS capturado'));
   // Capture time, accuracy and readings remain complete in the email;
   // the compact SMS prioritizes identity, approximate address and intact map.
  }
  if(subject.case==='coarse'||subject.case==='unknown'){
   assert(spoken.includes('Barranquilla'));assert(!spoken.includes('Calle 72'));
   assert(message.includes('Barranquilla'));assert(!message.includes('Calle 72'));assert(!text.includes('45-12'));
  }
  if(subject.case==='us'){assert(text.includes('Pennsylvania Avenue NW')&&text.includes('Washington'));assert(spoken.includes('Pennsylvania Avenue NW')&&spoken.includes('Washington'));}
  if(['timeout','empty','future','japan'].includes(subject.case)){
   assert(spoken.includes('dirección aproximada no está disponible'));
   assert(text.includes('Dirección no disponible'));assert(!message.includes('Calle 72'));
  }
  if(subject.case==='unsafe'){
   assert(text.includes('<script>'));assert.equal(await page.locator('script').count(),0,'Provider text must be HTML-escaped.');
  }
  if(subject.case==='none'){
   assert(spoken.includes('No se compartió la ubicación GPS'));
   assert(text.includes('Ubicación no compartida'));assert.equal(await page.getByRole('link',{name:'Ver ubicación en el mapa'}).count(),0);
   assert(!text.includes('GPS capturado'));assert(!text.includes('Precisión GPS'));
  }else{
   const href=await page.getByRole('link',{name:'Ver ubicación en el mapa'}).getAttribute('href');
   assert(href.startsWith('https://sos.example.test/api/v1/sos/maps/'));
   const resolved=await api.get(new URL(href).pathname,{maxRedirects:0});assert.equal(resolved.status(),302);
   assert(new URL(resolved.headers().location).hostname==='www.google.com');
   const u=new URL(href);const token=u.pathname.split('/').pop();const changed=href.replace(token,(token[0]==='a'?'b':'a')+token.slice(1));
   assert.equal((await api.get(new URL(changed).pathname,{maxRedirects:0})).status(),404);
   if(subject.case==='future')assert(text.includes('Hora de captura no disponible'));
  }
  assert(!spoken.includes('911'),'The voice script must not prescribe the wrong national number.');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Email must fit a phone.');
  if(subject.case==='japan'){
   const lookups=(await readFile(path.join(output,'geocoding-ledger.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
   assert(!lookups.some(r=>r.position[0]===139.76),'Storage lookups must skip the restricted region.');
  }
  await writeFile(path.join(artifactDir,subject.case+'.html'),html);await writeFile(path.join(artifactDir,subject.case+'.sms.txt'),message);
  await page.screenshot({path:path.join(artifactDir,subject.case+'.png'),fullPage:true});
  const count=(await ledger()).length;
  assert.equal((await api.post('/api/v1/sos/alerts',{headers,data})).status(),200);
  // Await an actual request round trip; idempotent replay must not enqueue another send.
  await api.get(`/api/v1/sos/alerts/${alert.id}`,{headers});assert.equal((await ledger()).length,count);
  assert.equal((await api.post(`/api/v1/sos/alerts/${alert.id}/cancel`,{headers})).status(),200);
  if(subject.case!=='none'){
   const href=await page.getByRole('link',{name:'Ver ubicación en el mapa'}).getAttribute('href');
   assert.equal((await api.get(new URL(href).pathname,{maxRedirects:0})).status(),404);
  }
  results.push({case:subject.case,passed:true,alertId:alert.id,activationMs,smsUnits:isGsm?septets:message.length,smsEncoding:isGsm?'GSM-7':'UCS-2',smsSegments:isGsm?1:2,senderContractVerified:true});
 }
 await writeFile(path.join(artifactDir,'result.json'),JSON.stringify({passed:true,realDatabase:true,realSmsOrEmailSent:false,provider:'synthetic external boundary',results},null,2));
 console.log('Passed SOS message E2E cases:',results.map(r=>r.case).join(', '));
}catch(error){
 await page.screenshot({path:path.join(artifactDir,'failure.png'),fullPage:true});
 await writeFile(path.join(artifactDir,'failure.json'),JSON.stringify({error:error.message.split('\n')[0],results},null,2));
 console.error(error.message.split('\n')[0]);process.exitCode=1;
}finally{await api.dispose();await browser.close();}
