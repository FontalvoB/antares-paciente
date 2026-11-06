/** Actual app UI with synthetic authentication/APIs; never activates SOS or contacts a geocoder. */
import {chromium,expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const origin=process.env.COP_E2E_APP_URL??'http://localhost:5173',output=process.env.COP_E2E_OUTPUT;
assert(output?.startsWith('/tmp/'));
const destination='https://docs.aws.amazon.com/location/latest/developerguide/data-attribution.html';
const browser=await chromium.launch(),results=[];await mkdir(output,{recursive:true});
try{
 for(const language of ['es','en'])for(const width of [320,390,768]){
  const context=await browser.newContext({viewport:{width,height:950}});const page=await context.newPage();let activations=0;
  await context.addInitScript(lang=>localStorage.setItem('antares_lang',lang),language);
  const id='11111111-1111-4111-8111-111111111111';
  const token='x.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.x';
  await context.route('**/api/**',route=>{
   const request=route.request(),p=new URL(request.url()).pathname;const reply=json=>route.fulfill({json});
   if(p==='/api/auth/refresh')return reply({accessToken:token,tokenType:'Bearer',expiresIn:3600});
   if(p==='/api/auth/me')return reply({id,firstName:'Paciente',lastName:'QA',roles:['Patient'],permissions:[]});
   if(p==='/api/v1/me/patient-profile')return reply({patientId:id,firstName:'Paciente',lastName:'QA',documentNumber:'QA',emergencyName:'Contacto QA',emergencyPhone:'+12025550101',emergencyEmail:'contact@example.invalid'});
   if(p==='/api/v1/me/context')return reply({patient:{id,organizationId:id,clinicId:null},clinics:[]});
   if(p==='/api/v1/sos/alerts'&&request.method()==='POST')activations++;
   return route.fulfill({status:404,json:{}});
  });
  await context.route(destination,route=>route.fulfill({contentType:'text/html',body:'<h1>External attribution boundary, synthetic page</h1>'}));
  try{
   await page.goto(origin);
   await page.getByRole('button',{name:'SOS',exact:true}).click();
   await page.getByRole('button',{name:language==='es'?'Activar SOS ahora':'Activate SOS now',exact:true}).click();
   const disclosure=page.locator('.sos-location-disclosure');
   await expect(disclosure).toBeVisible({timeout:2500});
   await expect(disclosure).toContainText('Amazon Location');
   await expect(disclosure).toContainText(language==='es'?'punto GPS':'GPS point');
   const source=disclosure.getByRole('button',{name:language==='es'?'Fuentes de ubicación':'Location data sources',exact:true});
   await source.scrollIntoViewIfNeeded();await expect(source).toBeVisible();
   const bounds=await source.boundingBox();assert(bounds.height>=44,'The source action needs a usable touch target.');
   await page.screenshot({path:path.join(output,`${language}-${width}.png`),fullPage:true});
   const popupPromise=context.waitForEvent('page');await source.click();const popup=await popupPromise;
   await popup.waitForURL(destination);await popup.close();
   assert.equal(activations,0,'Reading provider details must not activate SOS.');
   await expect(page.getByRole('button',{name:language==='es'?'Sí, activar mi SOS':'Yes, activate my SOS',exact:true})).toBeVisible();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow.');
   results.push({language,width,passed:true,noSosActivation:true});
  }catch(error){await page.screenshot({path:path.join(output,'failure.png')});throw error;}
  finally{await context.close();}
 }
 await writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(`Passed ${results.length} SOS disclosure UI journeys.`);
}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=1;}finally{await browser.close();}
