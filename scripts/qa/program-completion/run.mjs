/** Playwright privado contra límite HTTP controlado; no acredita persistencia BACK. */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const origin = process.env.QA410_ORIGIN ?? 'http://127.0.0.1:5192'
const output = resolve(process.env.QA410_OUTPUT ?? '.artifacts/program-completion')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const completion = { enrollmentId: 'qa-finished', templateName: 'Programa COPP-ADRESD', timezone: 'America/Bogota', startLocalDate: '2026-08-24', endLocalDate: '2026-11-14', completedAt: '2026-11-15T05:00:00Z', totalDays: 83, completedWeeks: 12, daysWithActivity: 60, perfectDays: 40, tasksCompleted: 200, xpEarned: 18000, longestStreak: 15, canStartNewProgram: true }
const snapshot = { enrollmentId: 'qa-new', template: { id: 'qa-template', code: 'qa', name: 'Programa COPP-ADRESD', totalWeeks: 12, currentWeekNumber: 1, currentWeekStatus: 'Active', currentWeekStartDateLocal: '2026-11-15', currentWeekEndDateLocal: '2026-11-21' }, todayLocalDate: '2026-11-15', todayTasks: [], todayPoints: 0, todayBonusAvailable: false, todayPointsMax: 0, xp: { balance: 0, level: '1', nextLevelAt: 1000 }, streak: { current: 0, longest: 0, freezesRemaining: 0, multiplierActive: 1 }, nextMilestoneDays: 3, calendar: [] }

