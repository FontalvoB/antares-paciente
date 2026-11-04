/** Actual approved menu through Auth/API/PostgreSQL, without interception. */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const fixtures=JSON.parse(await readFile(process.env.COP_E2E_FIXTURES,'utf8'));
const origin=process.env.COP_E2E_APP_URL??'http://localhost:5173';
const browser=await chromium.launch();const results=[];
for(const width of [375,430]){
 const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
 try{
  const account=fixtures.patients[0];const login=await context.request.post(origin+'/api/auth/login',{data:{email:account.email,password:account.password,application:'app',rememberMe:true}});assert.equal(login.status(),200);
  await page.goto(origin);await page.getByRole('button',{name:/Nutrición/}).first().click();await page.locator('ion-segment-button[value="indicaciones"]').click();
  const nav=page.getByRole('navigation',{name:'Comidas de tu plan'});await nav.waitFor({timeout:5000});
  for(const name of ['Desayuno','Almuerzo','Merienda','Cena'])await nav.getByRole('button',{name:new RegExp(name)}).waitFor();
  await nav.getByRole('button',{name:/Merienda/}).click();
  const snack=page.locator('article[id^="nutrition-meal-mer-"]');await snack.waitFor();await page.waitForFunction(()=>{const el=document.querySelector('article[id^="nutrition-meal-mer-"]');if(!el)return false;const r=el.getBoundingClientRect();return r.top>=0&&r.top<innerHeight;});
  assert((await snack.innerText()).includes('porción revisada QA')); 
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(process.env.COP_E2E_OUTPUT,`snack-menu-${width}.png`)});
  results.push({width,result:'passed'});
 }catch(error){results.push({width,result:'failed',error:error.message});await page.screenshot({path:path.join(process.env.COP_E2E_OUTPUT,`snack-menu-${width}-failure.png`)});}
 await context.close();
}
await browser.close();await writeFile(path.join(process.env.COP_E2E_OUTPUT,'meal-navigation-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(row=>row.result==='failed'))process.exitCode=1;
