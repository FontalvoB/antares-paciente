/** Real app/API/DB; signed provider callbacks are synthetic, never delivery evidence. */
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const output=process.env.COP_E2E_OUTPUT;
const fixtures=JSON.parse(await readFile(process.env.COP_E2E_FIXTURES,'utf8'));
const stack=JSON.parse(await readFile(process.env.COP_E2E_STACK_CONFIG,'utf8'));
assert(stack.database.startsWith('copp_review_'),'Only an isolated database is supported.');
const account=fixtures.patients[Number(process.env.COP_E2E_PATIENT??3)];
const origin=process.env.COP_E2E_APP_URL??'http://localhost:5173';
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:950}});const page=await context.newPage();
try{
 const login=await context.request.post(origin+'/api/auth/login',{data:{email:account.email,password:account.password,application:'app',rememberMe:true}});assert.equal(login.status(),200);
 const headers={Authorization:'Bearer '+(await login.json()).accessToken};
 const response=await context.request.get(origin+'/api/v1/sos/alerts/active',{headers});assert.equal(response.status(),200);
 const alert=await response.json();assert.equal(alert.recipients.length,2);
 const ledger=(await readFile(path.join(output,'emergency-ledger.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 await page.goto(origin);await page.getByRole('button',{name:'SOS',exact:true}).first().click();await page.getByRole('button',{name:'Activar SOS ahora',exact:true}).click();await page.getByRole('button',{name:'Sí, activar mi SOS',exact:true}).click();
 await page.getByText('Contacto de respaldo',{exact:true}).waitFor();
 for(const [channel,form,section] of [['sms',{MessageStatus:'delivered'},'Sms'],['voice',{CallStatus:'completed',AnsweredBy:'human',CallDuration:'32'},'Voice']]){
  const callback=ledger.find(row=>row.channel===channel&&row.callback?.includes(alert.id)&&row.callback?.includes(alert.recipients[1].id))?.callback;
  assert(callback,'Callback must contain the backup recipient identifier.');
  const bad=await context.request.post(callback,{form,headers:{'X-Twilio-Signature':'invalid'}});assert.equal(bad.status(),401);
  const signature=createHmac('sha1',process.env.COP_E2E_WEBHOOK_TOKEN??stack.api.config[section].AuthToken).update(callback+Object.keys(form).sort().map(key=>key+form[key]).join('')).digest('base64');
  const sent=await context.request.post(callback,{form,headers:{'X-Twilio-Signature':signature}});assert.equal(sent.status(),200);
 }
 const saved=await (await context.request.get(origin+`/api/v1/sos/alerts/${alert.id}`,{headers})).json();
 assert.equal(saved.smsDeliveryStatus,null);assert.equal(saved.voiceCallStatus,null);assert.equal(saved.recipients[0].smsDeliveryStatus,null);assert.equal(saved.recipients[0].voiceCallStatus,null);
 assert.equal(saved.recipients[1].smsDeliveryStatus,'delivered');assert.equal(saved.recipients[1].voiceCallStatus,'completed');
 await page.waitForFunction(()=>{const row=document.querySelectorAll('.sos-recipient-row')[1];return row?.textContent.includes('Entregado')&&row?.textContent.includes('Contestada');},{},{timeout:15000});
 await page.locator('.sos-recipient-row').last().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'sos-secondary-simulated-callback.png')});
 await writeFile(path.join(output,'sos-callback-results.json'),JSON.stringify({result:'passed',signatureRejection:true,secondaryIsolated:true,realProviderDelivery:false},null,2));
 console.log('Signed synthetic backup callbacks updated only the backup; invalid signatures were rejected.');
 await context.request.post(origin+`/api/v1/sos/alerts/${alert.id}/cancel`,{headers});
}catch(error){await page.screenshot({path:path.join(output,'sos-callback-failure.png')});console.error(error.message);process.exitCode=1;}finally{await browser.close();}
