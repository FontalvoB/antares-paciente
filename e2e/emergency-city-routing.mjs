/** Interfaz real; sesión, GPS y entrega al marcador interceptados. Nunca llama a emergencias. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const origin = process.env.COP_E2E_APP_URL ?? 'http://localhost:5173';
const out = process.env.COP_E2E_OUTPUT;
assert(out); await mkdir(out, { recursive: true });
const patientId = '11111111-1111-4111-8111-111111111111';
const co = { latitude: 5.0703, longitude: -75.5138, accuracy: 20 };
const us = { latitude: 37.3382, longitude: -121.8863, accuracy: 20 };
const cases = ['manizales', 'san-jose', 'local-e164', 'bogota', 'miami', 'expired', 'expires-open', 'pending', 'invalid-phone', 'administrative', 'future-review', 'invalid-review-date', 'future-boundary', 'bad-boundary', 'ambiguous-city', 'duplicate-contact', 'missing-asset', 'bad-json', 'bad-version', 'slow-asset', 'uncertain-gps', 'missing-accuracy', 'city-border', 'denied-gps', 'unsupported-gps', 'retry-gps', 'offline', 'travel'];
const results = [], browser = await chromium.launch();
for (const width of [390, 320, 768]) for (const scenario of cases) {
  if (process.env.COP_E2E_CASE && !process.env.COP_E2E_CASE.split(',').includes(`${scenario}-${width}`)) continue;
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let position = scenario === 'san-jose' ? us : scenario === 'miami' ? { latitude: 25.7617, longitude: -80.1918, accuracy: 20 } : scenario === 'bogota' ? { latitude: 4.711, longitude: -74.0721, accuracy: 20 } : ['denied-gps', 'retry-gps'].includes(scenario) ? null : scenario === 'unsupported-gps' ? { latitude: 19.4, longitude: -99.1, accuracy: 20 } : { ...co, accuracy: scenario === 'uncertain-gps' ? 50000 : scenario === 'missing-accuracy' ? undefined : 20 };
  if (scenario === 'city-border') {
    const data = JSON.parse(await readFile(new URL('../src/data/emergency-city-directory.json', import.meta.url), 'utf8'));
    const [longitude, latitude] = data.cities.find(c => c.id === 'CO-17001').boundary.geometry.coordinates[0][0];
    position = { latitude, longitude, accuracy: 20 };
  }
  const now = new Date(scenario === 'expired' ? '2027-03-01T14:00:00Z' : scenario === 'expires-open' ? '2027-02-02T23:59:50Z' : scenario === 'invalid-review-date' ? '2026-12-02T14:00:00Z' : '2026-11-06T14:00:00Z');
  const token = 'x.' + Buffer.from(JSON.stringify({ sub: patientId, exp: Math.floor(now.getTime() / 1000) + 7 * 86400 })).toString('base64url') + '.x';
  if (scenario === 'expires-open') await page.clock.install({ time: now });
  else await page.clock.setFixedTime(now);
  await page.addInitScript(position => {
    window.__qaPosition = position; window.__qaDials = [];
    navigator.geolocation.getCurrentPosition = (success, error) => queueMicrotask(() => window.__qaPosition ? success({ coords: window.__qaPosition, timestamp: Date.now() }) : error?.({ code: 1, message: 'denied' }));
  }, position);
  let heldRoute, assetReads = 0; const writes = [];
  await page.route('**/src/utils/nativeDialer.ts*', async route => {
    const response = await route.fetch(), body = await response.text();
    assert(body.includes('window.location.assign(`tel:${number}`)'));
    await route.fulfill({ response, body: body.replace('window.location.assign(`tel:${number}`)', 'window.__qaDials.push(`tel:${number}`)') });
  });
  await page.route('**/emergency-city-directory*.json*', async route => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    assetReads++;
    if (scenario === 'missing-asset') return route.fulfill({ status: 404, body: '' });
    if (scenario === 'bad-json') return route.fulfill({ contentType: 'application/json', body: '{' });
    if (scenario === 'slow-asset') { heldRoute = route; return; }
    const data = JSON.parse(await readFile(new URL('../src/data/emergency-city-directory.json', import.meta.url), 'utf8'));
    const city = data.cities.find(c => c.id === 'CO-17001'), contact = city.contacts[0];
    if (scenario === 'pending') contact.status = 'pending';
    if (scenario === 'invalid-phone') contact.phone = '1234';
    if (scenario === 'local-e164') contact.phone = '+573001234567';
    if (scenario === 'administrative') contact.purpose = 'administrative';
    if (scenario === 'future-review') contact.verifiedAt = '2027-01-01T00:00:00Z';
    if (scenario === 'invalid-review-date') contact.verifiedAt = '2026-11-31T00:00:00Z';
    if (scenario === 'future-boundary') city.boundary.reviewedAt = '2027-01-01T00:00:00Z';
    if (scenario === 'bad-boundary') city.boundary.geometry = { type: 'Polygon', coordinates: [] };
    if (scenario === 'ambiguous-city') data.cities.push({ ...structuredClone(city), id: 'CO-99999' });
    if (scenario === 'duplicate-contact') city.contacts.push({ ...structuredClone(contact), phone: '+573001234567' });
    if (scenario === 'bad-version') data.version = 99;
    return route.fulfill({ json: data });
  });
  await page.route('**/api/**', route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    if (request.method() !== 'GET' && p !== '/api/auth/refresh') writes.push(p);
    const reply = json => route.fulfill({ json });
    if (p === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 86400 });
    if (p === '/api/auth/me') return reply({ id: patientId, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (p === '/api/v1/me/patient-profile') return reply({ patientId, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', phone: '+12025550101', email: 'qa@example.invalid', emergencyName: 'Contacto QA', emergencyPhone: '+12025550102' });
    if (p === '/api/v1/telemedicine/me' || p === '/api/v1/me/context') return reply({ patient: { id: patientId, organizationId: patientId }, clinics: [] });
    if (p === '/api/v1/telemedicine/requests/mine') return reply([]);
    if (p.includes('/appointments') || p.includes('/requests')) return reply({ items: [] });
    if (p.endsWith('/catalog') || p.endsWith('/specialties') || p.endsWith('/insurers')) return reply([]);
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto(origin);
    await page.getByRole('button', { name: 'Botón de pánico', exact: true }).click();
    const services = page.getByRole('group', { name: 'Servicios de emergencia', exact: true });
    await expect(page.locator('#sos-medical-panel')).toBeVisible();
    await expect(page.locator('#sos-services-panel')).toBeHidden();
    assert.equal(await page.locator('.sos-country-options').count(), 0);
    const sectionOrder = await page.locator('#sos-medical-panel > section').evaluateAll(elements => elements.map(e => e.className));
    assert.deepEqual(sectionOrder, ['sos-alert-card', 'sos-network', 'sos-shared']);
    await expect(page.locator('.sos-network').getByRole('button', { name: 'Llamar familiar', exact: true })).toBeVisible();
    await page.locator('.sos-scroll-body').evaluate(element => { element.scrollTop = element.scrollHeight; });
    const serviceTab = page.locator('ion-segment-button[value="services"]');
    await expect(serviceTab).toBeInViewport();
    await serviceTab.click();
    await expect(services).toBeVisible();
    await expect(page.locator('#sos-medical-panel')).toBeHidden();
    await expect(page.locator('.sos-scroll-body')).toHaveJSProperty('scrollTop', 0);
    if (['denied-gps', 'unsupported-gps', 'retry-gps'].includes(scenario)) {
      await expect(page.getByRole('button', { name: 'Reintentar ubicación', exact: true })).toBeVisible();
      for (const button of await services.locator('ion-button').all()) await expect(button).toHaveJSProperty('disabled', true);
      await expect(page.locator('ion-button.sos-orb')).toHaveJSProperty('disabled', false);
      assert.equal(writes.length, 0); assert.equal(await page.evaluate(() => window.__qaDials.length), 0);
      if (scenario === 'retry-gps') {
        await page.evaluate(position => { window.__qaPosition = position; }, co);
        await page.getByRole('button', { name: 'Reintentar ubicación', exact: true }).click();
      } else {
        results.push({ width, scenario, result: 'passed', unknownCountryDoesNotDial: true });
        await context.close(); continue;
      }
    }
    await expect(page.locator('.sos-country-status')).toContainText(scenario === 'san-jose' || scenario === 'miami' ? 'Estados Unidos' : 'Colombia');
    const initialLocal = ['manizales', 'san-jose', 'local-e164', 'offline', 'travel', 'expires-open', 'retry-gps'].includes(scenario);
    const countryNumber = ['san-jose', 'miami'].includes(scenario) ? '911' : '123';
    if (initialLocal) await expect(services.locator('[data-route-source="local"]')).toHaveCount(1);
    const overlayCopy = await page.locator('.overlay-panic').innerText();
    assert(!/\b(?:911|123|119)\b|\+12025550102/.test(overlayCopy), overlayCopy);
    if (scenario === 'offline') { await expect(services.locator('[data-route-source="local"]')).toHaveCount(1); await context.setOffline(true); }
    if (scenario !== 'slow-asset') await expect.poll(() => assetReads).toBeGreaterThan(0);
    for (const [service, label] of [['ambulance', 'Ambulancia'], ['police', 'Policía'], ['fire', 'Bomberos']]) {
      const local = initialLocal && (scenario === 'san-jose' ? service === 'police' : service === 'fire');
      const number = local ? scenario === 'san-jose' ? '+14082778911' : scenario === 'local-e164' ? '+573001234567' : '119' : countryNumber;
      const button = services.locator(`[data-emergency-service="${service}"]`);
      await expect(button).toHaveAttribute('data-route-source', local ? 'local' : 'national');
      await expect(button).toBeEnabled();
      await expect(button).toHaveAccessibleName(`Llamar: ${label}`);
      await button.click();
      assert.equal(await page.evaluate(() => window.__qaDials.at(-1)), `tel:${number}`);
    }
    assert.equal(writes.length, 0);
    if (initialLocal) {
      await expect(page.locator('.sos-country-status')).toContainText(scenario === 'san-jose' ? 'San José' : 'Manizales');
      await page.getByRole('button', { name: 'Llamar a la central de emergencias', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__qaDials.at(-1)), `tel:${countryNumber}`);
    }
    if (scenario === 'expires-open') {
      await page.clock.fastForward(15000);
      await expect(services.locator('[data-route-source="local"]')).toHaveCount(0);
      await services.getByRole('button', { name: 'Llamar: Bomberos', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__qaDials.at(-1)), 'tel:123');
    }
    if (scenario === 'travel') {
      await page.evaluate(position => { window.__qaPosition = position; window.dispatchEvent(new Event('pageshow')); }, us);
      await page.clock.setFixedTime(new Date('2026-11-06T14:01:00Z'));
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
      await expect(page.locator('.sos-country-status')).toContainText('Estados Unidos');
      await expect(services.locator('[data-emergency-service="police"]')).toHaveAttribute('data-route-source', 'local');
      await services.locator('[data-emergency-service="police"]').click();
      assert.equal(await page.evaluate(() => window.__qaDials.at(-1)), 'tel:+14082778911');
      await services.locator('[data-emergency-service="fire"]').click();
      assert.equal(await page.evaluate(() => window.__qaDials.at(-1)), 'tel:911');
    }
    if (scenario === 'slow-asset') {
      assert(heldRoute);
      await heldRoute.fulfill({ json: JSON.parse(await readFile(new URL('../src/data/emergency-city-directory.json', import.meta.url), 'utf8')) }); heldRoute = null;
      await expect(services.locator('[data-emergency-service="fire"]')).toHaveAttribute('data-route-source', 'local');
    }
    if (width === 390 || ['manizales', 'san-jose', 'bogota'].includes(scenario)) {
      await page.mouse.move(0, 0);
      await page.locator('.sos-services').screenshot({ path: path.join(out, `${scenario}-${width}.png`), animations: 'disabled' });
    }
    for (const button of await services.locator('ion-button').all()) {
      const bounds = await button.boundingBox(); assert(bounds.width >= 44 && bounds.height >= 44);
    }
    const typography = await services.locator('.sos-service-copy strong, .sos-service-dial b').evaluateAll(elements => elements.map(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      const text = range.getBoundingClientRect(), button = element.closest('ion-button').shadowRoot.querySelector('button').getBoundingClientRect();
      return { text: element.textContent, unclipped: text.left >= button.left && text.right <= button.right,
        wholeLabel: element.tagName !== 'STRONG' || range.getClientRects().length === 1 };
    }));
    assert(typography.every(item => item.unclipped && item.wholeLabel), JSON.stringify(typography));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    results.push({ width, scenario, result: 'passed' });
  } catch (error) { results.push({ width, scenario, result: 'failed', error: error.message, errors }); await page.screenshot({ path: path.join(out, `failure-${scenario}-${width}.png`), animations: 'disabled' }); }
  if (heldRoute) await heldRoute.abort().catch(() => {});
  await context.close();
}
await browser.close(); await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results)); if (results.some(r => r.result === 'failed')) process.exitCode = 1;
