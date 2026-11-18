/** Full app UI, synthetic APIs/media: cover failures across snapshot refreshes. No database writes. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.COP_E2E_APP_URL ?? 'http://127.0.0.1:5188';
const out = process.env.COP_E2E_OUTPUT;
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
assert(out?.startsWith('/tmp/'));
await mkdir(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const token = 'x.' + Buffer.from(JSON.stringify({ sub: id, exp: 2000000000 })).toString('base64url') + '.x';
const photo = path.resolve('src/assets/missions/podcast.jpg');
const browser = await chromium.launch();
const results = [];
for (const screen of ['card', 'player']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/Bogota' });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  await page.clock.setFixedTime(new Date('2026-11-17T14:00:00Z'));
  let phase = 0, observedPhase = -1, writes = 0;
  const imageRequests = [];
  const snapshot = () => ({
    enrollmentId: id, todayLocalDate: '2026-11-17',
    template: { id, code: 'QA', name: 'Programa QA', totalWeeks: 24, currentWeekNumber: 3, currentWeekStatus: 'Active', currentWeekStartDateLocal: '2026-11-16', currentWeekEndDateLocal: '2026-11-22' },
    todayTasks: [{ taskCode: 'podcast', title: 'Escuchar podcast', points: 80, status: 'Pending', content: { title: 'Episodio QA', durationSecs: 840, thumbnailUrl: `${origin}/qa-cover/${phase}.jpg`, mediaUrl: `${origin}/qa-audio.wav` } }],
    todayPoints: 0, todayPointsMax: 130, todayBonusAvailable: true,
    xp: { balance: 1200, level: 'Semilla', nextLevelAt: 2000 },
    streak: { current: 1, longest: 1, freezesRemaining: 0, multiplierActive: false, nbWeekDays: Array(7).fill(false) }, calendar: [],
  });
  await page.route('**/qa-cover/*', route => {
    const n = Number(new URL(route.request().url()).pathname.split('/').at(-1).split('.')[0]);
    imageRequests.push(n);
    if (n === 2) return route.fulfill({ path: photo, contentType: 'image/jpeg' });
    if (n === 3) return route.abort('failed');
    return route.fulfill({ status: n === 1 ? 403 : 404, body: '' });
  });
  await page.route('**/qa-audio.wav', route => route.abort('failed'));
  await page.route('**/api/**', route => {
    const req = route.request(), p = new URL(req.url()).pathname;
    const reply = json => route.fulfill({ json });
    if (req.method() !== 'GET' && p !== '/api/auth/refresh') writes++;
    if (p === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 86400 });
    if (p === '/api/auth/me') return reply({ id, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (p === '/api/v1/me/patient-profile') return reply({ patientId: id, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA', email: 'qa@example.invalid' });
    if (p === '/api/v1/telemedicine/me') return reply({ patient: { id, organizationId: id }, clinics: [] });
    if (p === '/api/v1/program/me/snapshot') { observedPhase = phase; return reply(snapshot()); }
    if (p.includes('/appointments') || p.includes('/requests')) return reply({ items: [] });
    if (p.endsWith('/specialties') || p.endsWith('/insurers') || p.endsWith('/catalog')) return reply([]);
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto(origin);
    await page.locator('.hm-day-link').click();
    const card = page.locator('button.pcard').filter({ hasText: 'Escuchar podcast' });
    await card.scrollIntoViewIfNeeded();
    if (screen === 'player') { await card.click(); await expect(page.locator('.pod-cover')).toBeVisible(); }
    const cover = page.locator(screen === 'card' ? 'button.pcard .pcard-photo' : '.pod-cover img');
    const localPhoto = async () => {
      await expect(cover).toHaveAttribute('src', /\/src\/assets\/missions\/podcast\.jpg/);
      await expect.poll(() => cover.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    };
    await localPhoto();
    for (phase = 1; phase <= 3; phase++) {
      await page.clock.setFixedTime(new Date(`2026-11-${17 + phase}T14:00:00Z`));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect.poll(() => observedPhase).toBe(phase);
      await expect.poll(() => imageRequests.includes(phase)).toBe(true);
      if (phase === 2) {
        await expect(cover).toHaveAttribute('src', `${origin}/qa-cover/2.jpg`);
        await expect.poll(() => cover.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      } else await localPhoto();
    }
    if (screen === 'card') {
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await card.scrollIntoViewIfNeeded();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await card.screenshot({ path: path.join(out, `podcast-card-${width}.png`), animations: 'disabled' });
      }
    }
    assert.equal(writes, 0);
    results.push({ screen, passed: true, imageRequests });
  } catch (error) {
    await page.screenshot({ path: path.join(out, `${screen}-failed.png`), animations: 'disabled' });
    results.push({ screen, passed: false, error: error.message, imageRequests });
  } finally { await context.close(); }
}
await browser.close();
await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(r => !r.passed)) process.exitCode = 1;
