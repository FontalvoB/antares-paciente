// FASE 5: página, visor y GLB reales; HTTP controlado, sin escrituras en BD.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.AVATAR_AUDIT_DIR || path.join(root, 'docs/avatar-loading-validation');
const baseline = process.env.AVATAR_BASELINE_DIR;
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_GATEWAY_BASE_URL': '""' }, plugins: [{
    name: 'avatar-loading-test-shell', enforce: 'pre',
    resolveId(id) {
      if (id === '/avatar-loading-entry') return '\0avatar-entry';
      if (id.endsWith('/context/AppContext')) return '\0avatar-context';
    },
    async load(id) {
      if (baseline) {
        for (const [suffix, saved] of Object.entries({ '/src/pages/AvatarPage.tsx': 'AvatarPage.before.tsx',
          '/src/components/avatar/AvatarViewer.tsx': 'AvatarViewer.before.tsx', '/src/hooks/useAvatarProgress.ts': 'useAvatarProgress.before.ts' })) {
          if (id.replaceAll('\\', '/').endsWith(suffix)) {
            let source = await fs.readFile(path.join(baseline, saved), 'utf8');
            // Solo instrumentación temporal de la copia anterior para comparar el mismo intervalo.
            source = source.replace('const [recordOpen, setRecordOpen]', "useState(() => { performance.mark('avatar-entry'); return 0; });\n  const [recordOpen, setRecordOpen]");
            source = source.replace('asset.metrics.firstFrameMs = now - asset.started;', "asset.metrics.visibleMs = now - performance.getEntriesByName('avatar-entry')[0].startTime; asset.metrics.firstFrameMs = now - asset.started;");
            return source;
          }
        }
      }
      if (id === '\0avatar-context') return 'export const useApp=()=>({screen:"avatar",navigate:()=>{},openPanic:()=>{},showToast:()=>{}});';
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
      instance.middlewares.use('/avatar-loading-test', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await instance.transformIndexHtml('/avatar-loading-test', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/avatar-loading-entry"></script></body></html>'));
      });
    },
  }, react()], optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', '@ionic/react', '@react-three/fiber', '@react-three/drei', 'three', 'framer-motion', '@capacitor/core'] },
  server: { host: '127.0.0.1', port: 5187, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const reports = [];
  for (const scenario of baseline ? ['data'] : ['data', 'empty', 'api-error', 'asset-error', 'missing-prefs', 'data-during-asset-load']) {
    const page = await browser.newPage({ viewport: { width: 430, height: 1000 } });
    await page.addInitScript(() => sessionStorage.setItem('copp_access_token', 'fixture-test-session'));
    const history = values => ({ heightCm: null, metrics: values.length ? [{ code: 'weight', unit: 'kg', target: null,
      favorableDirection: null, points: values.map((value, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value })) }] : [] });
    let values = scenario === 'empty' ? [] : [100, 90], apiFailed = scenario === 'api-error', assetFailed = scenario === 'asset-error';
    let historyStarted = 0, historyFinished = 0, glbStarted = 0, glbs = 0, posts = 0, gets = 0, prefsFinished = 0;
    await page.route('**/api/auth/me/avatar', async route => {
      await new Promise(resolve=>setTimeout(resolve,400));prefsFinished=Date.now();
      if(scenario==='missing-prefs')return route.fulfill({status:204,body:''});
      return route.fulfill({json:{version:1,gender:'male',hair:null,clothing:{shirt:scenario==='data-during-asset-load'?'shirt-basic-01':null,pants:null,shoes:null},accessories:{glasses:null,watch:null,bracelet:null}}});
    });
    await page.route('**/api/v1/program/me/metrics-history?**', async route => {
      historyStarted = Date.now();
      gets++;
      if (!baseline) assert(historyStarted >= prefsFinished && prefsFinished > 0);
      await new Promise(resolve => setTimeout(resolve, 2500));
      historyFinished = Date.now();
      await route.fulfill({ status: apiFailed ? 503 : 200, json: apiFailed ? { message: 'Fixture unavailable' } : history(values) });
    });
    await page.route('**/api/v1/program/me/weight', async route => {
      posts++; values = process.env.AVATAR_BODY_V8 ? [100,105,110,115,120,90,110] : [100, 90, 110];
      await route.fulfill({ json: { id: 'fixture', weightKg: 110, date: '2026-09-03', observedAt: '2026-09-03T12:00:00Z' } });
    });
    await page.route(/\/male-body-base-v\d+\.glb$/, async route => {
      glbStarted = Date.now(); glbs++;
      if (assetFailed) await route.fulfill({ status: 503, body: 'Fixture asset error' });
      else await route.continue();
    });
    if(scenario==='data-during-asset-load')await page.route('**/male-shirt-basic-01-v3.glb',async route=>{
      await new Promise(resolve=>setTimeout(resolve,6500));await route.continue();
    });
    const started = Date.now();
    await page.goto('http://127.0.0.1:5187/avatar-loading-test');
    if(!baseline) await page.locator('ion-segment-button[value="evolution"]').click();
    await page.waitForFunction(() => document.body.innerText.includes('Consultando tu historial'));
    await page.waitForTimeout(500);
    if (!baseline) { assert.equal(glbs, 0); assert.equal(await page.locator('canvas').count(), 0); }
    const section = async value => {
      await page.locator('ion-segment-button[value="appearance"]').click();
      await page.locator('ion-segment[aria-label="Personalización del avatar"]').evaluate((el,value)=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),value);
    };
    const readMetrics = () => page.locator('[data-avatar-metrics]').evaluate(el => JSON.parse(el.dataset.avatarMetrics));
    if (scenario === 'api-error') {
      await page.getByText('Error al cargar historial.', { exact: true }).waitFor();
      assert.equal(glbs, 0); assert.equal(await page.locator('canvas').count(), 0);
      apiFailed = false; await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    }
    if (scenario === 'asset-error') {
      await page.locator('[data-avatar-error="asset"]').waitFor();
      assert.equal(await page.getByText('Error al cargar historial.', { exact: true }).count(), 0);
      assetFailed = false; await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    }
    if(scenario==='data-during-asset-load') {
      await page.locator('canvas').waitFor({state:'attached'});
      values=[100,110];await page.getByRole('button',{name:'Actualizar historial',exact:true}).click();
    }
    await page.locator('[data-avatar-metrics]').waitFor({ state: 'attached', timeout: 90000 });
    const first = await readMetrics();
    if (!baseline) {
      if(scenario!=='data-during-asset-load')assert(glbStarted >= historyFinished);
      assert.equal(first.initialMorphWeights.BodyLean, ['empty','data-during-asset-load'].includes(scenario) ? 0 : 0.5);
      assert.equal(first.initialMorphWeights.BodyVolume, scenario==='data-during-asset-load' ? 0.5 : 0);
    }
    await page.waitForTimeout(1200);
    const running = await readMetrics();
    assert(running.idleTime > first.idleTime);
    reports.push({ scenario, historyMs: historyFinished - historyStarted,
      glbStartedAfterHistory: glbStarted - historyFinished, observedMetricsMs: Date.now() - started,
      first, running });
    await page.screenshot({ path: path.join(out, `${baseline ? 'before' : 'after'}-${scenario}.png`) });
    if (!baseline && scenario === 'empty') await page.getByRole('button', { name: 'Completar historia clínica', exact: true }).waitFor();
    if (!baseline && scenario === 'data') {
      const canvas = await page.locator('canvas').elementHandle(), count = glbs;
      await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
      await page.waitForFunction(()=>document.querySelector('[data-avatar-data-state]')?.getAttribute('data-avatar-data-state')==='LOADING_USER_DATA');
      await page.waitForFunction(()=>document.querySelector('[data-avatar-data-state]')?.getAttribute('data-avatar-data-state')==='USER_DATA_READY');
      assert.equal(gets,2);assert.equal(posts,0);assert.equal(await page.locator('ion-modal').count(),0);
      assert(await canvas.evaluate(el=>el.isConnected));assert.equal(glbs,count);
      await page.getByRole('button', { name: 'Registrar peso', exact: true }).click();
      const modal = page.locator('ion-modal.avatar-weight-modal');
      await modal.locator('ion-input input').fill('110');
      await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
      await page.getByText('Consultando tu historial de peso…', { exact: true }).waitFor();
      assert(await canvas.evaluate(el => el.isConnected));
      assert.equal(glbs, count);
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-avatar-metrics]');
        return el && Math.abs(JSON.parse(el.dataset.avatarMetrics).morphWeights.BodyVolume - 0.5) < 0.001;
      });
      assert.equal(posts, 1); assert.equal(gets,3); assert.equal(glbs, count); assert(await canvas.evaluate(el => el.isConnected));
      if (process.env.AVATAR_MODULAR) {
        await section('clothing');
        const shirt = page.locator('ion-select[label="Camiseta"]');
        const choose = value => shirt.evaluate((el, value) => el.dispatchEvent(new CustomEvent('ionChange', { detail: { value }, bubbles: true })), value);
        await choose('shirt-basic-01');
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).equipment?.shirt?.status === 'ready');
        const dressed = await readMetrics(); assert.equal(dressed.calls, 2); assert.equal(dressed.triangles, 18287);
        await page.screenshot({ path: path.join(out, 'shirt-equipped.png') });
        if (process.env.AVATAR_HAIR) {
          await section('hair');
          const hair = page.locator('ion-select[label="Cabello"]');
          for (const id of ['hair-02', 'hair-03']) {
            await hair.evaluate((el, value) => el.dispatchEvent(new CustomEvent('ionChange', { detail: { value }, bubbles: true })), id);
            await page.waitForFunction(id => { const m = JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics); return m.equipment?.hair?.id === id && m.equipment.hair.status === 'ready'; }, id);
            const m = await readMetrics(); assert.equal(m.calls, 3); assert.equal(m.bones, 51);
            await page.screenshot({ path: path.join(out, `${id}-equipped.png`) });
            reports.push({ scenario: id, metrics: m });
          }
          if (process.env.AVATAR_ACCESSORIES) {
            await section('accessories');
            for (const [label, id] of [['Gafas','glasses-01'],['Reloj','watch-01'],['Pulsera','bracelet-01']]) {
              await page.locator(`ion-select[label="${label}"]`).evaluate((el,value) => el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),id);
            }
            await page.waitForFunction(() => {
              const e=JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).equipment;
              return ['glasses','watch','bracelet'].every(slot=>e?.[slot]?.status==='ready');
            });
            await page.waitForTimeout(1500);
            const combined=await readMetrics(); assert(combined.calls===9); assert.equal(combined.bones,51);
            await page.screenshot({path:path.join(out,'all-equipped.png')});
            await page.waitForTimeout(12500);
            const animated=await readMetrics(); assert(animated.loops>0); assert(animated.idleTime>combined.idleTime+10);
            reports.push({scenario:'all-equipment',combined,animated});
            if (process.env.AVATAR_BODY_V8) {
              await page.locator('ion-segment-button[value="evolution"]').click();
              const record = page.locator('ion-select').filter({has:page.locator('ion-select-option[value="2026-09-07"]')});
              for(const [day,volume,lean] of [[1,0,0],[2,.25,0],[3,.5,0],[4,.75,0],[5,1,0],[6,0,.5],[7,.5,0]]) {
                await record.evaluate((el,value)=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),`2026-09-${String(day).padStart(2,'0')}`);
                await page.waitForFunction(({volume,lean})=>{
                  const m=JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics);
                  return Math.abs(m.morphWeights.BodyVolume-volume)<.001 && Math.abs(m.morphWeights.BodyLean-lean)<.001;
                },{volume,lean});
                const m=await readMetrics();assert.equal(Object.keys(m.equipment).length,5);assert(m.idleTime>=animated.idleTime);
                await page.screenshot({path:path.join(out,`combined-body-${day}.png`)});
                reports.push({scenario:`combined-body-${day}`,metrics:m});
              }
            }
            for(const label of ['Gafas','Reloj','Pulsera']) {
              await page.locator(`ion-select[label="${label}"]`).evaluate(el=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value:''},bubbles:true})));
            }
            await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).calls===3);
          }
          await section('hair');
          await hair.evaluate(el => el.dispatchEvent(new CustomEvent('ionChange', { detail: { value: '' }, bubbles: true })));
        }
        await section('clothing');
        await choose('shirt-basic-01-navy');
        await page.waitForFunction(() => { const m = JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics); return m.equipment?.shirt?.id === 'shirt-basic-01-navy' && m.equipment.shirt.status === 'ready'; });
        await choose('');
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).calls === 1);
        assert.equal(glbs, count); assert(await canvas.evaluate(el => el.isConnected));
        reports.push({ scenario: 'shirt-equip-change-remove', dressed, sameBodyCanvas: true });
      }
      if (process.env.AVATAR_GENDER) {
        await section('body');
        const selectGender = value => page.locator('ion-select[label="Género del avatar"]').evaluate((el,value) => el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),value);
        await selectGender('female');
        await page.waitForFunction(() => { const el=document.querySelector('[data-avatar-metrics]');return el && JSON.parse(el.dataset.avatarMetrics).triangles===15000; });
        assert.equal(await canvas.evaluate(el=>el.isConnected),false);
        assert.equal(await page.locator('canvas').count(),1);
        const female=await readMetrics();assert.equal(female.bones,51);assert.equal(female.initialMorphWeights.BodyVolume,.5);
        await page.waitForTimeout(2000);const animated=await readMetrics();assert(animated.idleTime>female.idleTime);
        await page.screenshot({path:path.join(out,'female-integrated.png')});
        reports.push({scenario:'female-integrated',female,animated});
        if (process.env.AVATAR_MODULAR) {
          for (const [tab,label,id] of [['clothing','Camiseta','shirt-basic-01'],['hair','Cabello','hair-02'],['accessories','Gafas','glasses-01'],['accessories','Reloj','watch-01'],['accessories','Pulsera','bracelet-01']]) {
            await section(tab);
            await page.locator(`ion-select[label="${label}"]`).evaluate((el,value)=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),id);
          }
          await page.waitForFunction(()=>{const m=JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics);return Object.values(m.equipment??{}).filter(e=>e.status==='ready').length===5;});
          await page.waitForTimeout(2500);
          const full=await readMetrics();assert.equal(full.calls,10);assert.equal(full.triangles,26063);
          await page.screenshot({path:path.join(out,'female-all-equipped.png')});
          reports.push({scenario:'female-all-equipment',metrics:full});
          await page.locator('ion-segment-button[value="evolution"]').click();
          for (const [day,volume,lean] of [[1,0,0],[3,.5,0],[5,1,0],[6,0,.5]]) {
            await page.locator('ion-select[label="Registro mostrado"]').evaluate((el,value)=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),`2026-09-${String(day).padStart(2,'0')}`);
            await page.waitForFunction(({volume,lean})=>{const m=JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics);return Math.abs(m.morphWeights.BodyVolume-volume)<.001&&Math.abs(m.morphWeights.BodyLean-lean)<.001;},{volume,lean});
            await page.screenshot({path:path.join(out,`female-body-${day}.png`)});
          }
          await section('body');await selectGender('male');
          await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-avatar-metrics]')?.dataset.avatarMetrics || '{}').triangles===22006);
          reports.push({scenario:'gender-keeps-compatible-equipment',metrics:await readMetrics()});
          for (const [tab,label] of [['clothing','Camiseta'],['hair','Cabello'],['accessories','Gafas'],['accessories','Reloj'],['accessories','Pulsera']]) {
            await section(tab);await page.locator(`ion-select[label="${label}"]`).evaluate(el=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value:''},bubbles:true})));
          }
          await section('body');
        }
        await selectGender('male');
        await page.waitForFunction(() => {const el=document.querySelector('[data-avatar-metrics]');return el && JSON.parse(el.dataset.avatarMetrics).triangles===14354;});
        assert.equal(await page.locator('canvas').count(),1);
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: path.join(out, 'after-desktop.png') });
      await page.reload();
      await page.locator('[data-avatar-metrics]').waitFor({ state: 'attached', timeout: 60000 });
      assert.equal((await readMetrics()).initialMorphWeights.BodyVolume, 0.5);
      reports.push({ scenario: 'weight-update-and-reload', sameCanvas: true, postCount: posts, reload: await readMetrics() });
    }
    await page.close();
  }
  await fs.writeFile(path.join(out, baseline ? 'before.json' : 'after.json'), JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports));
} finally { await browser?.close(); await server.close(); }

