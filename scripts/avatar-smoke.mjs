// Prueba real del flujo demo existente. No depende del backend ni escribe configuración del avatar.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs', process.env.AVATAR_TEST_OUTPUT ?? 'avatar-validation');
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error' && /avatar|three|webgl/i.test(msg.text())) errors.push(msg.text()); });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function button(text) {
  const element = await page.evaluateHandle(text => [...document.querySelectorAll('button,ion-button')].find(e => e.textContent.trim() === text), text);
  assert(element.asElement(), `Button ${text}`);
  await element.asElement().click(); await element.dispose();
}
async function metrics() { return page.$eval('[data-avatar-metrics]', el => JSON.parse(el.dataset.avatarMetrics)); }
async function top() { await page.$eval('.screen-scroll', el => { el.scrollTop = 0; }); await wait(350); }
try {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
  await page.goto(process.env.AVATAR_TEST_URL ?? 'http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-id input', { timeout: 30000 });
  await page.type('#login-id input', '12345678');
  await page.type('#login-password input', 'demo1234');
  await page.click('ion-button.cta-pill');
  await page.waitForSelector('.bnav', { timeout: 20000 });
  await button('Perfil'); await wait(700); await button('Probar avatar 3D');
  await page.waitForSelector('[data-avatar-metrics]', { timeout: 45000 });
  const first = await metrics();
  assert.equal(first.bones, 51); assert.equal(first.triangles, 23924);
  assert.equal(await page.$$eval('[data-morph]', els => els.length), 9);
  await top(); await wait(9500);
  const running = await metrics(); assert(running.loops >= 1, 'Idle completes a loop');
  assert.deepEqual(first.rootPosition, running.rootPosition, 'No root motion');
  assert.notDeepEqual(first.headQuaternion, running.headQuaternion, 'Skeleton is animated');
  if (process.env.AVATAR_RECORD === '1') {
    const recording = await page.evaluate(async () => {
      const stream = document.querySelector('canvas').captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1800000 });
      const chunks = [];
      const finished = new Promise(resolve => { recorder.onstop = async () => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
        stream.getTracks().forEach(track => track.stop());
      }; });
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.start(); setTimeout(() => recorder.stop(), 8500);
      return finished;
    });
    await fs.writeFile(path.join(output, 'idle-preview.webm'), Buffer.from(recording, 'base64'));
  }
  await page.screenshot({ path: path.join(output, 'mobile-base.png') });
  const samples = [];
  for (let i = 0; i < 5; i++) { await wait(1100); samples.push(await metrics()); }
  await button('Pausar Idle'); await top(); await wait(1200);
  const paused = await metrics(); await wait(1200);
  assert.equal((await metrics()).idleTime, paused.idleTime, 'Idle pauses');
  const stateShots = {};
  for (const [label, name] of [['A · Base', 'base'], ['B · Mayor volumen', 'larger'], ['C · Intermedio', 'intermediate'], ['D · Menor volumen', 'lean']]) {
    await button(label); await top();
    stateShots[name] = Buffer.from(await (await page.$('canvas')).screenshot());
    await fs.writeFile(path.join(output, `body-${name}.png`), stateShots[name]);
  }
  assert(!stateShots.base.equals(stateShots.larger)); assert(!stateShots.larger.equals(stateShots.intermediate)); assert(!stateShots.base.equals(stateShots.lean));
  // Interacción real por teclado con el control Ionic dentro de Shadow DOM.
  const names = await page.$$eval('[data-morph]', els => els.map(el => el.dataset.morph));
  const changes = [];
  for (const name of names) {
    await button('A · Base');
    const slider = await page.$(`[data-morph="${name}"] >>> [role="slider"]`);
    assert(slider, `Accessible slider ${name}`);
    await slider.scrollIntoView(); await slider.focus();
    for (let i = 0; i < 100; i++) await page.keyboard.press('ArrowRight');
    await wait(150);
    const value = await page.$eval(`[data-morph="${name}"]`, el => el.value);
    assert.equal(value, 1, name);
    await top();
    const shot = Buffer.from(await (await page.$('canvas')).screenshot());
    assert(!shot.equals(stateShots.base), `Rendered morph ${name}`);
    changes.push({ name, value, renderedChange: true });
  }
  await page.screenshot({ path: path.join(output, 'controls.png') });
  await button('A · Base'); await button('Reproducir Idle'); await top();
  // Cambiar isMobile reinicia la página en Chromium: volver por el flujo real.
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  await page.waitForSelector('#login-id input, .bnav', { timeout: 30000 });
  if (await page.$('#login-id input')) {
    await page.type('#login-id input', '12345678'); await page.type('#login-password input', 'demo1234');
    await page.click('ion-button.cta-pill');
  }
  await page.waitForSelector('.bnav');
  await button('Perfil'); await wait(700); await button('Probar avatar 3D');
  await page.waitForSelector('[data-avatar-metrics]', { timeout: 45000 }); await wait(1800);
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  const desktop = await metrics();
  await button('Volver'); await wait(700);
  assert.equal(await page.$$eval('canvas', els => els.length), 0, 'Canvas unmounted');
  await button('Probar avatar 3D'); await page.waitForSelector('[data-avatar-metrics]');
  const remount = await metrics();
  assert.equal(remount.bones, 51);
  assert.equal(errors.length, 0, errors.join('\n'));
  await button('Volver'); await wait(700);
  let blockAsset = true;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (blockAsset && /male-body-base-v\d+\.glb$/.test(request.url())) void request.abort();
    else void request.continue();
  });
  await button('Probar avatar 3D');
  await page.waitForFunction(() => document.body.innerText.includes('No se pudo mostrar el avatar.'));
  blockAsset = false;
  await button('Reintentar'); await page.waitForSelector('[data-avatar-metrics]', { timeout: 30000 });
  const recovered = await metrics(); assert.equal(recovered.bones, 51);
  const report = { environment: await browser.version(), userAgent: await page.evaluate(() => navigator.userAgent),
    viewport: '390x844 DPR1.5 mobile emulation; desktop1280x900 DPR1',
    first, running, samples, desktop, remount, recovered, morphs: changes,
    expectedLoadFailureRecovered: true,
    tests: ['demo login > Profile > avatar', '51 bones / 23924 triangles', 'Idle automatic loop and pause; root fixed; head animated', 'four distinct rendered body states', 'nine keyboard sliders change rendering', 'desktop rendering', 'unmount/remount', 'failed GLB download and successful retry'],
    note: 'Browser baseline, not physical phone measurements. Heap covers whole page. No GPU memory byte measurement.' };
  await fs.writeFile(path.join(output, 'baseline.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  console.error('PAGE', (await page.$eval('body', el => el.innerText)).slice(-4000));
  console.error('ERRORS', errors); throw error;
} finally { await browser.close(); }
