/** Recaptura enfocada tras pulido CSS; no confirma ni envía registros. */
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {setup} from './setup.mjs';
const browser=await chromium.launch({headless:true});
try {
  for(const lang of ['es','en'])for(const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},permissions:['local-network-access'],serviceWorkers:'block'});
    const page=await context.newPage();await setup(page,'http://127.0.0.1:5182');
    await page.evaluate(lang=>{window.qaLang(lang);window.qaReset('program-nutraceutico')},lang);
    await page.locator('.p2-nb-actions ion-button').last().click();await page.locator('.p2-nb-sheet').waitFor({state:'visible'});
    await page.getByTestId('nutraceutic-photo-input').setInputFiles(resolve('src/assets/missions/nutribiotico.jpg'));
    await page.locator('.p2-nb-sheet ion-toggle').click();await page.locator('.p2-nb-sheet textarea').fill(lang==='es'?'Un d\u00eda m\u00e1s cuid\u00e1ndome.':'Another day taking care of myself.');
    await page.waitForTimeout(700);
    const label=await page.locator('.p2-nb-sheet ion-textarea .label-text').evaluate(el=>({whiteSpace:getComputedStyle(el).whiteSpace,overflow:el.scrollWidth>el.clientWidth+1}));
    assert.equal(label.whiteSpace,'normal');assert.equal(label.overflow,false);assert.equal(page.qaRequests.length,0);assert.deepEqual(page.qaErrors,[]);
    await page.screenshot({path:resolve('../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/P2/after',`${lang}-${width}-nutraceutico-registro.png`),scale:'css'});
    await context.close();
  }
} finally {await browser.close()}