async function setup(page, lang, width, mode = 'ready') {
  const state = { mode, posts: 0, reads: 0, active: false, requests: [], errors: [], warnings: [], bodies: [] }
  page.on('pageerror', error => state.errors.push(error.message))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) state.warnings.push(message.text()) })
  const source = await (await page.request.get(origin + '/src/pages/ProgramPage.tsx')).text()
  const main = await (await page.request.get(origin + '/src/main.tsx')).text()
  const dependency = (text, name) => text.match(new RegExp('from "([^"\\n]*/' + name + '\\.js\\?[^"\\n]*)"'))?.[1]
  const react = dependency(source, 'react'), ionic = dependency(source, '@ionic_react'), query = dependency(source, '@tanstack_react-query'), dom = dependency(main, 'react-dom_client')
  assert(react && ionic && query && dom, 'Dependencias de Vite disponibles')
  const mocks = {
    '/src/context/AppContext.tsx': `export const useApp=()=>({user:{nombre:'Paciente QA',id:'qa-self'},screen:'prog',program:{},pointsToday:0,navigate:id=>{window.qaNavigation=id},openTests:()=>{},showToast:()=>{},completeStep:()=>{},streak:0,programWeek:1,weekCheckins:[],wearableConnected:false});`,
    '/src/hooks/useProgramScores.ts': 'export const useProgramScores=()=>({scores:undefined,isLoading:false,isError:false,refetch:()=>{}});',
    '/src/hooks/useProgramCalendar.ts': 'export const useProgramCalendar=()=>({data:undefined});',
    '/src/hooks/useScoresHistory.ts': 'export const useScoresHistory=()=>({history:undefined,isLoading:false,isError:false,refetch:()=>{}});',
  }
  await page.route('**/src/**', async route => {
    const body = mocks[new URL(route.request().url()).pathname]
    if (body) await route.fulfill({ contentType: 'application/javascript', body }); else await route.continue()
  })
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    state.requests.push({ path, method: request.method(), language: request.headers()['x-app-language'], bearer: !!request.headers().authorization })
    if (path === '/api/v1/program/me/snapshot') return state.active ? route.fulfill({ json: snapshot }) : route.fulfill({ status: 404, json: { detail: 'NO_ACTIVE_ENROLLMENT: no active program' } })
    if (path === '/api/v1/program/me/completion') {
      state.reads++
      assert.equal(request.method(), 'GET'); assert.equal(new URL(request.url()).search, ''); assert.equal(request.postData(), null)
      if (state.mode === 'loading') await new Promise(resolve => { state.release = resolve })
      if (state.mode === 'error') return route.fulfill({ status: 503, json: { detail: 'Controlled failure' } })
      return route.fulfill({ json: { completion: state.mode === 'empty' ? null : { ...completion, canStartNewProgram: state.mode !== 'blocked' && !state.active } } })
    }
    if (path === '/api/v1/program/enrollments/me') {
      state.posts++
      const body = request.postDataJSON(); state.bodies.push(body)
      assert.equal(body.patientId, null); assert.equal(body.templateId, null); assert.equal(body.timezone, 'America/Bogota')
      assert.match(body.startLocalDate, /^\d{4}-\d{2}-\d{2}$/)
      if (state.mode === 'conflict') { state.active = true; return route.fulfill({ status: 409, json: { detail: 'Already enrolled' } }) }
      if (state.mode === 'post-error') return route.fulfill({ status: 503, json: { detail: 'Controlled write failure' } })
      if (state.mode === 'pending-post') await new Promise(resolve => { state.releasePost = resolve })
      state.active = true
      return route.fulfill({ status: 201, json: { id: 'qa-new', status: 'Active', patientId: 'qa-patient', templateId: 'qa-template' } })
    }
    if (path.includes('/health-tests/')) return route.fulfill({ json: [] })
    throw Error('Ruta inesperada: ' + path)
  })
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>QA 4.10</title>${['core','normalize','structure','typography','padding','flex-utils','display'].map(f=>'<link rel="stylesheet" href="/node_modules/@ionic/react/css/'+f+'.css">').join('')}<link rel="stylesheet" href="/src/theme/variables.css"><link rel="stylesheet" href="/src/theme/global.css"></head><body><div id="root"></div><script type="module">
  import React from '${react}';import ReactDOM from '${dom}';import {IonApp,setupIonicReact} from '${ionic}';import {QueryClient,QueryClientProvider} from '${query}';import {I18nProvider} from '/src/i18n/I18nContext.tsx';import {ProgramPage} from '/src/pages/ProgramPage.tsx';import {programKeys} from '/src/hooks/queryKeys.ts';
  setupIonicReact({mode:'ios'});localStorage.setItem('antares_lang','${lang}');const token=btoa('{}')+'.'+btoa(JSON.stringify({sub:'qa-self',aud:'app',exp:4102444800}))+'.fixture';sessionStorage.setItem('copp_access_token',token);
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});window.qaRetry=()=>client.invalidateQueries({queryKey:programKeys.all});
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(IonApp,null,React.createElement(QueryClientProvider,{client},React.createElement(I18nProvider,null,React.createElement('div',{className:'app-stage'},React.createElement('div',{className:'app-shell'},React.createElement(ProgramPage)))))));
  </script></body></html>`
  await page.route('**/qa-410', route => route.fulfill({ contentType: 'text/html', body: html }))
  await page.setViewportSize({ width, height: 844 })
  await page.goto(origin + '/qa-410')
  return state
}

try {
  for (const lang of ['es', 'en']) for (const width of [320, 390, 1440]) {
    const context = await browser.newContext(), page = await context.newPage()
    const state = await setup(page, lang, width)
    await page.getByTestId('program-completion').waitFor()
    await page.waitForLoadState('networkidle')
    const initialWarnings = state.warnings.splice(0)
    assert(initialWarnings.every(text => text.includes('404 (Not Found)')))
    assert.equal(state.posts, 0)
    const text = await page.getByTestId('program-completion').innerText()
    assert(text.includes('40') && text.includes('83') && text.includes('200') && text.includes('15'))
    assert(!text.includes('HbA1c') && !text.includes('IMC'))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: resolve(output, `${lang}-${width}-summary.png`), fullPage: true, animations: 'disabled' })
    await page.getByTestId('program-new-open').click()
    await page.getByTestId('program-new-confirm').waitFor()
    await page.screenshot({ path: resolve(output, `${lang}-${width}-confirm.png`), animations: 'disabled' })
    await page.getByRole('button', { name: lang === 'es' ? 'Todavía no' : 'Not yet', exact: true }).click()
    await page.locator('ion-modal').waitFor({ state: 'hidden' })
    assert.equal(state.posts, 0)
    await page.getByRole('button', { name: lang === 'es' ? 'Ver mi evolución' : 'View my progress', exact: true }).click()
    await page.getByRole('button', { name: lang === 'es' ? 'Volver al resumen' : 'Back to summary', exact: true }).click()
    state.mode = 'pending-post'
    await page.getByTestId('program-new-open').click()
    await page.getByTestId('program-new-confirm').click()
    await page.waitForFunction(() => document.querySelector('[data-testid="program-new-confirm"]')?.disabled === true)
    assert.equal(state.posts, 1)
    state.releasePost()
    await page.getByTestId('program-new-started').waitFor()
    await page.screenshot({ path: resolve(output, `${lang}-${width}-started.png`), animations: 'disabled' })
    assert.equal(state.posts, 1)
    await page.getByRole('button', { name: lang === 'es' ? 'Ir al inicio' : 'Go to Home', exact: true }).click()
    assert.equal(await page.evaluate(() => window.qaNavigation), 'home')
    assert.deepEqual(state.errors, [])
    assert.deepEqual(state.warnings, [])
    assert(state.requests.filter(r=>r.path.endsWith('/completion')).every(r=>r.language===lang && r.bearer))
    results.push({ lang, width, case: 'summary/cancel/evolution/start/home', posts: state.posts, errors: state.errors, warnings: state.warnings, initialExpectedWarnings: initialWarnings, requests: state.requests, body: state.bodies[0] })
    await context.close()
  }
  for (const mode of ['blocked', 'loading', 'error', 'empty', 'conflict', 'post-error']) {
    const context = await browser.newContext(), page = await context.newPage()
    const state = await setup(page, 'es', 390, mode)
    if (mode === 'loading') {
      await page.locator('[data-program-state="loading"]').waitFor()
      assert.equal(await page.getByTestId('program-new-open').count(), 0)
      state.mode = 'ready'; state.release()
    } else if (mode === 'error') {
      await page.getByText('No pudimos consultar el cierre de tu programa. Vuelve a intentarlo.', { exact: true }).waitFor()
      state.mode = 'ready'; await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
    } else if (mode === 'empty') {
      await page.getByText('Tu plan empieza contigo', { exact: true }).waitFor()
      assert.equal(await page.getByTestId('program-completion').count(), 0)
    }
    if (mode !== 'empty') await page.getByTestId('program-completion').waitFor()
    if (mode === 'blocked') assert.equal(await page.getByTestId('program-new-open').count(), 0)
    if (mode === 'conflict' || mode === 'post-error') {
      await page.getByTestId('program-new-open').click(); await page.getByTestId('program-new-confirm').click()
      await page.getByRole('alert').waitFor()
      assert.equal(await page.getByTestId('program-new-open').count(), 0)
      await page.getByRole('button', { name: 'Comprobar estado', exact: true }).click()
      if (mode === 'conflict') await page.getByTestId('program-completion').waitFor({ state: 'hidden' })
      else await page.getByTestId('program-new-open').waitFor()
      assert.equal(state.posts, 1)
    }
    assert.deepEqual(state.errors, [])
    await page.screenshot({ path: resolve(output, `${mode}.png`) })
    results.push({ case: mode, posts: state.posts, reads: state.reads, requests: state.requests, errors: state.errors, warnings: state.warnings })
    await context.close()
  }
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify({ cases: results.length, screenshots: 24, pageErrors: results.flatMap(r=>r.errors).length, output }))
} finally { await browser.close() }
