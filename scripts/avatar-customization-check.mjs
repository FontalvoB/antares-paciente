// FASE 5: página, visor y GLB reales; HTTP controlado, sin escrituras en BD.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.env.AVATAR_REPORT_DIR ?? 'docs/avatar-customization-v1-validation/browser');
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
  let stored={version:1,skin:'skin-03',gender:'female',hair:'hair-02',clothing:{shirt:'shirt-basic-01',pants:null,shoes:null},accessories:{glasses:'glasses-01',watch:'watch-01',bracelet:'bracelet-01'}};
  let failGet=false,failPut=false,puts=0,delay=process.env.AVATAR_BENCH ? 0 : 4500,loaded=[];
  let roles=[];
  await page.route('**/api/auth/me', route=>route.fulfill({json:{id:'avatar-test-user',roles}}));
  await page.route('**/api/auth/me/avatar',async route=>{
    if(route.request().method()==='PUT') {
      puts++; await new Promise(r=>setTimeout(r,500));
      if(failPut) return route.fulfill({status:503,json:{message:'Test save failure'}});
      stored=route.request().postDataJSON();return route.fulfill({json:stored});
    }
    await new Promise(r=>setTimeout(r,delay));
    return route.fulfill({status:failGet?503:200,json:failGet?{message:'Test load failure'}:stored});
  });
  let bodyWeight=110;
  await page.route('**/api/v1/program/me/metrics-history?**',async route=>{
    await new Promise(r=>setTimeout(r,process.env.AVATAR_BENCH ? 0 : 500));
    return route.fulfill({json:{heightCm:null,metrics:[{code:'weight',unit:'kg',points:[{date:'2026-09-01',value:100},{date:'2026-09-02',value:bodyWeight}]}]}});
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
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>{const m=document.querySelector('[data-avatar-metrics]');return m&&JSON.parse(m.dataset.avatarMetrics).fps>0;},{},{timeout:60000});
  await page.goto('http://127.0.0.1:5187/avatar-loading-test');
  await page.waitForTimeout(1200);assert.equal(loaded.length,0);await ready();
  assert.equal((await config()).skin,'skin-03');
  if (process.env.AVATAR_FINAL_UI) {
    await page.locator('ion-segment[aria-label="Vista del avatar"]') .evaluate(el=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value:'evolution'},bubbles:true})));
    assert.equal(await page.getByRole('button',{name:'Registrar peso',exact:true}).count(),0);
    for (const width of [375,767,1280]) {
      await page.setViewportSize({width,height:900});
      const displays=await page.locator('.avatar-viewer-actions').evaluateAll(els=>els.map(el=>getComputedStyle(el).display));
      assert(displays.length>0);
      assert(displays.every(display=>width<768 ? display==='none' : display!=='none'));
    }
    const before=await metrics(); await page.waitForTimeout(1200); const after=await metrics();
    assert(after.idleTime!==before.idleTime || after.loops>before.loops);
    roles=['Admin']; delay=20; await page.reload(); await ready();
    await page.locator('ion-segment[aria-label="Vista del avatar"]') .evaluate(el=>el.dispatchEvent(new CustomEvent('ionChange',{detail:{value:'evolution'},bubbles:true})));
    await page.getByRole('button',{name:'Registrar peso',exact:true}).click();
    assert(await page.locator('ion-modal').isVisible());
    console.log(JSON.stringify({passed:true,nonAdminHidden:true,adminModal:true,mobileHidden:true,desktopControls:true,idleAutomatic:true}));
  } else {
  const samples=[];
  for(const gender of ['female','male']) {
    await section('body');await select('Género del avatar',gender);await ready();
    await page.getByRole('button',{name:'Medio oscuro',exact:true}).click();assert.equal((await config()).skin,'skin-04');
    await section('clothing');await select('Camiseta','shirt-basic-01');
    for(const style of ['01','02','03']) {
      const id=`pants-${gender}-${style}`;await select('Pantalón',id);await page.locator('canvas').scrollIntoViewIfNeeded();
      await page.waitForFunction(id=>JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).equipment?.pants?.id===id && JSON.parse(document.querySelector('[data-avatar-metrics]').dataset.avatarMetrics).equipment.pants.status==='ready',id);
      await page.waitForTimeout(1400);samples.push({gender,style,metrics:await metrics()});
      if (!process.env.AVATAR_NO_SCREENSHOTS) await page.screenshot({path:path.join(out,`${id}.png`)});
    }
    await select('Pantalón',`pants-${gender}-02`);await select('Zapatos',`shoes-${gender}-01`);
    await section('hair');await select('Cabello',gender==='female'?'female-hair-long-01':'hair-02');
    await section('accessories');await select('Gafas','glasses-01');await select('Reloj','watch-01');await select('Pulsera','bracelet-01');
    failPut=true;await page.getByRole('button',{name:'Guardar avatar',exact:true}).click();
    await page.getByText('No se pudo guardar. Tu selección se conserva; vuelve a intentarlo.',{exact:true}).waitFor();
    const draft=await config();failPut=false;await page.getByRole('button',{name:'Reintentar guardado',exact:true}).click();
    await page.getByText('Personalización sincronizada.',{exact:true}).waitFor();assert.deepEqual(stored,draft);
    delay=20;loaded=[];await page.reload();await ready();assert.deepEqual(await config(),draft);
    assert(loaded.some(url=>url.includes(`pants-${gender}-02`)));assert(!loaded.some(url=>url.includes(gender==='male'?'female-body':'/male-body')));
    await section('body');
    for(const label of ['Claro','Claro medio','Medio','Medio oscuro','Oscuro']) {
      await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(300);
      if (!process.env.AVATAR_NO_SCREENSHOTS) await page.screenshot({path:path.join(out,`${gender}-skin-${label.replaceAll(' ','-')}.png`)});
    }
    await page.getByRole('button',{name:'Medio oscuro',exact:true}).click();await page.getByRole('button',{name:'Guardar avatar',exact:true}).click();
    await page.getByText('Personalización sincronizada.',{exact:true}).waitFor();
    for(const [volume,weight] of [[0,100],[.25,105],[.5,110],[.75,115],[1,120],[-.5,90],[-1,80]]) {
      bodyWeight=weight;await page.reload();await ready();const m=await metrics();
      assert(Math.abs((m.morphWeights.BodyVolume-m.morphWeights.BodyLean)-volume)<.002);
      samples.push({gender,volume,metrics:m});if (!process.env.AVATAR_NO_SCREENSHOTS) await page.screenshot({path:path.join(out,`${gender}-body-${volume}.png`)});
    }
    bodyWeight=110;
  }
  for(const size of [{width:375,height:812},{width:1280,height:900}]) {
    await page.setViewportSize(size);await section('body');if (!process.env.AVATAR_NO_SCREENSHOTS) await page.screenshot({path:path.join(out,`layout-${size.width}.png`)});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({http:'controlled; real components and GLB',puts,samples,errors,restored:stored},null,2));
  console.log(JSON.stringify({passed:true,puts,samples:samples.length,out}));
  }
} finally {await browser?.close();await server.close();}
