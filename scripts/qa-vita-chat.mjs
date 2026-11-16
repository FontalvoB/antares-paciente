// QA sintético: solo localhost, sin cuentas clínicas ni cambios de proveedor.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.VITA_QA_URL ?? 'http://127.0.0.1:5191';
const before = process.env.VITA_QA_BEFORE === '1';
const evidence = 'docs/integracion/evidencia-vita';
await mkdir(evidence, { recursive: true });
const token = `header.${Buffer.from(JSON.stringify({ sub: 'vita-qa', aud: 'app', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic`;
const browser = await chromium.launch({ headless: true });
const results = [];
const source = await (await fetch(`${base}/src/components/VoiceOverlay.tsx`)).text();
const reactModule = source.match(/from "([^"]*\/react\.js[^"]*)"/)[1];
const callFixture = `
import React from '${reactModule}';
const C = React.createContext(null);
export function ConversationProvider({children, ...callbacks}) { return React.createElement(C.Provider, {value:callbacks}, children); }
export function useConversation() {
 const callbacks = React.useContext(C); const [isMuted,setMuted]=React.useState(false);
 window.__vitaSdkCallbacks = callbacks;
 return { status:'connected', isMuted, isSpeaking:false, setMuted,
  startSession:async()=>{window.__vitaStarts=(window.__vitaStarts||0)+1;callbacks.onConnect?.({conversationId:'synthetic'});},
  endSession:async()=>{window.__vitaEnds=(window.__vitaEnds||0)+1;},
  getInputVolume:()=>0, getOutputVolume:()=>0, getOutputByteFrequencyData:()=>new Uint8Array(0), sendUserMessage:()=>{} };
}`;

