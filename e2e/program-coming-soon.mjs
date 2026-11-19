/** Comprueba el texto visible con respuestas HTTP sintéticas y sin escrituras reales. */
import { chromium, expect, webkit } from 'playwright/test'
import assert from 'node:assert/strict'

const origin = process.env.COP_E2E_APP_URL ?? 'http://127.0.0.1:5188'
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
const browser = await (process.env.COP_E2E_BROWSER === 'webkit' ? webkit : chromium).launch()
const patientId = '11111111-1111-4111-8111-111111111111'
const token = 'x.' + Buffer.from(JSON.stringify({ sub: patientId, exp: 2000000000 })).toString('base64url') + '.x'
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const snapshot = {
  enrollmentId: patientId,
  template: { id: patientId, code: 'QA', name: 'QA', totalWeeks: 12, currentWeekNumber: 1,
    currentWeekStatus: 'Active', currentWeekStartDateLocal: today, currentWeekEndDateLocal: today },
  todayLocalDate: today,
  todayTasks: ['podcast', 'vitals', 'nut', 'ejercicio', 'nutraceutico', 'emocional'].map(taskCode => ({
    taskCode, title: '', points: 80, status: 'Pending',
  })),
  todayPoints: 0, todayPointsMax: 370, todayBonusAvailable: false, dailyBonusAmount: 50,
  xp: { balance: 0, level: 'Semilla', nextLevelAt: 2000 },
  streak: { current: 0, longest: 0, nbWeekDays: Array(7).fill(false) },
  calendar: [], upcoming: [],
}

async function expectFullLabels(page, selector, message) {
  const labels = page.locator(selector)
  await expect(labels).toHaveCount(2)
  for (const label of await labels.all()) {
    await expect(label).toHaveText(message)
    await expect.poll(() => label.evaluate(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const lines = [...range.getClientRects()]
      const card = element.closest('button')?.getBoundingClientRect()
      const badge = element.getBoundingClientRect()
      if (!card || !lines.length) return false
      return lines.every(line =>
        line.left >= Math.max(0, badge.left, card.left) - 1 &&
        line.right <= Math.min(innerWidth, badge.right, card.right) + 1 &&
        line.top >= badge.top - 1 && line.bottom <= badge.bottom + 1,
      )
    }), { message: `${message} fully rendered in ${selector}`, timeout: 2500 }).toBe(true)
  }
}

try {
  for (const [language, message] of [['es', 'Próximamente'], ['en', 'Coming soon']]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' })
    const activityWrites = []
    await page.addInitScript(lang => localStorage.setItem('antares_lang', lang), language)
    await page.route('**/api/**', route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      const reply = json => route.fulfill({ json })
      if (path === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 86400 })
      if (path === '/api/auth/me') return reply({ id: patientId, firstName: 'Paciente', lastName: 'QA', roles: ['Patient'], permissions: [] })
      if (path === '/api/v1/me/patient-profile') return reply({ patientId, firstName: 'Paciente', lastName: 'QA', documentNumber: 'QA' })
      if (path === '/api/v1/me/capabilities') return reply({ modules: {} })
      if (path === '/api/v1/program/me/snapshot') return reply(snapshot)
      if (!['GET', 'HEAD'].includes(request.method()) && /tasks\/complete|exercise|podcast/.test(path)) activityWrites.push(path)
      return route.fulfill({ status: 404, json: {} })
    })

    await page.goto(origin)
    for (const width of [390, 320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 })
      await expectFullLabels(page, '.hm-soon-badge', message)
    }
    for (const card of await page.locator('.hm-soon-card').all()) {
      await card.click()
      const notice = page.getByRole('alertdialog', { name: message })
      await expect(notice).toBeVisible()
      await notice.getByRole('button').click()
      await expect(notice).toBeHidden()
    }
    await page.locator('.hm-day-link').click()
    for (const width of [390, 320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 })
      await expectFullLabels(page, '.pcard-availability', message)
    }
    await expect(page.locator('audio, .lesson-podcast, .lesson-ejercicio')).toHaveCount(0)
    assert.deepEqual(activityWrites, [])
    await page.close()
  }
  console.log('Coming-soon labels fit Home and the daily protocol in Spanish and English.')
} finally {
  await browser.close()
}
