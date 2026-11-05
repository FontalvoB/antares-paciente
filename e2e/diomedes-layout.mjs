/** Browser journeys over real Ionic components and explicit synthetic fixtures.
 * These validate layout/consent interaction, not provider or persistence behavior. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const fixture = process.env.COP_E2E_FIXTURE_URL;
if (!fixture) throw new Error('COP_E2E_FIXTURE_URL must point to the temporary component fixture.');
const output = process.env.COP_E2E_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'diomedes-layout-'));
const browser = await chromium.launch(); const results=[];
for (const mode of ['consent','exercise','nutra']) {
  const page=await browser.newPage({viewport:{width:390,height:900}});
  try {
    await page.goto(fixture+'?mode='+mode);
    if(mode==='consent') {
      const region=page.getByRole('region',{name:'Texto del consentimiento informado'});
      await region.waitFor();
      const dimensions=await region.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
      assert(dimensions.scroll>dimensions.height*10,'Fixture must require substantial scrolling.');
      const disabled=()=>page.locator('ion-checkbox').evaluateAll(items=>items.every(el=>el.disabled));
      assert.equal(await disabled(),true);
      await page.screenshot({path:path.join(output,'consent-long-locked.png')});
      await region.evaluate(el=>{el.scrollTop=el.scrollHeight/2;});
      await page.waitForTimeout(100);assert.equal(await disabled(),true);
      await region.focus();await page.keyboard.press('End');
      await page.getByText('Ya puedes aceptar el consentimiento.',{exact:true}).waitFor();
      for(let i=0;i<2;i++)await page.locator('ion-checkbox').nth(i).click();
      const proceed=page.locator('ion-button').filter({hasText:'Continuar'});
      assert.equal(await proceed.evaluate(el=>el.disabled),true);
      await page.locator('ion-checkbox').nth(2).click();
      await page.waitForFunction(()=>![...document.querySelectorAll('ion-button')].find(el=>el.textContent==='Continuar')?.disabled);
      assert.equal(await proceed.evaluate(el=>el.disabled),false);
      await proceed.click();
      await page.getByText('Continuación de prueba confirmada',{exact:true}).waitFor();
      await page.screenshot({path:path.join(output,'consent-long-accepted.png')});
    } else if(mode==='exercise') {
      const video=page.locator('video');await video.waitFor({timeout:5000});
      assert.equal(await video.evaluate(el=>el.paused&&!el.autoplay&&el.controls),true);
      await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
      assert.equal(await page.getByRole('button',{name:'Movimiento de prueba',exact:true}).count(),0);
      await page.screenshot({path:path.join(output,'exercise-inline-preview.png')});
    } else {
      const day=page.locator('.nutraceutic-day-celebration');await day.waitFor({timeout:5000});
      assert.match(await day.innerText(),/19/);
      const size=await day.locator('strong').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      assert(size>=40,'Program day must have clear visual emphasis.');
      await page.screenshot({path:path.join(output,'nutraceutical-day-highlight.png')});
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    results.push({mode,result:'passed'});
  } catch(error){results.push({mode,result:'failed',error:error.message});await page.screenshot({path:path.join(output,mode+'-baseline.png')});}
  await page.close();
}
await browser.close();await writeFile(path.join(output,'layout-e2e-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results));if(results.some(result=>result.result==='failed'))process.exitCode=1;
