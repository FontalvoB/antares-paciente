/** App -> real local API -> isolated PostgreSQL -> AI service. Only session/unrelated APIs are fixtures. */
import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out = process.env.COP_E2E_OUTPUT;
assert(out?.startsWith('/tmp/'), 'Evidence must stay outside the repository');
await mkdir(out, { recursive: true });
const api = process.env.COP_E2E_PROFILE_API;
assert(api && /^http:\/\/127\.0\.0\.1:\d+$/.test(api), 'Only isolated local API hosts are allowed');
const token = (await readFile(process.env.COP_E2E_TOKEN_FILE, 'utf8')).trim();
const subject = JSON.parse(await readFile(process.env.COP_E2E_SUBJECT_FILE, 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.setDefaultTimeout(12000);
await expect.poll(async () => { try { return (await page.request.get(api + '/health')).status(); } catch { return 0; } }, { timeout: 15000 }).toBe(200);
const posts = [];
await page.route('**/api/**', async route => {
  const req = route.request(), url = new URL(req.url()), p = url.pathname;
  if (p.startsWith('/api/v1/health-tests/me/')) {
    const response = await route.fetch({ url: api + p + url.search, headers: { ...req.headers(), authorization: `Bearer ${token}` }, timeout: 95000 });
    if (p.endsWith('/profile-analysis') && req.method() === 'POST') posts.push({ status: response.status(), body: response.headers()['content-type']?.includes('json') ? await response.json() : null });
    return route.fulfill({ response });
  }
  const reply = json => route.fulfill({ json });
  if (p === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 86400 });
  if (p === '/api/auth/me') return reply({ id: subject.userId, firstName: 'Paciente', lastName: 'Perfil IA QA', roles: ['Patient'], permissions: [] });
  if (p === '/api/v1/me/patient-profile') return reply({ patientId: subject.patientId, firstName: 'Paciente', lastName: 'Perfil IA QA', documentNumber: 'QA', email: 'qa@example.invalid' });
  if (p.includes('/appointments') || p.includes('/requests')) return reply({ items: [] });
  if (p.endsWith('/catalog') || p.endsWith('/insurers') || p.endsWith('/specialties')) return reply([]);
  return route.fulfill({ status: 404, json: {} });
});
async function openResults() {
  await page.goto(process.env.COP_E2E_APP_URL ?? 'http://127.0.0.1:5184');
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await page.getByRole('button', { name: /Batería de evaluación/ }).click();
  await page.getByRole('button', { name: 'Resultados de tus evaluaciones', exact: true }).click();
}
try {
  await openResults();
  await page.screenshot({ path: path.join(out, 'before-generation.png') });
  const generate = page.getByRole('button', { name: 'Analizar mis resultados con Vita', exact: true });
  await expect(generate.or(page.locator('.assessment-ai-summary'))).toBeVisible();
  if (await generate.count()) await generate.click();
  await expect(page.locator('.assessment-ai-summary')).toBeVisible({ timeout: 95000 });
  assert.equal(posts.length, 1, 'One deliberate generation');
  assert.equal(posts[0].status, 200);
  const analysis = posts[0].body;
  assert.equal(analysis.sources.length, 2, 'Both latest evaluations survive identical raw result codes');
  assert.deepEqual(analysis.sources.map(s => s.testCode).sort(), ['qa-estres', 'qa-sueno']);
  assert(analysis.sources.every(s => s.value === 4), 'No previous total or removed subscale leaks into the prompt');
  assert.equal(new Set(analysis.sources.map(s => s.evidenceCode)).size, 2);
  for (const priority of analysis.priorities) {
    assert(priority.evidenceCodes.every(code => analysis.sources.some(s => s.evidenceCode === code)));
  }
  assert(analysis.summary.length >= 40);
  await expect(page.locator('.assessment-ai-evidence')).toContainText('Hábitos de sueño');
  await expect(page.locator('.assessment-ai-evidence')).toContainText('Estrés percibido');
  await expect(page.getByText('Análisis parcial', { exact: true })).toBeVisible();
  const cached = await page.request.get(`${api}/api/v1/health-tests/me/profile-analysis?language=es`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(cached.status(), 200);
  assert.equal((await cached.json()).sourceRevision, analysis.sourceRevision);
  await openResults();
  await expect(page.locator('.assessment-ai-summary')).toHaveText(analysis.summary);
  assert.equal(posts.length, 1, 'Reopening reads saved analysis without a new model call');
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, `profile-ai-${width}.png`), fullPage: true });
  }
  await writeFile(path.join(out, 'analysis.json'), JSON.stringify(analysis, null, 2));
  await writeFile(path.join(out, 'result.json'), JSON.stringify({ passed: true, api: 'real local', database: 'isolated PostgreSQL', model: process.env.COP_E2E_AI_MODE ?? 'configured live provider', auth: 'signed synthetic QA session', cacheReused: true, sources: analysis.sources.length }));
  console.log('PASS: real analysis, latest evaluations, evidence, cache and mobile layouts');
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(out, 'failure.json'), JSON.stringify({ error: error.message, posts }, null, 2));
  throw error;
} finally { await browser.close(); }
