/** Geometría del dock y de la última tarjeta: comparación con P1 aceptada. */
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const phase=process.argv[2]??'after',origin=process.env.PREMIUM_ORIGIN??'http://127.0.0.1:5182';
const output=resolve('../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/P2',phase);mkdirSync(output,{recursive:true});
const setup=(0,eval)('('+readFileSync('scripts/qa/nutrition-recommendations/setup-playwright.js','utf8')+')');
const b=await chromium.launch();const results=[];
try{for(const lang of ['es','en'])for(const width of [320,390,1440]){
 const context=await b.newContext({viewport:{width,height:900},serviceWorkers:'block',permissions:['local-network-access']}),p=await context.newPage();p.qaConfig={origin};await setup(p);await p.setViewportSize({width,height:900});await p.evaluate(lang=>window.qaLang(lang),lang);
 await p.locator('.nutrition-legal-sheet').waitFor({state:'visible'});await p.waitForTimeout(350);await p.keyboard.press('Escape');await p.locator('.nutrition-legal-sheet').waitFor({state:'hidden'});
 await p.waitForTimeout(700);await p.screenshot({path:resolve(output,`${lang}-${width}-hoy-dock.png`),scale:'css'});
 await p.locator('.screen-scroll').evaluate(el=>el.scrollTo({top:el.scrollHeight,behavior:'instant'}));await p.waitForTimeout(700);
 const geometry=await p.evaluate(()=>{const scroll=document.querySelector('.screen-scroll').getBoundingClientRect(),nav=document.querySelector('.premium-nav').getBoundingClientRect(),sos=document.querySelector('.premium-sos').getBoundingClientRect(),last=document.querySelector('.nut-protocol-checkin').getBoundingClientRect();return {readingBottom:scroll.bottom,navTop:nav.top,sosTop:sos.top,lastCardBottom:last.bottom,navDoesNotCoverReading:scroll.bottom<=Math.min(nav.top,sos.top)+1,lastCardClear:last.bottom<=Math.min(nav.top,sos.top)-12}});
 await p.screenshot({path:resolve(output,`${lang}-${width}-hoy-ultima-tarjeta.png`),scale:'css'});
 if(phase==='after'){if(!geometry.navDoesNotCoverReading||!geometry.lastCardClear)console.error({lang,width,...geometry});assert(geometry.navDoesNotCoverReading);assert(geometry.lastCardClear)}
 let safeArea=null;
 if(phase==='after'){
   const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:20,bottom:34,left:0,right:0}});await p.waitForTimeout(200);await p.locator('.screen-scroll').evaluate(el=>el.scrollTo({top:el.scrollHeight,behavior:'instant'}));await p.waitForTimeout(100);
   safeArea=await p.evaluate(()=>{const scroll=document.querySelector('.screen-scroll').getBoundingClientRect(),nav=document.querySelector('.premium-nav'),sos=document.querySelector('.premium-sos').getBoundingClientRect(),last=document.querySelector('.nut-protocol-checkin').getBoundingClientRect();return{top:20,bottom:34,marginBottom:getComputedStyle(nav).marginBottom,readingBottom:scroll.bottom,sosTop:sos.top,lastCardBottom:last.bottom}});
   assert.equal(safeArea.marginBottom,'34px');assert(safeArea.readingBottom<=safeArea.sosTop);assert(safeArea.lastCardBottom<safeArea.sosTop-12);await p.screenshot({path:resolve(output,`${lang}-${width}-hoy-safe-area.png`),scale:'css'});
 }
 assert.deepEqual(p.qaPageErrors,[]);results.push({lang,width,...geometry,safeArea});await context.close();
}}finally{await b.close();writeFileSync(resolve(output,'nav-results.json'),JSON.stringify(results,null,2)+'\n')}
