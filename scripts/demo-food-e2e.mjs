/**
 * Demo E2E: onboarding → app → Nutrición → "Seleccionar imagen" → análisis REAL
 * del backend (food-ai → USDA → PostgreSQL → NutritionCalculator).
 *
 * Uso: node scripts/demo-food-e2e.mjs [imagen]
 * Requiere: food-ai (8010) + Api (5122) + Gateway (5080) + dev server (5173).
 */
import { chromium } from 'playwright'
import { resolve } from 'node:path'

const IMAGE = resolve(process.argv[2] ?? 'C:/Users/Carlos Cortina/Documents/CoppAddresd/food-ai-service/datasets/food-us-v0.1/images/train/pizza_001.jpg')
const BASE = 'http://localhost:5173'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.setDefaultTimeout(15000)

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })

  // ── Onboarding (OTP demo 123456) ──
  const continueBtn = page.getByText('Continuar', { exact: true }).first()
  for (let i = 0; i < 5; i++) {
    const btn = page.getByRole('button', { name: /continuar|siguiente|empezar/i }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {})
    await page.waitForTimeout(400)
  }
  // OTP
  const otp = page.locator('input').first()
  if (await otp.isVisible().catch(() => false)) {
    await otp.fill('123456')
    await page.getByRole('button', { name: /verificar|continuar/i }).first().click().catch(() => {})
    await page.waitForTimeout(600)
  }
  // Saltar tests de salud
  const skip = page.getByText(/despu[eé]s|omitir|saltar/i).first()
  if (await skip.isVisible().catch(() => false)) {
    for (let i = 0; i < 3; i++) {
      await skip.click().catch(() => {})
      await page.waitForTimeout(400)
    }
  }

  // ── Ir a Nutrición ──
  const nut = page.getByText('Nutrición', { exact: true }).first()
  await nut.click().catch(() => {})
  await page.waitForTimeout(800)

  // ── Seleccionar imagen (fallback desktop de la demo) ──
  const selectBtn = page.getByText('Seleccionar imagen').first()
  await selectBtn.click()
  await page.waitForTimeout(300)
  const fileInput = page.locator('input[type="file"][accept="image/*"]')
  await fileInput.setInputFiles(IMAGE)

  // ── Esperar análisis real (DINO puede tardar 10-17 s) ──
  await page.getByText(/analizando tu comida/i).first().waitFor({ timeout: 8000 }).catch(() => {})
  await page.getByText('Alimentos detectados').first().waitFor({ timeout: 60_000 })

  // ── Resultado ──
  const text = await page.locator('body').innerText()
  const hasFoods = text.includes('Alimentos detectados')
  const kcal = text.match(/(\d[\d,]*)\s*kcal/)
  console.log('=== RESULTADO DEMO ===')
  console.log('alimentos detectados:', hasFoods)
  console.log('kcal encontradas:', kcal ? kcal[1] : 'N/A')
  console.log(text.split('\n').filter((l) => /kcal|g \(|alimentos|pizza|total/i.test(l)).slice(0, 12).join(' | '))

  // ── Screenshot ──
  await page.screenshot({ path: resolve('docs/demo-nutrition-result.png'), fullPage: false })
  console.log('screenshot: docs/demo-nutrition-result.png')
} finally {
  await browser.close()
}