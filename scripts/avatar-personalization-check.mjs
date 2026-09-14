// FASE 5: página, visor y GLB reales; HTTP controlado, sin escrituras en BD.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.AVATAR_AUDIT_DIR || path.join(root, 'docs/avatar-phases-11-13-validation/phase13');
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
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:430,height:1000}});
  await page.addInitScript(()=>sessionStorage.setItem('copp_access_token','avatar-test-session'));
  let stored={version:1,gender:'female',hair:'hair-02',clothing:{shirt:'shirt-basic-01',pants:null,shoes:null},accessories:{glasses:'glasses-01',watch:'watch-01',bracelet:'bracelet-01'}};
  let failGet=false,failPut=true,puts=0,delay=process.env.AVATAR_BENCH ? 0 : 4500,loaded=[];
  await page.route('**/api/auth/me/avatar',async route=>{
    if(route.request().method()==='PUT') {
      puts++; await new Promise(r=>setTimeout(r,500));
      if(failPut) return route.fulfill({status:503,json:{message:'Test save failure'}});
      stored=route.request().postDataJSON();return route.fulfill({json:stored});
    }
    await new Promise(r=>setTimeout(r,delay));
    return route.fulfill({status:failGet?503:200,json:failGet?{message:'Test load failure'}:stored});
  });
  await page.route('**/api/v1/program/me/metrics-history?**',async route=>{
    await new Promise(r=>setTimeout(r,process.env.AVATAR_BENCH ? 0 : 500));
    return route.fulfill({json:{heightCm:null,metrics:[{code:'weight',unit:'kg',points:[{date:'2026-09-01',value:100},{date:'2026-09-02',value:110}]}]}});
  });
  await page.route('**/*.glb',async route=>{loaded.push(route.request().url());
    if(!process.env.AVATAR_BENCH && route.request().url().includes('shirt')) await new Promise(r=>setTimeout(r,800));
    return route.continue();
  });
  const metrics=()=>page.locator('[data-avatar-metrics]').evaluate(el=>JSON.parse(el.dataset.avatarMetrics));
  const performanceSamples=[];
  const config=()=>page.locator('[data-avatar-configuration]').evaluate(el=>JSON.parse(el.dataset.avatarConfiguration));
  const section=value=>page.locator('ion-segment[aria-label="Personalización del avatar"]').evaluate((el,value)=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),value);
  const select=(label,value)=>page.locator(`ion-select[label="${label}"]`).evaluate((el,value)=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value},bubbles:true})),value);
  const ready=()=>page.waitForFunction(()=>{const m=document.querySelector('[data-avatar-metrics]');return m&&Object.values(JSON.parse(m.dataset.avatarMetrics).equipment??{}).filter(e=>e.status==='ready').length===5;},{},{timeout:60000});
  await page.goto('http://127.0.0.1:5187/avatar-loading-test');
  if(!process.env.AVATAR_BENCH) { await page.waitForTimeout(1500);assert.equal(loaded.length,0);assert.equal(await page.locator('canvas').count(),0); }
  await ready();const first=await metrics();assert.equal(first.initialMorphWeights.BodyVolume,.5);assert.equal(first.triangles,26063);assert(loaded.every(url=>!url.includes('/male-body')));
  assert.equal(await page.getByRole('button',{name:'Registrar peso',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Actualizar historial',exact:true}).count(),0);
  assert.equal(await page.getByRole('heading',{name:'Mi Avatar',exact:true}).count(),1);
  const initialCanvas=await page.locator('canvas').elementHandle();
  await page.locator('ion-segment-button[value="evolution"]').click();
  await page.getByRole('button',{name:'Registrar peso',exact:true}).waitFor();
  await page.getByRole('button',{name:'Ver inicial del período',exact:true}).click();
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).morphWeights.BodyVolume<.001);
  await page.locator('ion-segment-button[value="appearance"]').click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).morphWeights.BodyVolume>.499);
  assert(await initialCanvas.evaluate(el=>el.isConnected));
  assert.equal(await page.getByRole('button',{name:'Registrar peso',exact:true}).count(),0);
  await page.getByRole('button',{name:'Ver de perfil',exact:true}).click();
  await page.screenshot({path:path.join(out,'side-view.png')});
  await page.getByRole('button',{name:'Ver de frente',exact:true}).click();
  await page.waitForTimeout(2500);const female=await metrics();assert(female.idleTime>first.idleTime);assert.equal(female.calls,10);
  await page.screenshot({path:path.join(out,'female-ready.png')});
  // Nuevos cabellos femeninos: selección local real, sin simular compatibilidad del backend.
  await section('hair');
  for (const id of ['female-hair-long-01','female-hair-long-02','female-hair-long-03']) {
    await select('Cabello',id);
    await page.waitForFunction(id=>{const m=JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics);return m.equipment?.hair?.id===id&&m.equipment.hair.status==='ready';},id);
    assert.equal((await config()).hair,id);
    await page.waitForTimeout(2200);
    performanceSamples.push({scenario:id,metrics:await metrics()});
    await page.screenshot({path:path.join(out,`${id}.png`)});
  }
  await select('Cabello','hair-02');await ready();
  await section('clothing');await select('Camiseta','shirt-basic-01-navy');
  await page.getByRole('button',{name:'Guardar avatar',exact:true}).click();
  await page.getByText('No se pudo guardar. Tu selección se conserva; vuelve a intentarlo.',{exact:true}).waitFor();
  assert.equal((await config()).clothing.shirt,'shirt-basic-01-navy');assert.equal(stored.clothing.shirt,'shirt-basic-01');
  failPut=false;await page.getByRole('button',{name:'Reintentar guardado',exact:true}).click();
  await page.getByText('Personalización sincronizada.',{exact:true}).waitFor();assert.equal(puts,2);
  const saved=structuredClone(stored);delay=50;loaded=[];await page.reload();await ready();assert.deepEqual(await config(),saved);assert(loaded.every(url=>!url.includes('/male-body')));
  await page.screenshot({path:path.join(out,'restored.png')});
  const oldCanvas=await page.locator('canvas').elementHandle();
  await section('body');await select('Género del avatar','male');await ready();
  assert.equal(await oldCanvas.evaluate(el=>el.isConnected),false);assert.equal(await page.locator('canvas').count(),1);
  await page.waitForTimeout(2500);const male=await metrics();assert.equal(male.triangles,22006);assert.equal(male.calls,9);
  await page.screenshot({path:path.join(out,'male-ready.png')});
  // Incompatible Hair03 se retira al cambiar de género, sin perder otros slots.
  await section('hair');await select('Cabello','hair-03');await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-avatar-configuration]').dataset.avatarConfiguration).hair==='hair-03');
  await section('body');await select('Género del avatar','female');assert.equal((await config()).hair,null);
  await section('hair');await select('Cabello','hair-02');await ready();
  const soakSeconds=Number(process.env.AVATAR_SOAK_SECONDS || 0);
  for(let elapsed=0;elapsed<soakSeconds;elapsed+=10) {
    await page.waitForTimeout(10000);
    performanceSamples.push({scenario:'sustained-idle',elapsedSeconds:elapsed+10,metrics:await metrics()});
  }
  await fs.writeFile(path.join(out,'performance.json'),JSON.stringify({surface:'Desktop Edge headless; mobile viewport, NOT physical Android/iOS',soakSeconds,performanceSamples},null,2));
  failGet=true;loaded=[];await page.reload();await page.getByText('No se pudo cargar tu personalización.',{exact:true}).waitFor();assert.equal(loaded.length,0);
  failGet=false;await page.getByRole('button',{name:'Reintentar personalización',exact:true}).click();await ready();
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(out,'desktop.png')});
  const accessibility=[];
  for(const size of [{width:375,height:812},{width:430,height:932},{width:844,height:390}]) {
    await page.setViewportSize(size);
    await section('accessories');
    await page.locator('ion-select[label="Gafas"]').click();
    await page.getByRole('radio',{name:'Sin accesorio',exact:true}).click();
    await page.locator('ion-popover').waitFor({state:'detached'});
    assert.equal((await config()).accessories.glasses,null);
    await page.locator('ion-select[label="Gafas"]').click();
    await page.getByRole('radio',{name:'Gafas negras',exact:true}).click();
    await page.locator('ion-popover').waitFor({state:'detached'});
    assert.equal((await config()).accessories.glasses,'glasses-01');
    const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
      targets:[...document.querySelectorAll('ion-button,ion-select,ion-segment-button')].filter(e=>e.getBoundingClientRect().height>0)
        .map(e=>({label:e.getAttribute('label')||e.textContent.trim(),height:e.getBoundingClientRect().height}))}));
    assert(layout.scrollWidth<=layout.width);assert(layout.targets.every(t=>t.height>=44));
    accessibility.push({size,...layout});
    await page.screenshot({path:path.join(out,`responsive-${size.width}.png`)});
  }
  await fs.writeFile(path.join(out,'accessibility.json'),JSON.stringify(accessibility,null,2));
  await fs.writeFile(path.join(out,'personalization.json'),JSON.stringify({first,female,male,puts,restored:saved,configurationGate:true,initialEquipmentGate:true,saveFailureRetained:true,incompatibleHairRemoved:true,loadRetry:true},null,2));
  console.log('PASS: configuration gating, equipment gating, both genders, save/retry/restore, compatibility, errors.');
} finally {await browser?.close();await server.close();}

