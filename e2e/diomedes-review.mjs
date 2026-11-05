/** Recorridos de revisión contra app, Gateway, Auth, API y PostgreSQL reales.
 * COP_E2E_FIXTURES contiene únicamente credenciales de una base copp_review_.
 * Los transportes externos de SOS se reemplazan solo en CoppAddresd.E2EHost.
 * Evidencia y credenciales permanecen en un directorio temporal. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const fixturesPath = process.env.COP_E2E_FIXTURES;
if (!fixturesPath) throw new Error('Configura COP_E2E_FIXTURES con las cuentas aisladas de prueba.');
const fixtures = JSON.parse(await readFile(fixturesPath, 'utf8'));
const output = process.env.COP_E2E_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'diomedes-e2e-'));
const origin = process.env.COP_E2E_APP_URL ?? 'http://localhost:5173';
const browser = await chromium.launch();
const report = [];
async function patientContext() {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 },
    geolocation: { latitude: 4.711, longitude: -74.0721 }, permissions: ['geolocation'] });
  const login = await context.request.post(origin + '/api/auth/login', { data: {
    email: fixtures.patients[Number(process.env.COP_E2E_PATIENT ?? 0)].email, password: fixtures.patients[Number(process.env.COP_E2E_PATIENT ?? 0)].password,
    application: 'app', rememberMe: true,
  } });
  assert.equal(login.status(), 200, 'La sesión real del paciente debe estar disponible.');
  const { accessToken } = await login.json();
  const auth = { Authorization: `Bearer ${accessToken}` };
  const active = await context.request.get(origin + '/api/v1/sos/alerts/active', { headers: auth });
  if (active.status() === 200) {
    const previous = await active.json();
    await context.request.post(origin + `/api/v1/sos/alerts/${previous.id}/cancel`, { headers: auth });
  }
  const page = await context.newPage(); await page.goto(origin);
  await page.getByText(/Hola,/).waitFor();
  return { context, page, auth };
}
async function check(name, action) {
  if (process.env.COP_E2E_CASE && !name.includes(process.env.COP_E2E_CASE)) return;
  const { context, page, auth } = await patientContext();
  try { await action(page, context, auth); report.push({ name, result: 'passed' });
    await page.screenshot({ path: path.join(output, name + '-verified.png'), fullPage: true }); }
  catch (error) { report.push({ name, result: 'failed', error: error.message });
    await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }); }
  finally { await context.close(); }
}
async function eventually(read, predicate, message, timeout = 15000) {
  const until = Date.now() + timeout;
  do { const value = await read(); if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 200)); } while (Date.now() < until);
  throw new Error(message);
}
async function activateFromUi(page) {
  await page.getByRole('button', { name: 'SOS', exact: true }).first().click();
  await page.getByRole('button', { name: 'Activar SOS ahora', exact: true }).click();
  const activation = page.waitForResponse(response => response.url().endsWith('/api/v1/sos/alerts') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sí, activar mi SOS', exact: true }).click();
  const response = await activation; assert.equal(response.status(), 201);
  const alert = await response.json();
  return { alert, request: response.request() };
}
await check('sos-both-contacts', async (page, context, auth) => {
  const { alert, request } = await activateFromUi(page);
  const destinations=fixtures.patients[Number(process.env.COP_E2E_PATIENT ?? 0)].phoneNumbers??['+12025550101','+12025550102'];
  assert.equal(alert.recipients?.length, 2, 'La alerta debe guardar ambos destinatarios.');
  const ledger = await eventually(async () => {
    const body = await readFile(path.join(output, 'emergency-ledger.jsonl'), 'utf8').catch(() => '');
    return body.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }, rows => ['sms', 'voice'].every(channel => destinations.every(destination => rows.some(row => row.channel === channel && row.destination === destination && row.callback?.includes(alert.id)))),
  'SMS y voz deben intentarse para ambos contactos.');
  assert(ledger.length >= 4);
  const replay=await context.request.post(request.url(), { headers: { ...auth, 'Idempotency-Key':request.headers()['idempotency-key'] }, data:request.postDataJSON() });
  assert.equal(replay.status(),200);assert.equal((await replay.json()).id,alert.id);
  await page.getByText('Contacto de respaldo', { exact: true }).waitFor();
  await eventually(()=>page.locator('.sos-recipient-row').last().textContent(),text=>text?.includes('Aceptado por el proveedor')&&text?.includes('Llamada solicitada'),'El respaldo debe reflejar el estado final.');
  await page.locator('.sos-recipient-row').last().scrollIntoViewIfNeeded();
});
await check('sos-primary-failure', async (page, context, auth) => {
  const fault=path.join(output,'fail-primary');await writeFile(fault,'isolated emergency transport failure');
  try {
    const {alert}=await activateFromUi(page);
    const saved=await eventually(async()=>{
      const response=await context.request.get(origin+`/api/v1/sos/alerts/${alert.id}`,{headers:auth});assert.equal(response.status(),200);return response.json();
    },value=>value.recipients?.[0].smsChannelStatus==='Fallido'&&value.recipients?.[1].smsChannelStatus==='Enviado'&&value.recipients?.[1].voiceChannelStatus==='Enviado','El fallo del principal no debe impedir SMS/voz al respaldo.');
    assert.equal(saved.recipients[0].voiceChannelStatus,'Fallido');
    await page.getByText('Contacto de respaldo',{exact:true}).waitFor();
    await eventually(async()=>{
      const text=await page.locator('.sos-recipient-row').last().textContent();
      await writeFile(path.join(output,'sos-secondary-ui-state.txt'),text??'');return text??'';
    },text=>text.includes('Aceptado por el proveedor')&&text.includes('Llamada solicitada'),'El estado del respaldo debe aparecer en la app.');
    await page.locator('.sos-recipient-row').last().scrollIntoViewIfNeeded();
  } finally { await unlink(fault).catch(()=>{}); }
});
await check('profile-ai-guidance', async page => {
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await page.getByText('Batería de evaluación', { exact: true }).click();
  await page.getByRole('button', { name: 'Resultados de tus evaluaciones', exact: true }).click();
  const generate = page.getByRole('button', { name: 'Analizar mis resultados con Vita', exact: true });
  if (await generate.count()) await generate.click({ timeout: 5000 });
  await page.getByRole('heading', { name: 'Vita te explica tus resultados', exact: true }).waitFor();
  const narrative = page.locator('.assessment-ai-narrative');
  await eventually(() => narrative.innerText(), value => value.length > 120,
    'Debe aparecer una explicación humana obtenida desde la IA, no solo un contador.', 90000);
});
await check('nutrition-preparation-progress', async page => {
  await page.getByRole('button', { name: /Nutrición/ }).first().click();
  await page.locator('ion-segment-button[value="indicaciones"]').click();
  await page.getByRole('heading', { name: 'Así estamos creando tu plan', exact: true }).waitFor({ timeout: 5000 });
  await page.getByRole('list', { name: 'Pasos de tu plan nutricional' }).waitFor();
  await page.getByText('Revisión de tu nutricionista', { exact: true }).waitFor();
});
await browser.close();
await writeFile(path.join(output, 'app-e2e-results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.some(item => item.result === 'failed')) process.exitCode = 1;
