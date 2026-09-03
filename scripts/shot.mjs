/**
 * Captura pantallas de la app en el viewport del teléfono para revisar el
 * diseño sin abrir el navegador a mano.
 *
 *   node scripts/shot.mjs <nombre> [pasos] [ancho]
 *
 * "pasos" es una lista separada por comas de acciones sobre la demo:
 *   login   → entra con las credenciales demo
 *   prog    → abre el módulo de protocolo diario
 *   tests   → salta la batería de tests de salud
 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT_DIR = 'C:/Users/ByronFontalvo/antares-paciente/.shots'

const URL = process.env.SHOT_URL ?? 'http://localhost:5173'
const name = process.argv[2] ?? 'shot'
const steps = (process.argv[3] ?? '').split(',').filter(Boolean)
const width = Number(process.argv[4] ?? 430)

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function clickText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, txt) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim().includes(txt)),
    selector,
    text,
  )
  const el = handle.asElement()
  if (!el) throw new Error(`No encontré "${text}" (${selector})`)
  await el.click()
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width, height: 920, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 40000 })
  await wait(1200)

  for (const step of steps) {
    if (step === 'login') {
      await page.waitForSelector('#login-id input', { timeout: 10000 })
      await page.type('#login-id input', '12345678')
      await page.type('#login-password input', 'demo1234')
      await wait(200)
      await clickText(page, 'ion-button.cta-pill', '')
      await wait(1600)
    }
    if (step === 'tests') {
      await clickText(page, 'button, ion-button', 'Después').catch(() => {})
      await wait(1200)
    }
    if (step === 'prog') {
      await page.click('.hm-wheel-card')
      await wait(1600)
    }
    if (step.startsWith('tab:')) {
      await clickText(page, 'ion-segment-button', step.slice(4))
      await wait(1200)
    }
    if (step === 'activar') {
      await clickText(page, '.auth-alt-link', 'Activa')
      await wait(900)
    }
    if (step === 'scroll') {
      await page.evaluate(() => {
        const el = document.querySelector('.screen-scroll')
        if (el) el.scrollTop = el.scrollHeight
      })
      await wait(900)
    }
    await wait(400)
  }

  await wait(700)
  await page.screenshot({ path: `${OUT_DIR}/${name}.png` })
  console.log(`${OUT_DIR}/${name}.png`)
  await browser.close()
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
