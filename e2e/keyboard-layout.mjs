/** App real con APIs sintéticas y geometría/eventos de teclado simulados. */
import { chromium, webkit, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.COP_E2E_APP_URL ?? 'http://localhost:5173';
const out = process.env.COP_E2E_OUTPUT;
assert(out);
await mkdir(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const token = 'x.' + Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.x';
const browser = await (process.env.COP_E2E_BROWSER === 'webkit' ? webkit : chromium).launch();
const results = [];
const cases = [320, 390, 768].flatMap(width => ['login', 'onboarding', 'contacts', 'chat', 'profile', 'community'].map(screen => ({ width, screen, mode: 'web' })));
for (const mode of ['ios', 'android']) for (const screen of ['onboarding', 'chat']) cases.push({ width: 390, screen, mode });
for (const width of [320, 768]) cases.push({ width, screen: 'alert', mode: 'web' });

for (const test of cases) {
  if (process.env.COP_E2E_CASE && !`${test.mode}-${test.screen}-${test.width}`.includes(process.env.COP_E2E_CASE)) continue;
  const { width, screen, mode } = test;
  const height = width === 768 ? 1024 : 844;
  const keyboard = width === 768 ? 400 : 330;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    window.__qaViewport = (height, offsetTop = 0, scale = 1) => {
      Object.assign(viewport, { height, offsetTop, scale });
      viewport.dispatchEvent(new Event('resize'));
      viewport.dispatchEvent(new Event('scroll'));
    };
  });
  if (mode !== 'web') {
    // Emular solo la dependencia nativa del hook: el resto de la app sigue en web.
    await page.route('**/src/hooks/useKeyboardInset.ts*', async route => {
      const response = await route.fetch();
      const body = (await response.text()).replaceAll('Capacitor.isNativePlatform()', 'true').replaceAll('Capacitor.getPlatform()', JSON.stringify(mode));
      await route.fulfill({ response, body });
    });
    await page.route('**/node_modules/.vite/deps/@capacitor_keyboard.js*', route => route.fulfill({ contentType: 'text/javascript', body: `export const Keyboard={addListener:async(name,callback)=>{const listener=e=>callback(e.detail);window.addEventListener('qa:'+name,listener);return {remove:()=>window.removeEventListener('qa:'+name,listener)}}};` }));
  }
  let authenticated = !['login', 'onboarding', 'contacts'].includes(screen);
  let writes = 0;
  await page.route('**/api/**', route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const reply = json => route.fulfill({ json });
    if (request.method() !== 'GET' && !p.startsWith('/api/auth/') && !p.includes('/graphql')) writes++;
    if (p === '/api/auth/refresh') return authenticated ? reply({ accessToken: token, expiresIn: 3600 }) : route.fulfill({ status: 401, json: {} });
    if (p === '/api/auth/me') return reply({ id, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (p === '/api/auth/id-lookup') return reply({ patientId: id, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', contacts: [{ id: 'qa-contact', type: 'Email', label: 'qa@example.invalid' }] });
    if (p === '/api/auth/send-otp') return reply({ expiresInSeconds: 300 });
    if (p === '/api/auth/verify-otp') { authenticated = true; return reply({ accessToken: token, expiresIn: 3600 }); }
    if (p === '/api/v1/me/patient-profile') return reply({ patientId: id, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', email: 'qa@example.invalid', phone: '3001234567', emergencyName: 'Contacto QA', emergencyPhone: '3001234567', emergencyRelationship: 'Madre', emergencyEmail: '', secondaryEmergencyContact: null, insurerId: null, memberId: '' });
    if (p === '/api/v1/me/context' || p === '/api/v1/telemedicine/me') return reply({ patient: { id, organizationId: id }, clinics: [] });
    if (p === '/api/v1/telemedicine/requests/mine') return reply([]);
    if (p.includes('/graphql')) return reply({ data: { me: { id, displayName: 'Paciente QA', bio: '', isPrivate: false }, feed: [], followingFeed: [], friends: [], groups: [], conversations: [], people: [], followers: [], following: [] } });
    if (p.endsWith('/specialties') || p.endsWith('/insurers')) return reply([]);
    if (screen === 'alert' && p === '/api/v1/appointments/mine') return reply({ items: [{ id, patientId: id, professionalId: id, professionalName: 'Profesional QA', specialtyId: id, specialtyName: 'Medicina general', scheduledStart: new Date(Date.now() + 86400_000).toISOString(), scheduledEnd: new Date(Date.now() + 88200_000).toISOString(), durationMinutes: 30, status: 'Confirmed', rescheduleCount: 0, createdAt: new Date().toISOString() }] });
    if (p.includes('/appointments') || p.includes('/requests')) return reply({ items: [] });
    if (p.endsWith('/catalog')) return reply({ data: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  const reveal = async (field, bottom) => {
    await field.focus();
    await expect.poll(async () => field.evaluate((el, bottom) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= bottom - 4;
    }, bottom)).toBe(true);
    assert(await page.evaluate(() => Math.abs(document.scrollingElement.scrollTop) < 2), 'El documento no debe desplazarse para simular el ajuste del formulario.');
  };
  const show = async () => {
    if (mode === 'android') await page.setViewportSize({ width, height: height - keyboard });
    else if (mode === 'web') await page.evaluate(h => window.__qaViewport(h), height - keyboard);
    if (mode !== 'web') await page.evaluate(h => {
      for (const name of ['keyboardWillShow', 'keyboardDidShow']) window.dispatchEvent(new CustomEvent('qa:' + name, { detail: { keyboardHeight: h } }));
    }, keyboard);
  };
  const hide = async () => {
    await page.evaluate(h => {
      window.__qaViewport(h);
      for (const name of ['keyboardWillHide', 'keyboardDidHide']) window.dispatchEvent(new CustomEvent('qa:' + name));
    }, height);
    if (mode === 'android') await page.setViewportSize({ width, height });
  };
  try {
    await page.goto(origin);
    let field, next, footer;
    if (screen === 'login') {
      await expect(page.locator('label[for="login-id"]')).toHaveText('Número de identificación');
      field = page.locator('#login-password input');
    } else if (['onboarding', 'contacts'].includes(screen)) {
      await page.getByRole('button', { name: 'Activa tu cuenta', exact: true }).click();
      const document = page.locator('#login-first-id input');
      if (screen === 'login') field = document;
      else {
        await document.fill('QA');
        await page.getByRole('button', { name: 'Confirmar identidad', exact: true }).click();
        await page.getByRole('radio').click();
        await page.locator('#login-otp-0').fill('123456');
        await page.getByRole('button', { name: 'Verificar y entrar', exact: true }).click();
        if (screen === 'contacts') {
          await page.getByRole('button', { name: 'Continuar', exact: true }).click();
          await page.getByRole('button', { name: 'Añadir contacto opcional', exact: true }).click();
          field = page.locator('#onb-fam2-name input');
          next = page.locator('#onb-fam2-cel input');
        } else { field = page.locator('#onb-email input'); next = page.locator('#onb-cel input'); }
        footer = page.locator('.onb-foot');
      }
    } else if (screen === 'chat') {
      await page.getByRole('button', { name: 'Chat', exact: true }).click();
      field = page.locator('ion-input.chat-inp input');
      footer = page.locator('.chat-composer');
    } else if (screen === 'profile') {
      await page.getByRole('button', { name: 'Perfil', exact: true }).click();
      await page.getByRole('button', { name: 'Añadir contacto opcional', exact: true }).click();
      field = page.locator('#pf-emg2-name input'); next = page.locator('#pf-emg2-cel input');
    } else if (screen === 'alert') {
      await page.getByRole('button', { name: 'Citas', exact: true }).click();
      await page.getByRole('button', { name: 'Cancelar cita', exact: true }).first().click();
      field = page.locator('ion-alert textarea');
      footer = page.locator('ion-alert .alert-wrapper');
    } else {
      await page.getByRole('button', { name: /Comunidad/ }).first().click();
      await page.locator('.mcar-card').filter({ hasText: 'Comunidad' }).click();
      await page.getByRole('button', { name: 'Publicar', exact: true }).first().click();
      field = page.locator('textarea.comp-input');
    }
    await field.focus();
    await show();
    await reveal(field, height - keyboard);
    if (next) await reveal(next, height - keyboard);
    if (footer) {
      await expect.poll(() => footer.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(height - keyboard + 1);
    }
    await page.screenshot({ path: path.join(out, `${mode}-${screen}-${width}-open.png`), animations: 'disabled' });
    if (screen === 'chat' && mode === 'web') {
      await page.evaluate(h => window.__qaViewport(h, 25), height - keyboard - 25);
      await reveal(field, height - keyboard);
    }
    await field.blur(); await hide();
    await expect.poll(() => page.locator('.app-shell').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(height - 40);
    if (screen === 'chat') await expect(page.locator('.bnav')).toBeVisible();
    assert.equal(writes, 0);
    results.push({ ...test, result: 'passed' });
  } catch (error) {
    results.push({ ...test, result: 'failed', error: error.message });
    await page.screenshot({ path: path.join(out, `${mode}-${screen}-${width}-failure.png`), animations: 'disabled' });
  }
  await context.close();
}
await browser.close();
await writeFile(path.join(out, 'keyboard-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => result.result === 'failed')) process.exitCode = 1;
