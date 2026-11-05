/** Real Ionic exercise screens with an explicit temporary server-contract fixture. */
import {chromium} from 'playwright';import assert from 'node:assert/strict';import path from 'node:path';
assert(process.env.COP_E2E_FIXTURE_URL);assert(process.env.COP_E2E_OUTPUT);
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:900}});
try {
 await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>External provider fixture</p>'}));
 await page.goto(process.env.COP_E2E_FIXTURE_URL);
 await page.getByText('Smart Fit Chile',{exact:true}).waitFor({timeout:5000});
 assert.equal(await page.locator('iframe').count(),0,'External video must be opt-in.');
 await page.getByRole('button',{name:'Ver demostración',exact:true}).click();
 assert.match(await page.locator('iframe').getAttribute('src'),/youtube-nocookie.com\/embed\/cCMob-mi19U/);
 await page.getByRole('button',{name:/Ver indicaciones de/}).click();
 await page.getByText('Smart Fit Chile',{exact:true}).waitFor({timeout:5000});
 assert.equal(await page.getByText('Demostración no disponible',{exact:true}).count(),0);
 assert(await page.getByText('2-1-2',{exact:true}).isVisible());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(process.env.COP_E2E_OUTPUT,'app-reference-video.png'),fullPage:true});
 console.log('Passed: server reference metadata, opt-in external video, consistent dedicated detail and prescription.');
} catch(error){console.error(error.stack??error.message);process.exitCode=1;}finally{await browser.close();}
