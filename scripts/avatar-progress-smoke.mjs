// Prueba de la página real y GLB real con respuestas HTTP de prueba explícitas.
// No crea usuarios/mediciones en BD. El shell de navegación se aísla de módulos ajenos.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/avatar-progress-validation');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_GATEWAY_BASE_URL': '""' }, plugins: [react(), {
  name: 'avatar-test-shell',
  enforce: 'pre',
  resolveId(id) {
    if (id === '/avatar-test-entry' || id.endsWith('/context/AppContext')) return '\0' + (id === '/avatar-test-entry' ? 'avatar-entry' : 'avatar-context');
  },
  load(id) {
    if (id === '\0avatar-context') return 'export const useApp=()=>({screen:"avatar",navigate:()=>{},openPanic:()=>{}});';
    if (id === '\0avatar-entry') return `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {IonApp,setupIonicReact} from '@ionic/react';
      import {I18nProvider} from '/src/i18n/I18nContext.tsx';
      import {AvatarPage} from '/src/pages/AvatarPage.tsx';
      import '@ionic/react/css/core.css'; import '/src/theme/variables.css'; import '/src/theme/global.css';
      setupIonicReact({mode:'ios'});
      createRoot(document.getElementById('root')).render(React.createElement(IonApp,null,
        React.createElement(I18nProvider,null,React.createElement(AvatarPage))));`;
  },
  configureServer(instance) {
    instance.middlewares.use('/avatar-test', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await instance.transformIndexHtml('/avatar-test', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/avatar-test-entry"></script></body></html>'));
    });
  },
}], optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', '@ionic/react', '@react-three/fiber', '@react-three/drei', 'three', 'framer-motion', '@capacitor/core'] }, server: { host: '127.0.0.1', port: 5186, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const fixture = { heightCm: null, metrics: [{ code: 'weight', unit: 'kg', target: null, favorableDirection: null,
    points: [{date:'2026-09-01',value:100},{date:'2026-09-05',value:110},{date:'2026-09-10',value:90}] }] };
  let response = fixture, status = 200, calls = 0;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().includes('/api/v1/program/me/metrics-history')) {
      calls++; assert(request.url().includes('codes=weight&days=365'));
      assert.equal(request.headers().authorization, 'Bearer fixture-test-session');
      void request.respond({status,contentType:'application/json',body:JSON.stringify(response)});
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('copp_access_token', 'fixture-test-session'));
  await page.goto('http://127.0.0.1:5186/avatar-test');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const click = text => page.evaluate(text => [...document.querySelectorAll('ion-button')].find(el => el.textContent.trim() === text)?.click(), text);
  const metrics = () => page.$eval('[data-avatar-metrics]', el => JSON.parse(el.dataset.avatarMetrics));
  await page.waitForSelector('[data-avatar-metrics]', { timeout: 90000 });
  await wait(1600);
  const current = await metrics(); assert.equal(current.bones,51); assert.equal(current.triangles,23924);
  assert(Math.abs(current.morphWeights.BodyLean-0.5)<0.001);
  await page.screenshot({path:path.join(out,'mobile-current-fixture.png')});
  await click('Ver inicial del período'); await wait(1800);
  assert((await metrics()).morphWeights.BodyLean<0.001);
  await page.screenshot({path:path.join(out,'mobile-reference-fixture.png')});
  await page.$eval('ion-select', el => el.dispatchEvent(new CustomEvent('ionChange',{detail:{value:'2026-09-05'},bubbles:true})));
  await wait(1800); assert(Math.abs((await metrics()).morphWeights.BodyVolume-0.5)<0.001);
  await click('Ver último registro'); await wait(1800);
  assert(Math.abs((await metrics()).morphWeights.BodyLean-0.5)<0.001);
  await wait(8500); const animated = await metrics(); assert(animated.loops>=1);
  assert.deepEqual(current.rootPosition,animated.rootPosition);
  assert.notDeepEqual(current.headQuaternion,animated.headQuaternion);
  assert.equal(await page.$$eval('ion-range', els=>els.length),0);
  response={heightCm:null,metrics:[]}; await click('Actualizar historial');
  await page.waitForFunction(()=>document.body.innerText.includes('No hay registros válidos'));
  assert.equal(await page.$$eval('canvas',els=>els.length),0);
  response={message:'Unavailable'}; status=503; await click('Actualizar historial');
  await page.waitForFunction(()=>document.body.innerText.includes('No se pudo consultar tu progreso'));
  response=fixture; status=200; await click('Actualizar historial');
  await page.waitForSelector('[data-avatar-metrics]',{timeout:30000});
  await page.setViewport({width:1280,height:900,deviceScaleFactor:1}); await wait(1200);
  await page.screenshot({path:path.join(out,'desktop-fixture.png')});
  // Nueva página demo: nunca consulta el endpoint ni reutiliza las medidas anteriores.
  const demo = await browser.newPage(); let demoCalls=0;
  demo.on('request',r=>{if(r.url().includes('/api/v1/program/me/metrics-history'))demoCalls++;});
  await demo.evaluateOnNewDocument(()=>sessionStorage.setItem('copp_access_token','demo-access-token'));
  await demo.goto('http://127.0.0.1:5186/avatar-test');
  await demo.waitForFunction(()=>document.body.innerText.includes('Inicia sesión con una cuenta real'));
  assert.equal(demoCalls,0); assert.equal(await demo.$$eval('canvas',els=>els.length),0);
  assert.deepEqual(errors,[]);
  const report={validation:'HTTP fixtures; real AvatarPage + Ionic + GLB + WebGL; not real patient data',calls,current,animated,checks:['reference','latest','intermediate','smooth morphs','Idle','root fixed','empty','error','retry','demo has no data','mobile','desktop'],errors};
  await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks, fps:current.fps,drawCalls:current.calls,bytes:current.bytes}));
} finally { await browser?.close(); await server.close(); }