try {
  for (const lang of before ? ['es'] : ['es', 'en']) for (const width of before ? [390] : [320, 390, 430, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    let history = [];
    let actionScenario = false;
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const action = { type:'navigate', destination:'podcast', resourceId:'fixture-podcast', localDate, resourceVersion:'a'.repeat(64) };
    const writes = [];
    const errors = [];
    await context.addInitScript(({token, lang}) => {
      localStorage.setItem('copp_access_token', token);
      localStorage.setItem('antares_lang', lang);
      localStorage.setItem('antares:vita-welcome:v1:vita-qa', 'seen');
    }, { token, lang });
    await context.route('**/node_modules/.vite/deps/@elevenlabs_react.js*', route => route.fulfill({ contentType: 'text/javascript', body: callFixture }));
    await context.route('**/api/**', async route => {
      const request = route.request(); const path = new URL(request.url()).pathname;
      const reply = (body, status = 200, contentType = 'application/json') => route.fulfill({ status, contentType, body: typeof body === 'string' ? body : JSON.stringify(body) });
      if (request.method() !== 'GET') writes.push(path);
      if (path === '/api/auth/refresh') return reply({ accessToken: token, tokenType: 'Bearer', expiresIn: 3600 });
      if (path === '/api/auth/me') return reply({ id: 'vita-qa', firstName: 'Alex', lastName: 'Fixture', email: 'fixture@example.invalid' });
      if (path === '/api/v1/me/patient-profile') return reply({}, 404);
      if (path === '/api/v1/telemedicine/me') return reply({ patient: { id: 'fixture-patient' } });
      if (path.includes('/professionals-catalog')) return reply({ data: [] });
      if (path.includes('/threads/')) return reply({ threadId: 'proactive-vita-qa', messageCount: history.length, messages: history, hasMore: false });
      if (path === '/api/v1/chat/voice/session') return reply({ signedUrl: 'wss://example.invalid/synthetic', agentId: 'fixture' });
      if (path === '/api/v1/vita/me/context') return reply({ status:'ok', localDate, resourceVersion:action.resourceVersion, actions:[action], data:{}, sources:[] });
      if (path.endsWith('/task-completion-proposals')) return reply({ proposalToken:'synthetic-proposal', taskCode:'podcast', localDate, resourceVersion:action.resourceVersion, expiresAt:new Date(Date.now()+60_000).toISOString(), requiresConfirmation:true });
      if (path.endsWith('/task-completion-confirmations')) return reply({ taskCompletionId:'synthetic-completion' });
      if (path === '/api/v1/chat/stream') return reply('event:message\ndata:{"type":"token","content":"Texto inicial"}\n\nevent:done\ndata:' + JSON.stringify({ answer:'Respuesta sintética de Vita. Esta prueba confirma la presentación del hilo y sus controles.', thread_id:'proactive-vita-qa', execution_id:'fixture-execution', ...(actionScenario ? { actions:[action] } : {}) }) + '\n\n', 200, 'text/event-stream');
      if (path === '/api/v1/chat/feedback') return reply({ ok: true });
      if (path.includes('/community/graphql')) return reply({ data: {} });
      return reply({ message: 'Fuera del escenario sintético' }, 501);
    });
    // Ninguna dependencia externa puede recibir tráfico del escenario.
    await context.route('**/*', route => new URL(route.request().url()).origin !== new URL(base).origin ? route.abort() : route.fallback());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.waitForLoadState('networkidle');
    if (before) { await page.locator('.mascot-home').waitFor(); } else await page.locator('.vita-home-portrait').waitFor();
    if (!before) assert.equal(await page.locator('.hm-head .mascot').count(), 0);
    if (width === 390 && lang === 'es') await page.screenshot({ path: `${evidence}/${before ? 'antes-' : ''}inicio-390-es.png` });
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    if (!before) await page.locator('.vita-chat-welcome').waitFor();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.router-page')).opacity) > .99);
    if (width === 390) await page.screenshot({ path: `${evidence}/${before ? 'antes-' : ''}vacio-${width}-${lang}.png` });
    if (before) {
      history = [{ role: 'user', text: 'Quiero revisar mis hábitos' }, { role: 'bot', text: 'Respuesta sintética de Vita. Esta prueba confirma la presentación del hilo y sus controles.' }];
      await page.reload(); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Chat', exact: true }).click();
      await page.locator('.chat-list').getByText('Respuesta sintética de Vita.', { exact: false }).waitFor();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.router-page')).opacity) > .99);
      await page.screenshot({ path: `${evidence}/antes-hilo-390-es.png` });
      await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => new MediaStream(); });
      await page.evaluate(() => { window.__vitaPresented = new Promise(resolve => { const ready = event => { if (event.target.querySelector('.vc-shell')) { document.removeEventListener('ionModalDidPresent', ready); resolve(true); } }; document.addEventListener('ionModalDidPresent', ready); }); });
      await page.locator('.chat-voice').click(); await page.locator('.vc-shell').waitFor(); await page.evaluate(() => window.__vitaPresented);
      await page.screenshot({ path: `${evidence}/antes-llamada-390-es.png` });
      results.push({ before: true, lang, width, status: 'captured', errors }); await context.close(); continue;
    }
    const input = page.locator(before ? 'ion-input.chat-inp input' : 'ion-textarea.chat-inp textarea');
    await input.fill(lang === 'es' ? 'Quiero revisar mis hábitos' : 'I want to review my habits');
    await page.getByRole('button', { name: lang === 'es' ? 'Enviar' : 'Send', exact: true }).click();
    await page.getByText('Respuesta sintética de Vita.', { exact: false }).waitFor();
    assert.equal(await page.locator('.vita-chat-welcome').count(), 0);
    await input.fill('Primera línea\nSegunda línea');
    const layout = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      const list = document.querySelector('.chat-list');
      return { header: box('.vita-chat-header'), list: box('.chat-list'), composer: box('.chat-composer'), nav: box('.bnav'), overflow: list.scrollWidth > list.clientWidth + 1, font: getComputedStyle(document.querySelector('.bub')).fontSize, family: getComputedStyle(document.querySelector('.bub')).fontFamily, listBackground: getComputedStyle(list).backgroundImage, screenBackground: getComputedStyle(document.querySelector('.chat-reference')).backgroundImage, icons: [...document.querySelectorAll('.chat-composer ion-icon')].map(icon => ({ width:icon.getBoundingClientRect().width, height:icon.getBoundingClientRect().height })) };
    });
    assert.equal(layout.overflow, false);
    assert.ok(layout.composer.bottom <= layout.nav.top + 1, JSON.stringify(layout));
    assert.ok(layout.list.height > 350, JSON.stringify(layout));
    if ([320, 390, 430, 768].includes(width)) await page.screenshot({ path: `${evidence}/hilo-${width}-${lang}.png` });
    // Simulación de teclado en el viewport compartido; no equivale a iOS real.
    await page.evaluate(() => { document.documentElement.classList.add('kb-open'); document.documentElement.style.setProperty('--app-viewport-height', '560px'); });
    assert.ok(await page.locator('.chat-composer').isVisible());
    await page.evaluate(() => { document.documentElement.classList.remove('kb-open'); document.documentElement.style.removeProperty('--app-viewport-height'); });
    if (width === 390 && lang === 'es') {
      await page.evaluate(() => { window.__vitaPresented = new Promise(resolve => { const ready = event => { if (event.target.querySelector('.vc-shell')) { document.removeEventListener('ionModalDidPresent', ready); resolve(true); } }; document.addEventListener('ionModalDidPresent', ready); }); });
      await page.locator('.vita-header-call').click();
      await page.locator('.vc-shell').waitFor(); await page.evaluate(() => window.__vitaPresented);
      await page.screenshot({ path: `${evidence}/llamada-390-es.png` });
      const endsBeforeMinimize = await page.evaluate(() => window.__vitaEnds || 0);
      await page.evaluate(() => { window.__vitaDismissed = new Promise(resolve => document.addEventListener('ionModalDidDismiss', () => resolve(true), { once: true })); });
      await page.getByRole('button', { name: 'Volver al chat', exact: true }).click();
      await page.evaluate(() => window.__vitaDismissed);
      await page.locator('.vita-call-bar').waitFor();
      assert.equal(await page.evaluate(() => window.__vitaStarts), 1);
      assert.equal(await page.evaluate(() => window.__vitaEnds || 0), endsBeforeMinimize);
      await page.evaluate(() => window.__vitaSdkCallbacks.onMessage({ message: 'Transcripción sintética inmediata', role: 'user', source: 'user', event_id: 14 }));
      await page.locator('.chat-list').getByText('Transcripción sintética inmediata', { exact: true }).waitFor();
      await page.screenshot({ path: `${evidence}/minimizada-390-es.png` });
      await page.getByRole('button', { name: 'Restaurar llamada', exact: true }).click();
      await page.locator('.vc-shell').waitFor();
      assert.equal(await page.evaluate(() => window.__vitaStarts), 1);
      await page.getByRole('button', { name: 'Colgar', exact: true }).click();
      await page.waitForFunction(baseline => window.__vitaEnds > baseline, endsBeforeMinimize);
      actionScenario = true;
      await input.fill('Abrir mi podcast'); await page.locator('ion-button.chat-send').click();
      await page.locator('.vita-action-controls').waitFor();
      await page.evaluate(() => { window.__vitaAlertPresented = new Promise(resolve => document.addEventListener('ionAlertDidPresent', () => resolve(true), {once:true})); });
      await page.locator('.vita-action-controls').getByRole('button', {name:'Registrar que terminé',exact:true}).click();
      await page.evaluate(() => window.__vitaAlertPresented);
      await page.screenshot({ path:`${evidence}/confirmacion-390-es.png` });
      await page.getByRole('button', {name:'Cancelar',exact:true}).click();
      assert.equal(writes.filter(path=>path.endsWith('task-completion-confirmations')).length,0);
      await page.locator('.vita-action-controls').getByRole('button', {name:'Registrar que terminé',exact:true}).click();
      await page.getByRole('button', {name:'Confirmar',exact:true}).click();
      await page.getByText('Actividad registrada.', {exact:true}).waitFor();
      assert.equal(writes.filter(path=>path.endsWith('task-completion-confirmations')).length,1);

    }
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.ok(writes.every(path => ['/api/auth/refresh', '/api/v1/chat/stream', '/api/v1/chat/voice/session','/api/v1/vita/me/task-completion-proposals','/api/v1/vita/me/task-completion-confirmations'].includes(path)), writes.join(','));
    results.push({ lang, width, layout, errors, writes, status: 'passed' });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${evidence}/${before ? 'antes-' : ''}qa-resultados.json`, JSON.stringify(results, null, 2) + '\n');
}
console.log(`Vita QA: ${results.length}/${before ? 1 : 8} escenarios correctos`);
